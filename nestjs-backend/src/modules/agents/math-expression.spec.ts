import {
  astToPolynomial,
  compileEvaluator,
  fToString,
  frac,
  normalizeMathText,
  parseMathExpression,
  parsePolynomialExact,
  polyDegree,
  polyDerivative,
  polyIntegral,
  polyToLatex,
  solveEquationString,
} from './math-expression';

describe('normalizeMathText', () => {
  it('把 Unicode 上标转换为 ^(...)', () => {
    expect(normalizeMathText('x² + 3x')).toBe('x^(2) + 3x');
    expect(normalizeMathText('x³')).toBe('x^(3)');
  });

  it('折叠 LaTeX 分数与根式', () => {
    expect(normalizeMathText('\\frac{1}{2}x')).toBe('((1)/(2))x');
    expect(normalizeMathText('\\sqrt{2}')).toBe('sqrt(2)');
  });

  it('把 e^{x} 转成 exp(x)，避免把 e 当变量', () => {
    expect(normalizeMathText('e^{x}')).toBe('exp(x)');
    expect(normalizeMathText('e^2x')).toBe('exp(2x)');
  });

  it('去掉全角与中文标点', () => {
    expect(normalizeMathText('（x＋1）')).toBe('(x+1)');
  });
});

describe('parsePolynomialExact', () => {
  it('解析小数系数（旧实现 parseInt 会把 0.5 截断为 0）', () => {
    const poly = parsePolynomialExact('0.5x^2 + 3x - 1');
    expect(poly).not.toBeNull();
    expect(fToString(poly![2])).toBe('1/2');
    expect(fToString(poly![1])).toBe('3');
    expect(fToString(poly![0])).toBe('-1');
  });

  it('补全隐式系数 1（旧的 + 号解析会得到 NaN）', () => {
    const poly = parsePolynomialExact('x^2 + x = 0'.split('=')[0]);
    expect(poly).not.toBeNull();
    expect(fToString(poly![1])).toBe('1');
    expect(fToString(poly![2])).toBe('1');
  });

  it('展开括号与隐式乘法', () => {
    const poly = parsePolynomialExact('(x-1)(x+1)');
    expect(polyToLatex(poly!)).toBe('x^{2} - 1');
    expect(polyToLatex(parsePolynomialExact('2(x+3)')!)).toBe('2x + 6');
    expect(polyToLatex(parsePolynomialExact('3*x + 2x')!)).toBe('5x');
  });

  it('接受 Unicode 上标与内部空格', () => {
    expect(polyToLatex(parsePolynomialExact('x² - 4')!)).toBe('x^{2} - 4');
  });

  it('对非多项式返回 null 而不是猜测', () => {
    expect(parsePolynomialExact('sin(x)')).toBeNull();
    expect(parsePolynomialExact('1/x')).toBeNull();
    expect(parsePolynomialExact('x^0.5')).toBeNull();
  });
});

describe('polyDerivative / polyIntegral', () => {
  it('逐项求导不丢项', () => {
    const p = parsePolynomialExact('x^3 + 2x')!;
    expect(polyToLatex(polyDerivative(p))).toBe('3x^{2} + 2');
  });

  it('逐项积分保留分数系数', () => {
    const p = parsePolynomialExact('x^2 + 3x')!;
    expect(polyToLatex(polyIntegral(p))).toBe(
      '\\frac{1}{3}x^{3} + \\frac{3}{2}x^{2}',
    );
  });
});

describe('compileEvaluator', () => {
  it('求值三角函数与指数函数', () => {
    const f = compileEvaluator('sin(x)/cos(x)')!;
    expect(f(0)).toBeCloseTo(0, 12);
    const exp = compileEvaluator('exp(x)')!;
    expect(exp(1)).toBeCloseTo(Math.E, 12);
  });

  it('对无法解析的输入返回 null', () => {
    expect(compileEvaluator('x +* 3')).toBeNull();
  });
});

describe('solveEquationString', () => {
  it('解一元二次方程并给出精确有理根', () => {
    const result = solveEquationString('x^2 + x = 0');
    expect(result.kind).toBe('roots');
    if (result.kind === 'roots') {
      const values = result.roots.map((r) => r.numeric).sort((a, b) => a - b);
      expect(values).toEqual([-1, 0]);
    }
  });

  it('解小数系数方程（旧实现系数被截断成 0）', () => {
    const result = solveEquationString('0.5x^2 - 2 = 0');
    expect(result.kind).toBe('roots');
    if (result.kind === 'roots') {
      const values = result.roots.map((r) => r.numeric).sort((a, b) => a - b);
      expect(values[0]).toBeCloseTo(-2, 9);
      expect(values[1]).toBeCloseTo(2, 9);
    }
  });

  it('支持右边不为零的方程', () => {
    const result = solveEquationString('2x^2 + 3x = 5');
    expect(result.kind).toBe('roots');
    if (result.kind === 'roots') {
      const values = result.roots.map((r) => r.numeric).sort((a, b) => a - b);
      expect(values[0]).toBeCloseTo(-2.5, 9);
      expect(values[1]).toBeCloseTo(1, 9);
    }
  });

  it('判别式非完全平方时保留根式精确形式', () => {
    const result = solveEquationString('x^2 - x - 1 = 0');
    expect(result.kind).toBe('roots');
    if (result.kind === 'roots') {
      expect(result.roots[0].latex).toContain('\\sqrt{5}');
    }
  });

  it('无实数解时明确说明而不是输出 Δ = NaN', () => {
    const result = solveEquationString('x^2 + x + 1 = 0');
    expect(result.kind).toBe('roots');
    if (result.kind === 'roots') {
      expect(Number.isNaN(result.roots[0].numeric)).toBe(true);
      expect(result.roots[0].latex).toContain('i');
    }
  });

  it('恒等式与无解情况分别识别', () => {
    expect(solveEquationString('x = x').kind).toBe('identity');
    expect(solveEquationString('x = x + 1').kind).toBe('none');
  });

  it('高次方程明确标记 unsolved', () => {
    const result = solveEquationString('x^3 - 1 = 0');
    expect(result.kind).toBe('unsolved');
  });
});

describe('回归：reviewer 指出的具体错误', () => {
  it('x²+x=0 不应得到 Δ = NaN', () => {
    const solution = solveEquationString('x² + x = 0');
    expect(solution.kind).toBe('roots');
    if (solution.kind === 'roots') {
      expect(solution.roots.every((r) => Number.isFinite(r.numeric))).toBe(
        true,
      );
    }
  });

  it('parse_expr 退化：sin2x 区分于 sin(2)·x', () => {
    const f = compileEvaluator('sin(2x)')!;
    expect(f(0)).toBeCloseTo(0, 12);
    expect(f(Math.PI / 4)).toBeCloseTo(1, 9);
  });
});

describe('辅助函数', () => {
  it('frac 约分并规范化符号', () => {
    expect(fToString(frac(4, 8))).toBe('1/2');
    expect(fToString(frac(1, -2))).toBe('-1/2');
  });

  it('polyDegree 处理零多项式', () => {
    expect(polyDegree([])).toBe(-1);
    expect(polyDegree([frac(0), frac(0)])).toBe(-1);
  });

  it('astToPolynomial 拒绝含变量的除式', () => {
    const ast = parseMathExpression('x/(x+1)')!;
    expect(astToPolynomial(ast)).toBeNull();
  });
});
