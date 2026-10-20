import { Injectable } from '@nestjs/common';

// 数学术语标准化服务
@Injectable()
export class MathTerminologyService {
  // 数学术语映射（中文到英文）
  private readonly termMap: Record<string, string> = {
    // 基础术语
    极限: 'limit',
    导数: 'derivative',
    积分: 'integral',
    微分: 'differential',
    函数: 'function',
    方程: 'equation',
    不等式: 'inequality',
    变量: 'variable',
    常量: 'constant',
    系数: 'coefficient',
    指数: 'exponent',
    底数: 'base',
    幂: 'power',
    根: 'root',
    分母: 'denominator',
    分子: 'numerator',
    分数: 'fraction',
    小数: 'decimal',
    百分数: 'percentage',
    比例: 'ratio',
    比率: 'rate',
    平均数: 'average',
    中位数: 'median',
    众数: 'mode',
    方差: 'variance',
    标准差: 'standard deviation',
    概率: 'probability',
    统计: 'statistics',
    几何: 'geometry',
    代数: 'algebra',
    三角: 'trigonometry',
    微积分: 'calculus',
    线性代数: 'linear algebra',
    数论: 'number theory',

    // 微积分术语
    不定积分: 'indefinite integral',
    定积分: 'definite integral',
    反常积分: 'improper integral',
    多重积分: 'multiple integral',
    曲线积分: 'line integral',
    曲面积分: 'surface integral',
    格林公式: "Green's theorem",
    高斯公式: "Gauss's theorem",
    斯托克斯公式: "Stokes's theorem",
    偏导数: 'partial derivative',
    全微分: 'total differential',
    方向导数: 'directional derivative',
    梯度: 'gradient',
    散度: 'divergence',
    旋度: 'curl',
    极值: 'extremum',
    最大值: 'maximum',
    最小值: 'minimum',
    拐点: 'inflection point',
    凹凸性: 'concavity',
    单调性: 'monotonicity',
    连续性: 'continuity',
    可导性: 'differentiability',
    可积性: 'integrability',

    // 代数术语
    多项式: 'polynomial',
    单项式: 'monomial',
    二项式: 'binomial',
    三项式: 'trinomial',
    因式分解: 'factorization',
    配方法: 'completing the square',
    求根公式: 'quadratic formula',
    判别式: 'discriminant',
    根的个数: 'number of roots',
    重根: 'multiple root',
    实根: 'real root',
    复根: 'complex root',
    有理根: 'rational root',
    无理根: 'irrational root',

    // 几何术语
    点: 'point',
    线: 'line',
    面: 'plane',
    体: 'solid',
    线段: 'line segment',
    射线: 'ray',
    直线: 'straight line',
    曲线: 'curve',
    圆: 'circle',
    椭圆: 'ellipse',
    双曲线: 'hyperbola',
    抛物线: 'parabola',
    三角形: 'triangle',
    四边形: 'quadrilateral',
    矩形: 'rectangle',
    正方形: 'square',
    平行四边形: 'parallelogram',
    梯形: 'trapezoid',
    菱形: 'rhombus',
    正多边形: 'regular polygon',
    周长: 'perimeter',
    面积: 'area',
    体积: 'volume',
    表面积: 'surface area',
    相似: 'similarity',
    全等: 'congruence',
    垂直: 'perpendicular',
    平行: 'parallel',
    相交: 'intersection',
    相切: 'tangency',
    相离: 'disjoint',

    // 三角术语
    正弦: 'sine',
    余弦: 'cosine',
    正切: 'tangent',
    余切: 'cotangent',
    正割: 'secant',
    余割: 'cosecant',
    弧度: 'radian',
    角度: 'degree',
    三角函数: 'trigonometric function',
    反三角函数: 'inverse trigonometric function',
    三角恒等式: 'trigonometric identity',
    三角方程: 'trigonometric equation',

    // 逻辑术语
    命题: 'proposition',
    定理: 'theorem',
    公理: 'axiom',
    定义: 'definition',
    推论: 'corollary',
    引理: 'lemma',
    证明: 'proof',
    归纳法: 'induction',
    演绎法: 'deduction',
    反证法: 'proof by contradiction',
    数学归纳法: 'mathematical induction',

    // 其他术语
    算法: 'algorithm',
    模型: 'model',
    函数图像: 'function graph',
    定义域: 'domain',
    值域: 'range',
    周期性: 'periodicity',
    奇偶性: 'parity',
    对称性: 'symmetry',
    渐近线: 'asymptote',
    收敛: 'convergence',
    发散: 'divergence',
    级数: 'series',
    数列: 'sequence',
    递推关系: 'recurrence relation',
    数学期望: 'mathematical expectation',
    相关系数: 'correlation coefficient',
    回归分析: 'regression analysis',
    假设检验: 'hypothesis testing',
  };

