@echo off
echo.
echo ========================================================
echo              Stop All Services
echo ========================================================
echo.

set SCRIPT_DIR=%~dp0
set PROJECT_ROOT=%SCRIPT_DIR%..

echo [1/4] Stopping Docker services...
cd /d "%PROJECT_ROOT%"
docker-compose down 2>nul
if %errorlevel% equ 0 (
    echo [OK] Docker services stopped
) else (
    echo [!] Docker services stop failed or not running
)

echo.
echo [2/4] Stopping Node.js processes...
tasklist /fi "imagename eq node.exe" 2>nul | find "node.exe" >nul
if %errorlevel% equ 0 (
    taskkill /f /im node.exe 2>nul
    echo [OK] Node.js processes stopped
) else (
    echo [!] No running Node.js processes found
)

echo.
echo [3/4] Stopping Python processes...
tasklist /fi "imagename eq python.exe" 2>nul | find "python.exe" >nul
if %errorlevel% equ 0 (
    taskkill /f /im python.exe 2>nul
    echo [OK] Python processes stopped
) else (
    echo [!] No running Python processes found
)

echo.
echo [4/4] Cleaning temp files...
del /q "%TEMP%\sympy-*.log" 2>nul
del /q "%TEMP%\nestjs-*.log" 2>nul
del /q "%TEMP%\formula-renderer*.log" 2>nul
echo [OK] Cleanup complete

echo.
echo ========================================================
echo              All Services Stopped
echo ========================================================
echo.
pause
