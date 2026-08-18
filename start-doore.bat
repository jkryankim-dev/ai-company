@echo off
cd /d "%~dp0"
call pm2 start ecosystem.config.cjs
call pm2 save
exit
