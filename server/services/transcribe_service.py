# server/services/transcribe_service.py
import io
import logging
from typing import Optional, List, Dict, Any
import time
import wave

import numpy as np
import regex as re
from pydub import AudioSegment

from server.pipelines.Whisper import transcribe_audio_bytes as _whisper_transcribe_audio_bytes
from server.pipelines.VAD import VADSettings

import torch

logger = logging.getLogger(__name__)

# Use INFO level logging as configured in main.py

# -----------------------------------------------------------------------------
# Constants & globals
# -----------------------------------------------------------------------------
TARGET_SR = 16_000  # Whisper expects 16 kHz mono PCM
PCM_WIDTH = 2       # 16‑bit samples

_word_re = re.compile(r"(\p{Script=Han}|\w)")


def _bytes_to_mono_f32(audio_bytes: bytes) -> np.ndarray:
    """Convert raw PCM bytes to mono float32 samples."""
    logger.debug(f"Converting {len(audio_bytes)} bytes to mono float32")
    samples = np.frombuffer(audio_bytes, dtype=np.int16)
    float_samples = samples.astype(np.float32) / 32768.0
    logger.debug(f"Converted to {len(float_samples)} float32 samples, range: [{float_samples.min():.4f}, {float_samples.max():.4f}]")
    return float_samples


def _create_wav_from_pcm(pcm_bytes: bytes, sample_rate: int = TARGET_SR) -> bytes:
    """Create a WAV file from raw PCM bytes for Whisper pipeline compatibility."""
    logger.debug(f"Creating WAV file from {len(pcm_bytes)} PCM bytes")
    
    # Create a WAV file in memory
    wav_buffer = io.BytesIO()
    with wave.open(wav_buffer, 'wb') as wav_file:
        wav_file.setnchannels(1)  # mono
        wav_file.setsampwidth(2)  # 16-bit
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(pcm_bytes)
    
    wav_bytes = wav_buffer.getvalue()
    logger.debug(f"Created WAV file with {len(wav_bytes)} bytes")
    return wav_bytes


def _has_speech(audio: np.ndarray) -> bool:
    """Run VAD check on audio samples."""
    vad_start = time.time()
    
    vad = VADSettings.SILERO_VAD
    vad.reset_states()

    # Process in chunks that Silero expects
    chunk_size = 512
    speech_detected = False
    chunks_processed = 0
    
    for i in range(0, len(audio), chunk_size):
        chunk = audio[i : i + chunk_size]
        if len(chunk) < chunk_size:
            # Pad last chunk if needed
            chunk = np.pad(chunk, (0, chunk_size - len(chunk)))

        vad_evt = vad(chunk)
        chunks_processed += 1
        
        if vad_evt and "start" in vad_evt:
            speech_detected = True
            break

    # Removed VAD logging - only return the result
    return speech_detected


def transcribe_audio_bytes(
    audio_bytes: bytes,
    beam_size: int = 5,
    initial_prompt: Optional[str] = None,
    language: Optional[str] = None,
    temperature: float = 0.0,
    timestamp_granularities: Optional[List[str]] = None,
    include: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Top‑level helper: VAD‑gate, then delegate to Whisper service."""
    
    transcribe_start = time.time()
    duration_seconds = len(audio_bytes) / (TARGET_SR * PCM_WIDTH)
    
    logger.debug(f"Starting transcription of {len(audio_bytes)} bytes ({duration_seconds:.2f}s audio)")
    logger.debug(f"Parameters: beam_size={beam_size}, language={language}, temperature={temperature}")

    # 1. Pre‑flight speech detection to save GPU / NPU cycles
    logger.debug("Step 1: Converting audio to float32 for VAD")
    audio_f32 = _bytes_to_mono_f32(audio_bytes)
    
    logger.debug("Step 2: Running VAD speech detection")
    if not _has_speech(audio_f32):
        logger.debug("VAD found no speech – returning empty result.")
        return {"text": ""}

    logger.debug("VAD confirmed speech detected, proceeding to Whisper transcription")

    # 2. Convert raw PCM to WAV format for Whisper pipeline compatibility
    logger.debug("Step 3: Converting PCM to WAV format for Whisper")
    wav_bytes = _create_wav_from_pcm(audio_bytes, TARGET_SR)

    # 3. Whisper transcription - only pass language if not 'auto'
    logger.debug("Step 4: Preparing Whisper transcription parameters")
    kwargs = {
        "beam_size": beam_size,
        "initial_prompt": initial_prompt,
        "temperature": temperature,
        "timestamp_granularities": timestamp_granularities,
        "include": include,
    }
    if language and language.lower() != "auto":
        kwargs["language"] = language
        logger.debug(f"Using specified language: {language}")
    else:
        logger.debug("Using automatic language detection")

    logger.debug("Step 5: Calling Whisper transcription service")
    whisper_start = time.time()
    
    try:
        whisper_res = _whisper_transcribe_audio_bytes(wav_bytes, **kwargs)
        whisper_time = time.time() - whisper_start
        logger.debug(f"Whisper transcription completed in {whisper_time:.2f}s")
    except Exception as e:
        whisper_time = time.time() - whisper_start
        logger.error(f"Whisper transcription failed after {whisper_time:.2f}s: {e}", exc_info=True)
        return {"text": ""}

    text = whisper_res.get("text", "").strip()
    logger.debug(f"Raw Whisper output: '{text}' (length: {len(text)})")

    # 4. Heuristic post‑filter – mirror original behaviour
    logger.debug("Step 6: Applying post-processing filters")
    wc = len(_word_re.findall(text))
    logger.debug(f"Word count: {wc}")
    
    if wc <= 3:
        logger.debug(f"Filtering out result: too few words ({wc} <= 3)")
        text = ""
    elif wc >= 40:
        logger.debug(f"Filtering out result: too many words ({wc} >= 40)")
        text = ""
    else:
        logger.debug(f"Post-filter passed: {wc} words within acceptable range")

    result: Dict[str, Any] = {"text": text}

    # Preserve optional log‑prob field for API compatibility
    if include and "logprobs" in include:
        result["logprobs"] = whisper_res.get("logprobs", None)
        logger.debug("Including logprobs in result")

    total_time = time.time() - transcribe_start
    
    # INFO: Only log the final result - this is what we want to see
    if text:
        logger.info(f"Transcription result: '{text}' ({total_time:.2f}s)")
    else:
        logger.debug(f"Transcription completed in {total_time:.2f}s total. No text result.")
    
    return result


def transcribe_audio_file(
    audio_data: bytes,
    beam_size: int = 5,
    initial_prompt: Optional[str] = None,
    language: Optional[str] = None,
    temperature: float = 0.0,
    timestamp_granularities: Optional[List[str]] = None,
    include: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Simple wrapper that accepts any audio blob read from disk."""
    logger.debug("transcribe_audio_file called - delegating to transcribe_audio_bytes")
    return transcribe_audio_bytes(
        audio_data,
        beam_size=beam_size,
        initial_prompt=initial_prompt,
        language=language,
        temperature=temperature,
        timestamp_granularities=timestamp_granularities,
        include=include,
    )
