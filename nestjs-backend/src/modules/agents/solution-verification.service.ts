import { Injectable, Logger } from '@nestjs/common';
import {
  Polynomial,
  compileEvaluator,
  fEquals,
  parsePolynomialExact,
  polyDegree,
  polyDerivative,
  polyIntegral,
} from './math-expression';

/**
 * 解题结果自校验（Verifier 模式）。
 *
 * 代码审阅 2.9：系统此前只有“让 LLM 自己检查自己”的软验证，没有任何
 * “把答案代回原题”的硬校验。本服务对四类可验证题型给出独立的数值/符号证据：
 *
 *   - 求导：用中心差分 (f(x+h)-f(x-h))/2h 与解析导数逐点比对（相对误差阈值）；
 *   - 积分：对结果求导应等于被积函数（微积分基本定理）；
 *           定积分再用 Simpson 数值积分交叉验证；
 *   - 方程：把解代回原方程，检查残差是否接近 0；
 *   - 极限：用双侧趋近序列观察收敛值（含“极限不存在”与无穷的情形）。
 *
 * 多项式题型会走**精确符号通道**（有理数系数完全相等），非多项式退回数值通道。
 * 证据不足（无法解析 / 采样点太少）时明确返回“未验证”，绝不当成通过。
 */

export type VerificationKind = 'derivative' | 'integral' | 'equation' | 'limit';

export interface VerificationCheck {
  kind: VerificationKind;
  method: 'symbolic' | 'numeric';
  /** 是否通过了该项校验 */
  passed: boolean;
  /** 中文说明（可直接展示给学生/日志） */
  summary: string;
  /** 数值通道的最大相对误差 */
  maxError?: number;
  /** 实际使用的采样点数量 */
  samples?: number;
}

export interface VerificationReport {
  /** 所有可执行校验都通过才为 true；无可执行校验时为 false */
  verified: boolean;
  checks: VerificationCheck[];
  /** 0~1：证据强度（符号 1.0，数值按采样与误差） */
  confidence: number;
}

/** 与 agent.types.ts 的 VerificationResult 对齐的映射结果 */
export interface VerificationResultLike {
  stepId: string;
  isValid: boolean;
  errorMessage?: string;
  confidence: number;
}

const DERIVATIVE_TOLERANCE = 1e-4;
const EQUATION_TOLERANCE = 1e-6;
const DEFINITE_INTEGRAL_TOLERANCE = 1e-3;
const LIMIT_TOLERANCE = 1e-3;

/** 稳定的采样点：跨越正负、避开 0（部分函数在 0 处无定义/不可导） */
const SAMPLE_POINTS = [-1.7, -0.9, -0.4, 0.3, 0.8, 1.3, 2.1];

@Injectable()
export class SolutionVerificationService {
  private readonly logger = new Logger(SolutionVerificationService.name);

  // ============================ 对外入口 ============================

  /** 求导结果验证：解析导数 vs 中心差分 */
  verifyDerivative(
    sourceExpr: string,
    claimedDerivative: string,
    variable = 'x',
  ): VerificationCheck {
    const exact = this.trySymbolicDerivative(sourceExpr, claimedDerivative, variable);
    if (exact) {
      return exact;
    }
    return this.numericDerivativeCheck(sourceExpr, claimedDerivative, variable, 'derivative');
  }

  /**
   * 不定积分验证：对“原函数”求导应等于被积函数。
   * 先尝试精确多项式通道，再退回数值通道。
   */
  verifyIndefiniteIntegral(
    integrand: string,
    claimedAntiderivative: string,
    variable = 'x',
  ): VerificationCheck {
    const antiderivative = this.stripIntegrationConstant(claimedAntiderivative);
    const exact = this.trySymbolicAntiderivative(integrand, antiderivative, variable);
    if (exact) {
      return exact;
    }
    // 微积分基本定理：d/dx F(x) = f(x)
    const numeric = this.numericDerivativeCheck(
      antiderivative,
      integrand,
      variable,
      'integral',
    );
    return numeric;
  }

