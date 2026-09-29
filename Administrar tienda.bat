@echo off
title Panel JC Perfumeria
cd /d "%~dp0"
echo Abriendo el panel de JC Perfumeria...
node "panel-local\servidor.js"
if errorlevel 1 pause
