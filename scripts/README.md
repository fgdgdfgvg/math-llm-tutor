# 脚本使用说明

本目录包含多智能体数学辅导系统的启动和管理脚本，支持 Windows 和 Linux/macOS 平台。

## 脚本列表

### 一键启动脚本
- **start-all.bat** (Windows): 一键启动所有服务，包括后端、前端、SymPy 服务和公式渲染服务
- **start-all.sh** (Linux/macOS): 一键启动所有服务，包括后端、前端、SymPy 服务和公式渲染服务

### 单独启动脚本
- **start-backend.bat** (Windows): 启动后端服务
- **start-backend.sh** (Linux/macOS): 启动后端服务
- **start-frontend.bat** (Windows): 启动前端 H5 服务
- **start-frontend.sh** (Linux/macOS): 启动前端 H5 服务
- **start-sympy.bat** (Windows): 启动 SymPy 符号计算服务
- **start-sympy.sh** (Linux/macOS): 启动 SymPy 符号计算服务
- **start-formula-renderer.bat** (Windows): 启动公式渲染服务
- **start-formula-renderer.sh** (Linux/macOS): 启动公式渲染服务

### 停止脚本
- **stop-all.bat** (Windows): 停止所有服务
- **stop-all.sh** (Linux/macOS): 停止所有服务

### 其他脚本
- **import-math-questions.js**: 导入数学题目数据

## 系统要求

- **Node.js**: 18.x 或更高版本
- **Python**: 3.9 或更高版本
- **Docker** (可选): 用于运行 MongoDB 和 Redis

## 使用方法

### 一键启动所有服务

1. 确保已安装所有系统要求
2. 运行 `start-all.bat` (Windows) 或 `start-all.sh` (Linux/macOS)
3. 脚本会自动检查环境、安装依赖、启动所有服务
4. 启动完成后，会显示所有服务的访问地址

### 单独启动服务

如果只需要启动特定服务，可以使用对应的单独启动脚本。例如：

- 启动后端服务: `start-backend.bat` 或 `start-backend.sh`
- 启动前端服务: `start-frontend.bat` 或 `start-frontend.sh`
- 启动 SymPy 服务: `start-sympy.bat` 或 `start-sympy.sh`
- 启动公式渲染服务: `start-formula-renderer.bat` 或 `start-formula-renderer.sh`

### 停止所有服务

运行 `stop-all.bat` (Windows) 或 `stop-all.sh` (Linux/macOS) 停止所有服务。

## 服务地址

启动成功后，服务访问地址如下：

- **前端 H5**: http://localhost:5173
- **后端 API**: http://localhost:3000
- **SymPy 服务**: http://localhost:8000
- **公式渲染服务**: http://localhost:8080
- **API 文档**: http://localhost:3000/api/docs
- **MongoDB**: mongodb://root:123456@localhost:27017
- **Redis**: redis://localhost:6379

## 注意事项

1. 首次运行脚本时，会自动安装所需依赖，可能需要较长时间
2. 确保端口 3000、5173、8000、8080 未被占用
3. 如果 Docker 不可用，需要手动启动 MongoDB 和 Redis
4. 服务启动后，可以通过健康检查端点验证服务状态
5. 按 Ctrl+C 停止正在运行的服务

## 故障排查

- **依赖安装失败**: 检查网络连接，确保 npm 和 pip 可以正常访问
- **服务启动失败**: 检查端口是否被占用，查看服务日志
- **Docker 启动失败**: 检查 Docker 是否正常运行，确保 Docker Compose 配置正确
- **公式渲染服务失败**: 确保 Node.js 版本符合要求，检查依赖安装情况

## 环境变量配置

服务启动前会自动检查 `.env` 文件，如果不存在会从 `.env.docker` 复制创建。主要环境变量包括：

- `JWT_SECRET`: JWT 签名密钥
- `MONGODB_URI`: MongoDB 连接地址
- `REDIS_URI`: Redis 连接地址
- `OPENAI_API_KEY`: OpenAI API 密钥（用于 LangChain 协作）
- `SYMPY_SERVICE_URL`: SymPy 服务地址
- `FORMULA_RENDERER_URL`: 公式渲染服务地址

## 版本更新

- **v1.0**: 初始版本，支持基本服务启动
- **v1.1**: 添加公式渲染服务支持
- **v1.2**: 优化服务启动流程，增加健康检查

---

**注意**: 本脚本仅用于开发环境，生产环境部署请参考项目文档。