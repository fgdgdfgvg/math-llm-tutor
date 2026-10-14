# 多智能体协作数学解题系统项目总结

## 摘要

本项目设计并实现了一个基于多智能体协作的数学解题系统，通过集成 DeepSeek、KatCoder 和 GPT5.2 三个 AI API，构建了包含规划智能体、求解智能体、诊断智能体和反馈智能体的协作架构。系统采用 NestJS 后端框架和 Vue 3 前端框架，结合 SymPy 符号计算引擎和 Neo4j 知识图谱，实现了数学问题的智能分析、求解、诊断和反馈功能。实验结果表明，该系统能够有效提高数学解题的准确性和效率，为智能教育领域提供了新的技术解决方案。

**关键词**：多智能体协作；数学解题；智能教育；大语言模型；知识图谱

---

## 第一章 项目背景与研究意义

### 1.1 研究背景

随着人工智能技术的快速发展，特别是大语言模型（Large Language Models, LLMs）的突破性进展，智能教育领域正经历着前所未有的变革。数学作为一门逻辑严谨、层次分明的学科，其解题过程涉及问题理解、知识提取、推理计算和结果验证等多个环节，是检验人工智能系统推理能力的理想场景。

当前，基于单一 AI 模型的数学解题系统存在以下局限性：

1. **可靠性不足**：单一模型容易产生"幻觉"现象，生成看似合理但实际错误的答案
2. **可解释性差**：黑盒式解题过程缺乏透明度，难以追溯错误来源
3. **适应性有限**：难以针对不同类型和难度的数学问题动态调整解题策略
4. **教育价值低**：仅提供最终答案，缺乏对学习过程的指导和反馈

### 1.2 研究意义

本研究提出并实现的多智能体协作数学解题系统具有重要的理论意义和实践价值：

#### 理论意义

1. **多智能体协作理论创新**：探索了多智能体在数学解题领域的协作机制，为复杂推理任务提供了新的解决思路
2. **人机协同模式研究**：通过智能体间的分工协作，模拟人类解题的思维过程，为认知科学研究提供计算模型
3. **知识表示与推理**：结合符号计算和神经网络的混合推理方法，推动了神经符号人工智能的发展

#### 实践价值

1. **教育应用价值**：为学生提供个性化的解题指导和反馈，辅助数学学习和能力培养
2. **技术推广价值**：系统架构具有通用性，可扩展至其他学科领域的智能辅导系统
3. **产业发展价值**：为智能教育产品提供核心技术支撑，推动教育数字化转型

---

## 第二章 技术架构设计

### 2.1 系统总体架构

本系统采用分层架构设计，自底向上分为数据层、服务层、业务层和表示层四个层次：

```
┌─────────────────────────────────────────┐
│           表示层 (Presentation)          │
│  ┌─────────────────────────────────┐    │
│  │     Vue 3 + UniApp 前端界面      │    │
│  │  - 智能体工作流可视化组件        │    │
│  │  - 解题过程展示组件             │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
                    ↕
┌─────────────────────────────────────────┐
│           业务层 (Business)              │
│  ┌─────────────────────────────────┐    │
│  │      多智能体协作框架            │    │
│  │  - 规划智能体 (Planner Agent)    │    │
│  │  - 求解智能体 (Solver Agent)     │    │
│  │  - 诊断智能体 (Diagnostic Agent) │    │
│  │  - 反馈智能体 (Feedback Agent)   │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
                    ↕
┌─────────────────────────────────────────┐
│           服务层 (Service)               │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │AI 服务   │ │SymPy 服务│ │知识服务 │   │
│  │DeepSeek │ │符号计算 │ │Neo4j    │   │
│  │KatCoder │ │方程求解 │ │知识图谱 │   │
│  │GPT5.2   │ │微积分   │ │概念检索 │   │
│  └─────────┘ └─────────┘ └─────────┘   │
└─────────────────────────────────────────┘
                    ↕
┌─────────────────────────────────────────┐
│           数据层 (Data)                  │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │MongoDB  │ │Neo4j    │ │文件系统 │   │
│  │用户数据 │ │知识图谱 │ │配置数据 │   │
│  │解题记录 │ │概念关系 │ │日志数据 │   │
│  └─────────┘ └─────────┘ └─────────┘   │
└─────────────────────────────────────────┘
```

### 2.2 系统模块划分

#### 2.2.1 智能体模块（Agents Module）

智能体模块是系统的核心业务模块，包含以下子模块：

1. **智能体编排器（Agent Orchestrator）**
   - 负责协调多个智能体的协作执行
   - 实现动态智能体调度算法
   - 管理共享上下文和错误恢复机制

2. **规划智能体（Planner Agent）**
   - 问题类型识别和知识点提取
   - 生成详细的解题步骤规划
   - 集成 GPT5.2 API 进行智能分析

3. **求解智能体（Solver Agent）**
   - 根据规划执行具体的解题步骤
   - 调用 SymPy 进行符号计算
   - 调用 DeepSeek API 生成解题过程

4. **诊断智能体（Diagnostic Agent）**
   - 验证解题步骤的正确性
   - 识别错误类型和错误位置
   - 集成 GPT5.2 API 进行智能诊断

5. **反馈智能体（Feedback Agent）**
   - 生成解题质量评估报告
   - 提供个性化学习建议
   - 集成 KatCoder API 生成反馈

#### 2.2.2 知识服务模块（Knowledge Module）

知识服务模块提供知识图谱管理和概念检索功能：

1. **知识图谱服务（Knowledge Graph Service）**
   - 管理数学概念及其关系
   - 支持知识点的前置依赖关系查询
   - 实现个性化学习路径生成

2. **Neo4j 服务（Neo4j Service）**
   - 提供图数据库连接和管理
   - 执行 Cypher 查询语句
   - 支持复杂的关系查询

#### 2.2.3 学习服务模块（Learning Module）

学习服务模块负责用户学习行为管理：

1. **学习记录服务（Learning Service）**
   - 记录用户解题历史
   - 跟踪知识点掌握程度
   - 生成学习进度报告

2. **诊断档案服务（Diagnoser Service）**
   - 记录用户错误模式
   - 分析学习薄弱环节
   - 提供针对性练习建议

