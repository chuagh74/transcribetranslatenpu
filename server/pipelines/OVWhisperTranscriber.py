# server/pipelines/OVWhisperTranscriber.py
# © 2025 — MIT-licensed example

import os
import json
from pathlib import Path
from typing import Union, Sequence, Tuple, List

import numpy as np
import librosa
from openvino_genai import WhisperPipeline as OVWhisperPipeline

__all__ = ["OVWhisperTranscriber"]


class _Segment:                         # minimal faster-whisper segment stand-in
    def __init__(self, text: str):
        self.text = text


class OVWhisperTranscriber:
    """
    Thin wrapper around *OpenVINO-GenAI Whisper* that mimics faster-whisper’s
    API.  Accepts a file path or in-memory audio samples and stores the compiled
    NPU blob in **<model_dir>/cache/**.

    Parameters
    ----------
    model_dir : str | os.PathLike
        Folder holding the IR (.xml/.bin) and generation_config.json.
    device : str
        OpenVINO device string (default ``"NPU"``).
    cache_dir : str | os.PathLike | None
        Where to keep compiled blobs.  If *None* (default) a *cache/* subdir
        beside the model files is used.
    """

    TARGET_SR = 16_000   # Whisper expects 16 kHz mono PCM

    # ------------------------------------------------------------------
    # Init
    # ------------------------------------------------------------------
    def __init__(
        self,
        model_dir: Union[str, os.PathLike],
        device: str = "NPU",
        cache_dir: Union[str, os.PathLike, None] = None,
    ):
        model_dir = Path(model_dir).expanduser().resolve()

        if cache_dir is None:
            cache_dir = model_dir / "cache"
        cache_dir = Path(cache_dir)
        cache_dir.mkdir(parents=True, exist_ok=True)

        self.pipeline = OVWhisperPipeline(str(model_dir), device, CACHE_DIR=str(cache_dir))

        cfg_path = model_dir / "generation_config.json"
        if cfg_path.is_file():
            self._supported_langs = set(
                json.loads(cfg_path.read_text(encoding="utf-8")).get("lang_to_id", {})
            )
        else:
            self._supported_langs = set()

    # ------------------------------------------------------------------
    # Public API – mirrors faster-whisper
    # ------------------------------------------------------------------
    def transcribe(
        self,
        audio_source: Union[str, os.PathLike, np.ndarray, Sequence[float]],
        **kwargs,
    ) -> Tuple[List[_Segment], dict]:
        """Return ``([Segment(text)], info_dict)`` just like faster-whisper."""

        # 1) Load & resample audio → float32 mono 16 kHz
        if isinstance(audio_source, (str, os.PathLike)):
            audio_f32 = self._load_from_file(audio_source)
        else:
            audio_f32 = self._load_from_array(np.asarray(audio_source))

        # 2) Translate kwargs → OV generate() args
        gen_kwargs = self._build_gen_kwargs(kwargs)

        # 3) Run Whisper (OV implementation uses beam_size=1)
        result = self.pipeline.generate(audio_f32.tolist(), beam_size=1, **gen_kwargs)
        text = getattr(result, "text", str(result))
        return [ _Segment(text) ], {}

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def _load_from_file(self, path: Union[str, os.PathLike]) -> np.ndarray:
        audio, sr = librosa.load(path, sr=None, mono=False)
        if audio.ndim == 2:
            audio = np.mean(audio, axis=0)                 # stereo → mono
        if sr != self.TARGET_SR:
            audio = librosa.resample(audio, orig_sr=sr, target_sr=self.TARGET_SR)
        return audio.astype(np.float32)

    def _load_from_array(self, audio: np.ndarray) -> np.ndarray:
        if not np.issubdtype(audio.dtype, np.floating):    # int PCM → float
            audio = audio.astype(np.float32) / np.iinfo(audio.dtype).max
        else:
            audio = audio.astype(np.float32)
        if audio.ndim == 2:
            audio = np.mean(audio, axis=1)                 # flatten channels
        return audio                                       # assumes 16 kHz

    def _build_gen_kwargs(self, kwargs: dict) -> dict:
        params = {k: v for k, v in kwargs.items() if v is not None
                  and k not in {"beam_size", "initial_prompt"}}

        if (lang := params.pop("language", None)):         # map "en" → "<|en|>"
            token = f"<|{lang.lower()}|>"
            if token not in self._supported_langs:
                raise ValueError(
                    f"Language '{lang}' not supported; available: "
                    f"{sorted(self._supported_langs)}"
                )
            params["language"] = token
        return params
