import asyncio
import websockets
import json
import wave
import time
import numpy as np
from pathlib import Path

async def test_websocket_transcription(src_lang="auto"):
    """Test WebSocket transcription with test.wav file at real-time speed"""
    uri = f"ws://localhost:8000/v1/realtime/transcription_sessions?src_lang={src_lang}"
    
    # Find test.wav in project root
    test_file = Path(__file__).parent.parent / "test.wav"
    if not test_file.exists():
        print(f"Test file not found: {test_file}")
        return
        
    print(f"Using test file: {test_file} with language: {src_lang}")
    
    # Read the WAV file and get audio properties
    with wave.open(str(test_file), 'rb') as wav:
        audio_bytes = wav.readframes(wav.getnframes())
        sample_rate = wav.getframerate()
        channels = wav.getnchannels()
        sample_width = wav.getsampwidth()
        total_frames = wav.getnframes()
        
    print(f"Original audio: {sample_rate}Hz, {channels}ch, {sample_width}B/sample, {total_frames} frames")
    
    # Convert audio to format expected by WebSocket handler (16kHz mono)
    target_sample_rate = 16000
    
    # Convert bytes to numpy array
    if sample_width == 2:  # 16-bit
        audio_data = np.frombuffer(audio_bytes, dtype=np.int16)
    else:
        print(f"Unsupported sample width: {sample_width}")
        return
    
    # Handle stereo to mono conversion
    if channels == 2:
        audio_data = audio_data.reshape(-1, 2)
        audio_data = np.mean(audio_data, axis=1).astype(np.int16)
        print("Converted stereo to mono")
    
    # Resample to 16kHz if needed
    if sample_rate != target_sample_rate:
        # Simple downsampling by taking every nth sample
        downsample_factor = sample_rate // target_sample_rate
        audio_data = audio_data[::downsample_factor]
        print(f"Downsampled from {sample_rate}Hz to {target_sample_rate}Hz (factor: {downsample_factor})")
    
    # Convert back to bytes
    audio_bytes = audio_data.tobytes()
    
    # Calculate timing for real-time playback at 16kHz
    total_duration = len(audio_data) / target_sample_rate
    bytes_per_second = target_sample_rate * 2  # 16-bit mono
    
    print(f"Processed audio: {total_duration:.2f}s, {target_sample_rate}Hz, 1ch, 2B/sample")
    print(f"Bytes per second: {bytes_per_second}")
        
    try:
        async with websockets.connect(uri) as websocket:
            print("WebSocket connected, starting real-time simulation...")
            
            # Send audio in chunks that match expected frame size (1024 bytes = 512 samples)
            chunk_size = 1024  # Expected by WebSocket handler
            chunks_sent = 0
            
            # Calculate how often to send chunks for real-time playback
            samples_per_chunk = chunk_size // 2  # 16-bit samples
            chunk_duration = samples_per_chunk / target_sample_rate
            print(f"Sending {chunk_size} byte chunks ({samples_per_chunk} samples) every {chunk_duration:.3f}s")
            
            start_time = time.time()
            
            for i in range(0, len(audio_bytes), chunk_size):
                chunk = audio_bytes[i:i + chunk_size]
                
                # Pad last chunk if needed
                if len(chunk) < chunk_size:
                    chunk = chunk + b'\x00' * (chunk_size - len(chunk))
                
                # Calculate when this chunk should be sent
                expected_time = start_time + (chunks_sent * chunk_duration)
                current_time = time.time()
                
                # Wait if we're sending too fast
                if current_time < expected_time:
                    await asyncio.sleep(expected_time - current_time)
                
                await websocket.send(chunk)
                chunks_sent += 1
                
                # Try to get response after each chunk
                try:
                    response = await asyncio.wait_for(websocket.recv(), timeout=0.001)
                    elapsed = time.time() - start_time
                    print(f"[{elapsed:.2f}s] Chunk {chunks_sent}: {response}")
                except asyncio.TimeoutError:
                    # Don't print for every chunk to avoid spam
                    if chunks_sent % 20 == 0:  # Print every 20 chunks
                        elapsed = time.time() - start_time
                        print(f"[{elapsed:.2f}s] Sent {chunks_sent} chunks, no response yet...")
            
            # Wait up to 120 seconds for final responses
            print("Audio finished, waiting for final responses (up to 120 seconds)...")
            try:
                timeout_start = time.time()
                response_count = 0
                while time.time() - timeout_start < 120:  # Wait up to 120 seconds
                    try:
                        response = await asyncio.wait_for(websocket.recv(), timeout=10.0)
                        elapsed = time.time() - start_time
                        response_count += 1
                        print(f"[{elapsed:.2f}s] Response {response_count}: {response}")
                    except asyncio.TimeoutError:
                        elapsed = time.time() - start_time
                        if response_count == 0:
                            print(f"[{elapsed:.2f}s] Still waiting for transcription...")
                        else:
                            print(f"[{elapsed:.2f}s] No more responses after {response_count} total responses")
                            break
                
                if response_count == 0:
                    print("No transcription responses received after 120 seconds")
                else:
                    print(f"Received {response_count} total responses")
                    
            except Exception as e:
                print(f"Error waiting for responses: {e}")
                
    except Exception as e:
        print(f"WebSocket error: {e}")

    # Process responses from the WebSocket
    async for message in websocket:
        try:
            data = json.loads(message)
            if data.get("type") == "transcription":
                # Handle Unicode safely when printing
                text = data.get("text", "")
                try:
                    print(f"✓ Received transcription: '{text}'")
                except UnicodeEncodeError:
                    safe_text = text.encode('ascii', 'replace').decode('ascii')
                    print(f"✓ Received transcription: '{safe_text}'")
                responses.append(data)
            elif data.get("type") == "error":
                print(f"✗ Error from server: {data.get('message', 'Unknown error')}")
                responses.append(data)
            else:
                print(f"? Unknown message type: {data}")
        except json.JSONDecodeError as e:
            print(f"✗ Invalid JSON received: {e}")
        except Exception as e:
            print(f"✗ Error processing message: {e}")
            break

if __name__ == "__main__":
    print("Starting real-time WebSocket transcription test...")
    asyncio.run(test_websocket_transcription())