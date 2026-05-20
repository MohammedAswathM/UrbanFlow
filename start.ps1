# UrbanFlow one-shot launcher (Windows / PowerShell)
# Installs deps if missing, starts the FastAPI backend and the React dev server.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

Write-Host "==> UrbanFlow launcher" -ForegroundColor Cyan

# --- Backend ---
Write-Host "==> Installing Python dependencies..." -ForegroundColor Yellow
python -m pip install --quiet -r backend/requirements.txt

Write-Host "==> Starting FastAPI on http://localhost:8000" -ForegroundColor Green
$backend = Start-Process -PassThru -FilePath "python" -ArgumentList "-m","uvicorn","main:app","--reload","--port","8000" -WorkingDirectory "$root/backend" -WindowStyle Minimized

Start-Sleep -Seconds 2

# --- Frontend ---
if (-not (Test-Path "$root/frontend/node_modules")) {
  Write-Host "==> Installing Node dependencies (first run only)..." -ForegroundColor Yellow
  Push-Location "$root/frontend"
  npm install
  Pop-Location
}

Write-Host "==> Starting React dev server on http://localhost:5173" -ForegroundColor Green
$frontend = Start-Process -PassThru -FilePath "npm" -ArgumentList "run","dev" -WorkingDirectory "$root/frontend"

Write-Host ""
Write-Host "UrbanFlow is running:" -ForegroundColor Cyan
Write-Host "  - API : http://localhost:8000/docs"
Write-Host "  - App : http://localhost:5173"
Write-Host "Press Ctrl+C to stop."

try { Wait-Process -Id $frontend.Id } finally { Stop-Process -Id $backend.Id -ErrorAction SilentlyContinue }