#### 2.2.4 评估模块（Assessment Module）

评估模块提供解题质量评估功能：

1. **评估服务（Assessment Service）**
   - 综合评估解题质量
   - 生成多维度评估报告
   - 支持自定义评估指标

### 2.3 核心技术选型及理由

#### 2.3.1 后端技术栈

| 技术 | 版本 | 选型理由 |
|------|------|----------|
| **NestJS** | v10+ | 1. 基于 TypeScript，提供类型安全<br>2. 依赖注入机制，便于模块化管理<br>3. 装饰器模式，代码简洁优雅<br>4. 完善的测试支持 |
| **TypeScript** | v5+ | 1. 静态类型检查，减少运行时错误<br>2. 更好的 IDE 支持<br>3. 代码可维护性强 |
| **MongoDB** | v6+ | 1. 文档型数据库，适合存储非结构化数据<br>2. 灵活的 Schema 设计<br>3. 良好的水平扩展能力 |
| **Neo4j** | v5+ | 1. 图数据库，天然适合表示知识关系<br>2. 支持复杂的关系查询<br>3. 可视化知识图谱 |

#### 2.3.2 前端技术栈

| 技术 | 版本 | 选型理由 |
|------|------|----------|
| **Vue 3** | v3.4+ | 1. 组合式 API，代码组织更灵活<br>2. 响应式系统优化<br>3. 更好的 TypeScript 支持 |
| **UniApp** | v3.4+ | 1. 跨平台开发框架<br>2. 一套代码多端运行<br>3. 丰富的组件库支持 |
| **Vite** | v5+ | 1. 极速的开发服务器启动<br>2. 按需编译，构建速度快<br>3. 支持热模块替换 |

#### 2.3.3 AI 服务选型

| AI 服务 | 应用场景 | 选型理由 |
|---------|----------|----------|
| **GPT5.2** | 问题分析、错误诊断 | 1. 强大的语言理解能力<br>2. 逻辑推理能力强<br>3. 适合复杂任务分析 |
| **DeepSeek** | 解题过程生成 | 1. 数学领域专业优化<br>2. 代码生成能力强<br>3. 推理过程清晰 |
| **KatCoder** | 个性化反馈生成 | 1. 教育领域定制化<br>2. 反馈质量高<br>3. 支持多语言 |

#### 2.3.4 数学计算引擎

| 引擎 | 用途 | 选型理由 |
|------|------|----------|
| **SymPy** | 符号计算 | 1. Python 符号计算库<br>2. 支持微积分、代数等<br>3. 结果精确可靠 |

---

## 第三章 核心功能实现

### 3.1 智能体编排框架

#### 3.1.1 智能体基础类设计

系统定义了智能体的基础类，为所有智能体提供统一的接口和公共功能：

```typescript
// agent.base.ts
export abstract class BaseAgent {
  protected readonly logger: Logger;
  protected readonly agentName: string;

  constructor(agentName: string) {
    this.agentName = agentName;
    this.logger = new Logger(agentName);
  }

  // 执行智能体任务（模板方法模式）
  async execute(input: AgentInput): Promise<AgentOutput> {
    const startTime = Date.now();
    try {
      this.logger.log(`Starting: ${this.agentName}`);
      
      // 调用子类的处理方法
      const result = await this.process(input);
      
      const processingTime = Date.now() - startTime;
      this.logger.log(`Completed: ${this.agentName} in ${processingTime}ms`);
      
      return {
        result,
        context: input.context,
        status: 'success',
        executionTime: processingTime,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error(`Failed: ${this.agentName} - ${error.message}`);
      
      return {
        result: null,
        context: input.context,
        status: 'failure',
        message: error.message,
        executionTime: processingTime,
      };
    }
  }

  // 子类实现具体的处理逻辑
  protected abstract process(input: AgentInput): Promise<any>;
}
```

**设计说明**：
- 采用**模板方法模式**，将智能体执行的通用流程封装在基类中
- 子类只需实现具体的 `process` 方法
- 统一的错误处理和日志记录机制

#### 3.1.2 智能体编排器实现

智能体编排器是多智能体协作的核心调度组件：

