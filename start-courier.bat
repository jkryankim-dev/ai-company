@echo off
title doore courier (git sync only - safe to keep open)
cd /d "%~dp0"
echo.
echo   doore courier running. This only syncs files with GitHub.
echo   No gateway, no scheduler - safe alongside the VPS company.
echo.
node runtime\sync.mjs
pause
