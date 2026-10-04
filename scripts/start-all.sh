#!/bin/bash

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║          多智能体数学辅导系统 - 一键启动脚本                  ║"
echo "║          Multi-Agent Math Tutoring System                    ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_success() { echo -e "${GREEN}[√]${NC} $1"; }
print_error() { echo -e "${RED}[×]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[!]${NC} $1"; }
print_info() { echo -e "${BLUE}[i]${NC} $1"; }

check_command() {
    if command -v "$1" &> /dev/null; then
        return 0
    else
        return 1
    fi
}

echo "[1/8] 检查运行环境..."
echo ""

if ! check_command node; then
    print_error "未检测到 Node.js，请先安装 Node.js 18.x 或更高版本"
    echo "下载地址: https://nodejs.org/"
    exit 1
fi

if ! check_command python3; then
    print_error "未检测到 Python3，请先安装 Python 3.9 或更高版本"
    echo "下载地址: https://www.python.org/"
    exit 1
fi


# Docker v2 用 `docker compose`（无连字符），v1 用 `docker-compose`；两者择优，避免脚本在只装了 v2 的机器上直接失败
DOCKER_COMPOSE=""
if docker compose version >/dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
elif command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
fi
DOCKER_AVAILABLE=0
if check_command docker; then
    DOCKER_AVAILABLE=1
fi

NODE_VERSION=$(node -v)
PYTHON_VERSION=$(python3 --version)
print_success "Node.js 版本: $NODE_VERSION"
print_success "Python 版本: $PYTHON_VERSION"
if [ $DOCKER_AVAILABLE -eq 1 ]; then
    DOCKER_VERSION=$(docker --version)
    print_success "Docker: $DOCKER_VERSION"
fi
echo ""

echo "[2/8] 检查配置文件..."
echo ""

if [ ! -f "$PROJECT_ROOT/nestjs-backend/.env" ]; then
    print_warning "未找到 .env 配置文件，正在从 .env.example 生成..."
    # 单一事实来源用 .env.example（已入库、随代码走）。
    # 旧实现在这里复制 .env.docker，但该文件被 .gitignore 的 `.env.*` 规则排除，
    # 根本不会随仓库分发 → 全新机器必然走"创建默认配置失败"分支退出；
    # 而且它当时只含 10 个键，缺 MONGODB_URI / CORS_ORIGIN / JWT_EXPIRATION 等必需项，
    # 即便复制成功，后端也会在启动期校验直接拒绝启动。
    if [ -f "$PROJECT_ROOT/nestjs-backend/.env.example" ]; then
        cp "$PROJECT_ROOT/nestjs-backend/.env.example" "$PROJECT_ROOT/nestjs-backend/.env"
        print_success "已生成 nestjs-backend/.env（占位值，需按下方提示补全后重启）"
        print_warning "必填项：JWT_SECRET（≥32位随机）、MONGODB_URI、CORS_ORIGIN（生产必填）"
    else
        print_error "缺少 nestjs-backend/.env.example，请手动创建 .env 后重试"
        exit 1
    fi
else
    print_success "配置文件已存在"
fi
echo ""

echo "[3/8] 安装/更新依赖..."
echo ""

echo "正在检查 NestJS 后端依赖..."
cd "$PROJECT_ROOT/nestjs-backend"
if [ ! -d "node_modules" ]; then
    echo "首次运行，正在安装依赖..."
    npm install
else
    echo "依赖已存在，跳过安装"
fi
if [ $? -ne 0 ]; then
    print_error "NestJS 依赖安装失败"
    exit 1
fi
print_success "NestJS 依赖已就绪"

echo ""
echo "正在检查前端依赖..."
cd "$PROJECT_ROOT/uniapp-frontend"
if [ ! -d "node_modules" ]; then
    echo "首次运行，正在安装依赖..."
    npm install
else
    echo "依赖已存在，跳过安装"
fi
if [ $? -ne 0 ]; then
    print_error "前端依赖安装失败"
    exit 1
fi
print_success "前端依赖已就绪"

echo ""
echo "正在检查 Python SymPy 服务依赖..."
cd "$PROJECT_ROOT/sympy-service"
if [ ! -d "venv" ]; then
    echo "首次运行，正在创建虚拟环境..."
    python3 -m venv venv
fi
source venv/bin/activate
pip install -r requirements.txt --quiet
if [ $? -ne 0 ]; then
    print_error "Python 依赖安装失败"
    exit 1
fi
deactivate
print_success "Python 依赖已就绪"
echo ""

echo "[4/8] 启动 Docker 服务..."
echo ""

