import os, sys, json
import logging
from pathlib import Path

from server.device import device, cfg

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ----------------------------
# Paths to model directories
# ----------------------------
MODEL_DIR = Path(cfg.get('model_dir', 'models'))
STT_DIR = MODEL_DIR / cfg.get('stt_subdir', 'whisper-small')
TRANS_DIR = MODEL_DIR / cfg.get('trans_subdir', 'm2m100_418M')
TTS_DIR = MODEL_DIR / cfg.get('tts_subdir', 'kokoro_tts')

# ----------------------------
# STT Model
# ----------------------------
if device in ('cuda', 'GPU', 'CPU'):
    from faster_whisper import WhisperModel

    stt_model = WhisperModel(
        model_size_or_path=str(STT_DIR / cfg.get('stt_torch_subdir', 'torch')),
        device=device,
        compute_type='float16' if device == 'cuda' else 'int8'
    )

    logger.info("Loaded faster-whisper STT on %s", device)
else:
    from server.pipelines.OVWhisperTranscriber import OVWhisperTranscriber

    stt_model = OVWhisperTranscriber(str(STT_DIR / cfg.get('stt_ir_subdir', 'vino')), device="NPU")
    logger.info("Loaded OpenVINO OVWhisperTranscriber STT on NPU")

# ----------------------------
# Translation Model
# ----------------------------
from transformers import AutoTokenizer, pipeline

torch_dir = str(TRANS_DIR / cfg.get("trans_torch_subdir", "torch")).replace('\\', '/')
vino_dir = str(TRANS_DIR / cfg.get("trans_ir_subdir", "vino")).replace('\\', '/')

if device in ("cuda", "GPU", "CPU"):
    from optimum.onnxruntime import ORTModelForSeq2SeqLM

    trans_tokenizer = AutoTokenizer.from_pretrained(str(torch_dir))
    trans_model = ORTModelForSeq2SeqLM.from_pretrained(
        str(torch_dir),
        encoder_file_name="encoder_model.onnx",
        decoder_file_name="decoder_model.onnx",
        decoder_with_past_file_name="decoder_with_past_model.onnx"
    )
    logger.info("Loaded ONNX m2m100_418M model on %s", device)
else:
    from optimum.intel import OVModelForSeq2SeqLM

    trans_tokenizer = AutoTokenizer.from_pretrained(str(vino_dir))
    trans_model = OVModelForSeq2SeqLM.from_pretrained(str(vino_dir), device="CPU")
    logger.info("Loaded OpenVINO m2m100_418M model on CPU")


# Configure the pipeline based on the model type
if device in ("cuda", "GPU", "CPU"):
    # For ONNX Runtime models, explicitly set device
    pipeline_device = 0 if device == "cuda" else -1  # Use GPU index 0 for CUDA, -1 for CPU
    translator = pipeline(
        'translation',
        model=trans_model,
        tokenizer=trans_tokenizer,
        device=pipeline_device
    )
    logger.info("Loaded M2M100_418M Pipeline on %s", "CUDA" if device == "cuda" else "CPU")
else:
    # For OpenVINO models, don't specify device parameter - let OpenVINO handle it
    translator = pipeline(
        'translation',
        model=trans_model,
        tokenizer=trans_tokenizer,
        device=-1 # CPU since NPU not available for now
    )
    logger.info("Loaded M2M100_418M Pipeline on %s", "CPU")


# ----------------------------
# TTS Model
# ----------------------------
from server.pipelines.KokoroTTS import KokoroTTS

tts_pipeline = KokoroTTS(
    model_dir=str(TTS_DIR),
    sample_rate=cfg.get('tts_sample_rate', 24000)
)

logger.info("Loaded Kokoro TTS pipeline on %s", 'CPU')
