# server/routers/list_models.py
import os
import logging
from pathlib import Path
from fastapi import APIRouter, HTTPException
from server.config import MODEL_DIR, STT_DIR, TRANS_DIR, TTS_DIR, device

router = APIRouter()
logger = logging.getLogger("models_router")

@router.get("/v1/models", summary="Returns information about loaded models")
async def get_models():
    try:
        models_info = {
            "stt": {
                "models": [p for p in Path('models').iterdir() if p.is_dir() and "whisper" in p.name.lower()],
                "model_type": os.path.basename(STT_DIR),
            },
            "translation": {
                "model_path": os.path.basename(TRANS_DIR),
                "model_type": "M2M100",
            },
            "tts": {
                "model_path": os.path.basename(TTS_DIR),
                "model_type": "Kokoro TTS",
                "optimization": "ONNX Runtime with GPU support"
            },
            "available_devices": device
        }
        return models_info
    except Exception as e:
        logger.exception("Failed to retrieve models information: %s", e)
        raise HTTPException(status_code=500, detail="Unable to retrieve models information")
