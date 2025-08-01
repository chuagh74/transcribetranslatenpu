"""
server/routers/transcribe_ws.py
───────────────────────────────
Real-time transcription endpoint that uses *Silero* VAD via the pre-existing
`server.services.VAD.FixedVADIterator`.

Data path:
    mic → websocket → FixedVADIterator (512-sample hops)
        • 'start' event  – begin buffering speech bytes
        • 'end' event    – ≥500 ms of silence → flush to Whisper
"""

import json
import logging
import urllib.parse
import uuid
import time
from collections import deque

import numpy as np
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.concurrency import run_in_threadpool
from starlette.websockets import WebSocketState

from server.services.transcribe_service import transcribe_audio_file
from server.pipelines.VAD import VADSettings

router = APIRouter()
logger = logging.getLogger("ws_transcription")

FRAME_SAMPLES = 512                 # Silero expects exactly 512 samples
FRAME_BYTES = FRAME_SAMPLES * 2     # 16-bit mono
SAMPLE_RATE = 16_000

# --------------------------------------------------------------------------- #
# Silero VAD instance from settings                                           #
# --------------------------------------------------------------------------- #
VAD = VADSettings.SILERO_VAD          # already-initialised FixedVADIterator

# --------------------------------------------------------------------------- #
# WebSocket                                                                   #
# --------------------------------------------------------------------------- #
@router.websocket("/v1/realtime/transcription_sessions")
async def websocket_transcribe(websocket: WebSocket):
    session_id = str(uuid.uuid4())
    start_time = time.time()
    
    await websocket.accept()
    logger.debug(f"[{session_id}] WebSocket connection accepted from {websocket.client}")

    # ---- parse query -------------------------------------------------------
    try:
        qs = urllib.parse.parse_qs(websocket.scope["query_string"].decode())
    except Exception as e:
        logger.error(f"[{session_id}] Failed to parse query string: {e}")
        await websocket.close(code=1002)
        return
    
    src_lang = qs.get("src_lang", ["en"])[0]
    logger.debug(f"[{session_id}] New transcription session – lang={src_lang}, client={websocket.client}")

    # ---- state -------------------------------------------------------------
    audio_buf = bytearray()          # incoming raw bytes
    speech_buf = bytearray()         # bytes belonging to current utterance
    pending_frames: deque[bytes] = deque()  # for VAD feed (float32)

    # Metrics
    total_bytes_received = 0
    total_frames_processed = 0
    vad_events_count = 0
    transcription_attempts = 0
    successful_transcriptions = 0

    VAD.reset_states()
    logger.debug(f"[{session_id}] VAD states reset, ready to receive audio")

    # --------------------------------------------------------------------- #
    try:
        while websocket.client_state == WebSocketState.CONNECTED:
            try:
                msg = await websocket.receive()
            except RuntimeError as e:
                logger.debug(f"[{session_id}] WebSocket receive error (likely closed): {e}")
                break

            # control messages (ignored for now)
            if txt := msg.get("text"):
                logger.debug(f"[{session_id}] Received text message: {txt[:100]}...")
                try:
                    json.loads(txt)
                except json.JSONDecodeError:
                    logger.warning(f"[{session_id}] Ignoring non-JSON text message")
                continue

            data = msg.get("bytes")
            if not data:
                logger.debug(f"[{session_id}] Received message without bytes data")
                continue

            total_bytes_received += len(data)
            audio_buf.extend(data)
            
            if total_bytes_received % (1024 * 10) == 0:  # Log every 10KB
                logger.debug(f"[{session_id}] Received {total_bytes_received} total bytes, buffer: {len(audio_buf)} bytes")

            # ---------------------------------------------------------- #
            # Chunk into 512-sample (1024-byte) windows for Silero VAD   #
            # ---------------------------------------------------------- #
            while len(audio_buf) >= FRAME_BYTES:
                frame_bytes = bytes(audio_buf[:FRAME_BYTES])
                del audio_buf[:FRAME_BYTES]
                total_frames_processed += 1

                # int16 → float32 in [-1,1] for Silero model
                pcm = np.frombuffer(frame_bytes, dtype=np.int16).astype(np.float32) / 32768.0
                
                # Check audio levels for debugging
                audio_level = np.max(np.abs(pcm))
                if total_frames_processed % 100 == 0:  # Log every 100 frames
                    logger.debug(f"[{session_id}] Frame {total_frames_processed}: audio level = {audio_level:.4f}")
                
                vad_evt = VAD(pcm)

                if vad_evt:
                    vad_events_count += 1
                    logger.debug(f"[{session_id}] VAD event #{vad_events_count}: {vad_evt} (frame {total_frames_processed})")

                if vad_evt and "start" in vad_evt:
                    logger.debug(f"[{session_id}] Speech START detected - beginning utterance buffer")
                    speech_buf.extend(frame_bytes)  # start buffering
                elif vad_evt and "end" in vad_evt:
                    # add final padding frame then flush
                    speech_buf.extend(frame_bytes)
                    utterance_duration = len(speech_buf) / (SAMPLE_RATE * 2)  # duration in seconds
                    logger.debug(f"[{session_id}] Speech END detected - flushing {len(speech_buf)} bytes ({utterance_duration:.2f}s) to transcription")
                    try:
                        transcription_attempts += 1
                        success = await _flush_utterance(websocket, bytes(speech_buf), src_lang, session_id, transcription_attempts)
                        if success:
                            successful_transcriptions += 1
                    except RuntimeError as e:
                        logger.error(f"[{session_id}] Error during utterance flush: {e}")
                        break
                    speech_buf.clear()
                elif VAD.triggered:
                    speech_buf.extend(frame_bytes)
                    if len(speech_buf) % (SAMPLE_RATE * 2) == 0:  # Log every second of speech
                        duration = len(speech_buf) / (SAMPLE_RATE * 2)
                        logger.debug(f"[{session_id}] Buffering speech: {duration:.1f}s ({len(speech_buf)} bytes)")
                # else: silence outside utterance – ignored

    except WebSocketDisconnect:
        logger.debug(f"[{session_id}] Client disconnected")
    except Exception as exc:  # pragma: no cover
        logger.error(f"[{session_id}] Websocket loop error: {exc}", exc_info=True)
    finally:
        # Log session summary
        session_duration = time.time() - start_time
        logger.debug(f"[{session_id}] Session ended after {session_duration:.2f}s")
        logger.debug(f"[{session_id}] Stats: {total_bytes_received} bytes, {total_frames_processed} frames, {vad_events_count} VAD events")
        logger.debug(f"[{session_id}] Transcription attempts: {transcription_attempts}, successful: {successful_transcriptions}")
        
        # Clean up
        if websocket.client_state == WebSocketState.CONNECTED:
            try:
                await websocket.close()
            except:
                pass

