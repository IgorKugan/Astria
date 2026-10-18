@echo off
setlocal
cd /d "%~dp0"
if exist ".node-path" set /p MULTINEST_NODE=<.node-path
if defined MULTINEST_NODE set "PATH=%MULTINEST_NODE%;%PATH%"
where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo Instale Node.js LTS: https://nodejs.org/
  pause
  exit /b 1
)
if not exist "node_modules\electron\dist\electron.exe" (
  call npm.cmd ci
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
call npm.cmd test
if errorlevel 1 (
  pause
  exit /b 1
)
call npm.cmd run package:win
if errorlevel 1 (
  echo O empacotamento falhou. Confira a mensagem acima.
  pause
  exit /b 1
)
echo Instalador criado na pasta dist.
pause
