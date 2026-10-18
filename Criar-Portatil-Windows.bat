@echo off
setlocal
cd /d "%~dp0"
if exist ".node-path" set /p ASTRIA_NODE=<.node-path
if defined ASTRIA_NODE set "PATH=%ASTRIA_NODE%;%PATH%"
where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo Instale Node.js LTS: https://nodejs.org/
  pause
  exit /b 1
)
if not exist "node_modules\electron\dist\electron.exe" (
  call npm.cmd ci
  if errorlevel 1 exit /b 1
)
call npm.cmd test
if errorlevel 1 exit /b 1
call npm.cmd run package:portable
if errorlevel 1 (
  echo Geracao interrompida. Confira o erro acima; nenhuma pasta Save deve ser substituida.
  pause
  exit /b 1
)
echo Pasta portatil criada em dist. Copie a pasta inteira para usar em outro local.
pause
