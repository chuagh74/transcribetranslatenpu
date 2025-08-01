import asyncio
import httpx
import wave
import numpy as np
import io
from pathlib import Path

# Test configuration
BASE_URL = "http://localhost:8000"
TEST_AUDIO_FILE = Path(__file__).parent.parent / "test.wav"

def create_test_audio() -> bytes:
    """Create a simple test audio file"""
    sample_rate = 16000
    duration = 2.0  # 2 seconds
    frequency = 440  # A4 note
    
    # Generate sine wave
    samples = int(sample_rate * duration)
    t = np.linspace(0, duration, samples, False)
    audio = np.sin(2 * np.pi * frequency * t) * 0.3
    
    # Convert to 16-bit integers
    audio_int16 = (audio * 32767).astype(np.int16)
    
    # Create WAV file in memory
    with io.BytesIO() as wav_buffer:
        with wave.open(wav_buffer, 'wb') as wav_file:
            wav_file.setnchannels(1)  # mono
            wav_file.setsampwidth(2)  # 16-bit
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(audio_int16.tobytes())
        
        return wav_buffer.getvalue()

def get_test_audio() -> bytes:
    """Get test audio from file or create synthetic audio"""
    if TEST_AUDIO_FILE.exists():
        with open(TEST_AUDIO_FILE, 'rb') as f:
            return f.read()
    else:
        return create_test_audio()

async def test_transcribe_audio_json():
    """Test POST /v1/audio/transcriptions with JSON response"""
    print("\n=== Testing POST /v1/audio/transcriptions (JSON) ===")
    
    test_audio_bytes = get_test_audio()
    
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        files = {"file": ("test.wav", test_audio_bytes, "audio/wav")}
        data = {
            "model": "whisper-1",
            "response_format": "json",
            "language": "en",
            "temperature": 0.0
        }
        
        response = await client.post("/v1/audio/transcriptions", files=files, data=data)
        
        if response.status_code != 200:
            print(f"Transcription JSON test: FAIL - Status {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        try:
            result = response.json()
            if "text" not in result:
                print(f"Transcription JSON test: FAIL - Missing 'text' field")
                return False
            
            print(f"Transcription JSON test: PASS")
            print(f"Transcribed text: '{result.get('text', '')[:100]}...'")
            return True
            
        except Exception as e:
            print(f"Transcription JSON test: FAIL - Invalid JSON response: {e}")
            return False

async def test_transcribe_audio_text():
    """Test POST /v1/audio/transcriptions with text response"""
    print("\n=== Testing POST /v1/audio/transcriptions (text) ===")
    
    test_audio_bytes = get_test_audio()
    
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        files = {"file": ("test.wav", test_audio_bytes, "audio/wav")}
        data = {
            "model": "whisper-1",
            "response_format": "text",
            "language": "en"
        }
        
        response = await client.post("/v1/audio/transcriptions", files=files, data=data)
        
        if response.status_code != 200:
            print(f"Transcription text test: FAIL - Status {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        text_result = response.text
        if not isinstance(text_result, str):
            print(f"Transcription text test: FAIL - Response is not string")
            return False
        
        print(f"Transcription text test: PASS")
        print(f"Transcribed text: '{text_result[:100]}...'")
        return True

async def test_transcribe_invalid_format():
    """Test transcription with invalid response format"""
    print("\n=== Testing Transcription Invalid Format ===")
    
    test_audio_bytes = get_test_audio()
    
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        files = {"file": ("test.wav", test_audio_bytes, "audio/wav")}
        data = {
            "model": "whisper-1",
            "response_format": "invalid_format"
        }
        
        response = await client.post("/v1/audio/transcriptions", files=files, data=data)
        
        if response.status_code != 400:
            print(f"Invalid format test: FAIL - Expected 400, got {response.status_code}")
            return False
        
        print(f"Invalid format test: PASS")
        return True

async def test_transcribe_invalid_audio():
    """Test transcription with invalid audio data"""
    print("\n=== Testing Transcription Invalid Audio ===")
    
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        files = {"file": ("test.wav", b"invalid audio data", "audio/wav")}
        data = {
            "model": "whisper-1",
            "response_format": "json"
        }
        
        response = await client.post("/v1/audio/transcriptions", files=files, data=data)
        
        if response.status_code not in [400, 500]:
            print(f"Invalid audio test: FAIL - Expected 400/500, got {response.status_code}")
            return False
        
        print(f"Invalid audio test: PASS")
        return True

async def main():
    """Run transcription API tests"""
    print("Starting Transcription API tests...")
    
    tests = [
        ("Transcription JSON", test_transcribe_audio_json()),
        ("Transcription Text", test_transcribe_audio_text()),
        ("Invalid Format", test_transcribe_invalid_format()),
        ("Invalid Audio", test_transcribe_invalid_audio())
    ]
    
    results = []
    for test_name, test_coro in tests:
        try:
            result = await test_coro
            results.append((test_name, result))
        except Exception as e:
            print(f"{test_name} test: FAIL - {str(e)}")
            import traceback
            print(f"Error details: {traceback.format_exc()}")
            results.append((test_name, False))
    
    # Summary
    print("\n=== Transcription API Test Results ===")
    passed = sum(1 for _, result in results if result)
    failed = len(results) - passed
    
    for test_name, result in results:
        status = "PASS" if result else "FAIL"
        print(f"{test_name}: {status}")
    
    print(f"\nTotal: {len(results)} tests, Passed: {passed}, Failed: {failed}")
    return failed == 0

if __name__ == "__main__":
    asyncio.run(main())