@echo off
chcp 65001 >nul
title Kaizen - Stop
echo.
echo  Encerrando processos Kaizen (Node/Vite)...
echo.
taskkill /FI "WINDOWTITLE eq Kaizen Backend*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Kaizen Frontend*" /T /F >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1
echo  Finalizado.
echo.
pause