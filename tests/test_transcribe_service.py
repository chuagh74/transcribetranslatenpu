# server/tests/test_transcribe_service.py
import argparse
import io
import sys
from pathlib import Path

from server.services.transcribe_service import transcribe_audio_file, transcribe_audio_bytes

def _load_audio_bytes(path: Path) -> bytes:
    """Read the *entire* file into memory and return raw bytes."""
    with path.open("rb") as f:
        return f.read()

def main():
    parser = argparse.ArgumentParser(
        description="Quick sanity‑check for server.services.transcribe_service " +
    "\nIt exercises *both* transcribe_audio_file() *and* transcribe_audio_bytes()."
    )
    parser.add_argument(
        "audio",
        type=Path,
        nargs="?",
        default=Path("test.wav"),
        help="Path to a WAV/MP3/FLAC/OGG file to transcribe (default: test.wav)",
    )
    parser.add_argument(
        "--lang",
        default="en",
        help="ISO‑639‑1 language code to pass to Whisper (default: en)",
    )

    args = parser.parse_args()

    if not args.audio.exists():
        sys.exit(f"Audio file not found: {args.audio}")

    audio_bytes = _load_audio_bytes(args.audio)

    print("=== transcribe_audio_file() ===")
    res_file = transcribe_audio_file(audio_bytes, language=args.lang)
    print("\nResult:")
    print(res_file.get("text", "<no text>").strip())

    print("\n=== transcribe_audio_bytes() ===")
    res_bytes = transcribe_audio_bytes(audio_bytes, language=args.lang)
    print("\nResult:")
    print(res_bytes.get("text", "<no text>").strip())

    # Consistency check
    if res_file.get("text") != res_bytes.get("text"):
        print("\n[WARN] The two helper functions returned *different* text!")
    else:
        print("\n[OK] Both functions returned identical transcripts.")


if __name__ == "__main__":
    main()