  /**
   * 定积分验证：Simpson 数值积分作为参考真值（符号解由 SymPy 通道负责）。
   */
  verifyDefiniteIntegral(
    integrand: string,
    lower: string,
    upper: string,
    claimedValue: string,
    variable = 'x',
  ): VerificationCheck {
    const f = compileEvaluator(integrand, variable);
    const claimed = compileEvaluator(claimedValue, variable);
    const a = this.evaluateConstant(lower);
    const b = this.evaluateConstant(upper);
    if (!f || !claimed || a === null || b === null || !(b > a)) {
      return this.unknown('integral', '定积分验证所需条件不足（无法解析被积函数/上下限/答案）');
    }
    const claimedNumber = claimed(0);
    const reference = this.simpson(f, a, b, 2000);
    if (!Number.isFinite(reference) || !Number.isFinite(claimedNumber)) {
      return this.unknown('integral', '被积函数或答案在积分区间上无有限取值');
    }
    const error = Math.abs(reference - claimedNumber) / Math.max(1, Math.abs(reference));
    const passed = error <= DEFINITE_INTEGRAL_TOLERANCE;
    return {
      kind: 'integral',
      method: 'numeric',
      passed,
      maxError: error,
      samples: 2001,
      summary: passed
        ? `定积分数值交叉验证通过（Simpson 参考值 ${reference.toPrecision(8)}）`
        : `定积分与 Simpson 参考值不一致：答案 ${claimedNumber}，参考 ${reference.toPrecision(8)}`,
    };
  }

  /**
   * 方程解验证：把每个解代回原方程检查残差。
   * 支持 `x = 2`、`±2`、`1/2`、`sqrt(2)` 等写法；复数/无法解析的解跳过。
   */
  verifyEquationSolutions(
    equation: string,
    solutions: string[],
    variable = 'x',
  ): VerificationCheck[] {
    const residual = this.buildResidualEvaluator(equation, variable);
    if (!residual) {
      return [this.unknown('equation', '方程无法解析为可求值形式')];
    }

    const candidates = solutions.flatMap((s) => this.extractSolutionValues(s, variable));
    if (candidates.length === 0) {
      return [this.unknown('equation', '未能从答案中解析出可验证的数值解')];
    }

    const checks: VerificationCheck[] = [];
    for (const { label, value } of candidates) {
      const r = residual(value);
      const scale = this.residualScale(equation, value, variable);
      const passed = Number.isFinite(r) && Math.abs(r) <= EQUATION_TOLERANCE * scale;
      checks.push({
        kind: 'equation',
        method: 'numeric',
        passed,
        maxError: Number.isFinite(r) ? Math.abs(r) : undefined,
        summary: passed
          ? `解 ${label} 代回原方程残差≈0，验证通过`
          : `解 ${label} 代回原方程残差为 ${Number.isFinite(r) ? r : 'NaN'}，验证失败`,
      });
    }
    return checks;
  }

