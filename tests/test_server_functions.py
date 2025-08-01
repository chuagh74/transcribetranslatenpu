import asyncio
import sys
import os
import numpy as np
import wave
from pathlib import Path

# Add parent directory to path so we can import server modules
parent_dir = Path(__file__).parent.parent
sys.path.insert(0, str(parent_dir))

from server.pipelines.VAD import VADSettings
from server.pipelines.OVWhisperTranscriber import OVWhisperTranscriber
import server.config as config

def load_and_process_audio(audio_path: Path) -> np.ndarray:
    """Load and process audio file for testing"""
    with wave.open(str(audio_path), 'rb') as wav:
        audio_bytes = wav.readframes(wav.getnframes())
        sample_rate = wav.getframerate()
        channels = wav.getnchannels()
        
    # Convert to numpy array
    audio_data = np.frombuffer(audio_bytes, dtype=np.int16)
    
    # Handle stereo to mono conversion
    if channels == 2:
        audio_data = audio_data.reshape(-1, 2)
        audio_data = np.mean(audio_data, axis=1).astype(np.int16)
        
    # Resample to 16kHz if needed
    if sample_rate != 16000:
        downsample_factor = sample_rate // 16000
        audio_data = audio_data[::downsample_factor]
    
    return audio_data

async def test_vad_directly():
    """Test VAD functionality directly"""
    print("\n=== Testing VAD directly ===")
    
    # Load test audio
    test_file = Path(__file__).parent.parent / "test.wav"
    if not test_file.exists():
        print(f"Test file not found: {test_file}")
        return False
        
    # Read and process audio like the WebSocket handler does
    with wave.open(str(test_file), 'rb') as wav:
        audio_bytes = wav.readframes(wav.getnframes())
        sample_rate = wav.getframerate()
        channels = wav.getnchannels()
        
    print(f"Original audio: {sample_rate}Hz, {channels} channels, {len(audio_bytes)} bytes")
        
    # Convert to 16kHz mono like WebSocket handler
    audio_data = np.frombuffer(audio_bytes, dtype=np.int16)
    if channels == 2:
        audio_data = audio_data.reshape(-1, 2)
        audio_data = np.mean(audio_data, axis=1).astype(np.int16)
        print("Converted stereo to mono")
        
    if sample_rate != 16000:
        downsample_factor = sample_rate // 16000
        audio_data = audio_data[::downsample_factor]
        print(f"Downsampled from {sample_rate}Hz to 16000Hz")
        
    print(f"Processed audio: {len(audio_data)} samples")
    
    # Test VAD
    try:
        vad = VADSettings.SILERO_VAD
        print("VAD loaded successfully")
        
        # Reset VAD state
        vad.reset_states()
        
        # Process audio in chunks like WebSocket does
        chunk_size = 512  # samples
        speech_detected = False
        vad_events = []
        
        for i in range(0, len(audio_data), chunk_size):
            chunk = audio_data[i:i + chunk_size]
            if len(chunk) < chunk_size:
                chunk = np.pad(chunk, (0, chunk_size - len(chunk)))
                
            # Normalize to [-1, 1] for VAD
            normalized_chunk = chunk.astype(np.float32) / 32768.0
            result = vad(normalized_chunk)
            
            if result:
                vad_events.append((i, result))
                print(f"VAD event at sample {i}: {result}")
                speech_detected = True
                
        if speech_detected:
            print(f"VAD detected speech - {len(vad_events)} events")
        else:
            print("VAD did not detect speech")
            
        return speech_detected
        
    except Exception as e:
        print(f"VAD test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_whisper_directly():
    """Test Whisper transcriber directly"""
    print("\n=== Testing Whisper directly ===")
    
    try:
        from server.config import stt_model
        print("Whisper transcriber loaded from config")
        
        # Load and process test audio
        test_audio_path = Path(__file__).parent.parent / "test.wav"
        if not test_audio_path.exists():
            print("Whisper test failed: test.wav not found")
            return False
            
        audio_data = load_and_process_audio(test_audio_path)
        print(f"Transcribing {len(audio_data)} samples...")
        
        # Test transcription
        result = stt_model.transcribe(audio_data, language="en")
        
        # Handle Unicode safely when printing
        try:
            print(f"Transcription successful: '{result}'")
        except UnicodeEncodeError:
            safe_result = result.encode('ascii', 'replace').decode('ascii') if result else ""
            print(f"Transcription successful: '{safe_result}'")
        
        return True
    except Exception as e:
        print(f"Whisper test failed: {e}")
        return False

async def test_transcription_service():
    """Test transcription service with real audio"""
    print("\n=== Testing Transcription Service ===")
    
    try:
        from server.services.transcribe_service import transcribe_audio_bytes
        
        # Load test audio
        test_audio_path = Path(__file__).parent.parent / "test.wav"
        if not test_audio_path.exists():
            print("Transcription service test failed: test.wav not found")
            return False
            
        # Convert to PCM format using a unique temporary file
        import subprocess, tempfile, os, uuid
        
        unique_id = str(uuid.uuid4())
        with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{unique_id}.wav") as tmp:
            tmp_path = tmp.name
        
        try:
            # Use -y flag to overwrite existing files
            subprocess.run([
                "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                "-i", str(test_audio_path), "-ac", "1", "-ar", "16000",
                "-f", "wav", tmp_path
            ], check=True)
            
            with open(tmp_path, 'rb') as f:
                wav_data = f.read()
                # Skip WAV header (44 bytes) to get raw PCM
                pcm_data = wav_data[44:] if len(wav_data) > 44 else b''
            
            if len(pcm_data) == 0:
                print("Transcription service test failed: No PCM data extracted")
                return False
                
            print(f"Testing transcription service with {len(pcm_data)} bytes")
            
            # Test transcription
            result = transcribe_audio_bytes(pcm_data, language="en")
            text = result.get("text", "")
            
            # Handle Unicode safely when printing
            try:
                print(f"Transcription service successful: '{text}'")
            except UnicodeEncodeError:
                safe_text = text.encode('ascii', 'replace').decode('ascii') if text else ""
                print(f"Transcription service successful: '{safe_text}'")
            
            return True
            
        finally:
            try:
                os.unlink(tmp_path)
            except:
                pass
        
    except Exception as e:
        print(f"Transcription service test failed: {e}")
        return False

async def test_websocket_handler_components():
    """Test components used by WebSocket handler"""
    print("\n=== Testing WebSocket Handler Components ===")
    
    try:
        # Test imports
        from server.routers.transcribe_ws import router
        print("WebSocket router imports successful")
        
        # Test config
        print(f"Device: {config.device}")
        print(f"STT model type: {type(config.stt_model)}")
        
        return True
        
    except Exception as e:
        print(f"WebSocket handler component test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

async def main():
    """Run all direct tests"""
    print("Starting direct server function tests...")
    
    results = []
    
    # Test VAD
    vad_result = await test_vad_directly()
    results.append(("VAD", vad_result))
    
    # Test Whisper
    whisper_result = await test_whisper_directly()
    results.append(("Whisper", whisper_result))
    
    # Test Transcription Service
    service_result = await test_transcription_service()
    results.append(("Transcription Service", service_result))
    
    # Test WebSocket components
    ws_result = await test_websocket_handler_components()
    results.append(("WebSocket Components", ws_result))
    
    # Summary
    print("\n=== Test Results Summary ===")
    all_passed = True
    for test_name, passed in results:
        status = "PASS" if passed else "FAIL"
        print(f"{test_name}: {status}")
        if not passed:
            all_passed = False
            
    if all_passed:
        print("\nAll direct tests passed! WebSocket issue might be in the handler logic.")
    else:
        print("\nSome tests failed. This explains the WebSocket transcription issue.")
    
    return all_passed

if __name__ == "__main__":
    asyncio.run(main())