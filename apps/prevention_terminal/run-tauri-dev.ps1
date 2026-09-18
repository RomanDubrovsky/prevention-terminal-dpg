# Double-click or: powershell -ExecutionPolicy Bypass -File run-tauri-dev.ps1
$vcvars = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\18\BuildTools\VC\Auxiliary\Build\vcvars64.bat'
if (-not (Test-Path $vcvars)) {
  Write-Host 'Build Tools not found.' -ForegroundColor Red
  Read-Host 'Press Enter'
  exit 1
}

cmd /c "`"$vcvars`" && set" | ForEach-Object {
  if ($_ -match '^(.*?)=(.*)$') { Set-Item -Path "Env:$($matches[1])" -Value $matches[2] }
}

Set-Location $PSScriptRoot
# Dev default: intl edition (RU = Cloud.ru later). Override: $env:VITE_TERMINAL_EDITION = "ru"
if (-not (Test-Path node_modules)) { npm install }
Write-Host 'Starting tauri dev (first build ~10-15 min)...' -ForegroundColor Cyan
npm run tauri:dev
