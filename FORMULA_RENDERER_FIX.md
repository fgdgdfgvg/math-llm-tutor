# Formula Renderer Service - Windows 环境修复指南

## 📋 问题诊断

### 错误信息分析

从终端输出可以看到以下关键错误：

```
npm error command failed
npm error command C:\WINDOWS\system32\cmd.exe /d /s /c node-pre-gyp install --fallback-to-build --update-binary
npm error node-pre-gyp ERR! install response status 404 Not Found on https://github.com/Automattic/node-canvas/releases/download/v2.11.2/canvas-v2.11.2-node-v127-win32-unknown-x64.tar.gz
npm error gyp ERR! find VS could not find any Visual Studio installation to use
```

### 根本原因

1. **Node.js 版本不兼容**：
   - 当前使用：Node.js 22.22.0 (node-v127 ABI)
   - canvas v2.11.2 没有为 Node.js 22 提供预编译包
   - 尝试从源码编译时失败

2. **缺少编译工具**：
   - 虽然安装了 Visual C++ Redistributable（运行时库）
   - 但缺少 Visual Studio Build Tools（编译工具）

---

## 🛠️ 解决方案（三选一）

### ✅ 方案 1：降级 Node.js（最简单，推荐）

**优点**：
- 无需安装额外工具
- 使用预编译包，安装快速
- 稳定性好

**步骤**：

1. **打开 PowerShell（管理员）**，执行：
   ```powershell
   # 安装 Node.js 20 LTS
   nvm install 20.18.0
   
   # 切换到 Node.js 20
   nvm use 20.18.0
   
   # 验证版本
   node -v
   # 应该显示：v20.18.0
   ```

2. **清理并重新安装依赖**：
   ```powershell
   cd D:\VS2022\code\DI_llm_ED\math_llm_tutor\formula-renderer-service
   
   # 删除旧的 node_modules
   Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
   
   # 清理 npm 缓存
   npm cache clean --force
   
   # 重新安装
   npm install
   ```

3. **验证安装**：
   ```powershell
   npm start
   ```
   服务应该在 http://localhost:8080 启动

---

### 🔧 方案 2：安装 Visual Studio Build Tools（保留 Node.js 22）

**优点**：
- 保留当前 Node.js 版本
- 可以编译其他需要原生模块的包

**缺点**：
- 需要下载 ~2GB 文件
- 安装时间较长（10-30 分钟）
- 编译过程复杂

**步骤**：

1. **下载 Visual Studio Build Tools 2022**：
   ```
   https://aka.ms/vs/17/release/vs_buildtools.exe
   ```

2. **运行安装程序**，选择以下工作负载：
   - ✅ **Desktop development with C++**
   
   或者在命令行中使用：
   ```cmd
   vs_buildtools.exe --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended --quiet --wait
   ```

3. **等待安装完成**（约 10-30 分钟）

4. **重启 PowerShell（管理员）**

5. **配置 npm**：
   ```powershell
   npm config set msvs_version 2022 --global
   ```

6. **安装依赖**：
   ```powershell
   cd D:\VS2022\code\DI_llm_ED\math_llm_tutor\formula-renderer-service
   
   Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
   npm cache clean --force
   
   npm install --build-from-source
   ```

7. **验证安装**：
   ```powershell
   npm start
   ```

---

### ⚠️ 方案 3：暂时跳过 Formula Renderer 服务

**适用场景**：
- 只需要核心功能（前后端 + SymPy）
- 不需要公式渲染功能

**步骤**：

1. **修改启动脚本** `scripts\start-all.bat`：
   注释掉第 173-185 行的 Formula Renderer 相关代码

2. **直接启动其他服务**：
   ```powershell
   cd scripts
   .\start-all.bat
   ```

---

## 🚀 快速修复脚本

我已经创建了自动修复脚本：`fix-formula-renderer.bat`

**使用方法**：
```cmd
cd D:\VS2022\code\DI_llm_ED\math_llm_tutor
.\fix-formula-renderer.bat
```

脚本会自动：
1. 检测 Node.js 版本
2. 提供降级选项
3. 清理旧的安装
4. 重新安装依赖
5. 验证服务启动

---

## 📊 方案对比

| 方案 | 难度 | 时间 | 推荐度 | 适用场景 |
|------|------|------|--------|----------|
| 降级 Node.js | ⭐ | 5 分钟 | ⭐⭐⭐⭐⭐ | 大多数用户 |
| 安装 Build Tools | ⭐⭐⭐⭐ | 30 分钟 | ⭐⭐⭐ | 需要 Node.js 22 特性 |
| 跳过服务 | ⭐ | 1 分钟 | ⭐⭐ | 临时方案 |

---

## ❓ 常见问题

### Q1: 为什么需要降级 Node.js？

A: canvas 包使用原生 C++ 代码，需要为特定 Node.js 版本预编译二进制文件。Node.js 22 太新，canvas 还没有提供对应的预编译包。

### Q2: 降级 Node.js 会影响其他项目吗？

A: 不会。NVM for Windows 允许每个项目使用不同的 Node.js 版本。您可以在其他项目目录使用 `nvm use 22.22.0` 切换回去。

### Q3: 我已经安装了 Visual C++ Redistributable，为什么还不够？

A: Visual C++ Redistributable 是**运行时库**，用于运行已编译的程序。而编译 C++ 代码需要**Build Tools**（编译器、链接器等）。

### Q4: 能否升级 canvas 到更新的版本？

A: 可以尝试，但需要测试兼容性。修改 `package.json`：
```json
"canvas": "^2.13.0"
```
然后运行 `npm install`

---

## 📞 需要帮助？

如果以上方案都无法解决问题，请提供：
1. 完整的错误日志
2. Node.js 版本：`node -v`
3. npm 版本：`npm -v`
4. Windows 版本

---

## ✅ 验证清单

修复完成后，请验证：

- [ ] 访问 `http://localhost:8080/health` 返回 `{"status":"healthy"}`
- [ ] 访问 `http://localhost:8080/` 显示服务信息
- [ ] POST `http://localhost:8080/render` 可以渲染公式
- [ ] 没有控制台错误

---

**最后更新**: 2026-03-21
**适用系统**: Windows 10/11
**Node.js 版本**: 18.x / 20.x (推荐)