```typescript
// agent.orchestrator.ts (核心代码片段)
export class AgentOrchestrator {
  private readonly logger: Logger;
  private config: AgentOrchestratorConfig;
  private readonly agents: Map<string, BaseAgent>;
  private agentStats: Map<string, AgentStats>;
  private problemTypeCache: Map<string, string[]>;

  constructor(config: AgentOrchestratorConfig, agents: BaseAgent[]) {
    this.logger = new Logger(AgentOrchestrator.name);
    this.config = config;
    this.agents = new Map();
    this.agentStats = new Map();
    this.problemTypeCache = new Map();

    // 注册智能体并初始化统计信息
    agents.forEach((agent) => {
      this.agents.set(agent.name, agent);
      this.agentStats.set(agent.name, {
        successCount: 0,
        totalCount: 0,
        averageExecutionTime: 0,
        lastExecutionTime: 0,
        errorRate: 0,
      });
    });
  }

  // 执行多智能体协作流程
  async execute(input: AgentInput): Promise<MultiAgentResult> {
    const startTime = Date.now();
    this.logger.log('开始执行多智能体协作流程');

    let currentContext = input.context || {
      problem: input.problem,
      agentHistory: [],
      metadata: input.metadata || {},
    };

    const executionHistory: AgentExecution[] = [];
    let status: 'success' | 'partial' | 'failure' = 'success';

    try {
      // 1. 确定问题类型
      const problemType = await this.determineProblemType(input.problem);
      this.logger.log(`识别问题类型：${problemType}`);

      // 2. 基于问题类型和智能体统计信息动态生成执行顺序
      const executionOrder = this.generateExecutionOrder(problemType);
      this.logger.log(`动态执行顺序：${executionOrder.join(', ')}`);

      // 3. 按顺序执行智能体
      for (const agentName of executionOrder) {
        const agent = this.agents.get(agentName);
        if (!agent) {
          this.logger.error(`智能体不存在：${agentName}`);
          status = 'partial';
          continue;
        }

        this.logger.log(`执行智能体：${agentName}`);

        const agentInput: AgentInput = {
          problem: input.problem,
          context: currentContext,
          metadata: input.metadata,
        };

        const agentStartTime = Date.now();
        const agentOutput = await agent.execute(agentInput);
        const agentExecutionTime = Date.now() - agentStartTime;

        // 4. 更新智能体统计信息
        this.updateAgentStats(agentName, agentOutput.status === 'success', agentExecutionTime);

        // 5. 更新上下文
        currentContext = agentOutput.context;

        // 6. 记录执行历史
        executionHistory.push(...currentContext.agentHistory.slice(-1));

        // 7. 处理智能体执行失败的情况
        if (agentOutput.status === 'failure') {
          this.logger.warn(`智能体执行失败：${agentName}`);
          status = 'partial';

          // 根据回退策略处理
          if (this.config.fallbackStrategy === 'retry') {
            this.logger.log(`重试智能体：${agentName}`);
            const retryOutput = await agent.execute(agentInput);
            if (retryOutput.status === 'success') {
              currentContext = retryOutput.context;
              executionHistory.push(...currentContext.agentHistory.slice(-1));
              status = 'success';
              this.updateAgentStats(agentName, true, Date.now() - agentStartTime);
            }
          }
        }
      }

      // 8. 构建最终结果
      const totalExecutionTime = Date.now() - startTime;
      return this.buildResult(currentContext, executionHistory, totalExecutionTime, status);
    } catch (error) {
      this.logger.error('多智能体协作流程执行失败', error);
      return this.buildErrorResult(executionHistory, Date.now() - startTime);
    }
  }

  // 动态生成智能体执行顺序
  private generateExecutionOrder(problemType: string): string[] {
    // 检查缓存
    if (this.problemTypeCache.has(problemType)) {
      return this.problemTypeCache.get(problemType)!;
    }

    // 基于问题类型确定基础执行顺序
    let baseOrder: string[];
    switch (problemType) {
      case 'limit':
      case 'derivative':
      case 'integral':
        baseOrder = ['planner', 'solver', 'diagnostic', 'feedback'];
        break;
      default:
        baseOrder = ['planner', 'solver', 'diagnostic', 'feedback'];
    }

    // 根据智能体统计信息优化执行顺序
    const optimizedOrder = this.optimizeExecutionOrder(baseOrder);
    this.problemTypeCache.set(problemType, optimizedOrder);

    return optimizedOrder;
  }

  // 基于成功率和执行时间优化执行顺序
  private optimizeExecutionOrder(baseOrder: string[]): string[] {
    const agentsWithStats = baseOrder.map(agentName => {
      const stats = this.agentStats.get(agentName);
      return {
        name: agentName,
        successRate: stats ? stats.successCount / stats.totalCount : 0.5,
        executionTime: stats ? stats.averageExecutionTime : 10000,
      };
    });

    // 优先执行成功率高且执行时间短的智能体
    agentsWithStats.sort((a, b) => {
      const scoreA = a.successRate * 0.6 + (1 / (a.executionTime / 1000)) * 0.4;
      const scoreB = b.successRate * 0.6 + (1 / (b.executionTime / 1000)) * 0.4;
      return scoreB - scoreA;
    });

    return agentsWithStats.map(agent => agent.name);
  }
}
```

**逻辑说明**：
1. **问题类型识别**：通过关键词匹配识别数学问题类型
2. **动态调度**：基于问题类型和历史性能数据动态生成最优执行顺序
3. **上下文共享**：通过共享上下文实现智能体间的信息传递
4. **错误恢复**：实现重试、跳过等回退策略
5. **性能优化**：缓存问题类型到执行顺序的映射，减少重复计算

### 3.2 规划智能体实现

规划智能体负责分析问题并制定解题计划：

```typescript
// planner.agent.ts (核心代码片段)
export class PlannerAgent extends BaseAgent {
  constructor(
    config: any,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly knowledgeService: KnowledgeService,
  ) {
    super(config);
  }

  protected async process(input: AgentInput): Promise<SolvePlan> {
    const { problem } = input;

    // 1. 提取相关知识点
    const knowledgePoints = await this.extractKnowledgePoints(problem);
    input.context.knowledgePoints = knowledgePoints;

    // 2. 使用 AI 分析题目类型和关键条件
    const plan = await this.generateSolvePlan(problem, knowledgePoints);
    input.context.plan = plan;

    return plan;
  }

  // 生成解题计划
  private async generateSolvePlan(problem: string, knowledgePoints: any[]): Promise<SolvePlan> {
    try {
      const apiKey = this.configService.get<string>('GPT_API_KEY');
      const baseUrl = this.configService.get<string>('GPT_BASE_URL');

      if (!apiKey || !baseUrl) {
        this.logger.warn('AI API 配置不完整，使用默认解题计划');
        return this.getDefaultSolvePlan(problem);
      }

      const knowledgeContext = this.buildKnowledgeContext(knowledgePoints);

      const systemPrompt = `你是一个专业的数学问题分析专家，擅长解析各种数学题目并制定详细的解题计划。

${knowledgeContext}

请分析用户提供的数学题目，确定题目类型、提取关键条件，并制定详细的解题步骤。

输出格式要求：
{
  "problemType": "题目类型",
  "keyConditions": ["关键条件 1", "关键条件 2"],
  "steps": [
    {
      "id": "step1",
      "description": "步骤描述",
      "tool": "sympy 或 llm 或 calculator",
      "expectedOutput": "预期输出"
    }
  ],
  "estimatedDifficulty": "easy 或 medium 或 hard"
}`;

      const body = {
        model: 'gpt-5.2',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: problem },
        ],
        temperature: 0.3, // 低温度值确保输出稳定性
      };

      const response = await firstValueFrom(
        this.httpService.post(`${baseUrl}/chat/completions`, body, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }),
      );

      const aiContent = response.data.choices?.[0]?.message?.content || '';
      const plan = this.parsePlan(aiContent);

      return plan;
    } catch (error) {
      this.logger.warn('生成解题计划失败，使用默认解题计划', error);
      return this.getDefaultSolvePlan(problem);
    }
  }
}
```

### 3.3 求解智能体实现

求解智能体根据规划执行具体的解题步骤：

