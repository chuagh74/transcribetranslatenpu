# server/routers/tts.py
import logging
import tempfile
import os
from pathlib import Path
from fastapi import APIRouter, HTTPException, Response, BackgroundTasks
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional

from server.config import tts_pipeline

router = APIRouter()
logger = logging.getLogger("tts_router")

class TTSRequest(BaseModel):
    text: str
    voice: Optional[str] = "am_adam"  # Changed default from ad_adam to am_adam
    language: Optional[str] = "en-us" 
    speed: Optional[float] = 1.0

# Voice name mapping for common mistakes/aliases
VOICE_ALIASES = {
    'ad_adam': 'am_adam',  # Common mistake
    'adam': 'am_adam',
    'bella': 'af_bella',
    'alice': 'bf_alice',
    'alloy': 'af_alloy',
    'echo': 'am_echo',
    'nova': 'af_nova',
    'onyx': 'am_onyx'
}

def normalize_voice_name(voice: str) -> str:
    """Normalize voice name and check if it exists"""
    if not voice:
        return "am_adam"  # Default voice
    
    # Check if voice exists as-is
    available_voices = tts_pipeline.list_voices()
    if voice in available_voices:
        return voice
    
    # Check aliases
    if voice in VOICE_ALIASES:
        mapped_voice = VOICE_ALIASES[voice]
        if mapped_voice in available_voices:
            logger.info(f"Mapped voice '{voice}' to '{mapped_voice}'")
            return mapped_voice
    
    # Try case-insensitive match
    voice_lower = voice.lower()
    for available_voice in available_voices:
        if available_voice.lower() == voice_lower:
            return available_voice
    
    # If no match found, raise error with suggestions
    logger.warning(f"Voice '{voice}' not found. Available voices: {available_voices[:10]}...")
    raise ValueError(f"Voice '{voice}' not available. Use /v1/tts/voices to see available voices.")

def cleanup_temp_file(file_path: str):
    try:
        if os.path.exists(file_path):
            os.unlink(file_path)
            logger.debug(f"Cleaned up temporary file: {file_path}")
    except Exception as e:
        logger.warning(f"Failed to cleanup temp file {file_path}: {e}")

@router.post("/v1/tts", summary="Text-to-Speech synthesis")
async def text_to_speech(request: TTSRequest, background_tasks: BackgroundTasks):
    """
    Convert text to speech using Kokoro TTS
    
    Args:
        request: TTS request containing text and parameters
        background_tasks: FastAPI background tasks for cleanup
        
    Returns:
        Audio file as response
    """
    try:
        logger.info(f"TTS request: '{request.text[:50]}...' with voice '{request.voice}'")
        
        # Validate input
        if not request.text or len(request.text.strip()) == 0:
            raise HTTPException(status_code=400, detail="Text cannot be empty")
        
        if len(request.text) > 1000:
            raise HTTPException(status_code=400, detail="Text too long (max 1000 characters)")
        
        # Normalize and validate voice
        try:
            normalized_voice = normalize_voice_name(request.voice)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        
        # Generate audio
        try:
            audio_data = tts_pipeline.synthesize(
                text=request.text,
                voice=normalized_voice,
                language=request.language,
                speed=request.speed
            )
        except KeyError as e:
            # This shouldn't happen after normalization, but just in case
            available_voices = tts_pipeline.list_voices()
            raise HTTPException(
                status_code=400, 
                detail=f"Voice '{request.voice}' not found. Available voices: {available_voices[:10]}"
            )
        
        # Save to temporary file
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
            temp_path = temp_file.name
        
        tts_pipeline.save_audio(audio_data, temp_path)
        background_tasks.add_task(cleanup_temp_file, temp_path)
        
        logger.info(f"TTS synthesis successful for voice '{normalized_voice}'")
        
        # Return the audio file
        return FileResponse(
            path=temp_path,
            media_type="audio/wav",
            filename="tts_output.wav"
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        logger.exception("TTS generation failed: %s", e)
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {str(e)}")

@router.get("/v1/tts/voices", summary="List available TTS voices")
async def list_voices():
    try:
        all_voices = tts_pipeline.list_voices()
        voices_dir = Path(tts_pipeline.model_dir) / "voices"
        bin_voice_files = {p.stem for p in voices_dir.glob("*.bin")}
        bin_voices = [voice for voice in all_voices if voice in bin_voice_files]
        default_voice = "am_adam"  # Changed from ad_adam to am_adam
        
        return {
            "voices": bin_voices,
            "total": len(bin_voices),
            "default": default_voice,
            "aliases": VOICE_ALIASES  # Include alias information
        }
    except Exception as e:
        logger.exception("Failed to list voices: %s", e)
        raise HTTPException(status_code=500, detail="Failed to retrieve voices")