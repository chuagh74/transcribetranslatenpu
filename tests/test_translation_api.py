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
    """Create a more realistic test audio file that VAD will detect as speech"""
    sample_rate = 16000
    duration = 3.0  # 3 seconds
    
    # Create a more complex waveform that resembles speech patterns
    samples = int(sample_rate * duration)
    t = np.linspace(0, duration, samples, False)
    
    # Mix multiple frequencies to simulate speech formants
    # Fundamental frequency around 100-200 Hz (typical for speech)
    f1 = 150 + 50 * np.sin(2 * np.pi * 2 * t)  # Varying fundamental
    f2 = 800 + 200 * np.sin(2 * np.pi * 3 * t)  # First formant
    f3 = 2400 + 400 * np.sin(2 * np.pi * 1.5 * t)  # Second formant
    
    # Create speech-like amplitude modulation
    amplitude_mod = 0.5 + 0.5 * np.sin(2 * np.pi * 4 * t)  # 4 Hz modulation
    
    # Combine frequencies with speech-like envelope
    audio = (0.3 * np.sin(2 * np.pi * f1 * t) * amplitude_mod +
             0.2 * np.sin(2 * np.pi * f2 * t) * amplitude_mod +
             0.1 * np.sin(2 * np.pi * f3 * t) * amplitude_mod)
    
    # Add some noise to make it more realistic
    noise = np.random.normal(0, 0.02, samples)
    audio = audio + noise
    
    # Apply speech-like envelope (quieter at start/end)
    envelope = np.ones(samples)
    fade_samples = int(0.1 * sample_rate)  # 100ms fade
    envelope[:fade_samples] = np.linspace(0, 1, fade_samples)
    envelope[-fade_samples:] = np.linspace(1, 0, fade_samples)
    audio = audio * envelope
    
    # Normalize and convert to 16-bit integers
    audio = audio / np.max(np.abs(audio)) * 0.7  # Leave some headroom
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
    # Always try to use the real test file first
    if TEST_AUDIO_FILE.exists():
        print(f"Using real test audio file: {TEST_AUDIO_FILE}")
        with open(TEST_AUDIO_FILE, 'rb') as f:
            return f.read()
    else:
        print("Real test file not found, using synthetic audio")
        return create_test_audio()

