import { SolverAgent } from './solver.agent';

/**
 * SolverAgent 纯规则逻辑的边界单测。
 *
 * 不测 process() 全链路（依赖 SymPy/Redis/AI 等 8 个外部依赖），
 * 而是聚焦 2026-10 加固过的关键纯函数：
 *   - isPlaceholderResult：占位符绝不许冒充 finalAnswer（回归：旧版返回 `（极限值）`）
 *   - extractFinalAnswerFromSteps：无确定结果时必须诚实返回"未能提取"，不编造
 *   - classifyProblemForRules / generateHighlight：分类与提示的边界
 */
describe('SolverAgent 规则引擎边界', () => {
  const agent: any = new SolverAgent(
    { name: 'solver' },
    {} as any, // ConfigService
    {} as any, // HttpService
    {} as any, // AIModelsService
    {} as any, // LocalComputationService
    {} as any, // RedisCacheService
    {} as any, // ModelRouterService
    {} as any, // HallucinationGuardService
  );

  describe('isPlaceholderResult', () => {
    it('空串/空白判为占位', () => {
      expect(agent.isPlaceholderResult('')).toBe(true);
      expect(agent.isPlaceholderResult('   ')).toBe(true);
      expect(agent.isPlaceholderResult(null)).toBe(true);
      expect(agent.isPlaceholderResult(undefined)).toBe(true);
    });

    it('中文括号泛称（回归：`（极限值）` 曾直接作为 finalAnswer 输出）', () => {
      expect(agent.isPlaceholderResult('（极限值）')).toBe(true);
      expect(agent.isPlaceholderResult('（方程的解）')).toBe(true);
      expect(agent.isPlaceholderResult('（计算完成）')).toBe(true);
      // 超过 20 字的括号文本不是"泛称占位"，不应误判
      expect(
        agent.isPlaceholderResult(`（${'很长的具体结果描述'.repeat(3)}）`),
      ).toBe(false);
    });

    it('执行中/省略号判为占位', () => {
      expect(agent.isPlaceholderResult('执行中...')).toBe(true);
      expect(agent.isPlaceholderResult('计算中…')).toBe(true);
    });

    it('兜底关键词判为占位', () => {
      expect(agent.isPlaceholderResult('需逐项应用换元法')).toBe(true);
      expect(agent.isPlaceholderResult('取决于具体参数')).toBe(true);
      expect(agent.isPlaceholderResult('未能求得确定结果')).toBe(true);
    });

    it('无信息泛化文本判为占位（A/B 消融实测：LaTeX 降级时 finalAnswer 全是这类输出）', () => {
      expect(agent.isPlaceholderResult('已整理结论')).toBe(true);
      expect(agent.isPlaceholderResult('过程已整理结论，详见步骤')).toBe(true);
    });

    it('真实数学结果不判为占位', () => {
      expect(agent.isPlaceholderResult('8')).toBe(false);
      expect(agent.isPlaceholderResult('x^2 + 2x + 1')).toBe(false);
      expect(agent.isPlaceholderResult('\\frac{1}{2}')).toBe(false);
      expect(agent.isPlaceholderResult('2x^{3} + C')).toBe(false);
    });
  });

  describe('extractFinalAnswerFromSteps（不编造答案原则）', () => {
    it('全部步骤都是占位结果时，返回诚实的"未能提取"而非编造', () => {
      const steps = [
        JSON.stringify({ stepTitle: '分析', result: '（极限值）' }),
        JSON.stringify({ stepTitle: '计算', result: '执行中...' }),
      ];
      const ans = agent.extractFinalAnswerFromSteps(steps, '求极限');
      expect(ans).toContain('未能');
    });

    it('取最后一个非占位结果作为最终答案', () => {
      const steps = [
        JSON.stringify({ stepTitle: '分析', result: '（中间量）' }),
        JSON.stringify({ stepTitle: '计算', result: '8' }),
        JSON.stringify({ stepTitle: '整理', result: '（结论）' }),
      ];
      expect(agent.extractFinalAnswerFromSteps(steps, '求极限')).toBe('8');
    });

    it('空步骤列表返回诚实提示', () => {
      expect(agent.extractFinalAnswerFromSteps([], '求极限')).toContain('未能');
    });

    it('跳过无法解析的 JSON 步骤，继续向前找', () => {
      const steps = [
        JSON.stringify({ stepTitle: '计算', result: '1/2' }),
        '不是JSON的步骤文本',
        JSON.stringify({ stepTitle: '分析', result: '（中间量）' }),
      ];
      expect(agent.extractFinalAnswerFromSteps(steps, '求极限')).toBe('1/2');
    });

    it('步骤缺 result 字段时跳过', () => {
      const steps = [JSON.stringify({ stepTitle: '分析' })];
      expect(agent.extractFinalAnswerFromSteps(steps, '求极限')).toContain(
        '未能',
      );
    });
  });

  describe('classifyProblemForRules', () => {
    it('按关键词分类：极限/导数/积分/ODE/方程', () => {
      expect(agent.classifyProblemForRules('求极限 lim(x->0)')).toBe('limit');
      expect(agent.classifyProblemForRules('求导数 y=x^2')).toBe('derivative');
      expect(agent.classifyProblemForRules('计算积分 ∫x dx')).toBe('integral');
      // "微分方程"包含"方程"，但必须先识别为 ode（顺序敏感）
      expect(agent.classifyProblemForRules("解微分方程 y''+y=0")).toBe('ode');
      expect(agent.classifyProblemForRules('解方程 x^2-1=0')).toBe('equation');
    });

    it('空串与无关文本归入 general（不抛异常）', () => {
      expect(agent.classifyProblemForRules('')).toBe('general');
      expect(agent.classifyProblemForRules('介绍一下数学史')).toBe('general');
    });
  });

  describe('generateHighlight', () => {
    it('按题型给出对应避坑提示', () => {
      expect(agent.generateHighlight('识别极限类型')).toContain('洛必达');
      expect(agent.generateHighlight('导数计算')).toContain('链式法则');
      expect(agent.generateHighlight('执行积分运算')).toContain('常数C');
      expect(agent.generateHighlight('判断级数收敛性')).toContain('收敛性');
    });

    it('未知题型给出通用提示', () => {
      expect(agent.generateHighlight('整理题目条件')).toBe(
        '请仔细检查每一步的计算过程',
      );
    });
  });
});
