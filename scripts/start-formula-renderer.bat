@echo off
echo.
echo ========================================================
echo           Start Formula Renderer Service
echo ========================================================
echo.

set SCRIPT_DIR=%~dp0
set PROJECT_ROOT=%SCRIPT_DIR%..

cd /d "%PROJECT_ROOT%\formula-renderer-service"

echo [1/2] Checking dependencies...
if not exist "node_modules" (
    echo First run, installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Dependency install failed
        pause
        exit /b 1
    )
)
echo [OK] Dependencies ready

echo.
echo [2/2] Starting formula renderer service...
echo.
echo Service URL: http://localhost:8080
echo Health check: http://localhost:8080/health
echo Press Ctrl+C to stop
echo.

npm start

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Formula renderer service failed to start
    pause
)