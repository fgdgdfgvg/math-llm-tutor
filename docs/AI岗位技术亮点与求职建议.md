# AI 岗位视角技术亮点与求职叙事

> 本文档面向求职：把本仓库里"真正实现且可核查"的技术亮点，转化为简历/面试可讲的能力点。
> 每一条都标注了**代码证据位置**，面试被追问时可直接打开对应文件。

---

## 一、多智能体协作（Agent 编排）—— 核心亮点

**做了什么**：将"解一道高数题"拆成四个有明确职责边界的智能体串行协作，而非单次 LLM 调用。

| 智能体 | 职责 | 代码位置 |
|---|---|---|
| Planner | 抽取知识点 + 产出三级解题计划 | `nestjs-backend/src/modules/agents/planner/planner.agent.ts` |
| Solver | 本地计算 → 规则引擎 → SymPy/LLM 分派 | `nestjs-backend/src/modules/agents/solver/solver.agent.ts` |
| Diagnostic | 逐步 + 最终答案校验，四层错误诊断 | `nestjs-backend/src/modules/agents/diagnostic/diagnostic.agent.ts` |
| Feedback | 生成评分与建议 | `nestjs-backend/src/modules/agents/feedback/feedback.agent.ts` |

- **编排器**：`agents.service.ts` 调 `orchestrator.execute()`，执行顺序硬编码 `['planner','solver','diagnostic','feedback']`（`agent.orchestrator.ts`），单 agent 超时 60/45/15/10 秒。
- **可讲的工程点**：状态管理（`state-manager.service.ts`）、多模型适配（`ai-models.service.ts`，7 个 provider）、输出标准化（`output-standardizer.service.ts`）、输入预处理（`input-preprocessor.service.ts`）。

**面试叙事**：不是"调一个 LLM API"，而是设计了有状态、可观测、可降级的多智能体流水线，每个 agent 独立超时与失败兜底。

---

## 二、符号计算优先、LLM 兜底的混合推理 —— 差异化亮点

**核心设计**：`solver.agent.ts:151` `const useLLM = step.tool !== 'sympy' || !this.isSymPyAvailable();`
—— 只有 SymPy 可用且步骤标注 `tool=sympy` 时才走符号计算，否则回退 LLM。

降级链（5 处显式分支）：
1. `solver.agent.ts:113` 本地计算失败 → 规则引擎增强
2. `solver.agent.ts:185` LLM 失败 → 规则引擎生成完整解答
3. `planner.agent.ts:347` 无模型 → 规则引擎
4. `local-computation.service.ts:141` 本地规则先算，SymPy 仅"增强"
5. `feedback.agent.ts:55` / `diagnostic.agent.ts:64` catch → 规则

**可讲的工程点**：符号计算（确定性、可复现、零 token 成本）与 LLM（泛化、自然语言理解）的**成本/正确性权衡**——这是 LLM 工程里非常实际的考量。

---

## 三、结果自校验闭环 —— AI 正确性工程亮点

**做了什么**：LLM/流水线产出答案后，**不再信任模型自评**，而是把答案代回原题做硬校验。

- 入口：`agents.service.ts:92-116` `attachVerification()`（注释明确"替换让 LLM 自己检查自己的软验证"）
- `solution-verification.service.ts` 四种独立校验：
  - `verifyDerivative`（中心差分 vs 解析导数）
  - `verifyIndefiniteIntegral`（对答案求导 = 被积函数，微积分基本定理）
  - `verifyDefiniteIntegral`（Simpson 数值积分作参考真值）
  - `verifyLimit`（双侧趋近序列收敛）
  - `verifyEquationSolutions`（解代回方程，残差判定）
- `answer-equivalence.service.ts` 三级等价判定：精确多项式差 → 解集比较 → 数值抽样。

**可讲的工程点**：这是 RAG/Agent 应用里最稀缺的能力之一——**"给 LLM 输出加一道符号/数值真值校验"**，直击 AI 应用"幻觉不可控"的核心痛点。

---

## 四、可复现评测（benchmark eval）—— 数据驱动亮点

**做了什么**：把 500 题基准集从"文档里的一张结论表"变成"真正可跑、可复现的评测"。

- `scripts/benchmark-eval.cjs`：题面 LaTeX 解析 → LaTeX→SymPy 转换 → 符号求解 → 数值+符号双重等价判定。
- `scripts/latex-to-sympy.cjs`：手写 LaTeX→SymPy 转换器（递归下降 + 平衡括号扫描）。
- 产物：`results/eval-summary.md`（摘要）+ `results/eval-raw.json`（逐题原始数据，可复现）。

**可讲的工程点**：建立了"用标准答案做符号真值校验"的评测范式，评测结果诚实标注覆盖范围（不虚报），这是 AI 工程里稀缺的"可复现性意识"。

---

## 五、安全与工程稳健性 —— 后端功底亮点

- **refresh token 轮换 + 重用检测**：`token.service.ts:138-209`，宽容窗口幂等 + 窗口外重用即吊销整族 + 并发单飞（`setIfAbsent` 锁），有完整单测覆盖（`token.service.spec.ts`）。
- **限流不信任 XFF**：`rate-limit.guard.ts:84-95`，用 `request.ip`（Express `trust proxy` 语义）而非客户端可伪造的 `X-Forwarded-For`，防"换 IP 刷配额"。
- **统一错误信封** + traceId + 日志脱敏（`common/utils/redact.ts`）。
- **CI 门禁**：`.github/workflows/verify.yml`，真实 Mongo/Redis 集成 + 部署加固探针 + 密钥扫描。

---

## 六、当前短板（面试需坦诚）

1. **无 A/B 或消融实验**：从未真跑过"多智能体 vs 单 LLM"的对照实验，`paper/project_summary.md` 里的"95% 准确率"表无原始数据支撑（**简历上不要引用这个数字**）。
2. **Neo4j 知识图谱很浅**：代码种子 31 节点/39 关系，运行时库里实际仅 8 节点（历史数据未与当前代码种子同步），且无"为何选图数据库"的取舍论证。
3. **测试覆盖偏窄**：17 个 spec 集中在 auth/common，四个核心 agent 与 knowledge 服务无单测。
4. **仓库卫生**：曾跟踪 `.workbuddy/memory/`（AI 内部日志）、`.trae/`（AI IDE 痕迹）、`paper/*.docx`（含真实姓名），已清理。
5. **提交历史只有 10 天、作者 `workbuddy@local`**：面试可能被问"这是不是 AI 生成的"——需准备好诚实回答（见下）。

---

## 七、求职建议（怎么讲）

1. **诚实定位**：这是一个"AI 辅助构建的多智能体数学辅导系统"，你本人负责了架构设计、评测体系建设、安全加固与部署落地——**重点讲你"验证过、理解透"的部分**，不要照背代码。
2. **补一个 A/B 实验**（最加分）：跑一组"规则引擎/SymPy 单独 vs 多智能体流水线"在 benchmark 子集上的对照，产出真实数据——这能直接回应"多智能体是否真的有效"。
3. **补核心 agent 的单测**：至少给 solver/diagnostic 写 2-3 个边界用例，让测试覆盖不再"偏科"。
4. **写清 Neo4j 取舍**：在文档里补一段"为什么用图数据库表示知识图谱（知识点间的先修关系天然是图），以及为何可降级"。
5. **准备回答**"提交历史为何只有 10 天 / 作者是 workbuddy"：这是 AI 辅助开发的真实痕迹，可坦然说明工作流（AI 结对编程 + 人工 review + 门禁验证），反而能体现你对 AI 工具的高效运用。
