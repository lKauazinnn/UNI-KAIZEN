@echo off
chcp 65001 >nul
title Kaizen - Start
echo.
echo  ==========================================
echo   Kaizen Laboratórios Educacionais - Start
echo  ==========================================
echo.

echo  [1/2] Iniciando backend  http://localhost:3333 ...
start "Kaizen Backend" cmd /k "cd /d "%~dp0backend" && npm run dev"

echo  [2/2] Iniciando frontend http://localhost:5173 ...
start "Kaizen Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo  Abra http://localhost:5173 no navegador.
echo  Para encerrar, use PARAR.bat.
echo.
pause