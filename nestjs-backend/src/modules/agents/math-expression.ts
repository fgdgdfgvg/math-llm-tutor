/**
 * 数学表达式引擎：文本 → AST → （精确有理系数）多项式 / 数值求值。
 *
 * 为什么需要它：此前的求解器用正则 + 字符串匹配"猜"表达式，导致
 *   - `parseInt('0.5')` → 0（小数系数被截断）
 *   - `x²+x=0` 的隐式系数 1 被吃掉 → 判别式 NaN
 *   - `(x^2-1)`、`3*x`、`1/2`、Unicode 上标全部解析失败并静默返回 null
 * 这里改为真正的语法分析：
 *   1. `normalizeMathText` 把 LaTeX（\frac、\sqrt、^{}、\sin…）与全角/Unicode
 *      符号折叠成纯 ASCII 算式；
 *   2. `parseMathExpression` 用递归下降构建 AST（支持隐式乘法 `2x`、`3(x+1)`）；
 *   3. `astToPolynomial` 在 AST 上做**精确有理数**多项式运算（BigInt 无需求，
 *      Number 分子/分母配合 gcd 归一化对小规模系数足够且更快）；
 *   4. `evaluateAst` 做数值求值（供等价判定的数值抽样使用）。
 *
 * 全部纯函数、无外部依赖，便于单元测试。
 */

/** 精确分数（分子/分母均为整数，分母恒正且已约分） */
export interface Frac {
  n: number;
  d: number;
}

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a || 1;
}

/** 把有限小数放大为整数分子：0.25 → 1/4，避免浮点系数污染精确结果 */
function decimalToFraction(value: number): Frac {
  if (Number.isInteger(value)) return { n: value, d: 1 };
  for (let scale = 10; scale <= 1e12; scale *= 10) {
    const candidate = value * scale;
    if (Math.abs(candidate - Math.round(candidate)) < 1e-9) {
      return { n: Math.round(candidate), d: scale };
    }
  }
  return { n: value, d: 1 };
}

export function frac(n: number, d = 1): Frac {
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0)
    return { n: NaN, d: 1 };
  if (d < 0) {
    n = -n;
    d = -d;
  }
  if (!Number.isInteger(n)) {
    const scaled = decimalToFraction(n);
    return frac(scaled.n, scaled.d * d);
  }
  if (Number.isInteger(d)) {
    const g = gcd(n, d);
    return { n: n / g, d: d / g };
  }
  if (!Number.isInteger(d)) {
    const scaled = decimalToFraction(d);
    return frac(n * (scaled.d ?? 1), scaled.n);
  }
  return { n, d };
}

export const fAdd = (a: Frac, b: Frac): Frac =>
  frac(a.n * b.d + b.n * a.d, a.d * b.d);
export const fSub = (a: Frac, b: Frac): Frac =>
  frac(a.n * b.d - b.n * a.d, a.d * b.d);
export const fMul = (a: Frac, b: Frac): Frac => frac(a.n * b.n, a.d * b.d);
export const fDiv = (a: Frac, b: Frac): Frac => frac(a.n * b.d, a.d * b.n);

export function fIsZero(a: Frac): boolean {
  if (Number.isNaN(a.n)) return false;
  return Math.abs(a.n) < 1e-12;
}

/** 分数 → 人类可读字符串（保留精确形式，能约分/带整数部分时化简） */
export function fToString(a: Frac): string {
  if (Number.isNaN(a.n)) return 'NaN';
  if (a.n === 0) return '0';
  if (a.d === 1) return String(a.n);
  const sign = a.n < 0 ? '-' : '';
  return `${sign}${Math.abs(a.n)}/${a.d}`;
}

/** 分数 → LaTeX（真分数用 \frac，否则整数） */
export function fToLatex(a: Frac): string {
  if (Number.isNaN(a.n)) return '\\text{NaN}';
  if (a.d === 1 || a.n === 0) return String(a.n);
  const sign = a.n < 0 ? '-' : '';
  return `${sign}\\frac{${Math.abs(a.n)}}{${a.d}}`;
}