  /**
   * 极限验证：用趋近序列观察。
   * claimed 支持有限值、`oo` / `-oo` / `∞`，以及“不存在”类表述。
   */
  verifyLimit(
    expr: string,
    approach: string,
    claimed: string,
    variable = 'x',
    direction: '+' | '-' | '+-' = '+-',
  ): VerificationCheck {
    const f = compileEvaluator(expr, variable);
    if (!f) {
      return this.unknown('limit', '极限表达式无法解析');
    }

    const claimedText = claimed.trim();
    const claimsNonexistent = /不存在|dne|does\s*not\s*exist/i.test(claimedText);
    const claimsInfinity = /^[+]?(oo|∞|inf(inity)?)$/i.test(claimedText.replace(/\s/g, ''));
    const claimsNegativeInfinity = /^[-−](oo|∞|inf(inity)?)$/i.test(claimedText.replace(/\s/g, ''));
    const claimedEvaluator = compileEvaluator(claimedText, variable);
    const claimedNumber =
      !claimsNonexistent && !claimsInfinity && !claimsNegativeInfinity && claimedEvaluator
        ? claimedEvaluator(0)
        : null;

    const target = this.evaluateConstant(approach);
    if (target === null) {
      return this.unknown('limit', `无法解析趋近点 ${approach}`);
    }

    // 有限点才分左右侧；趋于无穷时按单一序列处理
    const sides: Array<'+' | '-'> =
      Math.abs(target) === Infinity ? ['+'] : direction === '+-' ? ['-', '+'] : [direction];
    const observations: Array<{ side: '+' | '-'; values: number[] }> = [];
    for (const side of sides) {
      const values: number[] = [];
      for (let k = 1; k <= 8; k++) {
        const point =
          Math.abs(target) === Infinity
            ? (target > 0 ? 1 : -1) * Math.pow(10, k)
            : target + (side === '+' ? 1 : -1) * Math.pow(10, -k);
        values.push(f(point));
      }
      observations.push({ side, values });
    }

    if (claimsInfinity || claimsNegativeInfinity) {
      const sign = claimsInfinity ? 1 : -1;
      const passed = observations.every(({ values }) => {
        const finite = values.filter((v) => Number.isFinite(v));
        if (finite.length < 4) return false;
        // 必须同号且绝对值单调增长
        return (
          finite.every((v) => Math.sign(v) === sign) &&
          finite.every((v, i) => i === 0 || Math.abs(v) >= Math.abs(finite[i - 1]))
        );
      });
      return {
        kind: 'limit',
        method: 'numeric',
        passed,
        samples: observations.reduce((n, o) => n + o.values.length, 0),
        summary: passed
          ? `趋近序列与“极限为${sign > 0 ? '+' : '-'}∞”一致（数值验证）`
          : '趋近序列未表现出应有的发散趋势，无法确认“极限为无穷”',
      };
    }

    if (claimsNonexistent) {
      const [left, right] = [
        observations.find((o) => o.side === '-'),
        observations.find((o) => o.side === '+'),
      ];
      if (!left || !right) {
        return this.unknown('limit', '判定“极限不存在”需要双侧序列');
      }
      const leftLast = left.values[left.values.length - 1];
      const rightLast = right.values[right.values.length - 1];
      const divergeInSign = Number.isFinite(leftLast) && Number.isFinite(rightLast)
        ? Math.abs(leftLast - rightLast) > LIMIT_TOLERANCE
        : false;
      const unbounded =
        !Number.isFinite(leftLast) || !Number.isFinite(rightLast)
          ? Math.max(Math.abs(leftLast), Math.abs(rightLast)) > 1e3
          : false;
      const passed = divergeInSign || unbounded;
      return {
        kind: 'limit',
        method: 'numeric',
        passed,
        samples: left.values.length + right.values.length,
        summary: passed
          ? '左右趋近序列确实不一致/无界，与“极限不存在”的结论一致'
          : '左右趋近序列看起来一致，“极限不存在”的结论没有得到数值支持',
      };
    }

    if (claimedNumber === null || !Number.isFinite(claimedNumber)) {
      return this.unknown('limit', `无法解析声称的极限值 ${claimed}`);
    }

    const tails = observations.map(({ values }) => {
      const last = values[values.length - 1];
      return {
        last,
        error: Math.abs(last - claimedNumber) / Math.max(1, Math.abs(claimedNumber)),
      };
    });
    const passed = tails.every(
      (t) => Number.isFinite(t.last) && t.error <= LIMIT_TOLERANCE,
    );
    const maxError = Math.max(...tails.map((t) => (Number.isFinite(t.error) ? t.error : Infinity)));
    return {
      kind: 'limit',
      method: 'numeric',
      passed,
      maxError,
      samples: observations.reduce((n, o) => n + o.values.length, 0),
      summary: passed
        ? `趋近序列收敛到 ${claimedNumber}，数值验证通过`
        : `趋近序列未收敛到 ${claimedNumber}（最大相对误差 ${maxError.toExponential(2)}）`,
    };
  }

  /**
   * 按题面文本推断题型并验证（尽力而为：推断不出题型时返回空 checks，
   * 调用方据此显示“未做数值验证”而不是显示“验证通过”）。
   */
  verifyByProblemText(problem: string, answer: string, variable = 'x'): VerificationReport {
    const text = problem || '';
    const expr = this.extractExpression(text);
    const check: VerificationCheck | null = (() => {
      if (!expr || !answer) return null;
      if (/求导|导数|微分\s*d\/d|d\/dx|f'\(x\)/i.test(text)) {
        return this.verifyDerivative(expr, answer, variable);
      }
      if (/积分|∫|int(egral)?\b/i.test(text)) {
        const definite = text.match(/[从由]\s*([^\s到至]+)\s*[到至]\s*([^\s]+)\s*积分/);
        if (definite) {
          return this.verifyDefiniteIntegral(expr, definite[1], definite[2], answer, variable);
        }
        return this.verifyIndefiniteIntegral(expr, answer, variable);
      }
      if (/极限|lim/i.test(text)) {
        const approach = text.match(/(?:→|->|趋近于|趋近)\s*([^\s，,）)]+)/);
        return this.verifyLimit(expr, approach ? approach[1] : '0', answer, variable);
      }
      if (text.includes('=')) {
        return this.verifyEquationSolutions(text, [answer], variable)[0] || null;
      }
      return null;
    })();