async def test_translate_text_only():
    """Test POST /v1/audio/translations with text input only"""
    print("\n=== Testing POST /v1/audio/translations (text only) ===")
    
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        data = {
            "text": "Hello, how are you?",
            "model": "whisper-1",
            "response_format": "json"
        }
        
        response = await client.post("/v1/audio/translations", params={"target_lang": "zh"}, data=data)
        
        if response.status_code != 200:
            print(f"Text translation test: FAIL - Status {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        try:
            result = response.json()
            if "text" not in result:
                print(f"Text translation test: FAIL - Missing 'text' field")
                return False
            
            print(f"Text translation test: PASS")
            # Handle Unicode safely when printing
            translated_text = result.get('text', '')
            try:
                print(f"Translated text: '{translated_text[:100]}...'")
            except UnicodeEncodeError:
                print(f"Translated text: '{translated_text.encode('ascii', 'replace').decode('ascii')[:100]}...'")
            return True
            
        except Exception as e:
            print(f"Text translation test: FAIL - Error processing response: {e}")
            return False

async def test_translate_audio():
    """Test POST /v1/audio/translations with audio file"""
    print("\n=== Testing POST /v1/audio/translations (audio) ===")
    
    test_audio_bytes = get_test_audio()
    
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        files = {"file": ("test.wav", test_audio_bytes, "audio/wav")}
        data = {
            "model": "whisper-1",
            "input_language": "en",
            "response_format": "json"
        }
        
        response = await client.post("/v1/audio/translations", files=files, params={"target_lang": "zh"}, data=data)
        
        if response.status_code != 200:
            print(f"Audio translation test: FAIL - Status {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        try:
            result = response.json()
            if "text" not in result:
                print(f"Audio translation test: FAIL - Missing 'text' field")
                return False
            
            print(f"Audio translation test: PASS")
            # Handle Unicode safely - just check length instead of printing content
            translated_text = result.get('text', '')
            print(f"Translated text length: {len(translated_text)} characters")
            return True
            
        except Exception as e:
            print(f"Audio translation test: FAIL - Error processing response: {e}")
            return False

async def test_simple_translate_text():
    """Test POST /translate endpoint with text"""
    print("\n=== Testing POST /translate (text) ===")
    
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        data = {
            "text": "Hello world",
            "source_language": "en",
            "target_language": "zh",  # Changed from zh_CN to zh
            "model": "whisper-1"
        }
        
        response = await client.post("/translate", data=data)
        
        if response.status_code != 200:
            print(f"Simple translate text test: FAIL - Status {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        try:
            result = response.json()
            if "translated_text" not in result:
                print(f"Simple translate text test: FAIL - Missing 'translated_text' field")
                return False
            
            print(f"Simple translate text test: PASS")
            # Handle Unicode safely - just show length instead of content
            translated_text = result.get('translated_text', '')
            print(f"Translated text length: {len(translated_text)} characters")
            return True
            
        except Exception as e:
            print(f"Simple translate text test: FAIL - Error processing response: {e}")
            return False

async def test_simple_translate_audio():
    """Test POST /translate endpoint with audio"""
    print("\n=== Testing POST /translate (audio) ===")
    
    test_audio_bytes = get_test_audio()
    
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        files = {"file": ("test.wav", test_audio_bytes, "audio/wav")}
        data = {
            "source_language": "en",
            "target_language": "zh",  # Changed from zh_CN to zh
            "model": "whisper-1"
        }
        
        response = await client.post("/translate", files=files, data=data)
        
        if response.status_code != 200:
            print(f"Simple translate audio test: FAIL - Status {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        try:
            result = response.json()
            required_fields = ["transcription", "translated_text"]
            for field in required_fields:
                if field not in result:
                    print(f"Simple translate audio test: FAIL - Missing '{field}' field")
                    return False
            
            print(f"Simple translate audio test: PASS")
            # Handle Unicode safely - just show lengths instead of content
            transcription = result.get('transcription', '')
            translated_text = result.get('translated_text', '')
            print(f"Transcription length: {len(transcription)} characters")
            print(f"Translation length: {len(translated_text)} characters")
            return True
            
        except Exception as e:
            print(f"Simple translate audio test: FAIL - Error processing response: {e}")
            return False

async def test_translate_no_input():
    """Test translation endpoint with no input"""
    print("\n=== Testing Translation No Input ===")
    
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        data = {
            "model": "whisper-1",
            "response_format": "json"
        }
        
        response = await client.post("/v1/audio/translations", params={"target_lang": "zh"}, data=data)
        
        if response.status_code != 400:
            print(f"No input test: FAIL - Expected 400, got {response.status_code}")
            return False
        
        print(f"No input test: PASS")
        return True

async def main():
    """Run translation API tests"""
    print("Starting Translation API tests...")
    
    tests = [
        ("Translation Text Only", test_translate_text_only()),
        ("Translation Audio", test_translate_audio()),
        ("Simple Translate Text", test_simple_translate_text()),
        ("Simple Translate Audio", test_simple_translate_audio()),
        ("No Input Error", test_translate_no_input())
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
    print("\n=== Translation API Test Results ===")
    passed = sum(1 for _, result in results if result)
    failed = len(results) - passed
    
    for test_name, result in results:
        status = "PASS" if result else "FAIL"
        print(f"{test_name}: {status}")
    
    print(f"\nTotal: {len(results)} tests, Passed: {passed}, Failed: {failed}")
    return failed == 0

if __name__ == "__main__":
    asyncio.run(main())