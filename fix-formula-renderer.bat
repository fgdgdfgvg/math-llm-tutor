@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo   Formula Renderer Service - Windows Fix Script
echo ========================================================
echo.

set SCRIPT_DIR=%~dp0
set PROJECT_ROOT=%SCRIPT_DIR%
set FORMULA_DIR=%PROJECT_ROOT%formula-renderer-service

echo [1/5] Cleaning up...
echo.

REM 停止可能占用文件的进程
echo Stopping Node.js processes that might be using canvas...
taskkill /F /IM node.exe /FI "WINDOWTITLE eq Formula*" >nul 2>&1

REM 清理 node_modules
cd /d "%FORMULA_DIR%"
if exist "node_modules" (
    echo Removing old node_modules...
    rmdir /s /q node_modules 2>nul
    if errorlevel 1 (
        echo Warning: Could not remove node_modules. Please close any programs using these files.
        echo Trying to continue...
    )
)

REM 清理 npm 缓存
echo Cleaning npm cache...
call npm cache clean --force

echo.
echo [2/5] Checking Node.js version...
echo.

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo Current Node.js version: %NODE_VERSION%

REM 检查是否是 Node.js 22
echo %NODE_VERSION% | findstr /C:"v22" >nul
if %errorlevel% equ 0 (
    echo.
    echo [WARNING] Node.js 22 detected!
    echo canvas v2.11.2 does not have pre-built binaries for Node.js 22.
    echo.
    echo Please choose an option:
    echo   1. Downgrade to Node.js 20 LTS (Recommended)
    echo   2. Install Visual Studio Build Tools and compile from source
    echo   3. Skip formula-renderer service for now
    echo.
    set /p CHOICE="Enter your choice (1/2/3): "
    
    if "!CHOICE!"=="1" (
        echo.
        echo Installing Node.js 20 LTS via NVM...
        nvm install 20.18.0
        nvm use 20.18.0
        echo Node.js switched to 20.18.0
        echo Please re-run this script after restarting your terminal.
        pause
        exit /b 0
    ) else if "!CHOICE!"=="2" (
        echo.
        echo Proceeding with source compilation...
        goto :install
    ) else (
        echo Skipping formula-renderer service...
        pause
        exit /b 0
    )
)

:install
echo.
echo [3/5] Installing dependencies...
echo.

cd /d "%FORMULA_DIR%"

REM 设置 npm 配置
echo Configuring npm...
call npm config set msvs_version 2022 --global 2>nul

REM 尝试安装
echo Installing dependencies (this may take several minutes)...
call npm install --build-from-source 2>&1

if errorlevel 1 (
    echo.
    echo [ERROR] Installation failed!
    echo.
    echo Common solutions:
    echo   1. Install Visual Studio Build Tools:
    echo      Download: https://aka.ms/vs/17/release/vs_buildtools.exe
    echo      Required workload: "Desktop development with C++"
    echo.
    echo   2. Or use Node.js 20 LTS instead:
    echo      Run: nvm install 20.18.0
    echo      Run: nvm use 20.18.0
    echo.
    pause
    exit /b 1
)

echo.
echo [4/5] Verifying installation...
echo.

REM 检查 canvas 是否安装成功
if exist "node_modules\canvas" (
    echo [OK] canvas installed successfully
) else (
    echo [ERROR] canvas installation failed
    pause
    exit /b 1
)

echo.
echo [5/5] Testing service...
echo.

REM 测试启动
echo Starting service for testing...
start "Formula Renderer Test" cmd /c "cd /d %FORMULA_DIR% && node index.js"
timeout /t 3 /nobreak >nul

echo.
echo ========================================================
echo   Installation Complete!
echo ========================================================
echo.
echo Formula Renderer Service should be running on:
echo   http://localhost:8080
echo.
echo Health check: http://localhost:8080/health
echo.
echo If the service failed to start, check:
echo   1. Node.js version (should be 18.x or 20.x)
echo   2. Visual Studio Build Tools installation
echo   3. Port 8080 is not in use
echo ========================================================
echo.
pause
