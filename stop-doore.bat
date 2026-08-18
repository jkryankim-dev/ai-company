@echo off
echo Stopping doore...
taskkill /F /IM node.exe >nul 2>&1
echo Done.
timeout /t 2 >nul
