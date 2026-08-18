@echo off
title doore - running (keep this window open)
cd /d "%~dp0"
if not exist runtime\logs mkdir runtime\logs
echo.
echo   doore is starting. Keep this window open.
echo.
node runtime\supervisor.mjs
echo.
echo   doore has stopped.
pause
