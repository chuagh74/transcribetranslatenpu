from __future__ import annotations
import logging
from pathlib import Path
from typing import  List

import numpy as np
import scipy.io.wavfile as wavfile
from onnxruntime import InferenceSession
from kokoro_onnx.tokenizer import Tokenizer

logger = logging.getLogger(__name__)
logger.addHandler(logging.NullHandler())

class KokoroTTS:
    def __init__(self, model_dir: str | Path, *, sample_rate: int = 24_000, model_name: str = "model.onnx") -> None:
        self.model_dir = Path(model_dir)
        self.sample_rate = sample_rate
        self.tokenizer = Tokenizer()
        self.sess = InferenceSession(f'{self.model_dir}/{model_name}')
        self.voice_bins = {
            p.stem: np.fromfile(p, np.float32).reshape(-1, 1, 256)
            for p in (self.model_dir / "voices").glob("*.bin")
        }
        self.language_mapping = {
            'en-us': 'en-us',
            'en-gb': 'en-gb', 
            'ja-jp': 'ja',
            'zh-cn': 'zh',
            'es-es': 'es',
            'fr-fr': 'fr',
            'hi-in': 'hi',
            'it-it': 'it',
            'pt-br': 'pt'
        }
    
    def _tokenize_text(self, text: str, language: str = "en-us"):
        tk_lang = self.language_mapping.get(language, "en-us")
        phonemes = self.tokenizer.phonemize(text, lang=tk_lang)
        ids = self.tokenizer.tokenize(phonemes)
        tokens = [0, *ids[:510], 0]
        return tokens

    def list_voices(self) -> List[str]:
        return sorted(self.voice_bins)

    def synthesize(self, text: str, *, voice: str = "am_michael", language: str = 'en-us', speed: float = 1.0) -> np.ndarray:
        tokens   = self._tokenize_text(text, language)
        ref_s    = self.voice_bins[voice][len(tokens)]
        input_ids = np.asarray(tokens, dtype=np.int64)[None, :]

        audio = self.sess.run(None, {
            "input_ids": input_ids,
            "style":     ref_s.astype(np.float32),
            "speed":     np.full((1,), speed, dtype=np.float32)
        })[0]
        return audio

    def save_audio(self, audio: np.ndarray, path: str | Path) -> None:
        wavfile.write(path, self.sample_rate, audio[0])