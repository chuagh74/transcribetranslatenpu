import asyncio
import subprocess
import sys
from pathlib import Path

# Test files to run
TEST_FILES = [
    "test_models_api.py",
    "test_transcription_api.py", 
    "test_translation_api.py",
    "test_tts_api.py",
    "test_transcribe_ws.py",
    "test_server_functions.py"
]

async def run_test_file(test_file: str) -> tuple[str, bool, str]:
    """Run a single test file and return results"""
    print(f"\n{'='*60}")
    print(f"Running {test_file}")
    print(f"{'='*60}")
    
    test_path = Path(__file__).parent / test_file
    
    if not test_path.exists():
        error_msg = f"Test file {test_file} not found at {test_path}"
        print(error_msg)
        return test_file, False, error_msg
    
    try:
        # Run the test file with UTF-8 encoding to handle Unicode
        result = subprocess.run(
            [sys.executable, str(test_path)],
            cwd=Path(__file__).parent.parent,  # Run from project root
            capture_output=True,
            text=True,
            encoding='utf-8',  # Use UTF-8 encoding
            errors='replace',  # Replace problematic characters
            timeout=120  # 2 minute timeout per test file
        )
        
        output = result.stdout
        error_output = result.stderr
        
        # Print the output (handle Unicode safely)
        if output:
            try:
                print(output)
            except UnicodeEncodeError:
                print(output.encode('ascii', 'replace').decode('ascii'))
        if error_output:
            try:
                print("STDERR:", error_output)
            except UnicodeEncodeError:
                print("STDERR:", error_output.encode('ascii', 'replace').decode('ascii'))
        
        # Determine if test passed - check both return code AND output content
        success = result.returncode == 0
        
        # Additional check: look for "FAIL" in output even if return code is 0
        if success and output:
            # Check for explicit test failures in output
            if "Failed: 0" not in output and ("FAIL" in output or "failed" in output.lower()):
                success = False
                print(f"WARNING: {test_file} returned success but contains failures in output")
            
            # Look for test summary patterns
            if "Total:" in output and "Failed:" in output:
                # Extract failed count from lines like "Total: 5 tests, Passed: 1, Failed: 4"
                for line in output.split('\n'):
                    if "Failed:" in line and "Total:" in line:
                        try:
                            failed_count = int(line.split("Failed:")[-1].strip().split()[0])
                            if failed_count > 0:
                                success = False
                                print(f"WARNING: {test_file} has {failed_count} failed tests")
                        except (ValueError, IndexError):
                            pass
        
        return test_file, success, output + error_output
        
    except subprocess.TimeoutExpired:
        error_msg = f"Test {test_file} timed out after 120 seconds"
        print(error_msg)
        return test_file, False, error_msg
        
    except Exception as e:
        error_msg = f"Error running {test_file}: {str(e)}"
        print(error_msg)
        return test_file, False, error_msg

async def main():
    """Run all test files and provide summary"""
    print("Starting comprehensive test suite...")
    print(f"Running {len(TEST_FILES)} test files")
    
    results = []
    
    # Run each test file
    for test_file in TEST_FILES:
        test_path = Path(__file__).parent / test_file
        if test_path.exists():
            result = await run_test_file(test_file)
            results.append(result)
        else:
            print(f"Warning: Test file {test_file} not found at {test_path}, skipping...")
            results.append((test_file, False, "File not found"))
    
    # Generate summary
    print(f"\n{'='*80}")
    print("TEST SUITE SUMMARY")
    print(f"{'='*80}")
    
    passed = 0
    failed = 0
    
    for test_file, success, output in results:
        status = "PASS" if success else "FAIL"
        print(f"{test_file:<30} {status}")
        
        if success:
            passed += 1
        else:
            failed += 1
            # Show brief error info for failed tests
            lines = output.split('\n')
            error_lines = [line for line in lines if 'FAIL' in line or 'Error' in line]
            if error_lines:
                print(f"  -> {error_lines[0][:70]}...")
    
    print(f"\n{'='*80}")
    print(f"FINAL RESULTS")
    print(f"{'='*80}")
    print(f"Total test files: {len(results)}")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    
    if failed == 0:
        print("All test suites passed!")
        return True
    else:
        print(f"{failed} test suite(s) failed.")
        return False

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)