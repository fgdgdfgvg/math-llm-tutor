#!/bin/bash

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║              启动 SymPy 符号计算服务                         ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT/sympy-service"

GREEN='\033[0;32m'
NC='\033[0m'

print_success() { echo -e "${GREEN}[√]${NC} $1"; }

echo "[1/3] 检查 Python 环境..."
if ! command -v python3 &> /dev/null; then
    echo "[错误] 未找到 Python3，请先安装 Python 3.9+"
    echo "下载地址: https://www.python.org/downloads/"
    exit 1
fi
print_success "$(python3 --version)"

echo ""
echo "[2/3] 检查依赖..."
if [ ! -d "venv" ]; then
    echo "创建虚拟环境..."
    python3 -m venv venv
fi
source venv/bin/activate
pip show fastapi > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "安装依赖..."
    pip install -r requirements.txt --quiet
fi
print_success "依赖已就绪"

echo ""
echo "[3/3] 启动 SymPy 服务..."
echo "服务地址: http://localhost:8000"
echo "健康检查: http://localhost:8000/health"
echo "按 Ctrl+C 停止服务"
echo ""

python main.py
