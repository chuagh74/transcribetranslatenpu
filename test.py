from pathlib import Path

for p in Path("models/kokoro_tts/voices").glob("*.pt"):
    p.unlink()      # deletes the file
