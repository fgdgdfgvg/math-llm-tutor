import { Injectable, Logger } from '@nestjs/common';
import {
  compileEvaluator,
  fToString,
  frac,
  normalizeMathText,
  parseMathExpression,
  astToPolynomial,
  polyDegree,
  polySub,
  polyToLatex,
} from './math-expression';

export type EquivalenceVerdict = 'correct' | 'equivalent' | 'incorrect' | 'unknown';

export interface EquivalenceResult {
  verdict: EquivalenceVerdict;
  /** 0~1，越高越可信（unknown 时为 0） */
  confidence: number;
  /** 判定依据，便于前端展示"为什么判对/判错" */
  evidence: string[];
  normalizedStudent: string;
  normalizedExpected: string;
}

/** 积分常数命名差异（C、C₁、+C1）视为同一常数 */
const CONSTANT_ALIAS = /\bC(?:_?[0-9])?/g;

@Injectable()
export class AnswerEquivalenceService {
  private readonly logger = new Logger(AnswerEquivalenceService.name);

  /**
   * 判定学生答案与参考答案是否等价。
   *
   * 三级判定（成本从低到高，任一级给出确定结论即返回）：
   *  1. 精确多项式差：两边都能解析成一元多项式时，直接比较差多项式是否为零
   *     —— 这一级能正确处理 `(x-1)(x+1)` vs `x^{2}-1`、`x+1` vs `1+x`、`2/4` vs `1/2`；
   *  2. 解集比较：形如 `x=1, x=2` 的答案按解集比较（顺序、`x_1/x_2` 命名无关）；
   *  3. 数值抽样：对含自由变量的表达式在定义域内取点比较 —— 能处理
   *     `sin(x)/cos(x)` vs `tan(x)`、`√2/2` vs `1/√2`、`e^x` vs `exp(x)`。
   *
   * 三级都不确定时返回 `unknown`（而不是武断判错），调用方可转 AI 或人工确认。
   */
  compare(studentAnswer: string, expectedAnswer: string): EquivalenceResult {
    const student = String(studentAnswer ?? '').trim();
    const expected = String(expectedAnswer ?? '').trim();

    const normalizedStudent = this.canonicalize(student);
    const normalizedExpected = this.canonicalize(expected);

    if (!expected) {
      return {
        verdict: 'unknown',
        confidence: 0,
        evidence: ['没有参考答案，无法自动判定'],
        normalizedStudent,
        normalizedExpected,
      };
    }

    if (!student) {
      return {
        verdict: 'incorrect',
        confidence: 0.9,
        evidence: ['学生答案为空'],
        normalizedStudent,
        normalizedExpected,
      };
    }

    // 0. 归一化后完全一致
    if (normalizedStudent === normalizedExpected) {
      return {
        verdict: 'correct',
        confidence: 0.99,
        evidence: ['归一化后字面一致'],
        normalizedStudent,
        normalizedExpected,
      };
    }

    // 0.5 两边都是纯数值（含分数、科学计数法）
    const numericVerdict = this.compareNumbers(student, expected);
    if (numericVerdict) return { ...numericVerdict, normalizedStudent, normalizedExpected };

    // 0.6 定性结论（中文自然语言答案）：
    // “极限不存在” 与 “极限不存在（左右极限不相等）” 是同一个结论，
    // 不应该因为括号里的说明文字就判为无法判定。
    const qualitativeVerdict = this.compareQualitativeStatements(student, expected);
    if (qualitativeVerdict) return { ...qualitativeVerdict, normalizedStudent, normalizedExpected };

    // 1. 精确多项式等价
    const polyVerdict = this.comparePolynomials(student, expected);
    if (polyVerdict) return { ...polyVerdict, normalizedStudent, normalizedExpected };

    // 2. 解集比较（方程题）
    const solutionVerdict = this.compareSolutionSets(student, expected);
    if (solutionVerdict) return { ...solutionVerdict, normalizedStudent, normalizedExpected };

    // 3. 数值抽样
    const sampleVerdict = this.compareBySampling(student, expected);
    if (sampleVerdict) return { ...sampleVerdict, normalizedStudent, normalizedExpected };

    return {
      verdict: 'unknown',
      confidence: 0,
      evidence: [
        '无法自动判定两个答案是否等价（非多项式、数值抽样不可用）',
        '建议由 AI 或教师人工确认',
      ],
      normalizedStudent,
      normalizedExpected,
    };
  }

