#!/bin/bash

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║              启动后端服务                                    ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT/nestjs-backend"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_success() { echo -e "${GREEN}[√]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[!]${NC} $1"; }

echo "[1/3] 检查依赖..."
if [ ! -d "node_modules" ]; then
    echo "首次运行，正在安装依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo "[错误] 依赖安装失败"
        exit 1
    fi
fi
print_success "依赖已就绪"

echo ""
echo "[2/3] 检查配置文件..."
if [ ! -f ".env" ]; then
    print_warning "未找到 .env 配置文件"
    if [ -f "../.env.docker" ]; then
        cp "../.env.docker" ".env"
        print_success "已从模板创建配置文件"
    else
        echo "[错误] 请手动创建 .env 配置文件"
        exit 1
    fi
else
    print_success "配置文件已存在"
fi

echo ""
echo "[3/3] 启动 NestJS 后端..."
echo ""
echo "服务地址: http://localhost:3000"
echo "API 文档: http://localhost:3000/api/docs"
echo "健康检查: http://localhost:3000/api/health"
echo "按 Ctrl+C 停止服务"
echo ""

npm run start:dev
