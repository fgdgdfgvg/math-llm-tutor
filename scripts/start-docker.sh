#!/bin/bash

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║              启动 Docker 服务                                ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

GREEN='\033[0;32m'
NC='\033[0m'

print_success() { echo -e "${GREEN}[√]${NC} $1"; }

echo "[1/3] 检查 Docker 环境..."
if ! command -v docker &> /dev/null; then
    echo "[错误] 未检测到 Docker，请先安装 Docker"
    echo "下载地址: https://www.docker.com/products/docker-desktop"
    exit 1
fi
print_success "$(docker --version)"

echo ""
echo "[2/3] 启动基础服务 (MongoDB, Redis)..."
docker-compose up -d mongodb redis
if [ $? -ne 0 ]; then
    echo "[错误] 基础服务启动失败"
    exit 1
fi
print_success "MongoDB 和 Redis 已启动"

echo ""
echo "[3/3] 可选服务..."
echo ""
read -p "是否启动 Neo4j 知识图谱服务? (y/n): " neo4j_choice
if [ "$neo4j_choice" = "y" ] || [ "$neo4j_choice" = "Y" ]; then
    echo "启动 Neo4j..."
    docker-compose --profile full up -d neo4j
    print_success "Neo4j 已启动: http://localhost:7474"
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║              Docker 服务启动完成                             ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  MongoDB:  mongodb://root:123456@localhost:27017             ║"
echo "║  Redis:    redis://localhost:6379                            ║"
echo "║  Neo4j:    http://localhost:7474 (如果已启动)                ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
