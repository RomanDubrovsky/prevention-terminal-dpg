@echo off
setlocal
title Prevention Terminal - tauri dev

call "%ProgramFiles(x86)%\Microsoft Visual Studio\18\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
if errorlevel 1 (
  echo [ERROR] Build Tools not found. Install "Desktop development with C++".
  pause
  exit /b 1
)

cd /d "%~dp0"
if not exist node_modules (
  echo Installing npm dependencies...
  call npm install
  if errorlevel 1 goto fail
)

echo Starting Prevention Terminal (first build may take 10-15 min)...
call npm run tauri:dev
goto end

:fail
echo Build failed.
pause
exit /b 1

:end
pause
