# server/routers/translate.py
import logging
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Query, Form, HTTPException
from fastapi.concurrency import run_in_threadpool
from server.services.transcribe_service import transcribe_audio_file
from server.services.translate_service import translate_text

router = APIRouter()
logger = logging.getLogger("translate_router")

# Import audio conversion utility from transcribe router
import io, os, subprocess, tempfile, shutil

FFMPEG = shutil.which("ffmpeg") or "ffmpeg"

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

@router.post("/v1/audio/translations", summary="Translate text or audio")
async def translate(
    file: Optional[UploadFile] = File(
        None,
        description="Optional audio file for speech-to-text translation. Accepted formats: flac, mp3, mp4, mpeg, mpga, m4a, ogg, wav, or webm."
    ),
    text: Optional[str] = Form(
        None, description="Optional input text for text-to-text translation."
    ),
    target_lang: str = Query(
        "en", description="Target language code for translation (e.g., 'en' for English)."
    ),
    input_language: Optional[str] = Query(
        "en", description="Optional input language of the audio in ISO-639-1 format (e.g., 'en')."
    ),
    model: str = Form(
        ...,
        description="ID of the model to use. Only 'whisper-1' is currently available."
    ),
    prompt: Optional[str] = Form(
        "", description="Optional prompt to guide the model's style or to continue a previous audio segment. Must be in English."
    ),
    response_format: str = Form(
        "json", description="Output format: json, text, srt, verbose_json, or vtt."
    ),
    temperature: float = Form(
        0.0, description="Sampling temperature between 0 and 1. Higher values yield more random output."
    )
):
    """
    Accepts an audio file or text, transcribes (if audio) and then translates the input text into the target language,
    returning a JSON object containing the translated text.

    **Parameters:**
      - **file**: The audio file object to transcribe.
      - **text**: Input text for translation if no audio file is provided.
      - **target_lang**: Target language code for the translation.
      - **input_language**: Optional input language of the audio (ISO-639-1) for transcription.
      - **model**: The transcription model to use (only "whisper-1" is supported).
      - **prompt**: Optional prompt to guide transcription.
      - **response_format**: Desired output format.
      - **temperature**: Sampling temperature (between 0 and 1).

    **Returns:**
      A JSON object with:
      - `text`: The translated text.
    """
    # Validate that at least one input is provided.
    if file is None and text is None:
        raise HTTPException(status_code=400, detail="Either an audio file or text must be provided.")

    logger.info("Translation request: model=%s, response_format=%s, temperature=%s, target_lang=%s, input_language=%s",
                model, response_format, temperature, target_lang, input_language)

    source_text: str = ""
    # If an audio file is provided, perform transcription.
    if file is not None:
        try:
            audio_bytes = await file.read()
            # Convert audio to proper format like transcription router does
            pcm = pcm16k(audio_bytes)
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Failed to read/process the uploaded audio file: %s", e, exc_info=True)
            raise HTTPException(status_code=400, detail="Invalid or unreadable audio file.")

        try:
            # Call transcription service with correct parameters
            source_result = await run_in_threadpool(
                transcribe_audio_file,
                pcm,                # processed audio data
                beam_size=5,        # beam_size 
                initial_prompt=prompt,  # initial_prompt
                language=input_language,  # language of the audio
                temperature=temperature   # sampling temperature
            )
            # Extract the transcribed text from the result dictionary.
            source_text = source_result.get("text", "")
            logger.info("Audio transcribed: %s", source_text[:100] if source_text else "(empty)")
        except Exception as e:
            logger.error("Error during transcription: %s", e, exc_info=True)
            raise HTTPException(status_code=500, detail="Transcription process failed.")
    else:
        # Use the provided text directly.
        source_text = text

    # Check if we have text to translate
    if not source_text or not source_text.strip():
        logger.warning("No text to translate (transcription returned empty or no text provided)")
        raise HTTPException(status_code=400, detail="No text to translate. Please provide text or audio with speech.")

    # Translate the (transcribed or provided) source text.
    try:
        translation = translate_text(source_text, src_lang=input_language or 'en', tgt_lang=target_lang)
        logger.info("Translation - %s -> %s: %s -> %s", input_language, target_lang, source_text[:50], translation[:50])
    except Exception as e:
        logger.error("Error during translation: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Translation process failed.")
    
    return {"text": translation}

@router.post("/translate", summary="Simple translate endpoint")
async def simple_translate(
    text: Optional[str] = Form(None, description="Text to translate"),
    file: Optional[UploadFile] = File(None, description="Audio file to transcribe and translate"),
    source_language: str = Form("en", description="Source language code"),
    target_language: str = Form("zh", description="Target language code"),  # Changed default from zh_CN to zh
    model: str = Form("whisper-1", description="Model to use for transcription")
):
    """
    Simple translate endpoint that matches frontend expectations.
    Supports both text and audio translation.
    """
    
    # Validate input
    if not text and not file:
        raise HTTPException(status_code=400, detail="Either text or file must be provided")
    
    logger.info("Simple translate request: source=%s, target=%s", source_language, target_language)
    
    source_text = ""
    
    # Handle audio file
    if file:
        try:
            audio_bytes = await file.read()
            # Convert audio to proper format
            pcm = pcm16k(audio_bytes)
            
            # Transcribe audio with correct parameters
            transcribe_result = await run_in_threadpool(
                transcribe_audio_file,
                pcm,                    # processed audio data
                beam_size=5,            # beam_size
                initial_prompt="",      # initial_prompt
                language=source_language,  # language
                temperature=0.0         # temperature
            )
            source_text = transcribe_result.get("text", "")
            logger.info("Audio transcribed: %s", source_text[:100] if source_text else "(empty)")
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Transcription failed: %s", e, exc_info=True)
            raise HTTPException(status_code=500, detail="Audio transcription failed")
    else:
        source_text = text

    # Check if we have text to translate
    if not source_text or not source_text.strip():
        logger.warning("No text to translate (transcription returned empty or no text provided)")
        raise HTTPException(status_code=400, detail="No text to translate. Please provide text or audio with speech.")
    
    # Translate the text
    try:
        translated_text = translate_text(source_text, src_lang=source_language, tgt_lang=target_language)
        logger.info("Translation completed: %s -> %s", source_text[:50], translated_text[:50])
        
        # Return format expected by frontend
        if file:
            return {
                "transcription": source_text,
                "translated_text": translated_text,
                "text": translated_text
            }
        else:
            return {
                "translated_text": translated_text,
                "text": translated_text
            }
            
    except Exception as e:
        logger.error("Translation failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Translation failed")
