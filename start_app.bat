@echo off
cd /d "%~dp0"

where py >nul 2>nul
if not errorlevel 1 (
    set PY_CMD=py
) else (
    set PY_CMD=python
)

where %PY_CMD% >nul 2>nul
if errorlevel 1 (
    echo Python nao encontrado no PATH.
    pause
    exit /b 1
)

set "SERVER_IP=127.0.0.1"
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /R /C:"IPv4"') do (
    set "SERVER_IP=%%a"
    set "SERVER_IP=!SERVER_IP: =!"
    goto :ip_found
)

:ip_found
if "%SERVER_IP%"=="" set "SERVER_IP=127.0.0.1"

echo Iniciando Nivel Tech...
echo Acessar no navegador: http://%SERVER_IP%:5000
start "" http://%SERVER_IP%:5000
%PY_CMD% server.py