export const fToNumber = (a: Frac): number => a.n / a.d;
export function fEquals(a: Frac, b: Frac): boolean {
  return Math.abs(a.n / a.d - b.n / b.d) < 1e-12;
}

// ============================ 文本归一化 ============================

const SUPERSCRIPT: Record<string, string> = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
};

const FULL_WIDTH: Record<string, string> = {
  '（': '(',
  '）': ')',
  '＋': '+',
  '－': '-',
  '×': '*',
  '÷': '/',
  '＝': '=',
  '，': ',',
  '：': ':',
  '·': '*',
  '−': '-',
  '＾': '^',
  '｛': '{',
  '｝': '}',
  '％': '%',
};

/**
 * 把任意人类写法（含 LaTeX、中文标点、Unicode 上标）折叠为可解析的 ASCII 算式。
 * 只做符号层面的折叠，不做数学上的等价变换——等价判定交给 AST。
 */
export function normalizeMathText(input: string): string {
  if (!input) return '';
  let s = String(input);

  // Unicode 上标：x² → x^2
  s = s.replace(
    /[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g,
    (m) => `^(${[...m].map((c) => SUPERSCRIPT[c]).join('')})`,
  );

  // Python/程序式幂运算符：`3*x**2` 是本地引擎与 SymPy 的输出格式，
  // 不归一化的话等价判定会退化为 unknown（学生写对了却说无法判定）
  s = s.replace(/\*\*/g, '^');

  // 全角与中文标点
  s = s.replace(/[（）＋－×÷＝，：·−＾｛｝％]/g, (c) => FULL_WIDTH[c] ?? c);
  // 反斜杠转义的 LaTeX 运算符
  s = s
    .replace(/\\left|\\right/g, '')
    .replace(/\\cdot|\\times/g, '*')
    .replace(/\\div/g, '/')
    .replace(/\\pi/g, 'pi')
    .replace(/\\infty/g, 'Infinity')
    .replace(/\\pm/g, '±')
    .replace(/\\,/g, ' ');

  // \frac{A}{B} → ((A)/(B))（支持简单嵌套）
  for (let i = 0; i < 20 && s.includes('\\frac'); i++) {
    const next = foldFrac(s);
    if (next === s) break;
    s = next;
  }

  // \sqrt{A} → sqrt(A)
  for (let i = 0; i < 20 && s.includes('\\sqrt'); i++) {
    const next = foldSqrt(s);
    if (next === s) break;
    s = next;
  }

  // 函数名去反斜杠，^{...} → ^(...)，_{...} → 丢弃（下标属命名约定）
  s = s
    .replace(
      /\\(sin|cos|tan|cot|sec|csc|arcsin|arccos|arctan|sinh|cosh|tanh|ln|log|exp|max|min)\b/g,
      '$1',
    )
    .replace(/\^\{([^{}]*)\}/g, '^($1)')
    .replace(/_\{([^{}]*)\}/g, '')
    .replace(/_([0-9A-Za-z])/g, '$1');

  // e^{x} / e^x → exp(x)（避免把 e 当成普通变量）
  s = s.replace(/\be\s*\^\s*\(([^()]*)\)/g, 'exp($1)');
  s = s.replace(/\be\s*\^\s*([0-9A-Za-z.]+)/g, 'exp($1)');

  return s;
}

function readGroup(
  s: string,
  start: number,
): { content: string; end: number } | null {
  if (s[start] !== '{') return null;
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}') {
      depth--;
      if (depth === 0) return { content: s.slice(start + 1, i), end: i + 1 };
    }
  }
  return null;
}

/** 把第一处 \frac{A}{B} 折叠成 ((A)/(B)) */
function foldFrac(s: string): string {
  const at = s.indexOf('\\frac');
  if (at < 0) return s;
  const num = readGroup(s, at + 5);
  if (!num) return s.replace('\\frac', '');
  const den = readGroup(s, num.end);
  if (!den) return s.replace('\\frac', '');
  return `${s.slice(0, at)}((${num.content})/(${den.content}))${s.slice(den.end)}`;
}