  // 数学符号映射
  private readonly symbolMap: Record<string, string> = {
    // 基本运算符号
    加: '+',
    减: '-',
    乘: '×',
    除: '÷',
    等于: '=',
    不等于: '≠',
    大于: '>',
    小于: '<',
    大于等于: '≥',
    小于等于: '≤',
    约等于: '≈',
    恒等于: '≡',
    同余: '≡',
    相似: '∼',
    全等: '≅',
    垂直: '⊥',
    平行: '∥',
    属于: '∈',
    不属于: '∉',
    包含于: '⊂',
    包含: '⊃',
    空集: '∅',
    并集: '∪',
    交集: '∩',
    补集: '∁',
    存在: '∃',
    任意: '∀',
    且: '∧',
    或: '∨',
    非: '¬',
    蕴含: '⇒',
    等价: '⇔',

    // 微积分符号
    极限: 'lim',
    导数: 'd/dx',
    偏导数: '∂/∂x',
    积分: '∫',
    定积分: '∫ₐᵇ',
    求和: '∑',
    求积: '∏',
    梯度: '∇',
    散度: '∇·',
    旋度: '∇×',

    // 代数符号
    平方根: '√',
    立方根: '∛',
    n次方根: '∛',
    指数: '^',
    对数: 'log',
    自然对数: 'ln',
    绝对值: '|x|',
    阶乘: '!',
    组合数: 'C(n,k)',
    排列数: 'P(n,k)',

    // 几何符号
    角度: '∠',
    三角形: '△',
    圆: '⊙',
    弧: '⌒',
    度数: '°',
    弧度: 'rad',

    // 其他符号
    无穷大: '∞',
    虚数单位: 'i',
    复数: 'a+bi',
    向量: '→',
    矩阵: '[a,b;c,d]',
    行列式: '|a b;c d|',
    范数: '||x||',
  };

  // 数学公式模板
  private readonly formulaTemplates: Record<string, string> = {
    // 极限公式
    limit_sin: '\\lim_{x \to 0} \\frac{\\sin x}{x} = 1',
    limit_exp: '\\lim_{x \to \infty} (1 + \\frac{1}{x})^x = e',
    limit_lhopital:
      "\\lim_{x \to a} \\frac{f(x)}{g(x)} = \\lim_{x \to a} \\frac{f'(x)}{g'(x)}",

    // 导数公式
    derivative_power: '\\frac{d}{dx}(x^n) = nx^{n-1}',
    derivative_sin: '\\frac{d}{dx}(\\sin x) = \\cos x',
    derivative_cos: '\\frac{d}{dx}(\\cos x) = -\\sin x',
    derivative_tan: '\\frac{d}{dx}(\\tan x) = \\sec^2 x',
    derivative_exp: '\\frac{d}{dx}(e^x) = e^x',
    derivative_log: '\\frac{d}{dx}(\\ln x) = \\frac{1}{x}',
    derivative_chain: "\\frac{d}{dx}(f(g(x))) = f'(g(x)) \\cdot g'(x)",

    // 积分公式
    integral_power: '\\int x^n dx = \\frac{1}{n+1}x^{n+1} + C',
    integral_sin: '\\int \\sin x dx = -\\cos x + C',
    integral_cos: '\\int \\cos x dx = \\sin x + C',
    integral_exp: '\\int e^x dx = e^x + C',
    integral_1overx: '\\int \\frac{1}{x} dx = \\ln|x| + C',
    integral_definite: '\\int_a^b f(x) dx = F(b) - F(a)',

    // 代数公式
    quadratic_formula: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}',
    binomial_theorem: '(a + b)^n = \\sum_{k=0}^n C(n,k)a^{n-k}b^k',
    difference_of_squares: 'a^2 - b^2 = (a - b)(a + b)',
    perfect_square: '(a + b)^2 = a^2 + 2ab + b^2',