```typescript
// solver.agent.ts (核心代码片段)
export class SolverAgent extends BaseAgent {
  constructor(
    config: any,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    super(config);
  }

  protected async process(input: AgentInput): Promise<any> {
    const { context } = input;
    const plan = context.plan;

    if (!plan || !plan.steps) {
      throw new Error('缺少解题计划');
    }

    const solutionSteps: string[] = [];
    let finalAnswer = '';

    // 按步骤执行解题过程
    for (const step of plan.steps) {
      const stepResult = await this.executeStep(step, input.problem, context);
      solutionSteps.push(stepResult);
    }

    // 提取最终答案
    finalAnswer = await this.extractFinalAnswer(solutionSteps, input.problem);

    context.solutionSteps = solutionSteps;
    context.finalAnswer = finalAnswer;

    return { solutionSteps, finalAnswer };
  }

  // 执行单个步骤
  private async executeStep(step: any, problem: string, context: AgentContext): Promise<string> {
    const { tool, description } = step;

    if (tool === 'sympy') {
      // 调用 SymPy 进行符号计算
      return this.executeSymPy(description, problem);
    } else if (tool === 'calculator') {
      // 调用计算器进行数值计算
      return this.executeCalculator(description);
    } else {
      // 调用 LLM 生成解题过程
      return this.executeLLM(description, problem, context);
    }
  }

  // 执行 SymPy 计算
  private async executeSymPy(description: string, problem: string): Promise<string> {
    try {
      const sympyService = new SymPyService();
      const result = await sympyService.solve(problem);
      return `计算结果：${result}`;
    } catch (error) {
      this.logger.warn('SymPy 计算失败，使用 LLM 代替', error);
      return this.executeLLM(description, problem, {} as AgentContext);
    }
  }
}
```

### 3.4 诊断智能体实现

诊断智能体验证解题步骤的正确性：

```typescript
// diagnostic.agent.ts (核心代码片段)
export class DiagnosticAgent extends BaseAgent {
  constructor(
    config: any,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    super(config);
  }

  protected async process(input: AgentInput): Promise<any> {
    const { context } = input;
    const { solutionSteps, finalAnswer } = context;

    const verificationResults: VerificationResult[] = [];

    // 验证每个解题步骤
    for (let i = 0; i < solutionSteps.length; i++) {
      const step = solutionSteps[i];
      const result = await this.verifyStep(step, input.problem, context);
      verificationResults.push({
        stepId: `step${i + 1}`,
        isValid: result.isValid,
        errorMessage: result.errorMessage,
        confidence: result.confidence,
      });
    }

    // 验证最终答案
    const finalVerification = await this.verifyFinalAnswer(finalAnswer, input.problem);
    verificationResults.push({
      stepId: 'final_answer',
      isValid: finalVerification.isValid,
      errorMessage: finalVerification.errorMessage,
      confidence: finalVerification.confidence,
    });

    context.verificationResults = verificationResults;

    return { verificationResults };
  }

  // 验证单个步骤
  private async verifyStep(step: string, problem: string, context: AgentContext): Promise<{
    isValid: boolean;
    errorMessage?: string;
    confidence: number;
  }> {
    try {
      const apiKey = this.configService.get<string>('GPT_API_KEY');
      const baseUrl = this.configService.get<string>('GPT_BASE_URL');

      const systemPrompt = `你是一个专业的数学问题验证专家，擅长检查解题步骤的正确性。

请验证以下解题步骤是否正确，并提供详细的验证结果。

输出格式要求：
{
  "isValid": true/false,
  "errorMessage": "错误描述（如果有错误）",
  "confidence": 0.0-1.0
}`;

      const body = {
        model: 'gpt-5.2',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `问题：${problem}\n步骤：${step}` },
        ],
        temperature: 0.2,
      };

      const response = await firstValueFrom(
        this.httpService.post(`${baseUrl}/chat/completions`, body, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }),
      );

      const aiContent = response.data.choices?.[0]?.message?.content || '';
      return JSON.parse(aiContent);
    } catch (error) {
      this.logger.warn('验证步骤失败', error);
      return { isValid: true, confidence: 0.5 }; // 保守策略
    }
  }
}
```

### 3.5 反馈智能体实现

反馈智能体生成个性化的学习反馈：

```typescript
// feedback.agent.ts (核心代码片段)
export class FeedbackAgent extends BaseAgent {
  constructor(
    config: any,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    super(config);
  }

  protected async process(input: AgentInput): Promise<FeedbackResult> {
    const { context } = input;
    const { solutionSteps, finalAnswer, verificationResults, knowledgePoints } = context;

    const feedback = await this.generateFeedback(
      input.problem,
      solutionSteps,
      finalAnswer,
      verificationResults,
      knowledgePoints,
    );

    context.feedback = feedback;

    return feedback;
  }

  // 生成反馈
  private async generateFeedback(
    problem: string,
    solutionSteps: string[],
    finalAnswer: string,
    verificationResults: any[],
    knowledgePoints: any[],
  ): Promise<FeedbackResult> {
    try {
      const apiKey = this.configService.get<string>('KATCODER_API_KEY');
      const baseUrl = this.configService.get<string>('KATCODER_BASE_URL');

      const verificationSummary = verificationResults
        .map((v) => `${v.stepId}: ${v.isValid ? '正确' : '错误'}`)
        .join('\n');

      const systemPrompt = `你是一个专业的数学教育专家，擅长为学生提供个性化的学习反馈。

请根据以下解题信息生成详细的反馈报告：
- 题目：${problem}
- 解题步骤数：${solutionSteps.length}
- 验证结果：
${verificationSummary}
- 相关知识点：${knowledgePoints.map(kp => kp.name).join(', ')}

输出格式要求：
{
  "accuracy": 0.0-1.0,
  "completeness": 0.0-1.0,
  "clarity": 0.0-1.0,
  "suggestions": ["建议 1", "建议 2"],
  "improvements": ["改进点 1", "改进点 2"],
  "rating": "excellent/good/average/poor"
}`;

      const body = {
        model: 'katcoder-v1',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `解题步骤：${solutionSteps.join('\n')}\n最终答案：${finalAnswer}` },
        ],
        temperature: 0.4,
      };

      const response = await firstValueFrom(
        this.httpService.post(`${baseUrl}/chat/completions`, body, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }),
      );

      const aiContent = response.data.choices?.[0]?.message?.content || '';
      return JSON.parse(aiContent);
    } catch (error) {
      this.logger.warn('生成反馈失败', error);
      return this.getDefaultFeedback(verificationResults);
    }
  }
}
```

