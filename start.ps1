# start.ps1 — launch FastAPI backend + React frontend via npm start, staying in project root

$ErrorActionPreference = "Stop"
$projRoot = $PSScriptRoot  # the folder where this script lives

Write-Host "Project root: $projRoot"

# Ensure Python can import your server/ package
$env:PYTHONPATH = $projRoot

Write-Host "Starting FastAPI backend on http://0.0.0.0:8000..."
$backend = Start-Process -PassThru -NoNewWindow `
    -WorkingDirectory $projRoot `
    -FilePath "python.exe" `
    -ArgumentList "-m uvicorn server.main:app --host 0.0.0.0 --port 8000 --reload"
$backend.Id | Out-File -FilePath "$projRoot\.backend.pid"

Write-Host "Starting React frontend (npm start)..."
$frontend = Start-Process -PassThru -NoNewWindow `
    -WorkingDirectory $projRoot `
    -FilePath "npm.cmd" `
    -ArgumentList "--prefix frontend start"
$frontend.Id | Out-File -FilePath "$projRoot\.frontend.pid"

Write-Host "Services are running. Press Ctrl+C to stop both."
try {
    Wait-Process -Id $backend.Id, $frontend.Id
}
finally {
    Write-Host "`nShutting down services..."
    Stop-Process -Id $backend.Id -ErrorAction SilentlyContinue
    Stop-Process -Id $frontend.Id -ErrorAction SilentlyContinue
    Remove-Item "$projRoot\.backend.pid", "$projRoot\.frontend.pid" -ErrorAction SilentlyContinue
}
