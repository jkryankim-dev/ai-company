@echo off
echo Stopping doore (only doore-related node processes)...
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -match 'doore' } | ForEach-Object { Write-Host ('  kill PID ' + $_.ProcessId); Stop-Process -Id $_.ProcessId -Force }"
echo Done. Other node processes were not touched.
timeout /t 3 >nul