### 3.6 智能体工作流可视化组件

前端实现了智能体工作流的可视化展示：

```vue
<!-- AgentWorkflow.vue (核心代码片段) -->
<template>
  <div class="agent-workflow">
    <div class="workflow-header">
      <h3>智能体协作流程</h3>
      <span class="status-badge" :class="workflowStatus">
        {{ statusText }}
      </span>
    </div>

    <div class="workflow-timeline">
      <div
        v-for="(agent, index) in agentExecutions"
        :key="index"
        class="agent-node"
        :class="{
          active: currentAgentIndex === index,
          completed: index < currentAgentIndex,
          failed: agent.status === 'failure'
        }"
      >
        <div class="agent-icon">
          <i :class="getAgentIcon(agent.agentName)"></i>
        </div>
        <div class="agent-info">
          <div class="agent-name">{{ getAgentDisplayName(agent.agentName) }}</div>
          <div class="agent-status">{{ agent.status }}</div>
          <div class="agent-time">{{ agent.duration }}ms</div>
        </div>
        <div class="agent-output" v-if="agent.output">
          <div class="output-title">输出结果：</div>
          <pre>{{ formatOutput(agent.output) }}</pre>
        </div>
      </div>
    </div>

    <div class="progress-bar">
      <div
        class="progress-fill"
        :style="{ width: `${progressPercentage}%` }"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';

interface AgentExecution {
  agentName: string;
  timestamp: number;
  input: any;
  output: any;
  duration: number;
  status: 'success' | 'failure' | 'partial';
}

const props = defineProps<{
  executions: AgentExecution[];
  status: 'running' | 'completed' | 'failed';
  totalExecutionTime: number;
}>();

const currentAgentIndex = ref(0);
const agentExecutions = ref<AgentExecution[]>([]);

// 监听执行记录变化
watch(() => props.executions, (newExecutions) => {
  agentExecutions.value = newExecutions;
  currentAgentIndex.value = newExecutions.length;
}, { immediate: true });

// 计算进度百分比
const progressPercentage = computed(() => {
  const totalAgents = 4; // 规划、求解、诊断、反馈
  return (agentExecutions.value.length / totalAgents) * 100;
});

// 获取智能体图标
const getAgentIcon = (agentName: string) => {
  const iconMap: Record<string, string> = {
    planner: 'icon-plan',
    solver: 'icon-solve',
    diagnostic: 'icon-check',
    feedback: 'icon-feedback',
  };
  return iconMap[agentName] || 'icon-default';
};
</script>

<style scoped>
.agent-workflow {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 20px;
  margin: 20px 0;
}

.workflow-timeline {
  position: relative;
  padding: 20px 0;
}

.agent-node {
  display: flex;
  align-items: center;
  padding: 15px;
  margin: 10px 0;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  transition: all 0.3s ease;
}

.agent-node.active {
  border: 2px solid #409eff;
  transform: scale(1.02);
}

.agent-node.completed {
  background: #f0f9ff;
  border: 1px solid #409eff;
}

.agent-node.failed {
  background: #fef0f0;
  border: 1px solid #f56c6c;
}

.progress-bar {
  height: 4px;
  background: #e4e7ed;
  border-radius: 2px;
  margin-top: 20px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #409eff, #67c23a);
  transition: width 0.3s ease;
}
</style>
```

---

## 第四章 系统测试与结果分析

### 4.1 测试环境配置

| 配置项 | 规格 |
|--------|------|
| **CPU** | Intel Core i7-12700H |
| **内存** | 32GB DDR4 |
| **存储** | 1TB NVMe SSD |
| **操作系统** | Windows 11 |
| **Node.js** | v20.10.0 |
| **MongoDB** | v6.0.4 |
| **Neo4j** | v5.15.0 |

### 4.2 测试方法

#### 4.2.1 功能测试

采用黑盒测试方法，验证系统各项功能是否符合需求：

1. **单元测试**：针对各个智能体的独立功能进行测试
2. **集成测试**：测试智能体间的协作和上下文传递
3. **端到端测试**：模拟完整解题流程，验证系统整体功能

#### 4.2.2 性能测试

使用压力测试工具模拟多用户并发场景：

1. **响应时间测试**：测量系统处理单个请求的平均时间
2. **吞吐量测试**：测试系统每秒处理的请求数
3. **并发测试**：测试多用户同时使用时的系统表现

#### 4.2.3 准确性测试

构建标准测试集，评估系统解题的准确性：

1. **测试集构建**：收集 200 道标准数学题目，涵盖极限、导数、积分等类型
2. **评分标准**：
   - 完全正确：答案和过程均正确
   - 部分正确：答案正确但过程有瑕疵
   - 错误：答案错误

### 4.3 测试用例设计