  /** 把答案文本规范化为可比较形式 */
  canonicalize(input: string): string {
    if (!input) return '';
    let s = normalizeMathText(input);
    s = s
      .replace(/^\s*(?:答案|答|解)\s*[:：=]?\s*/, '')
      .replace(/[，。；：\s]/g, '')
      .replace(/[{}$]/g, '')
      .replace(/±/g, '+-')
      .replace(/\+C(?![0-9A-Za-z])/g, '+C')
      .replace(CONSTANT_ALIAS, 'C')
      .toLowerCase();
    return s;
  }

  /** 积分/无理式里常数项的等价：`2x + C` 与 `2x + C_1` 视为相同 */
  private stripAdditiveConstant(input: string): string {
    return input
      .replace(/[+-]\s*C\s*$/i, '')
      .replace(/[+-]\s*C(?=[+\-]|$)/gi, '')
      .trim();
  }

  /** 表示“不存在/无解”类结论的中文关键词（必须先于肯定词检查：'不存在' 含 '存在'） */
  private static readonly NEGATIVE_CONCLUSIONS = [
    '不存在', '无解', '没有解', '无实数解', '无实根', '不可导', '不收敛', '发散', '未定义',
  ];

  /**
   * 定性结论比较：两侧都是自然语言时，看它们是否表达同一类结论。
   * 只处理“不存在类”与“存在类”这两个明确且高频的场景，其余仍返回 unknown。
   */
  private compareQualitativeStatements(
    a: string,
    b: string,
  ): Omit<EquivalenceResult, 'normalizedStudent' | 'normalizedExpected'> | null {
    const strip = (text: string) =>
      text.replace(/[（(][^）)]*[）)]/g, '').replace(/\s/g, '');
    const hasNegative = (text: string) =>
      AnswerEquivalenceService.NEGATIVE_CONCLUSIONS.some((keyword) => text.includes(keyword));

    const left = strip(a);
    const right = strip(b);

    // 两边都声明“不存在/无解”类结论
    if (hasNegative(left) && hasNegative(right)) {
      return {
        verdict: 'equivalent',
        confidence: 0.8,
        evidence: ['两侧均为“不存在 / 无解”类结论'],
      };
    }

    // 一侧说不存在、另一侧给出具体值 → 明确矛盾
    if (hasNegative(left) !== hasNegative(right)) {
      const valueSide = hasNegative(left) ? right : left;
      const isNumericValue = /^[-+0-9./]+$/.test(valueSide.replace(/[a-z=]/gi, ''));
      if (isNumericValue) {
        return {
          verdict: 'incorrect',
          confidence: 0.75,
          evidence: ['一侧结论为“不存在/无解”，另一侧给出了具体数值'],
        };
      }
    }