    if (!check) {
      return { verified: false, checks: [], confidence: 0 };
    }
    const checks = [check];
    return {
      verified: checks.every((c) => c.passed),
      checks,
      confidence: this.confidenceOf(checks),
    };
  }

  /** 把校验结果映射为 orchestrator 的 VerificationResult（用于前端徽章） */
  toVerificationResults(report: VerificationReport): VerificationResultLike[] {
    return report.checks.map((check) => ({
      stepId: `verifier:${check.kind}`,
      isValid: check.passed,
      errorMessage: check.passed ? undefined : check.summary,
      confidence: check.method === 'symbolic' ? 1 : check.passed ? 0.85 : 0.6,
    }));
  }

  // ============================ 精确符号通道 ============================

  private trySymbolicDerivative(
    sourceExpr: string,
    claimedDerivative: string,
    variable: string,
  ): VerificationCheck | null {
    const source = parsePolynomialExact(sourceExpr, variable);
    const claimed = parsePolynomialExact(claimedDerivative, variable);
    if (!source || !claimed) return null;
    const expected = polyDerivative(source);
    const same = this.polynomialsEqual(expected, claimed);
    return {
      kind: 'derivative',
      method: 'symbolic',
      passed: same,
      summary: same
        ? '精确多项式求导验证通过（有理数系数完全一致）'
        : `精确多项式求导不一致：解析结果应为 ${this.polynomialText(expected, variable)}`,
    };
  }

  private trySymbolicAntiderivative(
    integrand: string,
    antiderivative: string,
    variable: string,
  ): VerificationCheck | null {
    const f = parsePolynomialExact(integrand, variable);
    const F = parsePolynomialExact(antiderivative, variable);
    if (!f || !F) return null;
    // 原函数不唯一：比较导数是否等于被积函数
    const same = this.polynomialsEqual(polyDerivative(F), f);
    return {
      kind: 'integral',
      method: 'symbolic',
      passed: same,
      summary: same
        ? '精确多项式积分验证通过（求导后与被积函数完全一致）'
        : '精确多项式积分验证失败：对结果求导不等于被积函数',
    };
  }

  private polynomialsEqual(a: Polynomial, b: Polynomial): boolean {
    const degA = polyDegree(a);
    const degB = polyDegree(b);
    if (degA !== degB) return false;
    for (let i = 0; i <= degA; i++) {
      if (!fEquals(a[i] ?? { n: 0, d: 1 }, b[i] ?? { n: 0, d: 1 })) return false;
    }
    return true;
  }

  private polynomialText(p: Polynomial, variable: string): string {
    if (polyDegree(p) < 0) return '0';
    return p
      .map((coef, i) => {
        const c = coef.n / coef.d;
        if (c === 0) return null;
        const symbol = i === 0 ? '' : i === 1 ? variable : `${variable}^${i}`;
        return `${c}${symbol ? `*${symbol}` : ''}`;
      })
      .filter(Boolean)
      .join(' + ');
  }

  // ============================ 数值通道 ============================

  private numericDerivativeCheck(
    sourceExpr: string,
    claimedDerivative: string,
    variable: string,
    kind: 'derivative' | 'integral',
  ): VerificationCheck {
    const f = compileEvaluator(sourceExpr, variable);
    const g = compileEvaluator(claimedDerivative, variable);
    if (!f || !g) {
      return this.unknown(kind, '表达式无法解析，跳过数值验证');
    }

    let maxError = 0;
    let samples = 0;
    for (const x of SAMPLE_POINTS) {
      const h = 1e-5 * Math.max(1, Math.abs(x));
      const numeric = (f(x + h) - f(x - h)) / (2 * h);
      const claimed = g(x);
      if (!Number.isFinite(numeric) || !Number.isFinite(claimed)) continue;
      samples++;
      const error = Math.abs(numeric - claimed) / Math.max(1, Math.abs(claimed));
      maxError = Math.max(maxError, error);
    }

    if (samples < 3) {
      return this.unknown(kind, `有效采样点不足（${samples} 个），无法数值验证`);
    }
    const passed = maxError <= DERIVATIVE_TOLERANCE;
    return {
      kind,
      method: 'numeric',
      passed,
      maxError,
      samples,
      summary: passed
        ? `${kind === 'derivative' ? '求导' : '积分'}数值验证通过（${samples} 个采样点，最大相对误差 ${maxError.toExponential(2)}）`
        : `${kind === 'derivative' ? '求导' : '积分'}数值验证失败：最大相对误差 ${maxError.toExponential(2)} 超过阈值 ${DERIVATIVE_TOLERANCE}`,
    };
  }

  private simpson(f: (x: number) => number, a: number, b: number, n: number): number {
    const steps = n % 2 === 0 ? n : n + 1;
    const h = (b - a) / steps;
    let sum = f(a) + f(b);
    for (let i = 1; i < steps; i++) {
      const value = f(a + i * h);
      if (!Number.isFinite(value)) return NaN;
      sum += (i % 2 === 0 ? 2 : 4) * value;
    }
    return (sum * h) / 3;
  }

  private buildResidualEvaluator(
    equation: string,
    variable: string,
  ): ((x: number) => number) | null {
    const normalized = equation.replace(/[−–]/g, '-');
    const parts = normalized.split('=');
    if (parts.length < 2) {
      return compileEvaluator(normalized, variable);
    }
    const lhs = parts[0];
    const rhs = parts[1];
    return compileEvaluator(`(${lhs}) - (${rhs})`, variable);
  }

  private residualScale(equation: string, value: number, variable: string): number {
    // 用方程两边的数量级避免“大数方程”误判；取至少 1
    const normalized = equation.replace(/[−–]/g, '-');
    const parts = normalized.split('=');
    if (parts.length < 2) return 1;
    const left = compileEvaluator(parts[0], variable);
    const right = compileEvaluator(parts[1], variable);
    const l = left ? Math.abs(left(value)) : 0;
    const r = right ? Math.abs(right(value)) : 0;
    return Math.max(1, Math.max(Number.isFinite(l) ? l : 0, Number.isFinite(r) ? r : 0));
  }

  /** 从一条答案里抽出所有可验证的数值解（`±2` → 2 与 -2） */
  private extractSolutionValues(
    solution: string,
    variable: string,
  ): Array<{ label: string; value: number }> {
    const pieces = solution
      .split(/[，,;；]|\s+(?:或|and)\s+/)
      .map((p) => p.replace(/^\s*[a-zA-Z](?:_\{?\d+\}?)?\s*=\s*/, '').trim())
      .filter(Boolean);
    const values: Array<{ label: string; value: number }> = [];
    for (const piece of pieces) {
      const hasPlusMinus = piece.includes('±') || piece.includes('+-');
      if (hasPlusMinus) {
        const bare = piece.replace(/^[+-]\s*/, '').replace(/[±]|\+\-/g, '');
        for (const sign of [1, -1]) {
          const value = this.evaluateConstant(`(${sign < 0 ? '-' : ''}(${bare}))`);
          if (value !== null && Number.isFinite(value)) {
            values.push({ label: `${sign < 0 ? '-' : ''}${bare}`, value });
          }
        }
        continue;
      }
      const value = this.evaluateConstant(piece);
      if (value !== null && Number.isFinite(value)) {
        values.push({ label: piece, value });
      }
    }
    return values;
  }

  private evaluateConstant(expr: string): number | null {
    if (!expr) return null;
    const normalized = expr.trim().replace(/^[+]/, '');
    if (/^(oo|\+?∞|inf(inity)?)$/i.test(normalized)) return Infinity;
    if (/^[-−](oo|∞|inf(inity)?)$/i.test(normalized)) return -Infinity;
    const evaluator = compileEvaluator(normalized, 'x');
    if (!evaluator) return null;
    const value = evaluator(0);
    return Number.isFinite(value) ? value : null;
  }

  /** 从题面里抓取被操作表达式（尽力而为） */
  private extractExpression(problem: string): string | null {
    const limit = problem.match(/lim\s*_{?[^)]*}?\s*\(?([^,)\n]+)[,)]/);
    if (limit) return limit[1].trim();
    const integral = problem.match(/∫\s*_?\{?([^}^\s]*)\}?\^?\{?([^}^\s]*)\}?\s*([^\s]+)\s*d[a-zA-Z]/);
    if (integral) return integral[3].trim();
    const derivative = problem.match(/d\/d[a-zA-Z]\s*\(\s*([^)]+)\s*\)/);
    if (derivative) return derivative[1].trim();
    // 注意用贪婪匹配：惰性匹配会把 `sin(x)` 的右括号当成可选括号吞掉，得到 `sin(x`
    const fraction = problem.match(/[（(]?\s*([0-9a-zA-Z^*+\-/.\s()√²³]+)\s*[）)]?\s*(?:求导|的导数|求极限|求积分)/);
    if (fraction) return fraction[1].trim();
    return null;
  }

  private stripIntegrationConstant(expr: string): string {
    return expr
      .replace(/[+\-]\s*C(?:_?\s*\{?\s*\d+\s*\}?|[₀-₉])?\s*$/i, '')
      .replace(/[+\-]\s*C\s*$/i, '')
      .trim();
  }

  private unknown(kind: VerificationKind, summary: string): VerificationCheck {
    return { kind, method: 'numeric', passed: false, summary };
  }

  private confidenceOf(checks: VerificationCheck[]): number {
    if (checks.length === 0) return 0;
    const symbolic = checks.filter((c) => c.method === 'symbolic').length;
    if (symbolic === checks.length) return 1;
    const passed = checks.filter((c) => c.passed).length;
    return passed === checks.length ? 0.85 : 0.5;
  }
}
