@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title Kaizen - Enviar para GitHub
cd /d "%~dp0"

echo.
echo  ================================================
echo   Kaizen - Enviar arquivos para o GitHub
echo  ================================================
echo.

:: ------------------------------------------------------------
:: 1. Garantir identidade do git (nome e email)
:: ------------------------------------------------------------
git config user.name >nul 2>&1
if errorlevel 1 (
    echo  --- Identidade git nao configurada. Informe abaixo. ---
    set /p NOME="  Seu nome para os commits: "
    git config user.name "!NOME!"
)
git config user.email >nul 2>&1
if errorlevel 1 (
    set /p EMAIL="  Seu email para os commits: "
    git config user.email "!EMAIL!"
)

:: ------------------------------------------------------------
:: 2. Garantir o repositório remoto (origin)
:: ------------------------------------------------------------
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo.
    echo  --- Nenhum repositório remoto configurado. ---
    set /p REMOTO="  URL do repositório no GitHub [Enter = https://github.com/lKauazinnn/plataforma-kaizen]: "
    if "!REMOTO!"=="" set "REMOTO=https://github.com/lKauazinnn/plataforma-kaizen"
    git remote add origin "!REMOTO!"
    if errorlevel 1 (
        echo  Falha ao adicionar o remoto. Verifique a URL e tente de novo.
        pause
        exit /b 1
    )
)

git fetch origin --prune >nul 2>&1

:: ------------------------------------------------------------
:: 3. Escolher a branch
:: ------------------------------------------------------------
:escolher_branch
echo.
echo  --- Branches disponíveis ---
set n=0
git branch --format="%(refname:short)" > "%TEMP%\kaizen-branches.txt"
for /f "delims=" %%B in (%TEMP%\kaizen-branches.txt) do (
    set /a n+=1
    echo    [!n!] %%B
    set "B!n!=%%B"
)
set /a n+=1
set /a nova=n
echo    [!nova!] ^(criar nova branch^)
echo.
set /p OPCAO="  Escolha o número da branch para enviar: "

if not defined OPCAO (
    echo  Opção inválida.
    goto escolher_branch
)
call set "BRANCH=%%B!OPCAO!%%"
if defined BRANCH goto branch_ok

if "!OPCAO!"=="!nova!" (
    set /p NOVA="  Nome da nova branch (ex: feature/nome-da-feature): "
    if "!NOVA!"=="" (
        echo  Nome vazio. Tente de novo.
        goto escolher_branch
    )
    git checkout -b "!NOVA!"
    if errorlevel 1 (
        echo  Falha ao criar a branch. Tente de novo.
        goto escolher_branch
    )
    set "BRANCH=!NOVA!"
    goto branch_ok
)

echo  Opção inválida.
goto escolher_branch

:branch_ok
git checkout "!BRANCH!" >nul 2>&1
echo.
echo  Branch selecionada: !BRANCH!
echo.

:: ------------------------------------------------------------
:: 4. Adicionar arquivos
:: ------------------------------------------------------------
echo  --- Adicionando arquivos alterados/novos ---
git add -A
echo.
echo  Resumo das mudanças:
git status --short
echo.

:: ------------------------------------------------------------
:: 5. Mensagem do commit
:: ------------------------------------------------------------
set /p MENSAGEM="  Mensagem do commit [Enter = 'atualizacao kaizen']: "
if "!MENSAGEM!"=="" set "MENSAGEM=atualizacao kaizen"

git commit -m "!MENSAGEM!"
if errorlevel 1 (
    echo.
    echo  Nada para commitar (nenhuma alteração) ou falha no commit.
    pause
    exit /b 1
)

:: ------------------------------------------------------------
:: 6. Enviar para o GitHub
:: ------------------------------------------------------------
echo.
echo  --- Enviando para origin/!BRANCH! ... ---
git push -u origin "!BRANCH!"
if errorlevel 1 (
    echo.
    echo  Falha no envio. Possíveis causas:
    echo   - Nao autenticado: instale "Git Credential Manager" ou gere um
    echo     Personal Access Token do GitHub e use como senha.
    echo   - Remote a frente: rode "git pull origin !BRANCH!" e tente de novo.
    pause
    exit /b 1
)

echo.
echo  ================================================
echo   Enviado com sucesso para origin/!BRANCH!
echo  ================================================
echo.
pause