    return null;
  }

  private compareNumbers(a: string, b: string): Omit<EquivalenceResult, 'normalizedStudent' | 'normalizedExpected'> | null {
    const parse = (value: string): number | null => {
      const cleaned = normalizeMathText(value).replace(/[{}]/g, '').trim();
      if (!cleaned) return null;
      // 分数形式 a/b
      const m = cleaned.match(/^([+-]?\d+(?:\.\d+)?)\s*\/\s*([+-]?\d+(?:\.\d+)?)$/);
      if (m) return Number(m[1]) / Number(m[2]);
      if (/^[+-]?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(cleaned)) return Number(cleaned);
      return null;
    };
    const na = parse(a);
    const nb = parse(b);
    if (na === null || nb === null) return null;
    const diff = Math.abs(na - nb);
    const tolerance = 1e-9 * Math.max(1, Math.abs(na), Math.abs(nb));
    return diff <= tolerance
      ? { verdict: 'correct', confidence: 0.95, evidence: [`数值相等：${na} = ${nb}`] }
      : { verdict: 'incorrect', confidence: 0.9, evidence: [`数值不等：${na} ≠ ${nb}`] };
  }

  private comparePolynomials(
    a: string,
    b: string,
  ): Omit<EquivalenceResult, 'normalizedStudent' | 'normalizedExpected'> | null {
    const polyA = this.toPolynomial(a);
    const polyB = this.toPolynomial(b);
    if (!polyA || !polyB) return null;
    const diff = polySub(polyA, polyB);
    const degree = polyDegree(diff);
    if (degree < 0) {
      return {
        verdict: 'equivalent',
        confidence: 0.97,
        evidence: ['两边之差恒等于 0（多项式精确等价）'],
      };
    }
    // 只有当两边都不是常量多项式（即确实含变量）时，才能断言"不等价"
    const hasVariable = polyDegree(polyA) > 0 || polyDegree(polyB) > 0;
    if (hasVariable) {
      return {
        verdict: 'incorrect',
        confidence: 0.85,
        evidence: [`两边之差为 ${polyToLatex(diff)}，不恒为 0`],
      };
    }
    return null;
  }

  /**
   * 解析前的统一预处理：先规范化（`C_1`→`C`、`**`→`^`、去空格），
   * 再剥掉积分常数项。顺序很重要：未规范化的 `+ C_1` 无法被 `+ C$` 规则剥掉。
   */
  private prepareExpression(input: string): string {
    return this.stripAdditiveConstant(this.canonicalize(input));
  }

  private toPolynomial(input: string) {
    const ast = parseMathExpression(this.prepareExpression(input));
    if (!ast) return null;
    return astToPolynomial(ast, 'x');
  }

  /**
   * 解集比较：把 `x=1, x=2` / `x_1=1，x_2=2` / `{1, 2}` 解析成数值集合后比较。
   * 顺序无关，允许 ± 形式的解（两边都用根式展示时退化为字符串比较）。
   */
  private compareSolutionSets(
    a: string,
    b: string,
  ): Omit<EquivalenceResult, 'normalizedStudent' | 'normalizedExpected'> | null {
    const setA = this.extractRootSet(a);
    const setB = this.extractRootSet(b);
    if (!setA || !setB || setA.length === 0 || setB.length === 0) return null;
    if (setA.length !== setB.length) {
      return {
        verdict: 'incorrect',
        confidence: 0.8,
        evidence: [`解的个数不同：${setA.length} vs ${setB.length}`],
      };
    }
    const used = new Array(setB.length).fill(false);
    for (const value of setA) {
      const index = setB.findIndex(
        (candidate, i) => !used[i] && Math.abs(candidate - value) < 1e-9 * Math.max(1, Math.abs(value), Math.abs(candidate)),
      );
      if (index < 0) {
        return {
          verdict: 'incorrect',
          confidence: 0.8,
          evidence: [`解 ${value} 未出现在参考答案中`],
        };
      }
      used[index] = true;
    }
    return {
      verdict: 'equivalent',
      confidence: 0.9,
      evidence: ['解集相同（顺序无关）'],
    };
  }

  private extractRootSet(input: string): number[] | null {
    const text = normalizeMathText(input).replace(/[{}]/g, '');
    const chunks = text
      .split(/[,、;]|(?:或)/)
      .map((chunk) => chunk.trim())
      .filter(Boolean);
    const values: number[] = [];
    for (const chunk of chunks) {
      // 形如 x=1 / x_1=1 / 1（纯数值集合写法）
      const equation = chunk.match(/^[A-Za-z][A-Za-z0-9]*\s*=\s*(.+)$/);
      const valueText = equation ? equation[1].trim() : chunk;
      const value = this.evaluateConstant(valueText);
      if (value === null) return null;
      values.push(value);
    }
    return values;
  }

  /** 不含自由变量的表达式求值（常量/数值表达式），失败返回 null */
  private evaluateConstant(input: string): number | null {
    const evaluator = compileEvaluator(input, '__no_variable__');
    if (!evaluator) return null;
    const value = evaluator(0);
    if (!Number.isFinite(value)) return null;
    return value;
  }

  /** 数值抽样比较：在若干代表性取值上比较 |a-b| */
  private compareBySampling(
    a: string,
    b: string,
  ): Omit<EquivalenceResult, 'normalizedStudent' | 'normalizedExpected'> | null {
    const fa = compileEvaluator(this.prepareExpression(a));
    const fb = compileEvaluator(this.prepareExpression(b));
    if (!fa || !fb) return null;

    const samples = [-3, -2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2, 3, 5];
    const evidence: string[] = [];
    let compared = 0;
    for (const x of samples) {
      const va = fa(x);
      const vb = fb(x);
      // 定义域不一致（一方无定义）时跳过，不据此判错
      const aDefined = Number.isFinite(va);
      const bDefined = Number.isFinite(vb);
      if (!aDefined && !bDefined) continue;
      if (aDefined !== bDefined) {
        evidence.push(`x=${x} 处定义域不同（${aDefined ? '学生' : '参考'}答案无定义）`);
        return { verdict: 'unknown', confidence: 0, evidence };
      }
      compared++;
      const diff = Math.abs(va - vb);
      const tolerance = 1e-6 * Math.max(1, Math.abs(va), Math.abs(vb));
      if (diff > tolerance) {
        evidence.push(`x=${x} 处取值不同：${va} ≠ ${vb}`);
        return { verdict: 'incorrect', confidence: 0.85, evidence };
      }
    }

    if (compared < 3) return null;
    evidence.push(`在 ${compared} 个采样点上取值一致（数值抽样，非符号证明）`);
    return { verdict: 'equivalent', confidence: 0.85, evidence };
  }
}

/** 供其它模块复用的便捷函数 */
export function fractionsToLatex(values: { n: number; d: number }[]): string {
  return values.map((v) => fToString(frac(v.n, v.d))).join(', ');
}
