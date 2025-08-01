# server/routers/transcribe.py
import io, os, subprocess, tempfile, logging, shutil
from typing import Optional, List
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.concurrency import run_in_threadpool
from server.services.transcribe_service import transcribe_audio_file

router = APIRouter()
log = logging.getLogger("transcribe_router")
FFMPEG = shutil.which("ffmpeg") or "ffmpeg"
OK_FMT = {"json", "text", "srt", "verbose_json", "vtt"}

def pcm16k(in_bytes: bytes) -> bytes:
    """Convert input audio to 16kHz mono WAV format."""
    with tempfile.NamedTemporaryFile(delete=False, suffix=".src") as src:
        src.write(in_bytes); src_path = src.name
    dst_path = f"{src_path}.wav"
    try:
        subprocess.run(
            [FFMPEG, "-hide_banner", "-loglevel", "error",
             "-i", src_path, "-ac", "1", "-ar", "16000",
             "-f", "wav", dst_path],
            check=True)
        return open(dst_path, "rb").read()
    except FileNotFoundError:
        raise HTTPException(500, "ffmpeg not found")
    except subprocess.CalledProcessError:
        raise HTTPException(400, "Unsupported or corrupt audio file")
    finally:
        for p in (src_path, dst_path):
            try: os.remove(p)
            except FileNotFoundError: pass

@router.post("/v1/audio/transcriptions")
async def transcribe_audio(
    file: UploadFile = File(...),
    model: str = Form(...),
    prompt: str = Form(""),
    response_format: str = Form("json"),
    language: Optional[str] = Form(None),
    temperature: float = Form(0.0),
    include: Optional[List[str]] = Form(None),
    timestamp_granularities: Optional[List[str]] = Form(None),
    stream: bool = Form(False),
):
    if response_format not in OK_FMT:
        raise HTTPException(400, "response_format must be json/text/srt/verbose_json/vtt")
    try:
        pcm = pcm16k(await file.read())
    except HTTPException:
        raise
    except Exception as e:
        log.error("read/decode: %s", e, exc_info=True)
        raise HTTPException(400, "Unreadable audio file")
    try:
        res = await run_in_threadpool(
            transcribe_audio_file,
            pcm, 1, prompt, language, temperature, timestamp_granularities, include)
    except Exception as e:
        log.error("transcribe fail: %s", e, exc_info=True)
        raise HTTPException(500, "Transcription process failed")
    return res if response_format == "json" else res.get("text","")
