import asyncio
import httpx
from pathlib import Path

# Test configuration
BASE_URL = "http://localhost:8000"

async def test_tts_voices():
    """Test GET /v1/tts/voices endpoint"""
    print("\n=== Testing GET /v1/tts/voices ===")
    
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        response = await client.get("/v1/tts/voices")
        
        if response.status_code != 200:
            print(f"TTS voices test: FAIL - Status {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        try:
            result = response.json()
            required_fields = ["voices", "total", "default"]
            for field in required_fields:
                if field not in result:
                    print(f"TTS voices test: FAIL - Missing '{field}' field")
                    return False
            
            if not isinstance(result["voices"], list):
                print(f"TTS voices test: FAIL - 'voices' is not a list")
                return False
            
            print(f"TTS voices test: PASS")
            print(f"Available voices: {len(result['voices'])}")
            print(f"Default voice: {result.get('default', 'N/A')}")
            print(f"Sample voices: {result['voices'][:5]}")
            return True
            
        except Exception as e:
            print(f"TTS voices test: FAIL - Invalid JSON response: {e}")
            return False

async def test_tts_synthesis():
    """Test POST /v1/tts endpoint"""
    print("\n=== Testing POST /v1/tts ===")
    
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        data = {
            "text": "Hello, this is a test of text to speech synthesis.",
            "voice": "am_adam",  # Changed from ad_adam to am_adam
            "language": "en-us",
            "speed": 1.0
        }
        
        response = await client.post("/v1/tts", json=data)
        
        if response.status_code != 200:
            print(f"TTS synthesis test: FAIL - Status {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        # Check content type
        content_type = response.headers.get("content-type", "")
        if "audio/wav" not in content_type:
            print(f"TTS synthesis test: FAIL - Wrong content type: {content_type}")
            return False
        
        # Check that we received audio data
        audio_data = response.content
        if len(audio_data) < 1000:  # Should be substantial audio data
            print(f"TTS synthesis test: FAIL - Audio data too small: {len(audio_data)} bytes")
            return False
        
        print(f"TTS synthesis test: PASS")
        print(f"Audio data size: {len(audio_data)} bytes")
        print(f"Content type: {content_type}")
        return True

async def test_tts_empty_text():
    """Test TTS with empty text"""
    print("\n=== Testing TTS Empty Text ===")
    
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        data = {
            "text": "",
            "voice": "am_adam"  # Changed from ad_adam to am_adam
        }
        
        response = await client.post("/v1/tts", json=data)
        
        if response.status_code != 400:
            print(f"TTS empty text test: FAIL - Expected 400, got {response.status_code}")
            return False
        
        print(f"TTS empty text test: PASS")
        return True

async def test_tts_long_text():
    """Test TTS with text that's too long"""
    print("\n=== Testing TTS Long Text ===")
    
    # Create text longer than 1000 characters
    long_text = "This is a very long text. " * 50  # Should exceed 1000 chars
    
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        data = {
            "text": long_text,
            "voice": "am_adam"  # Changed from ad_adam to am_adam
        }
        
        response = await client.post("/v1/tts", json=data)
        
        if response.status_code != 400:
            print(f"TTS long text test: FAIL - Expected 400, got {response.status_code}")
            return False
        
        print(f"TTS long text test: PASS")
        return True

async def test_tts_different_voice():
    """Test TTS with different voice"""
    print("\n=== Testing TTS Different Voice ===")
    
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        data = {
            "text": "Testing with a different voice.",
            "voice": "af_bella",  # Female voice
            "language": "en-us",
            "speed": 1.2
        }
        
        response = await client.post("/v1/tts", json=data)
        
        if response.status_code != 200:
            print(f"TTS different voice test: FAIL - Status {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        # Check content type and data
        content_type = response.headers.get("content-type", "")
        audio_data = response.content
        
        if "audio/wav" not in content_type or len(audio_data) < 1000:
            print(f"TTS different voice test: FAIL - Invalid audio response")
            return False
        
        print(f"TTS different voice test: PASS")
        print(f"Audio data size: {len(audio_data)} bytes")
        return True

async def main():
    """Run TTS API tests"""
    print("Starting TTS API tests...")
    
    tests = [
        ("TTS Voices", test_tts_voices()),
        ("TTS Synthesis", test_tts_synthesis()),
        ("TTS Empty Text", test_tts_empty_text()),
        ("TTS Long Text", test_tts_long_text()),
        ("TTS Different Voice", test_tts_different_voice())
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
    print("\n=== TTS API Test Results ===")
    passed = sum(1 for _, result in results if result)
    failed = len(results) - passed
    
    for test_name, result in results:
        status = "PASS" if result else "FAIL"
        print(f"{test_name}: {status}")
    
    print(f"\nTotal: {len(results)} tests, Passed: {passed}, Failed: {failed}")
    return failed == 0

if __name__ == "__main__":
    asyncio.run(main())