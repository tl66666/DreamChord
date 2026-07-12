@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-dreamchord.ps1"

if %ERRORLEVEL% NEQ 0 (
  echo.
  echo  [X] 启动失败，请查看上方的具体错误。
  echo  常见原因：
  echo    1. 尚未安装 Node.js 20 或更高版本：https://nodejs.org/
  echo    2. 旧的 DreamChord 服务仍在运行，请关闭旧服务窗口后重试
  echo    3. 首次安装网络中断，请恢复网络后重新双击本脚本
  echo  详细诊断：powershell -ExecutionPolicy Bypass -File scripts\doctor.ps1
  echo.
)

echo.
pause
