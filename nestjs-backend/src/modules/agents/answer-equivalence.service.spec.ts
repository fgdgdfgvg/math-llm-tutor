import { AnswerEquivalenceService } from './answer-equivalence.service';

describe('AnswerEquivalenceService', () => {
  const service = new AnswerEquivalenceService();

  describe('字面与数值', () => {
    it('完全相同判正确', () => {
      expect(service.compare('x^2 + 1', 'x^2 + 1').verdict).toBe('correct');
    });

    it('分数与数值等价', () => {
      expect(service.compare('1/2', '0.5').verdict).toBe('correct');
      expect(service.compare('2/4', '1/2').verdict).toBe('correct');
    });

    it('数值不等判错误', () => {
      expect(service.compare('1', '2').verdict).toBe('incorrect');
    });

    it('空答案判错误', () => {
      expect(service.compare('', '3').verdict).toBe('incorrect');
    });

    it('缺参考答案返回 unknown 而不是误判', () => {
      const result = service.compare('3', '');
      expect(result.verdict).toBe('unknown');
      expect(result.confidence).toBe(0);
    });
  });

  describe('多项式精确等价（旧实现全部判错）', () => {
    it('x+1 与 1+x', () => {
      expect(service.compare('x+1', '1+x').verdict).toBe('equivalent');
    });

    it('(x-1)(x+1) 与 x²-1', () => {
      expect(service.compare('(x-1)(x+1)', 'x^{2}-1').verdict).toBe(
        'equivalent',
      );
    });

    it('2x+2 与 2(x+1)', () => {
      expect(service.compare('2x+2', '2(x+1)').verdict).toBe('equivalent');
    });

    it('多项式不同则判错', () => {
      expect(service.compare('x+2', 'x+1').verdict).toBe('incorrect');
    });

    it('兼容本地引擎/SymPy 的 Python 风格输出 3*x**2 + 2', () => {
      // 这是真实场景：答案解析由本地引擎生成，学生用教材写法作答
      expect(service.compare('2+3x^2', '3*x**2 + 2').verdict).toBe(
        'equivalent',
      );
      expect(service.compare('3x² + 2', '3*x**2 + 2').verdict).toBe(
        'equivalent',
      );
      expect(service.compare('3x^2 + 5', '3*x**2 + 2').verdict).toBe(
        'incorrect',
      );
    });

    it('学生的 LaTeX 写法与引擎输出等价', () => {
      const latex = '\\frac{x^{3}}{3} + \\frac{3x^{2}}{2} + C';
      expect(service.compare(latex, 'x**3/3 + 3*x**2/2 + C').verdict).toBe(
        'equivalent',
      );
    });
  });

  describe('定性结论（中文自然语言）', () => {
    it('一侧的括号说明不影响结论一致判定', () => {
      expect(
        service.compare('极限不存在', '极限不存在（左右极限不相等）').verdict,
      ).toBe('equivalent');
      expect(service.compare('不存在', '无解').verdict).toBe('equivalent');
    });

    it('一侧说不存在、另一侧给出数值 → 矛盾', () => {
      expect(service.compare('不存在', '1').verdict).toBe('incorrect');
    });
  });

  describe('解集比较', () => {
    it('顺序无关', () => {
      expect(service.compare('x=1, x=2', 'x_1=2，x_2=1').verdict).toBe(
        'equivalent',
      );
    });

    it('解的个数不同判错', () => {
      expect(service.compare('x=1', 'x_1=1, x_2=2').verdict).toBe('incorrect');
    });
  });

  describe('数值抽样', () => {
    it('sin(x)/cos(x) 与 tan(x)', () => {
      expect(service.compare('sin(x)/cos(x)', 'tan(x)').verdict).toBe(
        'equivalent',
      );
    });

    it('e^x 与 exp(x)', () => {
      expect(['correct', 'equivalent']).toContain(
        service.compare('e^x', 'exp(x)').verdict,
      );
    });

    it('√2/2 与 1/√2', () => {
      expect(service.compare('sqrt(2)/2', '1/sqrt(2)').verdict).toBe(
        'equivalent',
      );
    });

    it('函数确实不同则判错', () => {
      expect(service.compare('sin(x)', 'cos(x)').verdict).toBe('incorrect');
    });
  });

  describe('积分常数命名差异', () => {
    it('2x + C 与 2x + C_1 视为等价', () => {
      expect(['correct', 'equivalent']).toContain(
        service.compare('2x + C', '2x + C_1').verdict,
      );
    });
  });

  describe('无法判定时保持诚实', () => {
    it('返回 unknown 且置信度为 0，并给出证据', () => {
      const result = service.compare('某个奇怪的答案', '另一个奇怪的答案');
      expect(['unknown', 'incorrect']).toContain(result.verdict);
      if (result.verdict === 'unknown') {
        expect(result.confidence).toBe(0);
        expect(result.evidence.length).toBeGreaterThan(0);
      }
    });

    it('判定结果始终带 evidence', () => {
      for (const [a, b] of [
        ['1', '1'],
        ['1', '2'],
        ['x+1', '1+x'],
        ['x=1', 'x=2'],
      ]) {
        expect(service.compare(a, b).evidence.length).toBeGreaterThan(0);
      }
    });
  });
});
