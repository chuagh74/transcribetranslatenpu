# NPU Speech Transcription Service

**Local Whisper transcription / translation accelerated by Intel NPU (Core Ultra / Meteor Lake) with OpenVINO GenAI.**

---

## Prerequisites

### Hardware

- Intel NPU-capable PC (Core Ultra or newer)

### System software - Windows 10/11 (PowerShell examples)

1. **Node.js LTS** - front-end dev server

```powershell
winget install -e --id OpenJS.NodeJS.LTS
```

Or grab the MSI: [https://nodejs.org/en/download](https://nodejs.org/en/download)

2. **Conda** - Python env manager  
Install Miniconda / Anaconda: [https://docs.conda.io/en/latest/miniconda.html](https://docs.conda.io/en/latest/miniconda.html)

```powershell
& "C:\Windows\System32\curl.exe" -o "$env:USERPROFILE\Downloads\Miniconda3-latest-Windows-x86_64.exe" "https://repo.anaconda.com/miniconda/Miniconda3-latest-Windows-x86_64.exe"
Start-Process "$env:USERPROFILE\Downloads\Miniconda3-latest-Windows-x86_64.exe" -ArgumentList "/quiet", "/InstallAllUsers=1", "/PrependPath=1" -Wait
```

3. **Python**  
Install Python 3.8 - 3.12. Both manual or via PowerShell works.

```powershell
winget install Python.Python.3.12 --scope machine
```

4. **OpenVINO Runtime 2025.1 & OpenVINO GenAI 2025.1** - inference back-end

#### Download
```powershell
& "C:\Windows\System32\curl.exe" -L -o "$env:USERPROFILE\Documents\openvino_2025.zip" "https://storage.openvinotoolkit.org/repositories/openvino/packages/2025.1/windows/openvino_toolkit_windows_2025.1.0.18503.6fec06580ab_x86_64.zip"
& "C:\Windows\System32\curl.exe" -L -o "$env:USERPROFILE\Documents\openvino_genai_2025.zip" "https://storage.openvinotoolkit.org/repositories/openvino_genai/packages/2025.1/windows/openvino_genai_windows_2025.1.0.0_x86_64.zip"
```

#### Extract
```powershell
Expand-Archive $env:USERPROFILE\Documents\openvino_2025.zip -DestinationPath $env:TEMP\ov -Force
Expand-Archive $env:USERPROFILE\Documents\openvino_genai_2025.zip -DestinationPath $env:TEMP\ovg -Force
```

#### Install
```powershell
$ovSubfolder = Get-ChildItem -Path "$env:TEMP\ov" -Directory | Where-Object { $_.Name -like "*openvino*" }
$ovgSubfolder = Get-ChildItem -Path "$env:TEMP\ovg" -Directory | Where-Object { $_.Name -like "*openvino_genai*" }

Move-Item "$env:TEMP\ov\$ovSubfolder" "C:\Program Files (x86)\Intel\openvino_2025" -Force
Move-Item "$env:TEMP\ovg\$ovgSubfolder" "C:\Program Files (x86)\Intel\openvino_genai_2025" -Force

Remove-Item -Path `
  "$env:USERPROFILE\Documents\openvino_2025.zip", `
  "$env:USERPROFILE\Documents\openvino_genai_2025.zip", `
  "$env:TEMP\ov", `
  "$env:TEMP\ovg" -Force -Recurse

& "C:\Program Files (x86)\Intel\openvino_2025\setupvars.ps1"
& "C:\Program Files (x86)\Intel\openvino_genai_2025\setupvars.ps1"
```

5. **Python wheels** (inside the conda env)

```powershell
conda activate
conda env create -f environment.yml
conda activate NPU

pip install --upgrade pip
pip install `
  "optimum[openvino,onnxruntime-gpu]" `
  "openvino-genai==2025.1.0" `
  "nncf" `
  "uv" `
  "fastapi" `
  "faster_whisper" `
  "huggingface" `
  "uvicorn" `
  "websockets" `
  "hf_xet" `
  "python-multipart" `
  "sentencepiece" `
  "pydub" `
  "accelerate"
```

6. **FFmpeg** - audio decoding / resampling backend

```powershell
winget install -e --id Gyan.FFmpeg
# or via Chocolatey
choco install ffmpeg --confirm
```

Verify:

```powershell
ffmpeg -version
```

---

### Initialise OpenVINO in the current shell

```powershell
conda init
& "C:\Program Files (x86)\Intel\openvino_2025\setupvars.ps1"
& "C:\Program Files (x86)\Intel\openvino_genai_2025\setupvars.ps1"
```

Add the two lines to `$PROFILE` so every PowerShell session loads them automatically.

**Check installation:**

```powershell
python -c "import openvino as ov; print(ov.Core().available_devices)"
```

`['NPU', 'CPU']` (or similar) confirms everything is wired up.

---

## Repository setup

```powershell
git clone https://huggingface.co/burn874/transcribe-NPU NPU
cd NPU
conda env create -f environment.yml
conda activate NPU
```

---

## Running

### Backend only

```powershell
python -m uvicorn server.main:app --host 0.0.0.0 --port 8000 --reload
```

### Front-end only

```powershell
cd frontend
npm install

# Dev server
npm start

# Production bundle
npm run build
```

### Front-end + backend together

```powershell
.\start.ps1
```

`start.ps1` launches React (`npm start`) and Uvicorn, then cleans up when you exit.

---

## API Endpoints

| Path      | Method | Description  |
| --------- | ------ | ------------ |
| `/docs`   | GET    | Swagger UI   |
| `/health` | GET    | Health check |

---

## Linux / macOS notes

- Use the `.tgz` archives for Runtime & GenAI and run the accompanying `.sh` setup scripts.
- Replace `Move-Item` with `sudo mv`.
- Install Node via package manager (`sudo apt install nodejs` or `brew install node`).
- No extra NPU driver is required on Linux.
- **FFmpeg**: `sudo apt install ffmpeg` or `brew install ffmpeg`.

---

## Troubleshooting

- `ov.Core().available_devices` should list **NPU**. If missing, reinstall the NPU driver and reboot.
- Run `ffmpeg -encoders | findstr pcm_s16le` – PCM encoders must be present.
- Always open a *new* shell or re-run the `setupvars` scripts after installing OpenVINO.
# transcribetranslatenpu