# --------------------------------------------------------------------------- #
# Whisper helper                                                              #
# --------------------------------------------------------------------------- #
async def _flush_utterance(websocket: WebSocket, audio: bytes, lang: str, session_id: str, attempt_num: int) -> bool:
    if not audio:
        logger.debug(f"[{session_id}] Attempt #{attempt_num}: No audio data to transcribe")
        return False

    utterance_duration = len(audio) / (SAMPLE_RATE * 2)
    logger.debug(f"[{session_id}] Attempt #{attempt_num}: Starting transcription of {len(audio)} bytes ({utterance_duration:.2f}s), lang={lang}")
    
    transcribe_start = time.time()
    
    try:
        # Model call - logging will come from transcribe_service.py
        result = await run_in_threadpool(
            transcribe_audio_file,
            audio,              # raw PCM16
            beam_size=1,
            initial_prompt="",
            language=lang,
        )
        
        transcribe_time = time.time() - transcribe_start
        logger.debug(f"[{session_id}] Attempt #{attempt_num}: Transcription completed in {transcribe_time:.2f}s")
        
        text = result.get("text", "").strip()
        
        if not text:
            logger.debug(f"[{session_id}] Attempt #{attempt_num}: Transcription returned empty text")
            return False
        
        payload = {
            "event_id": str(uuid.uuid4()),
            "type": "conversation.item.input_audio_transcription.completed",
            "item_id": str(uuid.uuid4()),
            "content_index": 0,
            "transcript": text,
        }

        if websocket.client_state == WebSocketState.CONNECTED:
            await websocket.send_json(payload)
            logger.debug(f"[{session_id}] Attempt #{attempt_num}: Transcription result sent to client")
            return True
        else:
            logger.debug(f"[{session_id}] Attempt #{attempt_num}: WebSocket disconnected, cannot send result")
            return False
            
    except Exception as e:
        transcribe_time = time.time() - transcribe_start
        logger.error(f"[{session_id}] Attempt #{attempt_num}: Transcription failed after {transcribe_time:.2f}s: {e}", exc_info=True)
        return False
