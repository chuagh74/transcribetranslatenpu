# Check if winget exists
if (Get-Command winget -ErrorAction SilentlyContinue) {
    Write-Host "winget is already installed. Version:" (winget --version)
} else {
    Write-Host "winget not found. Installing App Installer package..."

    # Define download URL for latest release MSIX bundle from GitHub
    # NOTE: This URL might change over time; this is a stable known release as of now.
    $msixUrl = "https://github.com/microsoft/winget-cli/releases/download/v1.20.11800/Microsoft.DesktopAppInstaller_8wekyb3d8bbwe.msixbundle"

    # Define local download path
    $downloadPath = "$env:TEMP\Microsoft.DesktopAppInstaller.msixbundle"

    # Download the MSIX bundle
    Invoke-WebRequest -Uri $msixUrl -OutFile $downloadPath -UseBasicParsing

    # Install the MSIX bundle
    # Requires running PowerShell as admin and the system supports Add-AppxPackage
    try {
        Add-AppxPackage -Path $downloadPath -Register -DisableDevelopmentMode
        Write-Host "App Installer installed successfully."
    } catch {
        Write-Error "Failed to install App Installer package. Try installing manually from Microsoft Store or the GitHub releases page."
        Remove-Item $downloadPath -ErrorAction SilentlyContinue
    }

    # Clean up downloaded file
    Remove-Item $downloadPath -ErrorAction SilentlyContinue

    Write-Host "Installation complete. Please restart your PowerShell session and run 'winget --version' to verify."
}

# Install Choco
if (Get-Command choco -ErrorAction SilentlyContinue) {
    Write-Host "choco is already installed. Version:" (choco --version)
} else {
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
}

# 1. Node.js LTS
if (Get-Command node -ErrorAction SilentlyContinue) {
    Write-Host "node is already installed. Version:" (node --version)
} else {
    choco install nodejs-lts -y
}

# 2. Python 3.12
if ((Get-Command python -ErrorAction SilentlyContinue) -and ((& python --version 2>&1).Trim() -match "Python 3\.12\.\d+")) {
    Write-Host "Python 3.12 is already installed: $versionOutput"
} else {
    choco install python --version=3.12 --params "/InstallDir:C:/Python312 /PrependPath" --yes
}

# 3. Miniconda
if (-not ($Env:CONDA_EXE) -or -not (Test-Path $Env:CONDA_EXE)) {
    Write-Host "Miniconda not found. Installing..."

    $minicondaInstaller = "$env:USERPROFILE\Downloads\Miniconda3-latest-Windows-x86_64.exe"
    & "C:\Windows\System32\curl.exe" -L -o $minicondaInstaller "https://repo.anaconda.com/miniconda/Miniconda3-latest-Windows-x86_64.exe"

    Start-Process -FilePath $minicondaInstaller -ArgumentList "/S", "/InstallAllUsers=1", "/PrependPath=1" -Wait

    Write-Host "Miniconda installed."
} else {
    Write-Host "Miniconda already installed at $Env:CONDA_EXE"
}

# 4. OpenVINO 2025.1
$openvinoZip = "$env:USERPROFILE\Documents\openvino_2025.zip"
$openvinoGenAIZip = "$env:USERPROFILE\Documents\openvino_genai_2025.zip"

Write-Host "Downloading OpenVINO"
& "C:\Windows\System32\curl.exe" -L -o $openvinoZip "https://storage.openvinotoolkit.org/repositories/openvino/packages/2025.1/windows/openvino_toolkit_windows_2025.1.0.18503.6fec06580ab_x86_64.zip"

Write-Host "Downloading OpenVINO GenAI"
& "C:\Windows\System32\curl.exe" -L -o $openvinoGenAIZip "https://storage.openvinotoolkit.org/repositories/openvino_genai/packages/2025.1/windows/openvino_genai_windows_2025.1.0.0_x86_64.zip"

$openvinoExtractPath = "$env:TEMP\ov"
$openvinoGenAIExtractPath = "$env:TEMP\ovg"

Expand-Archive -Path $openvinoZip -DestinationPath $openvinoExtractPath -Force
Expand-Archive -Path $openvinoGenAIZip -DestinationPath $openvinoGenAIExtractPath -Force

$ovSubfolder = Get-ChildItem -Path $openvinoExtractPath -Directory | Where-Object { $_.Name -like "*openvino*" }
$ovgSubfolder = Get-ChildItem -Path $openvinoGenAIExtractPath -Directory | Where-Object { $_.Name -like "*openvino_genai*" }

Move-Item -Path "$openvinoExtractPath\$($ovSubfolder.Name)" -Destination "C:\Program Files (x86)\Intel\openvino_2025" -Force
Move-Item -Path "$openvinoGenAIExtractPath\$($ovgSubfolder.Name)" -Destination "C:\Program Files (x86)\Intel\openvino_genai_2025" -Force

Remove-Item -Path $openvinoZip, $openvinoGenAIZip, $openvinoExtractPath, $openvinoGenAIExtractPath -Force -Recurse

& "C:\Program Files (x86)\Intel\openvino_2025\setupvars.ps1"
& "C:\Program Files (x86)\Intel\openvino_genai_2025\setupvars.ps1"

Write-Host "Installed OpenVINO and OpenVINO GenAI"

# 5. FFmpeg
winget install -e --id Gyan.FFmpeg -h

# 6. Python wheels installation (inside conda env)
$condaBase = Split-Path -Parent (Split-Path -Parent $Env:CONDA_EXE);
$condaInitScript = Join-Path $condaBase "shell\condabin\conda-hook.ps1";

& $condaInitScript

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