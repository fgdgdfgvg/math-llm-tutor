@echo off
setlocal enabledelayedexpansion

echo.
echo ========================================================
echo          Multi-Agent Math Tutoring System
echo          All-in-One Startup Script
echo ========================================================
echo.

set SCRIPT_DIR=%~dp0
set PROJECT_ROOT=%SCRIPT_DIR%..

cd /d "%PROJECT_ROOT%"

echo [1/7] Checking environment...
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Please install Node.js 18.x+
    echo Download: https://nodejs.org/
    pause
    exit /b 1
)

where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found. Please install Python 3.9+
    echo Download: https://www.python.org/
    pause
    exit /b 1
)

where docker >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] Docker not found. Container deployment will be skipped.
    set DOCKER_AVAILABLE=0
) else (
    set DOCKER_AVAILABLE=1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
for /f "tokens=*" %%i in ('python --version') do set PYTHON_VERSION=%%i
echo [OK] Node.js: %NODE_VERSION%
echo [OK] Python: %PYTHON_VERSION%
if %DOCKER_AVAILABLE% equ 1 (
    for /f "tokens=*" %%i in ('docker --version') do echo [OK] Docker: %%i
)
echo.

echo [2/7] Checking configuration...
echo.

if not exist "%PROJECT_ROOT%\nestjs-backend\.env" (
    echo [WARNING] .env not found, creating default config...
    if exist "%PROJECT_ROOT%\.env.docker" (
        copy "%PROJECT_ROOT%\.env.docker" "%PROJECT_ROOT%\nestjs-backend\.env" >nul 2>&1
    ) else (
        echo [ERROR] Failed to create default config. Please create .env manually.
        pause
        exit /b 1
    )
    echo [OK] Default .env created
) else (
    echo [OK] Config file exists
)
echo.

echo [3/7] Installing dependencies...
echo.

echo Checking NestJS backend dependencies...
cd /d "%PROJECT_ROOT%\nestjs-backend"
if not exist "node_modules" (
    echo First run, installing dependencies...
    call npm install
) else (
    echo Dependencies exist, skipping install
)
if %errorlevel% neq 0 (
    echo [ERROR] NestJS dependency install failed
    pause
    exit /b 1
)
echo [OK] NestJS dependencies ready

echo.
echo Checking frontend dependencies...
cd /d "%PROJECT_ROOT%\uniapp-frontend"
if not exist "node_modules" (
    echo First run, installing dependencies...
    call npm install
) else (
    echo Dependencies exist, skipping install
)
if %errorlevel% neq 0 (
    echo [ERROR] Frontend dependency install failed
    pause
    exit /b 1
)
echo [OK] Frontend dependencies ready

echo.
echo Checking Python SymPy service dependencies...
cd /d "%PROJECT_ROOT%\sympy-service"
if not exist "venv" (
    echo First run, creating virtual environment...
    python -m venv venv
)
call venv\Scripts\activate.bat
pip install -r requirements.txt --quiet
if %errorlevel% neq 0 (
    echo [ERROR] Python dependency install failed
    pause
    exit /b 1
)
call venv\Scripts\deactivate.bat
echo [OK] Python dependencies ready
echo.

echo [4/7] Starting Docker services...
echo.

if %DOCKER_AVAILABLE% equ 1 (
    echo Checking Docker container status...
    docker ps -a --format "table {{.Names}}\t{{.Status}}" 2>nul
    echo.
    
    docker ps --filter "name=math_tutor_mongodb" --format "{{.Names}}" 2>nul | findstr "math_tutor_mongodb" >nul
    if %errorlevel% neq 0 (
        echo Starting MongoDB container...
        cd /d "%PROJECT_ROOT%"
        docker-compose up -d mongodb
    ) else (
        echo MongoDB container already running
    )
    
    docker ps --filter "name=math_tutor_redis" --format "{{.Names}}" 2>nul | findstr "math_tutor_redis" >nul
    if %errorlevel% neq 0 (
        echo Starting Redis container...
        cd /d "%PROJECT_ROOT%"
        docker-compose up -d redis
    ) else (
        echo Redis container already running
    )
    
    docker ps --filter "name=math_tutor_neo4j" --format "{{.Names}}" 2>nul | findstr "math_tutor_neo4j" >nul
    if %errorlevel% neq 0 (
        echo Starting Neo4j container...
        cd /d "%PROJECT_ROOT%"
        docker-compose --profile full up -d neo4j
    ) else (
        echo Neo4j container already running
    )
    
    echo [OK] Docker services started
) else (
    echo [SKIP] Docker not available. Please ensure MongoDB and Redis are started manually.
)
echo.

echo [5/8] Starting SymPy service...
echo.

echo Starting SymPy service on port 8000...
cd /d "%PROJECT_ROOT%\sympy-service"
start "SymPy Service" cmd /c "venv\Scripts\activate.bat && python main.py"
timeout /t 3 /nobreak >nul
echo [OK] SymPy service starting...
echo.

echo [6/8] Starting formula renderer service...
echo.

echo Starting formula renderer service on port 8080...
cd /d "%PROJECT_ROOT%\formula-renderer-service"
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)
start "Formula Renderer Service" cmd /c "npm start"
timeout /t 3 /nobreak >nul
echo [OK] Formula renderer service starting...
echo.

echo [7/8] Starting backend and frontend services...
echo.

echo Starting NestJS backend on port 3000...
cd /d "%PROJECT_ROOT%\nestjs-backend"
start "NestJS Backend" cmd /c "npm run start:dev"
timeout /t 5 /nobreak >nul
echo [OK] NestJS backend starting...

echo Starting frontend on port 5173...
cd /d "%PROJECT_ROOT%\uniapp-frontend"
start "Frontend H5" cmd /c "npm run dev:h5"
timeout /t 5 /nobreak >nul
echo [OK] Frontend starting...
echo.

echo [8/8] Verifying service status...
echo.

echo Checking service health (waiting for services to start)...
timeout /t 10 /nobreak >nul

curl -s http://localhost:8000/health >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] SymPy service running
) else (
    echo [!] SymPy service starting, please check later
)

curl -s http://localhost:3000/api/health >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] NestJS backend running
) else (
    echo [!] NestJS backend starting, please check later
)

curl -s http://localhost:5173 >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Frontend H5 running
) else (
    echo [!] Frontend H5 starting, please check later
)

curl -s http://localhost:8080/health >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Formula renderer service running
) else (
    echo [!] Formula renderer service starting, please check later
)
echo.

echo ========================================================
echo                    Startup Complete!
echo ========================================================
echo   Frontend H5:    http://localhost:5173
echo   Backend API:    http://localhost:3000
echo   SymPy Service:  http://localhost:8000
echo   Formula Renderer: http://localhost:8080
echo   API Docs:       http://localhost:3000/api/docs
echo   MongoDB:        mongodb://root:123456@localhost:27017
echo   Redis:          redis://localhost:6379
echo ========================================================
echo   Use stop-all.bat to stop all services
echo ========================================================
echo.

if "%1"=="--no-wait" goto :end
pause
:end