/** 把第一处 \sqrt{A} 折叠成 sqrt(A) */
function foldSqrt(s: string): string {
  const at = s.indexOf('\\sqrt');
  if (at < 0) return s;
  const group = readGroup(s, at + 5);
  if (group)
    return `${s.slice(0, at)}sqrt(${group.content})${s.slice(group.end)}`;
  // \sqrt3 / \sqrt x
  const m = s.slice(at + 5).match(/^([0-9A-Za-z.]+)/);
  if (m)
    return `${s.slice(0, at)}sqrt(${m[1]})${s.slice(at + 5 + m[1].length)}`;
  return s.replace('\\sqrt', 'sqrt');
}

// ============================ 词法与语法分析 ============================

export type MathNode =
  | { t: 'num'; v: Frac }
  | { t: 'var'; name: string }
  | { t: 'add'; a: MathNode; b: MathNode }
  | { t: 'sub'; a: MathNode; b: MathNode }
  | { t: 'mul'; a: MathNode; b: MathNode }
  | { t: 'div'; a: MathNode; b: MathNode }
  | { t: 'neg'; a: MathNode }
  | { t: 'pow'; a: MathNode; b: MathNode }
  | { t: 'fn'; name: string; arg: MathNode };

type Token =
  | { k: 'num'; v: number }
  | { k: 'ident'; v: string }
  | { k: 'op'; v: string };

const SUPPORTED_FUNCTIONS = new Set([
  'sin',
  'cos',
  'tan',
  'cot',
  'sec',
  'csc',
  'arcsin',
  'arccos',
  'arctan',
  'asin',
  'acos',
  'atan',
  'sinh',
  'cosh',
  'tanh',
  'ln',
  'log',
  'log10',
  'exp',
  'sqrt',
  'abs',
]);

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\n') {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      const raw = src.slice(i, j);
      const value = Number(raw);
      if (!Number.isFinite(value)) throw new Error(`无法解析数字: ${raw}`);
      tokens.push({ k: 'num', v: value });
      i = j;
      continue;
    }
    if (/[A-Za-z]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9]/.test(src[j])) j++;
      tokens.push({ k: 'ident', v: src.slice(i, j) });
      i = j;
      continue;
    }
    if ('+-*/^()[]{}|'.includes(c)) {
      // 中括号统一当圆括号，绝对值符号 | 也当括号（简化处理）
      const normalized =
        c === '[' || c === '{' || c === '|'
          ? '('
          : c === ']' || c === '}'
            ? ')'
            : c;
      tokens.push({ k: 'op', v: normalized });
      i++;
      continue;
    }
    throw new Error(`无法识别的字符: ${c}`);
  }
  return tokens;
}

class Parser {
  private pos = 0;

  constructor(private readonly tokens: Token[]) {}

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private eatOp(op: string): boolean {
    const t = this.peek();
    if (t && t.k === 'op' && t.v === op) {
      this.pos++;
      return true;
    }
    return false;
  }

  parse(): MathNode {
    const node = this.parseAdditive();
    if (this.pos < this.tokens.length) {
      throw new Error('表达式末尾存在多余符号');
    }
    return node;
  }

  private parseAdditive(): MathNode {
    let left = this.parseMultiplicative();
    for (;;) {
      if (this.eatOp('+'))
        left = { t: 'add', a: left, b: this.parseMultiplicative() };
      else if (this.eatOp('-'))
        left = { t: 'sub', a: left, b: this.parseMultiplicative() };
      else return left;
    }
  }

  private parseMultiplicative(): MathNode {
    let left = this.parseUnary();
    for (;;) {
      if (this.eatOp('*')) {
        left = { t: 'mul', a: left, b: this.parseUnary() };
        continue;
      }
      if (this.eatOp('/')) {
        left = { t: 'div', a: left, b: this.parseUnary() };
        continue;
      }
      // 隐式乘法：2x、3(x+1)、x sin(x)、2π
      const t = this.peek();
      if (
        t &&
        (t.k === 'num' || t.k === 'ident' || (t.k === 'op' && t.v === '('))
      ) {
        left = { t: 'mul', a: left, b: this.parseUnary() };
        continue;
      }
      return left;
    }
  }

