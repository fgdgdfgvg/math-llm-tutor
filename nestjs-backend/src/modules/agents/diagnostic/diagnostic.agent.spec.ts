import { DiagnosticAgent } from './diagnostic.agent';

/**
 * DiagnosticAgent 规则兜底链路的边界单测。
 *
 * 设计原则：AI 不可用时（isModelAvailable → false），诊断必须退化为
 * 可预期的规则行为——这是线上稳定性的最后防线，必须锁定行为边界。
 *
 * 聚焦：
 *   - ruleBasedVerify：内容完整性 / 末步结论提示 / 参考解数学 token 匹配三档置信度
 *   - parseVerificationResult：AI 输出解析失败时默认放行（置信度 0.5），confidence 越界钳制
 *   - verifyFinalAnswer：无 AI 时与参考解比对，含"包含即通过"的局限行为
 *   - generateRuleBasedVerification：无步骤时的兜底结构
 */
describe('DiagnosticAgent 规则兜底边界', () => {
  const makeAgent = (): any =>
    new DiagnosticAgent(
      { name: 'diagnostic' },
      {} as any, // ConfigService
      {} as any, // HttpService
      { isModelAvailable: () => false, chat: async () => ({ content: '' }) } as any, // AIModelsService（AI 不可用 → 走规则链路）
      { solveProblem: async () => ({ steps: [], finalAnswer: '' }) } as any, // LocalComputationService
      { validateAllSteps: async () => [], getValidationSummary: () => null } as any, // StepValidationService
      {} as any, // VisualizationService
      { diagnoseFull: () => ({}), generateScoreCard: () => ({}) } as any, // ErrorDiagnosisService
    );
  const agent = makeAgent();

  describe('ruleBasedVerify', () => {
    it('空步骤判无效（置信度 0.3）', () => {
      const r = agent.ruleBasedVerify('', 'step1', 0, 3);
      expect(r.isValid).toBe(false);
      expect(r.confidence).toBe(0.3);
      expect(r.errorMessage).toContain('为空');
    });

    it('过短步骤（≤10 字符）判无效', () => {
      const r = agent.ruleBasedVerify('短步骤', 'step1', 0, 3);
      expect(r.isValid).toBe(false);
      expect(r.confidence).toBe(0.3);
    });

    it('正常步骤（有结构、非末步）通过，置信度 0.7', () => {
      const step = JSON.stringify({ stepTitle: '分析极限类型', process: '识别自变量趋近值与函数形式', result: '0/0 型不定式' });
      const r = agent.ruleBasedVerify(step, 'step1', 0, 3);
      expect(r.isValid).toBe(true);
      expect(r.confidence).toBe(0.7);
      expect(r.errorMessage).toBe('');
    });

    it('末步未写明结果只扣置信度提示、不判整体失败（措辞差异 ≠ 数学错误）', () => {
      const step = JSON.stringify({ stepTitle: '得出结论', process: '汇总计算得到最终值', result: '' });
      const r = agent.ruleBasedVerify(step, 'step4', 3, 4);
      expect(r.isValid).toBe(true);
      expect(r.confidence).toBeLessThanOrEqual(0.6);
      expect(r.errorMessage).toContain('最后一步建议明确写出计算结果');
    });

    it('参考解数学 token 高匹配（≥60%）→ 置信度提升至 0.9', () => {
      const step = JSON.stringify({ stepTitle: '计算', result: '合并后得到 x^2 与常数 5' });
      const ref = { steps: [{ result: 'x^2 + 5' }] };
      const r = agent.ruleBasedVerify(step, 'step1', 0, 3, ref);
      expect(r.isValid).toBe(true);
      expect(r.confidence).toBe(0.9);
    });

    it('参考解 token 完全失配（<30%）→ 判无效并指出参考结果', () => {
      const step = JSON.stringify({ stepTitle: '计算', result: '结果为 999' });
      const ref = { steps: [{ result: 'x^2 + 5' }] };
      const r = agent.ruleBasedVerify(step, 'step1', 0, 3, ref);
      expect(r.isValid).toBe(false);
      expect(r.errorMessage).toContain('参考解决方案不一致');
    });

    it('参考解无可比对数学内容时，不因措辞不同而判失败', () => {
      const step = JSON.stringify({ stepTitle: '整理', result: '得出结论' });
      const ref = { steps: [{ result: '整理完毕' }] }; // 无数字/函数 token
      const r = agent.ruleBasedVerify(step, 'step1', 0, 3, ref);
      expect(r.isValid).toBe(true);
      expect(r.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it('参考解步骤数不足（index 越界）时跳过比对，正常通过', () => {
      const step = JSON.stringify({ stepTitle: '额外步骤', result: '任意内容 123' });
      const ref = { steps: [{ result: 'x^2' }] };
      const r = agent.ruleBasedVerify(step, 'step5', 4, 5, ref);
      expect(r.isValid).toBe(true);
    });
  });

  describe('parseVerificationResult', () => {
    it('合法 JSON 按字段返回，confidence 越界钳制到 [0,1]', () => {
      const r = agent.parseVerificationResult('{"isValid": false, "errorMessage": "符号错误", "confidence": 1.5}');
      expect(r.isValid).toBe(false);
      expect(r.errorMessage).toBe('符号错误');
      expect(r.confidence).toBe(1);
    });

    it('负 confidence 钳制为 0', () => {
      const r = agent.parseVerificationResult('{"isValid": true, "confidence": -2}');
      expect(r.confidence).toBe(0);
    });

    it('缺 confidence 默认 0.7', () => {
      const r = agent.parseVerificationResult('{"isValid": true}');
      expect(r.confidence).toBe(0.7);
    });

    it('非 JSON 输出默认放行（isValid=true, confidence=0.5），不抛异常', () => {
      const r = agent.parseVerificationResult('模型暂时无法返回结构化结果');
      expect(r.isValid).toBe(true);
      expect(r.confidence).toBe(0.5);
    });
  });

  describe('verifyFinalAnswer（AI 不可用时走规则比对）', () => {
    it('finalAnswer 包含参考解答案 → 通过（0.9）', async () => {
      const r = await agent.verifyFinalAnswer('所以最终答案为 8', '求极限', {}, { finalAnswer: '8' });
      expect(r.isValid).toBe(true);
      expect(r.confidence).toBe(0.9);
    });

    it('finalAnswer 与参考解不一致 → 判无效并给出正确答案', async () => {
      const r = await agent.verifyFinalAnswer('答案为 9', '求极限', {}, { finalAnswer: '8' });
      expect(r.isValid).toBe(false);
      expect(r.errorMessage).toContain('8');
    });

    it('无参考解时：非空即通过（0.6），空串判无效', async () => {
      expect((await agent.verifyFinalAnswer('x^2+1', '题', {}, null)).isValid).toBe(true);
      expect((await agent.verifyFinalAnswer('', '题', {}, null)).isValid).toBe(false);
    });
  });

  describe('generateRuleBasedVerification（无步骤兜底）', () => {
    it('返回固定三段结构，note 说明无步骤可供验证', () => {
      const results = agent.generateRuleBasedVerification('任意题目');
      expect(results).toHaveLength(3);
      expect(results.map((r: any) => r.stepId)).toEqual(['structure_check', 'completeness_check', 'note']);
      expect(results.every((r: any) => r.isValid)).toBe(true);
      expect(results[2].errorMessage).toContain('无解题步骤');
    });
  });
});
