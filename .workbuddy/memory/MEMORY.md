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

## 约定与注意事项
- 本机 **Bash 不可用**（Git Bash shim 缺 coreutils），改用 node 绝对路径执行脚本：`C:/Users/欧阳晨/.workbuddy/binaries/node/versions/22.22.2-3/node.exe`
- 掌握度量纲曾混用（0~1 与 0~100），统一前需确认调用点。
- `datasets/benchmark-dataset.json` / `math.json` 是现成的回归测试基线，优先用来做准确率回归。
- 用户偏好：审阅/分析类任务要求"具体可操作方案 + 定位到文件行号"，且明确禁止顺手改代码。