  private parseUnary(): MathNode {
    if (this.eatOp('-')) return { t: 'neg', a: this.parseUnary() };
    if (this.eatOp('+')) return this.parseUnary();
    return this.parsePower();
  }

  private parsePower(): MathNode {
    const base = this.parsePrimary();
    if (this.eatOp('^')) {
      // 右结合：a^b^c = a^(b^c)
      return { t: 'pow', a: base, b: this.parseUnary() };
    }
    return base;
  }

  private parsePrimary(): MathNode {
    const t = this.peek();
    if (!t) throw new Error('表达式不完整');

    if (t.k === 'num') {
      this.pos++;
      return { t: 'num', v: frac(t.v) };
    }

    if (t.k === 'op' && t.v === '(') {
      this.pos++;
      const inner = this.parseAdditive();
      if (!this.eatOp(')')) throw new Error('括号不匹配');
      return inner;
    }

    if (t.k === 'ident') {
      this.pos++;
      const name = t.v.toLowerCase();
      const isFunctionCall =
        !!this.peek() &&
        this.peek()!.k === 'op' &&
        (this.peek() as any).v === '(';

      if (SUPPORTED_FUNCTIONS.has(name) && isFunctionCall) {
        this.pos++; // 吃掉 '('
        const arg = this.parseAdditive();
        if (!this.eatOp(')')) throw new Error(`函数 ${name} 的括号不匹配`);
        return { t: 'fn', name, arg };
      }
      if (SUPPORTED_FUNCTIONS.has(name)) {
        // 无括号函数调用：sin x、ln x（这里只接受单个 primary 作为参数）
        const arg = this.parseUnary();
        return { t: 'fn', name, arg };
      }
      if (name === 'pi') return { t: 'var', name: 'pi' };
      if (name === 'infinity' || name === 'inf')
        return { t: 'var', name: 'infinity' };
      if (name === 'e') return { t: 'var', name: 'e' };
      return { t: 'var', name };
    }

    throw new Error('表达式结构无法识别');
  }
}

/**
 * 解析数学表达式为 AST。
 * @param input 原始文本（可含 LaTeX、Unicode 上标、中文标点）
 * @returns AST；解析失败返回 null（调用方据此标记 unsolved，而不是猜答案）
 */
export function parseMathExpression(input: string): MathNode | null {
  if (!input || !String(input).trim()) return null;
  const normalized = normalizeMathText(input);
  try {
    return new Parser(tokenize(normalized)).parse();
  } catch {
    return null;
  }
}

// ============================ 多项式（精确有理系数） ============================

/** 多项式：索引 i 为 x^i 的系数；空数组表示零多项式 */
export type Polynomial = Frac[];
export const ZERO_POLY: Polynomial = [];

export function polyDegree(p: Polynomial): number {
  for (let i = p.length - 1; i >= 0; i--) {
    if (!fIsZero(p[i])) return i;
  }
  return -1;
}

export function polyAdd(a: Polynomial, b: Polynomial): Polynomial {
  const out: Polynomial = [];
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    out[i] = fAdd(a[i] ?? frac(0), b[i] ?? frac(0));
  }
  return trimPoly(out);
}

export function polySub(a: Polynomial, b: Polynomial): Polynomial {
  const out: Polynomial = [];
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    out[i] = fSub(a[i] ?? frac(0), b[i] ?? frac(0));
  }
  return trimPoly(out);
}

export function polyMul(a: Polynomial, b: Polynomial): Polynomial {
  const out: Polynomial = new Array(a.length + b.length).fill(frac(0));
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      out[i + j] = fAdd(out[i + j], fMul(a[i], b[j]));
    }
  }
  return trimPoly(out);
}

export function polyScale(a: Polynomial, k: Frac): Polynomial {
  return trimPoly(a.map((c) => fMul(c, k)));
}

