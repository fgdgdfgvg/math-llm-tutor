@echo off
echo.
echo ========================================================
echo              Start Docker Services
echo ========================================================
echo.

set SCRIPT_DIR=%~dp0
set PROJECT_ROOT=%SCRIPT_DIR%..

cd /d "%PROJECT_ROOT%"

echo [1/3] Checking Docker environment...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker not found. Please install Docker Desktop
    echo Download: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('docker --version') do echo [OK] %%i

echo.
echo [2/3] Starting base services (MongoDB, Redis)...
docker-compose up -d mongodb redis
if %errorlevel% neq 0 (
    echo [ERROR] Base services failed to start
    pause
    exit /b 1
)
echo [OK] MongoDB and Redis started

echo.
echo [3/3] Optional services...
echo.
set /p neo4j_choice="Start Neo4j knowledge graph service? (y/n): "
if /i "%neo4j_choice%"=="y" (
    echo Starting Neo4j...
    docker-compose --profile full up -d neo4j
    echo [OK] Neo4j started: http://localhost:7474
)

echo.
echo ========================================================
echo              Docker Services Started
echo ========================================================
echo   MongoDB:  mongodb://root:123456@localhost:27017
echo   Redis:    redis://localhost:6379
echo   Neo4j:    http://localhost:7474 (if started)
echo ========================================================
echo.
pause
