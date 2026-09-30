@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo   Formula Renderer Service - Canvas Installation Script
echo ========================================================
echo.

set SCRIPT_DIR=%~dp0
set FORMULA_DIR=%SCRIPT_DIR%formula-renderer-service

echo [1/4] Navigating to formula-renderer-service...
cd /d "%FORMULA_DIR%"
if errorlevel 1 (
    echo [ERROR] Cannot find formula-renderer-service directory
    pause
    exit /b 1
)

echo [OK] Current directory: %CD%
echo.

echo [2/4] Cleaning old installation...
if exist "node_modules" (
    echo Removing node_modules...
    rmdir /s /q node_modules 2>nul
    if errorlevel 1 (
        echo [WARNING] Could not remove node_modules completely
        echo Please close any programs that might be using these files
        echo and try again.
        pause
        exit /b 1
    )
)

if exist "package-lock.json" (
    echo Removing package-lock.json...
    del /f /q package-lock.json 2>nul
)

echo [OK] Cleanup complete
echo.

echo [3/4] Installing dependencies with Visual Studio Build Tools...
echo This may take several minutes...
echo.

call npm install --build-from-source

if errorlevel 1 (
    echo.
    echo [ERROR] Installation failed!
    echo.
    echo Please check:
    echo   1. Visual Studio Build Tools is installed with "Desktop development with C++"
    echo   2. You have restarted your terminal after installation
    echo   3. Windows SDK is installed
    echo.
    pause
    exit /b 1
)

echo.
echo [OK] Dependencies installed successfully
echo.

echo [4/4] Verifying installation...
echo.

if exist "node_modules\canvas" (
    echo [OK] canvas module installed
) else (
    echo [ERROR] canvas module not found
    pause
    exit /b 1
)

if exist "node_modules\express" (
    echo [OK] express module installed
) else (
    echo [ERROR] express module not found
    pause
    exit /b 1
)

echo.
echo ========================================================
echo   Installation Complete!
echo ========================================================
echo.
echo Starting Formula Renderer Service...
echo.

start "Formula Renderer Service" cmd /c "cd /d %FORMULA_DIR% && node index.js"

timeout /t 3 /nobreak >nul

echo.
echo Service should be running at: http://localhost:8080
echo Health check: http://localhost:8080/health
echo.
echo If you see any errors, please check the Formula Renderer Service window.
echo ========================================================
echo.
pause
