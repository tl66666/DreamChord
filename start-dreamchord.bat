@echo off
setlocal
cd /d "%~dp0"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-dreamchord.ps1"

if %ERRORLEVEL% NEQ 0 (
  echo.
  echo  [X] Start failed. Check error messages above.
  echo  Common causes:
  echo    1. Node.js 20+ not installed - https://nodejs.org/
  echo    2. Port in use - close the program and retry
  echo    3. Dependencies failed - delete node_modules and retry
  echo.
)

echo.
pause
