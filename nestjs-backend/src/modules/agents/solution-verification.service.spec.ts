import { SolutionVerificationService } from './solution-verification.service';

describe('SolutionVerificationService', () => {
  let service: SolutionVerificationService;

  beforeEach(() => {
    service = new SolutionVerificationService();
  });

  describe('求导验证', () => {
    it('精确多项式：x^3 的导数是 3x^2（符号通道）', () => {
      const check = service.verifyDerivative('x^3', '3*x^2');
      expect(check.passed).toBe(true);
      expect(check.method).toBe('symbolic');
    });

    it('精确多项式：错误答案被拒绝', () => {
      const check = service.verifyDerivative('x^3', '2*x^2');
      expect(check.passed).toBe(false);
      expect(check.method).toBe('symbolic');
    });

    it('非多项式走数值通道：sin(x) → cos(x)', () => {
      const check = service.verifyDerivative('sin(x)', 'cos(x)');
      expect(check.passed).toBe(true);
      expect(check.method).toBe('numeric');
      expect(check.maxError).toBeLessThan(1e-4);
    });

    it('非多项式错误答案：sin(x) → -cos(x) 被拒绝', () => {
      const check = service.verifyDerivative('sin(x)', '-cos(x)');
      expect(check.passed).toBe(false);
    });

    it('无法解析时明确返回未验证，而不是通过', () => {
      const check = service.verifyDerivative('？？？', 'cos(x)');
      expect(check.passed).toBe(false);
      expect(check.summary).toContain('无法解析');
    });
  });

  describe('积分验证（微积分基本定理回代）', () => {
    it('不定积分带 + C：x^2 → x^3/3 + C 通过', () => {
      const check = service.verifyIndefiniteIntegral('x^2', 'x^3/3 + C');
      expect(check.passed).toBe(true);
    });

    it('不定积分漏掉系数：x^2 → x^3 被拒绝', () => {
      const check = service.verifyIndefiniteIntegral('x^2', 'x^3');
      expect(check.passed).toBe(false);
    });

    it('非多项式：cos(x) → sin(x) + C 通过数值通道', () => {
      const check = service.verifyIndefiniteIntegral('cos(x)', 'sin(x) + C');
      expect(check.passed).toBe(true);
    });

    it('定积分：∫₀¹ x² = 1/3 通过', () => {
      const check = service.verifyDefiniteIntegral('x^2', '0', '1', '1/3');
      expect(check.passed).toBe(true);
      expect(check.maxError).toBeLessThan(1e-3);
    });

    it('定积分错误答案：∫₀¹ x² = 0.5 被拒绝', () => {
      const check = service.verifyDefiniteIntegral('x^2', '0', '1', '0.5');
      expect(check.passed).toBe(false);
    });
  });

  describe('方程解验证（代回原方程）', () => {
    it('x² - 4 = 0 的 ±2 通过', () => {
      const checks = service.verifyEquationSolutions('x^2 - 4 = 0', ['x = -2, x = 2']);
      expect(checks).toHaveLength(2);
      expect(checks.every((c) => c.passed)).toBe(true);
    });

    it('x² - 4 = 0 的 3 被拒绝', () => {
      const checks = service.verifyEquationSolutions('x^2 - 4 = 0', ['3']);
      expect(checks[0].passed).toBe(false);
    });

    it('一元一次方程 2x - 8 = 0 的解 4 通过（含分数写法）', () => {
      const checks = service.verifyEquationSolutions('2*x - 8 = 0', ['x = 4']);
      expect(checks[0].passed).toBe(true);
      const fractional = service.verifyEquationSolutions('2*x - 1 = 0', ['x = 1/2']);
      expect(fractional[0].passed).toBe(true);
    });
  });

  describe('极限验证（双侧趋近序列）', () => {
    it('lim(x→0) sin(x)/x = 1 通过', () => {
      const check = service.verifyLimit('sin(x)/x', '0', '1');
      expect(check.passed).toBe(true);
      expect(check.maxError).toBeLessThan(1e-3);
    });

    it('lim(x→0) sin(x)/x = 0 被拒绝', () => {
      const check = service.verifyLimit('sin(x)/x', '0', '0');
      expect(check.passed).toBe(false);
    });

    it('lim(x→0) 1/x = 不存在 通过（左右不一致）', () => {
      const check = service.verifyLimit('1/x', '0', '不存在');
      expect(check.passed).toBe(true);
    });

    it('lim(x→∞) 1/x = 0 通过', () => {
      const check = service.verifyLimit('1/x', 'oo', '0');
      expect(check.passed).toBe(true);
    });
  });

  describe('按题面自动验证', () => {
    it('“求导”题面自动走求导验证', () => {
      const report = service.verifyByProblemText('求 f(x) = sin(x) 的导数', 'cos(x)');
      expect(report.checks).toHaveLength(1);
      expect(report.checks[0].kind).toBe('derivative');
      expect(report.verified).toBe(true);
    });

    it('无法识别的题面返回空证据（不伪装成通过）', () => {
      const report = service.verifyByProblemText('证明勾股定理', '略');
      expect(report.checks).toHaveLength(0);
      expect(report.verified).toBe(false);
      expect(report.confidence).toBe(0);
    });

    it('映射为 VerificationResult（前端徽章数据）', () => {
      const report = service.verifyByProblemText('求 x^3 的导数', '3*x^2');
      const results = service.toVerificationResults(report);
      expect(results).toHaveLength(1);
      expect(results[0].isValid).toBe(true);
      expect(results[0].stepId).toBe('verifier:derivative');
      expect(results[0].confidence).toBeGreaterThan(0.5);
    });
  });
});
