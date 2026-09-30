@echo off
echo.
echo ========================================================
echo              Start Frontend Service
echo ========================================================
echo.

set SCRIPT_DIR=%~dp0
set PROJECT_ROOT=%SCRIPT_DIR%..

cd /d "%PROJECT_ROOT%\uniapp-frontend"

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
echo [2/2] Starting UniApp H5 dev server...
echo.
echo Service URL: http://localhost:5173
echo Press Ctrl+C to stop
echo.

npm run dev:h5
