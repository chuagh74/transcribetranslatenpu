import asyncio
import httpx
from pathlib import Path

# Test configuration
BASE_URL = "http://localhost:8000"
TEST_AUDIO_FILE = Path(__file__).parent.parent / "test.wav"

async def test_get_models():
    """Test GET /v1/models endpoint"""
    print("\n=== Testing GET /v1/models ===")
    
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        response = await client.get("/v1/models")
        
        if response.status_code != 200:
            print(f"Models test: FAIL - Status {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        
        # Check required fields
        required_fields = ["stt", "translation", "tts", "available_devices"]
        for field in required_fields:
            if field not in data:
                print(f"Models test: FAIL - Missing field '{field}'")
                return False
        
        print(f"Models test: PASS")
        print(f"Available devices: {data.get('available_devices', 'N/A')}")
        print(f"STT model: {data.get('stt', {}).get('model_type', 'N/A')}")
        print(f"Translation model: {data.get('translation', {}).get('model_type', 'N/A')}")
        print(f"TTS model: {data.get('tts', {}).get('model_type', 'N/A')}")
        return True

async def test_invalid_endpoint():
    """Test error handling for non-existent endpoint"""
    print("\n=== Testing Invalid Endpoint ===")
    
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        response = await client.get("/v1/nonexistent")
        
        if response.status_code != 404:
            print(f"Invalid endpoint test: FAIL - Expected 404, got {response.status_code}")
            return False
        
        print(f"Invalid endpoint test: PASS")
        return True

async def main():
    """Run models API tests"""
    print("Starting Models API tests...")
    
    tests = [
        ("Models API", test_get_models()),
        ("Invalid Endpoint", test_invalid_endpoint())
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
    print("\n=== Models API Test Results ===")
    passed = sum(1 for _, result in results if result)
    failed = len(results) - passed
    
    for test_name, result in results:
        status = "PASS" if result else "FAIL"
        print(f"{test_name}: {status}")
    
    print(f"\nTotal: {len(results)} tests, Passed: {passed}, Failed: {failed}")
    return failed == 0

if __name__ == "__main__":
    asyncio.run(main())