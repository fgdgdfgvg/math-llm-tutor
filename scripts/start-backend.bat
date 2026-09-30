@echo off
echo.
echo ========================================================
echo              Start Backend Service
echo ========================================================
echo.

set SCRIPT_DIR=%~dp0
set PROJECT_ROOT=%SCRIPT_DIR%..

cd /d "%PROJECT_ROOT%\nestjs-backend"

echo [1/3] Checking dependencies...
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
echo [2/3] Checking configuration...
if not exist ".env" (
    echo [WARNING] .env not found
    if exist "..\.env.docker" (
        copy "..\.env.docker" ".env" >nul
        echo [OK] Config created from template
    ) else (
        echo [ERROR] Please create .env manually
        pause
        exit /b 1
    )
) else (
    echo [OK] Config file exists
)

echo.
echo [3/3] Starting NestJS backend...
echo.
echo Service URL: http://localhost:3000
echo API Docs: http://localhost:3000/api/docs
echo Health check: http://localhost:3000/api/health
echo Press Ctrl+C to stop
echo.

npm run start:dev