export function polyDerivative(p: Polynomial): Polynomial {
  if (p.length <= 1) return [];
  const out: Polynomial = [];
  for (let i = 1; i < p.length; i++) out.push(fMul(p[i], frac(i)));
  return trimPoly(out);
}

export function polyIntegral(p: Polynomial): Polynomial {
  const out: Polynomial = [frac(0)];
  for (let i = 0; i < p.length; i++) out.push(fDiv(p[i], frac(i + 1)));
  return trimPoly(out);
}

/** 多项式转 LaTeX 片段，例如 (1/3)x^3 + 2x - 1 */
export function polyToLatex(p: Polynomial, variable = 'x'): string {
  const deg = polyDegree(p);
  if (deg < 0) return '0';
  const parts: string[] = [];
  for (let i = deg; i >= 0; i--) {
    const c = p[i];
    if (!c || fIsZero(c)) continue;
    const negative = c.n < 0;
    const abs: Frac = negative ? { n: -c.n, d: c.d } : c;
    let body: string;
    if (i === 0) body = fToLatex(abs);
    else {
      const power = i === 1 ? variable : `${variable}^{${i}}`;
      body = abs.n === 1 && abs.d === 1 ? power : `${fToLatex(abs)}${power}`;
    }
    if (parts.length === 0) {
      parts.push(negative ? `-${body}` : body);
    } else {
      // 乘法内联（\frac{1}{3}x^{3}），加减号两侧留空格，符合教材排版
      parts.push(negative ? `- ${body}` : `+ ${body}`);
    }
  }
  return parts.join(' ');
}

function trimPoly(p: Polynomial): Polynomial {
  const out = [...p];
  while (out.length && fIsZero(out[out.length - 1])) out.pop();
  return out;
}

/**
 * AST → 多项式。仅接受能写成"有理系数一元多项式"的表达式：
 * 变量只允许 `variable`，幂次必须是非负整数，除数必须是常数，
 * 函数参数必须是与变量无关的常量（如 sin(0)）。其余情况返回 null——绝不猜。
 */
export function astToPolynomial(
  node: MathNode,
  variable = 'x',
): Polynomial | null {
  switch (node.t) {
    case 'num':
      return [node.v];
    case 'var':
      if (node.name === variable) return [frac(0), frac(1)];
      return null;
    case 'add': {
      const a = astToPolynomial(node.a, variable);
      const b = astToPolynomial(node.b, variable);
      return a && b ? polyAdd(a, b) : null;
    }
    case 'sub': {
      const a = astToPolynomial(node.a, variable);
      const b = astToPolynomial(node.b, variable);
      return a && b ? polySub(a, b) : null;
    }
    case 'neg': {
      const a = astToPolynomial(node.a, variable);
      return a ? polyScale(a, frac(-1)) : null;
    }
    case 'mul': {
      const a = astToPolynomial(node.a, variable);
      const b = astToPolynomial(node.b, variable);
      return a && b ? polyMul(a, b) : null;
    }
    case 'div': {
      const a = astToPolynomial(node.a, variable);
      const b = astToPolynomial(node.b, variable);
      if (!a || !b) return null;
      if (polyDegree(b) > 0) return null; // 除以含变量的式子不是多项式
      const k = b[0];
      if (!k || fIsZero(k)) return null;
      return polyScale(a, fDiv(frac(1), k));
    }
    case 'pow': {
      const base = astToPolynomial(node.a, variable);
      if (!base) return null;
      const constantExponent = astToPolynomial(node.b, variable);
      if (!constantExponent || polyDegree(constantExponent) > 0) return null;
      const expValue = fToNumber(constantExponent[0]);
      if (!Number.isInteger(expValue) || expValue < 0 || expValue > 64)
        return null;
      let acc: Polynomial = [frac(1)];
      for (let i = 0; i < expValue; i++) acc = polyMul(acc, base);
      return acc;
    }
    default:
      return null;
  }
}

/** 直接把文本解析成多项式；不成功返回 null */
export function parsePolynomialExact(
  input: string,
  variable = 'x',
): Polynomial | null {
  const ast = parseMathExpression(input);
  if (!ast) return null;
  return astToPolynomial(ast, variable);
}