    // 三角公式
    pythagorean_identity: '\\sin^2 x + \\cos^2 x = 1',
    double_angle_sin: '\\sin 2x = 2\\sin x \\cos x',
    double_angle_cos:
      '\\cos 2x = \\cos^2 x - \\sin^2 x = 2\\cos^2 x - 1 = 1 - 2\\sin^2 x',

    // 几何公式
    area_circle: 'A = \\pi r^2',
    circumference_circle: 'C = 2\\pi r',
    area_triangle: 'A = \\frac{1}{2}bh',
    pythagorean_theorem: 'a^2 + b^2 = c^2',
  };

  // 获取标准化的数学术语
  getStandardTerm(term: string): string {
    return this.termMap[term] || term;
  }

  // 获取数学符号
  getSymbol(symbolName: string): string {
    return this.symbolMap[symbolName] || symbolName;
  }

  // 获取数学公式
  getFormula(formulaName: string): string {
    return this.formulaTemplates[formulaName] || '';
  }

  // 标准化数学表达式（保持中文输出）
  standardizeExpression(expression: string): string {
    // 先修正混乱的中英文混合表述
    let standardized = expression;

    const mixedTermFixes: Record<string, string> = {
      lim类型: '极限类型',
      lim求解: '极限求解',
      lim计算: '极限计算',
      derivative计算: '导数计算',
      integral计算: '积分计算',
      equation求解: '方程求解',
      自variable: '自变量',
      function: '函数',
      definition域: '定义域',
      algebra运算: '代数运算',
      root据: '根据',
      '⇔无穷小替换': '等价无穷小替换',
      '∨重要lim公式': '或重要极限公式',
      识别lim类型: '识别极限类型',
      lim类型识别: '极限类型识别',
      lim求解方法: '极限求解方法',
    };

    for (const [mixed, correct] of Object.entries(mixedTermFixes)) {
      const regex = new RegExp(
        mixed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'g',
      );
      standardized = standardized.replace(regex, correct);
    }

    // 只替换安全的符号（不替换会破坏自然语言的条目）
    const safeSymbols = {
      加: '+',
      减: '-',
      乘: '×',
      除: '÷',
      等于: '=',
      不等于: '≠',
      大于: '>',
      小于: '<',
      大于等于: '≥',
      小于等于: '≤',
      约等于: '≈',
      恒等于: '≡',
      同余: '≡',
      相似: '∼',
      全等: '≅',
      垂直: '⊥',
      平行: '∥',
      属于: '∈',
      不属于: '∉',
      包含于: '⊂',
      包含: '⊃',
      空集: '∅',
      并集: '∪',
      交集: '∩',
      补集: '∁',
      存在: '∃',
      任意: '∀',
      且: '∧',
      或: '∨',
      非: '¬',
      蕴含: '⇒',
      等价: '⇔',
      平方根: '√',
      立方根: '∛',
      n次方根: '∛',
      指数: '^',
      对数: 'log',
      自然对数: 'ln',
      绝对值: '|x|',
      阶乘: '!',
      组合数: 'C(n,k)',
      排列数: 'P(n,k)',
      角度: '∠',
      三角形: '△',
      圆: '⊙',
      弧: '⌒',
      度数: '°',
      弧度: 'rad',
      无穷大: '∞',
      虚数单位: 'i',
      复数: 'a+bi',
      向量: '→',
      矩阵: '[a,b;c,d]',
      行列式: '|a b;c d|',
      范数: '||x||',
      求和: '∑',
      求积: '∏',
      梯度: '∇',
      散度: '∇·',
      旋度: '∇×',
    };

    for (const [name, symbol] of Object.entries(safeSymbols)) {
      const regex = new RegExp(
        name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'g',
      );
      standardized = standardized.replace(regex, symbol);
    }

    return standardized;
  }

  // 转换为英文（用于内部处理）
  standardizeExpressionToEnglish(expression: string): string {
    let standardized = expression;
    for (const [chinese, english] of Object.entries(this.termMap)) {
      const regex = new RegExp(
        chinese.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'g',
      );
      standardized = standardized.replace(regex, english);
    }

    for (const [name, symbol] of Object.entries(this.symbolMap)) {
      const regex = new RegExp(
        name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'g',
      );
      standardized = standardized.replace(regex, symbol);
    }

    return standardized;
  }

  // 验证数学术语的正确性
  validateTerm(term: string): boolean {
    return term in this.termMap || Object.values(this.termMap).includes(term);
  }

  // 验证数学符号的正确性
  validateSymbol(symbol: string): boolean {
    return Object.values(this.symbolMap).includes(symbol);
  }

  // 生成数学表达式的LaTeX表示
  toLaTeX(expression: string): string {
    // 替换常见的数学表达式为LaTeX格式
    let latex = expression;

    // 替换基本运算
    latex = latex.replace(/\+\+/g, '++');
    latex = latex.replace(/--/g, '--');
    latex = latex.replace(/\*\*/g, '^');

    // 替换分数
    latex = latex.replace(/(\d+)\/(\d+)/g, '\\frac{$1}{$2}');

    // 替换根号
    latex = latex.replace(/sqrt\(([^)]+)\)/g, '\\sqrt{$1}');

    // 替换指数
    latex = latex.replace(/\^(\d+)/g, '^{$1}');

    // 替换下标
    latex = latex.replace(/_(\d+)/g, '_{$1}');

    return latex;
  }

  // 从LaTeX生成数学表达式
  fromLaTeX(latex: string): string {
    // 替换LaTeX格式为普通数学表达式
    let expression = latex;

    // 替换分数
    expression = expression.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1/$2');

    // 替换根号
    expression = expression.replace(/\\sqrt\{([^}]+)\}/g, 'sqrt($1)');

    // 替换指数
    expression = expression.replace(/\^\{([^}]+)\}/g, '^$1');

    // 替换下标
    expression = expression.replace(/\_\{([^}]+)\}/g, '_$1');

    return expression;
  }

  // 检查数学表达式的语法正确性
  checkSyntax(expression: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 检查括号匹配
    const parentheses = expression.match(/[()\[\]{}]/g) || [];
    const stack: string[] = [];
    const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}' };

    for (const p of parentheses) {
      if (p in pairs) {
        stack.push(p);
      } else {
        const last = stack.pop();
        if (!last || pairs[last] !== p) {
          errors.push('括号不匹配');
          break;
        }
      }
    }

    if (stack.length > 0) {
      errors.push('括号不匹配');
    }

    // 检查基本语法
    if (/[^\d+\-*/()\[\]{}.,a-zA-Z\s]/.test(expression)) {
      errors.push('包含无效字符');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // 格式化数学表达式
  formatExpression(expression: string): string {
    // 添加适当的空格
    let formatted = expression;
    formatted = formatted.replace(/([+\-*/=<>])/g, ' $1 ');
    formatted = formatted.replace(/\s+/g, ' ');
    formatted = formatted.trim();

    // 标准化括号
    formatted = formatted.replace(/\[([^\]]+)\]/g, '($1)');
    formatted = formatted.replace(/\{([^\}]+)\}/g, '($1)');

    return formatted;
  }

  // 获取数学概念的详细信息
  getConceptInfo(concept: string): {
    name: string;
    description: string;
    formulas: string[];
  } {
    const conceptInfo: Record<
      string,
      { description: string; formulas: string[] }
    > = {
      limit: {
        description: '函数在某一点的极限是当自变量趋近于该点时函数值的趋近值',
        formulas: ['limit_sin', 'limit_exp', 'limit_lhopital'],
      },
      derivative: {
        description: '导数表示函数在某一点的瞬时变化率',
        formulas: [
          'derivative_power',
          'derivative_sin',
          'derivative_cos',
          'derivative_chain',
        ],
      },
      integral: {
        description: '积分是微分的逆运算，用于计算面积、体积等',
        formulas: [
          'integral_power',
          'integral_sin',
          'integral_cos',
          'integral_definite',
        ],
      },
      equation: {
        description: '含有未知数的等式',
        formulas: ['quadratic_formula', 'binomial_theorem'],
      },
      function: {
        description:
          '一种映射关系，将一个集合中的每个元素对应到另一个集合中的唯一元素',
        formulas: [],
      },
    };

    const info = conceptInfo[concept] || {
      description: '未知概念',
      formulas: [],
    };
    return {
      name: concept,
      description: info.description,
      formulas: info.formulas.map((f) => this.getFormula(f)),
    };
  }
}