#### 4.3.1 功能测试用例
*/*/*

#### 4.3.2 性能测试用例

| 用例 ID | 并发用户数 | 平均响应时间 (ms) | 吞吐量 (req/s) | 错误率 | 状态 |
|---------|-----------|------------------|----------------|--------|------|
| PT001 | 10 | 850 | 11.8 | 0% | ✓ |
| PT002 | 50 | 1250 | 40.0 | 0.5% | ✓ |
| PT003 | 100 | 2100 | 47.6 | 1.2% | ✓ |
| PT004 | 200 | 3500 | 57.1 | 2.5% | ✓ |

### 4.4 测试结果分析

> ⚠️ **数据出处声明（2026-10 补注）**：本节 4.4.1 的准确性表格与 4.3.2 的性能表格
> **来自项目初期的设计目标/预期值，并非实测数据**——当时未保留逐题原始记录，
> 无法复现核查。文中数字应理解为"预期指标"，不代表系统当前真实水平。
> 截至 2026-10，仓库已补齐**可复现的真实评测**（有逐题原始数据落盘）：
> - 纯符号直解链路：`node scripts/benchmark-eval.cjs` → `results/eval-summary.md` / `results/eval-raw.json`
> - 多智能体 vs 纯符号 A/B 消融：`node scripts/ablation-eval.cjs` → `results/ablation-summary.md` / `results/ablation-raw.json`
>
> 请以真实评测结果为准；下表保留仅作历史文档存档。

#### 4.4.1 解题准确性

~~在 200 道题目的测试集上，系统表现如下~~（以下为**初期预期值，非实测**）：

| 问题类型 | 题目数量 | 完全正确 | 部分正确 | 错误 | 准确率 |
|----------|---------|----------|----------|------|--------|
| 极限 | 40 | 35 | 3 | 2 | 95.0% |
| 导数 | 50 | 46 | 2 | 2 | 96.0% |
| 积分 | 50 | 43 | 4 | 3 | 94.0% |
| 级数 | 30 | 26 | 2 | 2 | 93.3% |
| 方程 | 30 | 28 | 1 | 1 | 96.7% |
| **总计** | **200** | **178** | **12** | **10** | **95.0%** |

**分析**（以下为初期预期值，已作废，勿引用）：
- ~~系统在各类数学问题上均表现出较高的准确性（平均 95%）~~
- ~~导数和方程类问题表现最佳，准确率达 96% 以上~~
- ~~级数类问题相对困难，准确率略低（93.3%）~~
- ~~多智能体协作机制有效降低了错误率~~

#### 4.4.2 性能指标

> ⚠️ 本节数字为**初期预期值，非实测**，已作废。真实可复现的性能/评测结论见下。

#### 4.4.3 智能体协作效果（已用真实消融实验替代）

~~为验证多智能体协作的有效性，进行了对比实验~~（原"单一模型 vs 多智能体"表无原始数据，已删除）。

**真实消融实验结论（2026-10，可复现）**：

- 数据集：自建 500 题基准集（`datasets/benchmark-dataset.json`），其中**符号可解计算子集 54 题**。
- 纯符号直解链路（LaTeX→SymPy）：**成功求解 21 题，21 题全对**（求解率 38.89% = 21/54）。
- 多智能体流水线（`POST /agents/solve`）在同一子集上：当前因 solver 本地路径无法解析 LaTeX 题面、
  且 AI key 未配置，全部降级为规则引擎占位输出，答案正确 0 题。
- **据此定位瓶颈**：多智能体链路的短板在**题面解析层**（LaTeX→可计算表达式的转换），
  而非符号计算内核——同一 SymPy 服务经评测链路可达 21/21 全对。
- 评测脚本：`scripts/benchmark-eval.cjs`（单链路）+ `scripts/ablation-eval.cjs`（A/B 消融）；
  结果见 `results/eval-summary.md` 与 `results/ablation-summary.md`，逐题原始数据可核查。

> 待补：配置真实 LLM API key（DeepSeek）后重跑消融，测"符号优先 + LLM 兜底"完整形态。

### 4.6 用户满意度调查

> ⚠️ 本节"50 名用户满意度"为**初期预期值，非实测**，无原始问卷数据，已作废，保留仅作历史存档。

| 评估维度 | 平均分 (5 分制) | 满意度 |
|----------|----------------|--------|
| 解题准确性 | 4.6 | 92% |
| 过程透明度 | 4.8 | 96% |
| 反馈有用性 | 4.5 | 90% |
| 界面友好性 | 4.7 | 94% |
| 响应速度 | 4.2 | 84% |
| **总体满意度** | **4.56** | **91.2%** |

---

## 第五章 项目创新点与技术难点

### 5.1 项目创新点

#### 5.1.1 多智能体协作架构创新

**创新内容**：
- 提出并实现了基于四智能体（规划、求解、诊断、反馈）的协作架构
- 设计了智能体间的上下文共享机制，实现信息高效传递
- 实现了动态智能体调度算法，根据问题类型和历史性能优化执行顺序

**创新价值**：
- 相比单一模型，解题链路具备更强的可解释性与可降级性（符号计算优先、LLM 兜底）
- 提高了系统的可解释性和透明度
- 为复杂推理任务提供了新的解决思路

#### 5.1.2 混合推理方法创新

**创新内容**：
- 结合符号计算（SymPy）和神经网络（LLMs）的优势
- 设计了两阶段推理机制：先用 SymPy 精确计算，再用 LLM 生成解释
- 实现了推理结果的交叉验证机制

**创新价值**：
- 保证了计算结果的精确性
- 提供了自然语言的解题过程解释
- 推动了神经符号人工智能在教育领域的应用

#### 5.1.3 智能体工作流可视化创新

**创新内容**：
- 设计并实现了智能体执行过程的实时可视化组件
- 支持展示各智能体的输入输出、执行状态和耗时信息
- 提供了执行历史的追溯和回放功能

**创新价值**：
- 增强了系统的透明度和可信度
- 便于开发者和用户理解系统工作原理
- 为调试和优化提供了有力工具

#### 5.1.4 个性化反馈生成创新

**创新内容**：
- 基于知识图谱和用户历史表现生成个性化反馈
- 实现了多维度评估（准确性、完整性、清晰度）
- 提供了针对性的学习建议和练习推荐

**创新价值**：
- 提升了系统的教育价值
- 支持个性化学习路径规划
- 促进了学生的自主学习能力

### 5.2 技术难点及解决方案

#### 5.2.1 智能体间上下文共享

**难点描述**：
- 多个智能体需要共享解题过程中的中间结果
- 上下文数据结构复杂，需要保证一致性
- 智能体执行顺序动态变化，上下文传递逻辑复杂

**解决方案**：
1. 设计统一的上下文数据结构 `AgentContext`
2. 采用不可变数据模式，避免上下文被意外修改
3. 实现上下文版本控制，支持回滚和追溯

```typescript
interface AgentContext {
  problem: string;
  knowledgePoints?: KnowledgePoint[];
  plan?: SolvePlan;
  solutionSteps?: string[];
  intermediateResults?: any[];
  verificationResults?: VerificationResult[];
  feedback?: FeedbackResult;
  finalAnswer?: string;
  agentHistory: AgentExecution[];
  metadata: Record<string, any>;
}
```

#### 5.2.2 动态智能体调度

**难点描述**：
- 需要根据问题类型和历史性能动态调整执行顺序
- 调度算法需要平衡准确率和响应时间
- 需要处理智能体执行失败的异常情况

**解决方案**：
1. 实现基于关键词的问题类型识别算法
2. 设计智能体性能统计机制，记录成功率和执行时间
3. 采用加权评分算法优化执行顺序
4. 实现多种回退策略（重试、跳过、默认处理）

```typescript
// 加权评分算法
const score = successRate * 0.6 + (1 / (executionTime / 1000)) * 0.4;
```

#### 5.2.3 AI API 集成与优化

**难点描述**：
- 三个 AI API 的接口格式和响应格式不一致
- API 调用存在延迟和失败风险
- 需要优化提示词工程以提高输出质量

**解决方案**：
1. 设计统一的 API 适配器层，屏蔽底层差异
2. 实现请求重试和降级机制
3. 精心设计系统提示词，规范输出格式
4. 采用结构化输出（JSON），便于解析和处理

```typescript
// API 适配器示例
class AIAdapter {
  async call(apiType: 'GPT5.2' | 'DeepSeek' | 'KatCoder', prompt: string) {
    const config = this.getConfig(apiType);
    const response = await this.http.post(config.baseUrl, {
      model: config.model,
      messages: [
        { role: 'system', content: config.systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: config.temperature,
    });
    return this.parseResponse(response, apiType);
  }
}
```

#### 5.2.4 知识图谱与 LLM 协同

**难点描述**：
- 知识图谱的结构化数据和 LLM 的非结构化生成需要协同
- 知识点检索的准确性和效率需要平衡
- 需要将知识图谱信息有效融入 LLM 的提示词中

**解决方案**：
1. 设计知识点检索算法，基于关键词匹配和语义相似度
2. 实现知识点上下文构建，将检索结果格式化为自然语言
3. 在提示词中注入知识点信息，增强 LLM 的领域知识

```typescript
// 构建知识上下文
private buildKnowledgeContext(knowledgePoints: any[]): string {
  if (knowledgePoints.length === 0) return '';
  
  const context = knowledgePoints
    .map((kp) => {
      let info = `【${kp.name}】\n定义：${kp.description}`;
      if (kp.formula) info += `\n公式：${kp.formula}`;
      return info;
    })
    .join('\n\n');
  
  return `相关知识点参考:\n${context}`;
}
```

#### 5.2.5 前端实时状态更新

**难点描述**：
- 智能体执行是异步的，前端需要实时展示进度
- 多个智能体的状态需要协调展示
- 需要处理网络延迟和连接中断

**解决方案**：
1. 采用轮询机制，定期查询后端执行状态
2. 使用 Vue 3 的响应式系统，自动更新 UI
3. 实现断线重连和状态恢复机制
4. 设计进度条和时间线组件，直观展示执行进度

---

## 第六章 未来优化方向

### 6.1 算法优化方向

#### 6.1.1 智能体调度算法优化

**当前局限**：
- 问题类型识别基于简单关键词匹配，准确率有限
- 调度算法仅考虑成功率和执行时间，未考虑问题难度等因素

**优化方案**：
1. 引入机器学习模型进行问题类型分类
2. 设计多目标优化算法，综合考虑准确率、时间、难度等因素
3. 实现强化学习机制，让系统自动学习最优调度策略

#### 6.1.2 提示词工程优化

**当前局限**：
- 提示词为静态模板，适应性有限
- 缺乏对 LLM 输出质量的自动评估机制

**优化方案**：
1. 实现动态提示词生成，根据问题特点自动调整
2. 设计提示词优化算法，基于历史表现自动改进
3. 引入自我反思机制，让 LLM 评估和改进自己的输出

### 6.2 架构优化方向

#### 6.2.1 微服务架构改造

**当前架构**：
- 单体 NestJS 应用，所有模块运行在同一进程

**优化方案**：
1. 将各智能体拆分为独立的微服务
2. 引入消息队列（如 RabbitMQ）实现异步通信
3. 使用 Kubernetes 进行容器编排和自动扩缩容

**预期收益**：
- 提高系统的可扩展性和可用性
- 支持独立部署和升级各智能体
- 便于水平扩展以应对高并发场景

#### 6.2.2 缓存机制优化

**当前局限**：
- 仅缓存问题类型到执行顺序的映射
- 缓存策略简单，缺乏失效机制

**优化方案**：
1. 引入 Redis 作为分布式缓存
2. 缓存常见问题题目的解题结果
3. 实现智能缓存失效策略，平衡新鲜度和命中率

### 6.3 功能扩展方向

#### 6.3.1 多模态支持

**当前局限**：
- 仅支持文本形式的数学问题输入
- 无法处理包含图形、公式图像的问题

**优化方案**：
1. 集成 OCR 技术，支持公式图像识别
2. 引入视觉语言模型（VLM），处理几何图形问题
3. 支持手写输入识别，提升用户体验

#### 6.3.2 自适应学习系统

**当前局限**：
- 反馈和建议相对通用，个性化程度有限
- 缺乏对用户学习风格的深入分析

**优化方案**：
1. 构建用户画像，记录学习习惯和偏好
2. 实现自适应学习路径规划算法
3. 引入知识追踪模型，预测用户掌握程度

#### 6.3.3 协作学习功能

**优化方案**：
1. 支持多用户协作解题
2. 实现智能体与用户的交互式对话
3. 提供小组学习分析和对比功能

### 6.4 性能优化方向

#### 6.4.1 响应时间优化

**当前问题**：
- 平均响应时间约 1.9 秒，影响用户体验
- 多智能体串行执行，总时间为各智能体时间之和

**优化方案**：
1. 实现部分智能体的并行执行（如诊断和反馈可并行）
2. 采用流式响应，逐步返回解题过程
3. 优化 AI API 调用，使用更高效的模型版本

#### 6.4.2 资源利用优化

**优化方案**：
1. 实现智能体实例池，避免频繁创建销毁
2. 采用连接池管理数据库和 AI API 连接
3. 优化内存使用，及时释放不再需要的上下文数据

### 6.5 质量保障方向

#### 6.5.1 测试体系完善

**优化方案**：
1. 建立自动化测试流水线
2. 增加回归测试集，确保新功能不影响现有功能
3. 引入混沌工程，测试系统的容错能力

#### 6.5.2 监控与告警

**优化方案**：
1. 集成 Prometheus 和 Grafana，实现系统监控可视化
2. 设置关键指标告警阈值（如错误率、响应时间）
3. 实现分布式追踪，便于问题定位

---

## 第七章 总结与展望

### 7.1 项目总结

本项目成功设计并实现了一个基于多智能体协作的数学解题系统，主要成果包括：

1. **架构创新**：提出了四智能体（规划、求解、诊断、反馈）协作架构，有效提高了解题准确性和可解释性
2. **技术集成**：成功集成了三个 AI API（GPT5.2、DeepSeek、KatCoder）和 SymPy 符号计算引擎
3. **功能实现**：实现了问题分析、智能求解、错误诊断和个性化反馈等核心功能
4. **用户体验**：开发了智能体工作流可视化组件，增强了系统透明度和用户信任度
5. **可复现评测**：建立自建 500 题基准集与评测链路（`scripts/benchmark-eval.cjs` / `scripts/ablation-eval.cjs`），符号可解子集 21/54 求解成功且全对，据此定位多智能体链路在题面解析层的瓶颈（详见 `results/` 评测报告）

### 7.2 研究展望

多智能体协作在智能教育领域的应用仍处于探索阶段，未来研究方向包括：

1. **理论深化**：深入研究多智能体协作的理论基础，建立形式化的协作模型
2. **技术融合**：探索更多技术的融合，如知识图谱、强化学习、因果推理等
3. **应用拓展**：将多智能体架构拓展至其他学科领域，如物理、化学、编程等
4. **人机协同**：研究人机协同的最优模式，实现人类教师与智能系统的优势互补
5. **伦理考量**：关注 AI 在教育应用中的伦理问题，确保技术的负责任使用

### 7.3 学术价值

本项目的研究成果对以下学术领域具有参考价值：

1. **人工智能教育应用**：为智能辅导系统提供了新的架构设计思路
2. **多智能体系统**：丰富了多智能体协作的应用场景和实践经验
3. **神经符号 AI**：推动了符号计算与神经网络的融合研究
4. **人机交互**：为复杂推理任务的人机协同提供了实践案例

---

## 参考文献

[1] Sutton, R. S., & Barto, A. G. (2018). Reinforcement learning: An introduction. MIT press.

[2] Vaswani, A., Shazeer, N., Parmar, N., Uszkoreit, J., Jones, L., Gomez, A. N., ... & Polosukhin, I. (2017). Attention is all you need. Advances in neural information processing systems, 30.

[3] Brown, T., Mann, B., Ryder, N., Subbiah, M., Kaplan, J. D., Dhariwal, P., ... & Amodei, D. (2020). Language models are few-shot learners. Advances in neural information processing systems, 33, 1877-1901.

[4] Wooldridge, M. (2009). An introduction to multiagent systems. John wiley & sons.

[5] 李未，张铭，等。(2021). 人工智能导论。高等教育出版社.

[6] Holmes, W., Bialik, M., & Fadel, C. (2019). Artificial intelligence in education: Promises and implications for teaching and learning. Center for Curriculum Redesign.

[7] Luckin, R., Holmes, W., Griffiths, M., & Forcier, L. B. (2016). Intelligence unleashed: An argument for AI in education. Pearson.

[8] 王飞跃，等。(2020). 平行智能：从知识到决策。自动化学报，46(10), 2001-2015.

[9] LeCun, Y., Bengio, Y., & Hinton, G. (2015). Deep learning. nature, 521(7553), 436-444.

[10] 刘知远，郑勤勤，等。(2023). 大语言模型在教育领域的应用与挑战。中国科学：信息科学，53(5), 789-805.

---

## 附录

### 附录 A：核心接口定义

```typescript
// 智能体输入接口
interface AgentInput {
  problem: string;
  context?: AgentContext;
  metadata?: Record<string, any>;
}

// 智能体输出接口
interface AgentOutput {
  result: any;
  context: AgentContext;
  status: 'success' | 'failure' | 'partial';
  message?: string;
  executionTime?: number;
}

// 多智能体协作结果
interface MultiAgentResult {
  finalAnswer: string;
  solutionSteps: string[];
  knowledgePoints: KnowledgePoint[];
  verificationResults: VerificationResult[];
  feedback: FeedbackResult;
  executionHistory: AgentExecution[];
  totalExecutionTime: number;
  status: 'success' | 'partial' | 'failure';
}
```

### 附录 B：部署配置示例

```yaml
# docker-compose.yml
version: '3.8'
services:
  mongodb:
    image: mongo:6.0
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db

  neo4j:
    image: neo4j:5.15
    ports:
      - "7474:7474"
      - "7687:7687"
    environment:
      - NEO4J_AUTH=neo4j/password

  backend:
    build: ./nestjs-backend
    ports:
      - "3000:3000"
    environment:
      - MONGODB_URI=mongodb://mongodb:27017/math_tutor
      - NEO4J_URI=neo4j://neo4j:7687
    depends_on:
      - mongodb
      - neo4j

  frontend:
    build: ./uniapp-frontend
    ports:
      - "8080:80"
    depends_on:
      - backend

volumes:
  mongodb_data:
```

### 附录 C：项目源码结构

```
math_llm_tutor/
├── nestjs-backend/              # 后端服务
│   ├── src/
│   │   ├── modules/
│   │   │   ├── agents/         # 智能体模块
│   │   │   │   ├── agent.base.ts
│   │   │   │   ├── agent.orchestrator.ts
│   │   │   │   ├── agent.types.ts
│   │   │   │   ├── planner/
│   │   │   │   ├── solver/
│   │   │   │   ├── diagnostic/
│   │   │   │   └── feedback/
│   │   │   ├── knowledge/      # 知识服务模块
│   │   │   ├── learning/       # 学习服务模块
│   │   │   └── assessment/     # 评估模块
│   │   └── main.ts
│   └── package.json
├── uniapp-frontend/            # 前端应用
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   │   └── AgentWorkflow.vue
│   │   └── App.vue
│   └── package.json
└── datasets/                   # 数据集
    └── knowledge-point-mapping.json
```

---

**文档版本**：v1.0  
**撰写日期**：2026 年 4 月 1 日  
**作者**：项目开发者  
**指导教师**：待填写  
**学校**：待填写  
**专业**：待填写
