@echo off
:: ==============================================================================
:: SQC - STATISTICAL QUALITY CONTROL SYSTEM
:: Windows Service & Auto-Start Setup Script for Server: BJCL
:: Configures SQC to start automatically upon server restart on Port 3001
:: ==============================================================================

title SQC Auto-Start Service Setup (BJCL)
echo ====================================================================
echo   SQC System - Automated Windows Service Installer
echo   Target Server : BJCL
echo   Production Port: 3001
echo ====================================================================
echo.

:: Check for Administrative privileges
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [OK] Running with Administrative privileges.
) else (
    echo [ERROR] This installer must be executed as Administrator!
    echo Right-click this .bat file and select 'Run as administrator'.
    pause
    exit /b 1
)

cd /d "%~dp0"
echo Working Directory: %CD%
echo.

:: Option 1: PM2 Windows Service (Recommended)
echo 1. Installing PM2 and PM2 Windows Startup Helper...
call npm install -g pm2 pm2-windows-startup
if %errorLevel% neq 0 (
    echo [NOTICE] Continuing with local PM2 configuration...
)

echo.
echo 2. Initializing Database "IT SQC"...
call node setup-db.js
if %errorLevel% neq 0 (
    echo [WARNING] Database setup returned an exit code. Ensure PostgreSQL is active on BJCL.
)

echo.
echo 3. Building Frontend Client for Production...
call npm run build

echo.
echo 4. Starting and Saving SQC Service via PM2...
call pm2 start ecosystem.config.cjs
call pm2 save
call pm2-startup install

echo.
echo ====================================================================
echo [SUCCESS] SQC is now configured to start automatically on boot!
echo.
echo Dashboard URL (Local):  http://localhost:3001
echo Dashboard URL (BJCL LAN): http://BJCL:3001
echo Public Access: Forward router Port 3001 to BJCL LAN IP
echo.
echo Admin Login:
echo   Username: admin
echo   Password: Admin@123456
echo ====================================================================
pause
