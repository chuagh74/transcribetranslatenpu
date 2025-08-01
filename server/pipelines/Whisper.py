# server/services/whisper.py
from __future__ import annotations

import io
import logging
from typing import Any, Dict, List, Optional, Sequence, Tuple

import numpy as np
import soundfile as sf

try:
    import librosa  # optional – only used when resampling
except ModuleNotFoundError:  # keep dependency optional
    librosa = None  # type: ignore

from server.config import stt_model  # the shared, already‑loaded model

logger = logging.getLogger(__name__)

TARGET_SR = 16_000  # Whisper expects 16 kHz mono PCM

def _to_f32_mono(buf: bytes) -> np.ndarray:
    """Decode common containers or raw PCM16LE → 16 kHz mono float32."""
    # Fast path for WebSocket streaming chunks (already PCM16LE)
    if len(buf) % 2 == 0 and len(buf) <= 4096:
        return np.frombuffer(buf, np.int16).astype(np.float32) / 32768

    # Fallback: try full‑featured decode (handles WAV / FLAC / OGG / MP3 …)
    audio, sr = sf.read(io.BytesIO(buf), dtype="float32")
    if audio.ndim == 2:  # stereo → mono
        audio = audio.mean(1)
    if sr != TARGET_SR:
        if librosa is None:
            raise RuntimeError("librosa required for resampling but not installed.")
        audio = librosa.resample(audio, sr, TARGET_SR)
    return audio.astype(np.float32)

def _transcribe(
    pcm: np.ndarray,
    *,
    beam_size: int,
    temperature: float,
    initial_prompt: Optional[str],
    language: Optional[str],
    word_ts: bool,
) -> Tuple[Sequence[Any], Any]:
    """Call the underlying model and always return ``(segments, info)``."""
    res = stt_model.transcribe(
        pcm,
        beam_size=beam_size,
        temperature=temperature,
        initial_prompt=initial_prompt,
        language=language,
        word_timestamps=word_ts,
    )

    if isinstance(res, tuple) and len(res) == 2:  # faster‑whisper
        return res
    if isinstance(res, dict):  # OVWhisperTranscriber
        return res.get("segments", []), res

    logger.warning("Unexpected transcriber return type %r", type(res))
    return [], {}

def _normalise_segments(
    segments: Sequence[Any], *, word_ts: bool
) -> Tuple[str, List[Dict[str, Any]]]:
    """Convert backend‑specific segments to a common dict schema."""
    out, collected_text = [], []
    for s in segments:
        if hasattr(s, "text"):
            seg = {"text": s.text, "start": 0.0, "end": 0.0}
        else:
            seg = {
                "text": s["text"],
                "start": float(s["start"]),
                "end": float(s["end"]),
            }
            if word_ts and "words" in s:
                seg["words"] = [
                    {
                        "text": w["text"],
                        "start": float(w["start"]),
                        "end": float(w["end"]),
                    }
                    for w in s["words"]
                ]
        out.append(seg)
        collected_text.append(seg["text"])
    return " ".join(collected_text).strip(), out

def transcribe_audio_bytes(
    audio_bytes: bytes,
    *,
    beam_size: int = 5,
    initial_prompt: Optional[str] = None,
    language: Optional[str] = None,  # ISO‑639‑1 or "auto"
    temperature: float = 0.0,
    timestamp_granularities: Optional[List[str]] = None,  # kept for API parity
    include: Optional[List[str]] = None,
    word_ts: bool = False,
) -> Dict[str, Any]:
    """Transcribe audio and return Whisper‑style JSON."""

    pcm = _to_f32_mono(audio_bytes)
    segments, info = _transcribe(
        pcm,
        beam_size=beam_size,
        temperature=temperature,
        initial_prompt=initial_prompt,
        language=language,
        word_ts=word_ts,
    )

    text, norm_segments = _normalise_segments(segments, word_ts=word_ts)
    result: Dict[str, Any] = {"text": text, "segments": norm_segments}

    if include and "logprobs" in include:
        result["logprobs"] = info.get("logprobs")

    return result