// ============================ 数值求值 ============================

const FUNCS: Record<string, (v: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  cot: (v) => 1 / Math.tan(v),
  sec: (v) => 1 / Math.cos(v),
  csc: (v) => 1 / Math.sin(v),
  arcsin: Math.asin,
  asin: Math.asin,
  arccos: Math.acos,
  acos: Math.acos,
  arctan: Math.atan,
  atan: Math.atan,
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  ln: Math.log,
  log: Math.log,
  log10: Math.log10,
  exp: Math.exp,
  sqrt: Math.sqrt,
  abs: Math.abs,
};

/** AST 数值求值；遇到无法求值的情况返回 NaN */
export function evaluateAst(node: MathNode, x: number, variable = 'x'): number {
  switch (node.t) {
    case 'num':
      return fToNumber(node.v);
    case 'var': {
      if (node.name === variable) return x;
      if (node.name === 'pi') return Math.PI;
      if (node.name === 'e') return Math.E;
      if (node.name === 'infinity') return Infinity;
      return NaN;
    }
    case 'add':
      return (
        evaluateAst(node.a, x, variable) + evaluateAst(node.b, x, variable)
      );
    case 'sub':
      return (
        evaluateAst(node.a, x, variable) - evaluateAst(node.b, x, variable)
      );
    case 'mul':
      return (
        evaluateAst(node.a, x, variable) * evaluateAst(node.b, x, variable)
      );
    case 'div':
      return (
        evaluateAst(node.a, x, variable) / evaluateAst(node.b, x, variable)
      );
    case 'neg':
      return -evaluateAst(node.a, x, variable);
    case 'pow':
      return Math.pow(
        evaluateAst(node.a, x, variable),
        evaluateAst(node.b, x, variable),
      );
    case 'fn': {
      const fn = FUNCS[node.name];
      if (!fn) return NaN;
      return fn(evaluateAst(node.arg, x, variable));
    }
    default:
      return NaN;
  }
}

/** 把文本编译成数值函数；失败返回 null */
export function compileEvaluator(
  input: string,
  variable = 'x',
): ((x: number) => number) | null {
  const ast = parseMathExpression(input);
  if (!ast) return null;
  return (x: number) => evaluateAst(ast, x, variable);
}

// ============================ 方程求解（精确） ============================

export interface EquationRoot {
  /** 精确根（判别式为完全平方时） */
  exact?: Frac;
  /** 根式/复数形式的展示文本 */
  latex: string;
  /** 数值近似 */
  numeric: number;
}

export type EquationSolution =
  | { kind: 'identity' } // 恒等式：无穷多解
  | { kind: 'none' } // 无解
  | { kind: 'roots'; roots: EquationRoot[]; degree: number }
  | { kind: 'unsolved'; reason: string };

function integerSqrt(value: number): number | null {
  if (value < 0 || !Number.isInteger(value)) return null;
  const r = Math.round(Math.sqrt(value));
  return r * r === value ? r : null;
}

