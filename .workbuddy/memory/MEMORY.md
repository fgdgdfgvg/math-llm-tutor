# 项目长期记忆 — math_llm_tutor（高等数学智能教育系统）

## 项目定位
NestJS + MongoDB + Neo4j + Vue3/UniApp 的高等数学 AI 辅导系统；核心链路：
题目 → 多智能体（planner/solver/diagnostic/feedback）→ SymPy 符号计算 → 步骤+答案。

## 已知系统性短板（审阅结论，见 docs/系统代码审阅与改进方案.md）
1. **本地规则引擎不可信**：用正则/字符串匹配猜答案，猜不到就返回 `（极限值）` 之类占位符作为 finalAnswer。
   改造方向：表达式 AST + 有理数精确运算 + SolverStrategy 责任链 + Unsolved 显式状态。
2. **答案等价判定用字符串比较**，缺数值抽样 / 符号 / 归一化三级判定。
3. **无结果自校验闭环**（代回验证、差分验证、求导验证、checkodesol）。
4. 安全：密钥曾明文入库与日志（需轮换）、注册 admin 提权、生产 CORS 兜底全放行。
5. 重复实现：两套前端、两份 sympy 服务、三套公式渲染器。

> 截至 2026-10-01：条目 1~4 的代码侧均已落地（见 docs/改进实施进度.md 与 docs/方案复盘与第二轮实施报告.md）；
> 仅剩"服务商后台轮换 3 组泄露密钥"需人工执行。条目 5 与巨型文件拆分、SSE 任务化为剩余 P1/P2。
> 自检报告 20 项亦全部闭环（提交 577f03a），系统状态：可部署工程原型。

## 上线门禁与探针（2026-10-01 建立，改代码后必须全绿）
- `npm run verify`（= `scripts/verify-all.cjs`）：后端 tsc + jest / 前端 vue-tsc / 密钥扫描 / 日志卫生扫描，**5 项全绿才可提交**。
- `node self-check.cjs --mode local --full`：完整集成自检（38 项，需 Mongo/SymPy）；`scripts/auth-probe.cjs`：认证授权真实 HTTP 探针（`BASE_URL` 指定入口）。
- CI：`.github/workflows/verify.yml`（静态门禁 + 真实 Mongo/Redis 的认证集成作业），与本地同一份脚本。
- **健康探针语义**：`/health/live` 只表示进程存活、**不查任何依赖**（毫秒级，可作 liveness）；
  `/health/ready` 只判**关键依赖**（Mongo、已配置但不可达的 Redis），不就绪返回 503；
  SymPy/Neo4j 属可降级依赖**不查**。`/health`、`/health/detailed` 是人工排查用全量视图，**不要拿来做探针**（会同步查 SymPy，最坏 15s+）。
- **响应信封约定**：`TransformInterceptor` 的 `code` 必须与 HTTP 状态一致（≥400 透传，2xx 记 200）；新增"未就绪/非 2xx"接口时务必确认这一点。
- **密钥扫描豁免策略**：只能往 `secret-scan.cjs` 的 `ALLOWLIST` 加"文件 + 规则"精确条目（针对测试夹具），**禁止按目录整体排除**；命中豁免会显式打印，新增豁免会出现在 diff 里。

## 约定与注意事项
- 仓库已建 git（2026-10-01 baseline 提交），改动前先确认 git status 干净、完成后提交。
- 本机 **Bash 不可用**（Git Bash shim 缺 coreutils），改用 node 绝对路径执行脚本：`C:/Users/欧阳晨/.workbuddy/binaries/node/versions/22.22.2-3/node.exe`
- 后端验证三件套：tsc --noEmit → jest → `node self-check.cjs --mode local --full`；`nest build` 在沙箱中清 dist 会失败，用 tsc 替代。
  **关键**：自检跑的是 `nestjs-backend/dist`，改完代码必须先 `tsc -p tsconfig.build.json`（emit，不加 --noEmit）重编译再起进程，否则验证的是旧代码（2026-10-01 踩过：33/35 通过但新接口 404）。
- 认证约定：access 15min + refresh 30d（只存哈希、轮换+重用检测）；前端 401 单飞刷新；改 JWT 相关必须前后端同步。
- 密钥卫生：`npm run secret:scan` 作为提交前门禁；日志一律经 `common/utils/redact.ts`，禁止整体打印 axios 错误对象。
- 掌握度量纲曾混用（0~1 与 0~100），统一前需确认调用点。
- `datasets/benchmark-dataset.json` / `math.json` 是现成的回归测试基线，优先用来做准确率回归。
- 用户偏好：审阅/分析类任务要求"具体可操作方案 + 定位到文件行号"；审阅轮禁止顺手改代码，实施轮则要求验证证据（编译/测试/自检）。
