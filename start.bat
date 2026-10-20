@echo off
setlocal
cd /d "%~dp0"
set "PORT=8765"
set "PY=python"

where python >nul 2>nul
if errorlevel 1 (
  where py >nul 2>nul
  if not errorlevel 1 (
    set "PY=py"
  ) else (
    echo Python not found. Install Python or run: python -m http.server 8765
    pause
    exit /b 1
  )
)

echo Starting Helltaker Dialogue Editor at http://127.0.0.1:%PORT%/
start "Helltaker Editor Server" /min "%PY%" -m http.server %PORT% --bind 127.0.0.1
ping -n 3 127.0.0.1 >nul
start "" "http://127.0.0.1:%PORT%/"
endlocal
