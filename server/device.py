# server/device.py
import json
import logging
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ----------------------------
# Load device preference from config.json
# ----------------------------
config_path = Path(__file__).parent / 'config.json'
if not config_path.exists():
    logger.warning(f"config.json not found at {config_path}, using default preference")
    pref_list = ['NPU', 'cuda', 'GPU', 'CPU']
else:
    with open(config_path, 'r', encoding='utf-8') as cfg_file:
        cfg = json.load(cfg_file)
    pref_list = cfg.get('device_preference', ['NPU', 'cuda', 'GPU', 'CPU'])

# ----------------------------
# Probe available devices
# ----------------------------
available = []
# CUDA GPU
try:
    import torch
    if torch.cuda.is_available():
        available.append('cuda')
        logger.info("CUDA GPU available")
except ImportError:
    pass
# OpenVINO devices
try:
    from openvino.runtime import Core
    core = Core()
    devs = core.available_devices
    for dev in ['NPU', 'GPU', 'CPU']:
        if dev in devs:
            available.append(dev)
            logger.info(f"OpenVINO device available: {dev}")
except ImportError:
    pass
# Always allow CPU fallback
if 'CPU' not in available:
    available.append('CPU')
    logger.info("Defaulting CPU available")

# ----------------------------
# Select preferred device
# ----------------------------
device = None
for pref in pref_list:
    if pref in available:
        device = pref
        break
if device is None:
    device = 'CPU'
logger.info(f"Selected device: {device} (available: {available})")

# Expose device for import
__all__ = ['device']