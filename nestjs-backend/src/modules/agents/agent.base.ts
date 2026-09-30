import { Logger } from '@nestjs/common';
import { AgentInput, AgentOutput, AgentContext, AgentConfig } from './agent.types';

// 智能体基类
export abstract class BaseAgent {
  protected readonly logger: Logger;
  protected readonly config: AgentConfig;

  constructor(config: AgentConfig) {
    this.logger = new Logger(this.constructor.name);
    this.config = config;
  }

  // 执行智能体任务
  async execute(input: AgentInput): Promise<AgentOutput> {
    const startTime = Date.now();
    this.logger.log(`开始执行智能体任务: ${this.config.name}`);

    try {
      // 初始化上下文
      const context = this.initializeContext(input);

      // 执行具体的智能体逻辑
      const result = await this.process(input, context);

      // 构建输出
      const executionTime = Date.now() - startTime;
      const output: AgentOutput = {
        result,
        context,
        status: 'success',
        executionTime,
      };

      // 记录执行历史
      this.addExecutionHistory(context, input, output, executionTime, 'success');

      this.logger.log(`智能体任务执行完成: ${this.config.name} (${executionTime}ms)`);
      return output;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error(`智能体任务执行失败: ${this.config.name}`, error);

      // 构建错误输出
      const output: AgentOutput = {
        result: null,
        context: input.context || this.initializeContext(input),
        status: 'failure',
        message: error.message,
        executionTime,
      };

      // 记录执行历史
      this.addExecutionHistory(output.context, input, output, executionTime, 'failure');

      return output;
    }
  }

  // 初始化上下文
  protected initializeContext(input: AgentInput): AgentContext {
    return {
      problem: input.problem,
      agentHistory: input.context?.agentHistory || [],
      metadata: input.context?.metadata || {},
      ...input.context,
    };
  }

  // 添加执行历史
  protected addExecutionHistory(
    context: AgentContext,
    input: any,
    output: any,
    duration: number,
    status: 'success' | 'failure' | 'partial',
  ): void {
    context.agentHistory.push({
      agentName: this.config.name,
      timestamp: Date.now(),
      input,
      output,
      duration,
      status,
    });
  }

  // 具体的智能体处理逻辑，由子类实现
  protected abstract process(input: AgentInput, context: AgentContext): Promise<any>;

  // 获取智能体名称
  get name(): string {
    return this.config.name;
  }

  // 获取智能体配置
  getConfig(): AgentConfig {
    return this.config;
  }
}