/** 解一元多项式方程 p(x) = 0，仅支持 1、2 次（更高次返回 unsolved） */
export function solvePolynomialEquation(p: Polynomial): EquationSolution {
  const degree = polyDegree(p);
  if (degree < 0) return { kind: 'identity' };
  if (degree === 0) return { kind: 'none' };

  if (degree === 1) {
    const root = fDiv({ n: -p[0].n, d: p[0].d }, p[1]);
    return {
      kind: 'roots',
      degree: 1,
      roots: [
        {
          exact: root,
          latex: `x = ${fToLatex(root)}`,
          numeric: fToNumber(root),
        },
      ],
    };
  }

  if (degree === 2) {
    const a = p[2];
    const b = p[1] ?? frac(0);
    const c = p[0] ?? frac(0);
    // Δ = b² - 4ac，用精确分数计算
    const disc = fSub(fMul(b, b), fMul(frac(4), fMul(a, c)));
    const discNum = fToNumber(disc);

    if (discNum < 0) {
      const real = fDiv({ n: -b.n, d: b.d }, fMul(frac(2), a));
      const imagNum = Math.sqrt(-discNum);
      const imag = fDiv(
        { n: Math.round(imagNum * 1e6), d: 1e6 },
        fMul(frac(2), a),
      );
      return {
        kind: 'roots',
        degree: 2,
        roots: [
          {
            latex: `x = ${fToLatex(real)} \\pm ${fToLatex(imag)}i`,
            numeric: NaN,
          },
        ],
      };
    }

    if (fIsZero(disc)) {
      const root = fDiv({ n: -b.n, d: b.d }, fMul(frac(2), a));
      return {
        kind: 'roots',
        degree: 2,
        roots: [
          {
            exact: root,
            latex: `x = ${fToLatex(root)}（二重根）`,
            numeric: fToNumber(root),
          },
        ],
      };
    }

    // 判别式为完全平方 → 精确有理根；否则保留根式精确形式
    const perfectSquare = Number.isInteger(discNum)
      ? integerSqrt(discNum)
      : null;
    const twoA = fMul(frac(2), a);
    if (perfectSquare !== null) {
      const r1 = fDiv(fAdd({ n: -b.n, d: b.d }, frac(perfectSquare)), twoA);
      const r2 = fDiv(fSub({ n: -b.n, d: b.d }, frac(perfectSquare)), twoA);
      return {
        kind: 'roots',
        degree: 2,
        roots: [
          { exact: r1, latex: `x_1 = ${fToLatex(r1)}`, numeric: fToNumber(r1) },
          { exact: r2, latex: `x_2 = ${fToLatex(r2)}`, numeric: fToNumber(r2) },
        ],
      };
    }

    const sqrtLatex = `\\sqrt{${fToLatex(disc)}}`;
    const minusB = fToLatex({ n: -b.n, d: b.d });
    const denom = fToLatex(twoA);
    const n1 = (-b.n / b.d + Math.sqrt(discNum)) / (2 * fToNumber(a));
    const n2 = (-b.n / b.d - Math.sqrt(discNum)) / (2 * fToNumber(a));
    return {
      kind: 'roots',
      degree: 2,
      roots: [
        {
          latex: `x_1 = \\frac{${minusB} + ${sqrtLatex}}{${denom}}`,
          numeric: n1,
        },
        {
          latex: `x_2 = \\frac{${minusB} - ${sqrtLatex}}{${denom}}`,
          numeric: n2,
        },
      ],
    };
  }

  return {
    kind: 'unsolved',
    reason: `本地规则引擎仅支持一次/二次方程（本题为 ${degree} 次）`,
  };
}

/**
 * 把"左边 = 右边"形式的方程移项成 p(x) = 0 并求解。
 * 支持小数系数、隐式系数 1、Unicode 上标、LaTeX 分数、括号展开。
 */
export function solveEquationString(
  input: string,
): EquationSolution & { moved?: string } {
  const normalized = normalizeMathText(input);
  const parts = normalized.split('=');
  if (parts.length < 2)
    return { kind: 'unsolved', reason: '未找到等号，无法作为方程求解' };
  // 支持连等号 A = B = C 时只取前两段
  const lhsAst = parseMathExpression(parts[0]);
  const rhsAst = parseMathExpression(parts.slice(1).join('='));

  // 右侧含变量时，用"差值多项式"求解，无需手写移项
  const lhsPoly = astToPolynomial(
    lhsAst ?? ({ t: 'num', v: frac(0) } as MathNode),
  );
  const rhsPoly = astToPolynomial(
    rhsAst ?? ({ t: 'num', v: frac(0) } as MathNode),
  );
  if (!lhsPoly || !rhsPoly) {
    return {
      kind: 'unsolved',
      reason: '表达式中含非多项式成分（三角函数/分式/根式等）',
    };
  }
  const moved = polySub(lhsPoly, rhsPoly);
  const solution = solvePolynomialEquation(moved);
  return { ...solution, moved: polyToLatex(moved) };
}
