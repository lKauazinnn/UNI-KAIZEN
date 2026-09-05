@echo off
chcp 65001 >nul
setlocal
title Kaizen - Start
cd /d "%~dp0"

echo.
echo  ==========================================
echo   Kaizen Laboratórios Educacionais - Start
echo  ==========================================
echo.

if not exist "backend\package.json" (
    echo  ERRO: backend\package.json nao encontrado.
    pause
    exit /b 1
)

:: Se nao houver .env, copia o exemplo para facilitar o preenchimento
if not exist "backend\.env" (
    echo  AVISO: backend\.env nao existe.
    copy "backend\.env.example" "backend\.env" >nul
    echo  Criei backend\.env a partir do exemplo.
    echo  PREENCHA as chaves do Supabase antes de o backend funcionar.
    echo.
    echo  .env pronto? Aperte uma tecla para continuar mesmo assim.
    pause >nul
)

:: Instala dependências se ainda nao instaladas
if not exist "backend\node_modules" (
    echo  [0/3] Instalando dependencias do backend...
    pushd backend
    call npm install
    popd
    if errorlevel 1 ( echo  ERRO ao instalar backend. & pause & exit /b 1 )
)
if not exist "frontend\node_modules" (
    echo  [0/3] Instalando dependencias do frontend...
    pushd frontend
    call npm install
    popd
    if errorlevel 1 ( echo  ERRO ao instalar frontend. & pause & exit /b 1 )
)

echo  [1/3] Iniciando backend  http://localhost:3333 ...
start "Kaizen Backend" cmd /k "cd /d "%~dp0backend" && npm run dev"

echo  [2/3] Iniciando frontend http://localhost:5173 ...
start "Kaizen Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo  [3/3] Pronto!
echo.
echo  Abra http://localhost:5173 no navegador.
echo  Para encerrar, use PARAR.bat.
echo.
pause