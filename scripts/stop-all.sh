#!/bin/bash

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║              停止所有服务                                    ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_success() { echo -e "${GREEN}[√]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[!]${NC} $1"; }

echo "[1/4] 停止 Docker 服务..."
cd "$PROJECT_ROOT"
docker-compose down 2>/dev/null
if [ $? -eq 0 ]; then
    print_success "Docker 服务已停止"
else
    print_warning "Docker 服务停止失败或未运行"
fi

echo ""
echo "[2/4] 停止 Node.js 进程..."
if pgrep -x "node" > /dev/null; then
    pkill -x "node"
    print_success "Node.js 进程已停止"
else
    print_warning "没有找到运行中的 Node.js 进程"
fi

echo ""
echo "[3/4] 停止 Python 进程..."
if pgrep -x "python" > /dev/null || pgrep -x "python3" > /dev/null; then
    pkill -x "python" 2>/dev/null
    pkill -x "python3" 2>/dev/null
    print_success "Python 进程已停止"
else
    print_warning "没有找到运行中的 Python 进程"
fi

echo ""
echo "[4/4] 清理临时文件..."
rm -f /tmp/sympy-service.log 2>/dev/null
rm -f /tmp/nestjs-backend.log 2>/dev/null
rm -f /tmp/frontend-h5.log 2>/dev/null
rm -f /tmp/formula-renderer.log 2>/dev/null
rm -f /tmp/math-tutor-pids.txt 2>/dev/null
print_success "清理完成"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║              所有服务已停止                                  ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
