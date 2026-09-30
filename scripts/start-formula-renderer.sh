#!/bin/bash

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║              启动公式渲染服务                                ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT/formula-renderer-service"

GREEN='\033[0;32m'
NC='\033[0m'

print_success() { echo -e "${GREEN}[√]${NC} $1"; }

echo "[1/2] 检查依赖..."
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
echo "[2/2] 启动公式渲染服务..."
echo ""
echo "服务地址: http://localhost:8080"
echo "健康检查: http://localhost:8080/health"
echo "按 Ctrl+C 停止服务"
echo ""

npm start