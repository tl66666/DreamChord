@echo off
chcp 65001 >nul 2>&1
setlocal
cd /d "%~dp0"

echo.
echo  ============================================
echo    DreamChord 一键启动
echo  ============================================
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-dreamchord.ps1"

if %ERRORLEVEL% NEQ 0 (
  echo.
  echo  [X] 启动失败，请查看上方错误信息
  echo  常见原因:
  echo    1. 未安装 Node.js 20+ — https://nodejs.org/
  echo    2. 端口被占用 — 关闭占用程序后重试
  echo    3. 依赖安装失败 — 删除 node_modules 后重试
  echo.
)

echo.
pause
