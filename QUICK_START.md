# 数学AI导师 - 快速启动指南

## 一键启动

### 方式一：根目录脚本
双击运行根目录下的脚本：

```
start-all.bat    # 一键启动所有服务
stop-all.bat     # 一键停止所有服务
```

### 方式二：scripts 目录脚本
```
scripts/
├── start-all.bat      # 启动所有服务
├── start-docker.bat   # 仅启动 Docker (MongoDB + Neo4j)
├── start-backend.bat  # 仅启动后端
├── start-frontend.bat # 仅启动前端
├── start-sympy.bat    # 仅启动 SymPy 服务
├── stop-all.bat       # 停止所有服务
└── check-status.bat   # 检查服务状态
```

## 一键自检（改完代码先跑这个）

```bash
node self-check.cjs                 # 自动选择运行模式，跑完给出退出码
node self-check.cjs --mode docker   # 强制走 docker compose（守护进程没起会自动拉起）
node self-check.cjs --mode local    # 强制本机进程（本地 MongoDB + sympy-service/venv + node dist/main.js）
node self-check.cjs --no-start      # 不启动任何服务，只体检已在运行的服务
node self-check.cjs --full          # 额外跑 probe-routes / e2e-verify（+ 前后端数学自检）
node self-check.cjs --with-frontend # 额外验证前端页面（本机模式会自动拉起 5173 的 H5 dev server）
node self-check.cjs --build         # Docker 模式下强制重建后端镜像
node self-check.cjs --stop          # 停掉自检启动的本机进程
```

它会按顺序做六件事，最后用退出码回答「系统现在能不能用」：

| 阶段 | 检查内容 |
|------|----------|
| 0 环境探测 | Node 版本、关键文件、Docker 守护进程、选本机还是 Docker |
| 1 启动依赖 | MongoDB / Redis / SymPy 容器 healthy（本机模式退化为本地 MongoDB + venv 里的 uvicorn） |
| 2 后端健康 | `/health` 里 mongodb / sympy / neo4j 的真实状态 |
| 3 题库就绪 | 题量与知识点覆盖（空库自动播种是否生效） |
| 4 五类题目 | 极限 / 导数 / 积分 / 方程 / 微分方程真实求解（含 2 个多项式回归用例） |
| 5 学习闭环 | 注册 → 登录 → 错题归档 → 错题本分组 → 练习上报 → 自动清理临时账号 |
| 6 附加检查 | 路由探测 / 端到端脚本 / 临时账号清理 / 前端页面（需 `--full`、`--with-frontend`） |

> 本机模式加 `--with-frontend` 会自动执行 `npm run dev:h5 -- --host 127.0.0.1 --port 5173`：
> vite 默认只绑 IPv6 的 `::1`，不显式指定 host 时用 `127.0.0.1` 探测会连不上。

退出码 `0` = 系统可用；`1` = 有致命问题（会列出失败项与排查提示）。
每次运行都会写一份机器可读报告到 `.self-check/report.json`，服务日志在 `.self-check/*.log`。

> 不用看这一串参数？日常一条就够：`node self-check.cjs`。

## 服务地址

| 服务 | 地址 | 说明 |
|------|------|------|
| 前端 | http://localhost:5173 | UniApp H5 |
| 后端 | http://localhost:3000 | NestJS API |
| SymPy | http://localhost:8000 | 符号计算服务（容器内仅以 `127.0.0.1:8000` 暴露；计算端点需 `X-Internal-Token`） |
| MongoDB | mongodb://root:123456@localhost:27017 | 数据库 |
| Neo4j | http://localhost:7474 | 知识图谱 (可选) |

## 前置要求

1. **Docker Desktop** - 用于运行 MongoDB 和 Neo4j
2. **Node.js 18+** - 用于运行前后端
3. **Python 3.9+** - 用于运行 SymPy 服务

## Docker 命令

```bash
# 启动 MongoDB
docker-compose up -d mongodb

# 启动 MongoDB + Neo4j
docker-compose --profile full up -d

# 停止所有 Docker 服务
docker-compose down

# 查看服务状态
docker-compose ps
```

## 手动启动步骤

如果脚本无法正常工作，可以手动启动：

```bash
# 1. 启动 Docker 服务
docker-compose up -d mongodb

# 2. 启动 SymPy 服务
cd python-sympy-service
python main.py

# 3. 启动后端 (新终端)
cd nestjs-backend
npm run start:dev

# 4. 启动前端 (新终端)
cd uniapp-frontend
npm run dev:h5
```