if [ $DOCKER_AVAILABLE -eq 1 ]; then
    echo "正在检查 Docker 容器状态..."
    docker ps -a --format "table {{.Names}}\t{{.Status}}" 2>/dev/null
    echo ""
    
    if ! docker ps --filter "name=math_tutor_mongodb" --format "{{.Names}}" 2>/dev/null | grep -q "math_tutor_mongodb"; then
        echo "正在启动 MongoDB 容器..."
        cd "$PROJECT_ROOT"
        "$DOCKER_COMPOSE" up -d mongodb
    else
        echo "MongoDB 容器已在运行"
    fi
    
    if ! docker ps --filter "name=math_tutor_redis" --format "{{.Names}}" 2>/dev/null | grep -q "math_tutor_redis"; then
        echo "正在启动 Redis 容器..."
        cd "$PROJECT_ROOT"
        "$DOCKER_COMPOSE" up -d redis
    else
        echo "Redis 容器已在运行"
    fi
    
    print_success "Docker 服务已启动"
else
    print_warning "Docker 不可用，请确保 MongoDB 和 Redis 已手动启动"
fi
echo ""

echo "[5/8] 启动 SymPy 服务..."
echo ""

echo "正在启动 SymPy 服务 (端口 8000)..."
cd "$PROJECT_ROOT/sympy-service"
source venv/bin/activate
python main.py > /tmp/sympy-service.log 2>&1 &
SYMPY_PID=$!
deactivate
echo "SymPy 服务 PID: $SYMPY_PID"
sleep 3
print_success "SymPy 服务启动中..."
echo ""

echo "[6/8] 启动公式渲染服务..."
echo ""

echo "正在启动公式渲染服务 (端口 8080)..."
cd "$PROJECT_ROOT/formula-renderer-service"
if [ ! -d "node_modules" ]; then
    echo "正在安装依赖..."
    npm install
fi
npm start > /tmp/formula-renderer.log 2>&1 &
FORMULA_RENDERER_PID=$!
echo "公式渲染服务 PID: $FORMULA_RENDERER_PID"
sleep 3
print_success "公式渲染服务启动中..."
echo ""

echo "[7/8] 启动后端和前端服务..."
echo ""

echo "正在启动 NestJS 后端服务 (端口 3000)..."
cd "$PROJECT_ROOT/nestjs-backend"
npm run start:dev > /tmp/nestjs-backend.log 2>&1 &
NESTJS_PID=$!
echo "NestJS 服务 PID: $NESTJS_PID"
sleep 5
print_success "NestJS 后端启动中..."

echo "正在启动前端 H5 服务 (端口 5173)..."
cd "$PROJECT_ROOT/uniapp-frontend"
npm run dev:h5 > /tmp/frontend-h5.log 2>&1 &
FRONTEND_PID=$!
echo "前端服务 PID: $FRONTEND_PID"
sleep 5
print_success "前端启动中..."
echo ""

echo "[8/8] 验证服务状态..."
echo ""

echo "正在检查服务健康状态 (等待服务启动)..."
sleep 10

if curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health 2>/dev/null | grep -q "^200$"; then
    print_success "SymPy 服务运行正常"
else
    print_warning "SymPy 服务启动中，请稍后检查"
fi

if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health/live 2>/dev/null | grep -q "^200$"; then
    print_success "NestJS 后端服务运行正常"
else
    print_warning "NestJS 后端服务未就绪（/health/live 未返回 200），请查看 /tmp/nestjs-backend.log"
fi

if curl -s -o /dev/null -w "%{http_code}" http://localhost:5173 2>/dev/null | grep -q "^200$"; then
    print_success "前端 H5 服务运行正常"
else
    print_warning "前端 H5 服务启动中，请稍后检查"
fi

if curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health 2>/dev/null | grep -q "^200$"; then
    print_success "公式渲染服务运行正常"
else
    print_warning "公式渲染服务启动中，请稍后检查"
fi
echo ""

echo "服务 PID 已保存到: /tmp/math-tutor-pids.txt"
echo "$SYMPY_PID" > /tmp/math-tutor-pids.txt
echo "$FORMULA_RENDERER_PID" >> /tmp/math-tutor-pids.txt
echo "$NESTJS_PID" >> /tmp/math-tutor-pids.txt
echo "$FRONTEND_PID" >> /tmp/math-tutor-pids.txt

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    启动完成！                                ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  前端 H5:      http://localhost:5173                         ║"
echo "║  后端 API:     http://localhost:3000                         ║"
echo "║  SymPy 服务:   http://localhost:8000                         ║"
echo "║  公式渲染服务: http://localhost:8080                         ║"
echo "║  API 文档:     http://localhost:3000/api/docs                ║"
    echo "  MongoDB:      mongodb://<user>:<password>@<host>:27017/<database>  (口令见 .env，不在横幅中显示)"
echo "║  Redis:        redis://localhost:6379                        ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  使用 scripts/stop-all.sh 停止所有服务                       ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

stop_services() {
    echo ""
    echo "正在停止服务..."
    kill $SYMPY_PID 2>/dev/null
    kill $FORMULA_RENDERER_PID 2>/dev/null
    kill $NESTJS_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    print_success "服务已停止"
    exit 0
}

trap stop_services SIGINT SIGTERM

if [ "$1" != "--no-wait" ]; then
    echo "按 Ctrl+C 停止所有服务..."
    wait
fi
