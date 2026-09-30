# 故障排查报告

## 问题概述

用户反馈两个关键问题：
1. SYMPY应用程序显示无法打开
2. 启动脚本未能正确启动前端服务，导致前端界面显示"服务不可用"

---

## 问题1：SYMPY服务排查

### 排查过程

**步骤1：检查端口监听状态**
```bash
netstat -ano | findstr ":8000"
# 结果：无输出，端口8000未监听
```

**步骤2：尝试访问健康检查端点**
```bash
curl http://localhost:8000/health
# 结果：连接失败
```

### 根本原因

**SymPy Python服务未启动**

启动脚本中虽然包含SymPy服务启动命令，但由于服务启动需要时间，且脚本未等待服务完全启动就继续执行后续步骤。

### 解决方案

**手动启动SymPy服务**：
```bash
cd python-sympy-service
python main.py
```

**启动成功日志**：
```
2026-03-08 14:43:13,665 - SymPy-Service - INFO - SymPy Service starting up...
2026-03-08 14:43:13,665 - SymPy-Service - INFO - SymPy version: 1.14.0
2026-03-08 14:43:13,665 - SymPy-Service - INFO - SymPy Service ready!
INFO:     Uvicorn running on http://0.0.0.0:8000
```

---

## 问题2：前端服务未启动

### 排查过程

**步骤1：检查前端端口**
```bash
netstat -ano | findstr ":5173"
# 结果：无输出，端口5173未监听
```

**步骤2：检查启动脚本内容**
```batch
# start-all.bat 原内容
echo 正在启动 Python SymPy 服务...
start "SymPy Service" cmd /c "..."

echo 正在启动 NestJS 后端服务...
start "NestJS Backend" cmd /c "..."
# 缺少前端服务启动命令！
```

### 根本原因

**启动脚本未包含前端服务启动逻辑**

`start-all.bat` 和 `start-all.sh` 脚本只启动了后端服务，遗漏了前端H5服务的启动。

### 解决方案

**更新 start-all.bat**：
```batch
echo 正在启动前端服务 (端口 5173)...
cd /d "%PROJECT_ROOT%\uniapp-frontend"
start "Frontend H5" cmd /c "npm run dev:h5"
timeout /t 5 /nobreak >nul
```

**更新 start-all.sh**：
```bash
echo "正在启动前端 H5 服务 (端口 5173)..."
cd "$PROJECT_ROOT/uniapp-frontend"
npm run dev:h5 > /tmp/frontend-h5.log 2>&1 &
FRONTEND_PID=$!
```

**添加前端服务健康检查**：
```batch
curl -s http://localhost:5173 >nul 2>&1
if %errorlevel% equ 0 (
    echo [√] 前端 H5 服务运行正常
) else (
    echo [×] 前端 H5 服务启动失败
)
```

---

## 修复后验证

### 服务状态检查结果

```
=== 服务状态检查 ===

[√] SymPy 服务: 正常 (端口 8000)
[√] NestJS 后端: 正常 (端口 3000)
[√] 前端 H5: 正常 (端口 5173)
[√] MongoDB: 正常 (端口 27017)
[√] Neo4j: 正常 (端口 7687)
```

### 端口监听确认

```
TCP    0.0.0.0:3000           LISTENING       4920   (NestJS)
TCP    0.0.0.0:8000           LISTENING       34628  (SymPy)
TCP    [::1]:5173             LISTENING       16328  (Frontend)
TCP    0.0.0.0:27017          LISTENING       9448   (MongoDB)
TCP    0.0.0.0:7687           LISTENING       9448   (Neo4j)
```

### 功能验证

**SymPy服务测试**：
```bash
curl -X POST http://localhost:8000/limit \
  -H "Content-Type: application/json" \
  -d '{"expr":"sin(x)/x","variable":"x","approach":"0"}'
```

**返回结果**：
```json
{
  "success": true,
  "result": "1",
  "latex": "1"
}
```

**前端界面测试**：
- 访问 http://localhost:5173
- 界面正常加载，显示"AI 数学解题"页面
- 无"服务不可用"提示

---

## 更新后的启动流程

```
启动脚本执行流程：
├── [1/6] 检查运行环境
│   ├── Node.js 版本检查
│   ├── Python 版本检查
│   └── Docker 可用性检查
├── [2/6] 检查配置文件
│   └── .env 文件检查/创建
├── [3/6] 安装/更新依赖
│   ├── NestJS 依赖
│   └── Python 依赖
├── [4/6] 启动 Docker 服务
│   ├── MongoDB 容器
│   └── Neo4j 容器
├── [5/6] 启动应用服务
│   ├── SymPy 服务 (端口 8000) ← 修复
│   ├── NestJS 后端 (端口 3000)
│   └── 前端 H5 (端口 5173) ← 新增
└── [6/6] 验证服务状态
    ├── SymPy 健康检查 ← 新增
    ├── NestJS 健康检查
    └── 前端服务检查 ← 新增
```

---

## 经验总结

### 问题预防措施

1. **启动脚本完整性检查清单**
   - [ ] 数据库服务
   - [ ] SymPy符号计算服务
   - [ ] NestJS后端API
   - [ ] 前端H5服务
   - [ ] 所有服务健康检查

2. **服务启动顺序**
   ```
   数据库 → SymPy → 后端 → 前端
   ```

3. **健康检查机制**
   - 每个服务启动后等待足够时间
   - 使用健康检查端点验证服务可用性
   - 提供清晰的错误提示

### 改进建议

1. **添加服务状态监控脚本**
   ```bash
   # scripts/check-services.sh
   # 检查所有服务状态并输出报告
   ```

2. **添加一键停止脚本**
   ```bash
   # scripts/stop-all.sh
   # 停止所有服务
   ```

3. **添加服务重启脚本**
   ```bash
   # scripts/restart-all.sh
   # 重启所有服务
   ```

---

## 相关文件更新

| 文件 | 更新内容 |
|------|----------|
| `scripts/start-all.bat` | 添加前端服务启动、健康检查 |
| `scripts/start-all.sh` | 添加前端服务启动、健康检查 |
| `docs/troubleshooting-report.md` | 新增故障排查报告 |

---

## 附录：快速命令参考

```bash
# Windows 启动所有服务
scripts\start-all.bat

# Unix/macOS 启动所有服务
./scripts/start-all.sh

# 检查服务状态
curl http://localhost:8000/health  # SymPy
curl http://localhost:3000/health  # NestJS
curl http://localhost:5173         # Frontend

# 查看端口占用
netstat -ano | findstr "LISTENING" | findstr ":8000 :3000 :5173"
```
