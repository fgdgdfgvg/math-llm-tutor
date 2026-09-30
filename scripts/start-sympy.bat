@echo off
echo.
echo ========================================================
echo              Start SymPy Service
echo ========================================================
echo.

set SCRIPT_DIR=%~dp0
set PROJECT_ROOT=%SCRIPT_DIR%..

cd /d "%PROJECT_ROOT%\sympy-service"

echo [1/3] Checking Python environment...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found. Please install Python 3.9+
    echo Download: https://www.python.org/downloads/
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('python --version') do echo [OK] %%i

echo.
echo [2/3] Checking dependencies...
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)
call venv\Scripts\activate.bat
pip show fastapi >nul 2>&1
if %errorlevel% neq 0 (
    echo Installing dependencies...
    pip install -r requirements.txt --quiet
)
echo [OK] Dependencies ready

echo.
echo [3/3] Starting SymPy service...
echo Service URL: http://localhost:8000
echo Health check: http://localhost:8000/health
echo Press Ctrl+C to stop
echo.

python main.py

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] SymPy service failed to start
    pause
)
