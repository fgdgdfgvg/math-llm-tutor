/**
 * 数学内容展示工具：统一题面里的“答案/步骤”呈现方式。
 */

/** 已经带公式定界符的答案，直接交给渲染器 */
const HAS_DELIMITER = /\$/;
/** LaTeX 命令，如 \\frac、\\sqrt、\\lim */
const LATEX_COMMAND = /\\[a-zA-Z]+/;
/** 数学记号：上标、下标、分式、比较符、极限算子等 */
const MATH_HINT = /[\^_=≤≥≠≈∞√×÷π∑∫Δ]|(?:\d+\s*\/\s*\d+)|\blim\b/i;
/** 只有数学符号 + 数字 + 常见变量，没有中文/英文句子时才当公式渲染 */
const MATH_ONLY = /^[\d\sA-Za-z\\.\{\}^_+\-*/()\[\],=<>≤≥≠≈∞√×÷π∑∫Δ|·'′;:\u2080-\u2089]+$/;

/**
 * 答案展示：把裸 LaTeX（后端 /agents/solve 返回的 3x^{2}、\frac{x^{3}}{3} 这类）
 * 补上行内公式定界符 $...$，否则 Markdown 会把花括号当纯文本、把 \f 当转义字符。
 * 纯文本答案则转义 Markdown 元字符，避免 3*x**2 被当成强调渲染成 “3x*2”。
 */
export const formatAnswerText = (answer: unknown): string => {
  const text = (answer ?? '').toString().trim();
  if (!text) return '';
  if (HAS_DELIMITER.test(text)) return text;

  const normalized = text.replace(/\*\*/g, '^');
  const looksLikeMath =
    (LATEX_COMMAND.test(normalized) || MATH_HINT.test(normalized)) && MATH_ONLY.test(normalized);
  if (looksLikeMath) return `$${normalized}$`;

  return text.replace(/([*_`~[\]])/g, '\\$1');
};

export interface ParsedSolutionStep {
  /** 步骤序号（能解析出就用题面里的序号） */
  index: number;
  /** 步骤小标题（如“直接代入验证”），可能为空 */
  title: string;
  /** 步骤正文（可能含 LaTeX） */
  body: string;
}

/**
 * 匹配题库里出现过的步骤前缀写法：
 * “步骤1：”“第 1 步。”“（1）”“1、”“1. ”
 * 只认整数序号，且 “1.” 后面必须跟空白，避免把 “1.5 倍” 当成序号。
 */
const STEP_PREFIX_PATTERNS: RegExp[] = [
  /^\s*步骤\s*(\d+)\s*[：:、.．)）]?\s*/,
  /^\s*第\s*(\d+)\s*步\s*[：:、.．)）]?\s*/,
  /^\s*[（(]\s*(\d+)\s*[）)]\s*[：:、.．]?\s*/,
  /^\s*(\d+)\s*([：:、)）]|\.\s)\s*/,
];

/**
 * 把题库里的步骤文本拆成「序号 + 小标题 + 正文」。
 * 题库常见写法：“步骤1：直接代入验证。当 $x=2$ 时……”，
 * 直接整段显示会出现“步骤 1”和“步骤1：”重复编号，也不利于扫读。
 */
export const parseSolutionStep = (raw: string, fallbackIndex: number): ParsedSolutionStep => {
  const text = (raw ?? '').toString().trim();
  if (!text) {
    return { index: fallbackIndex, title: '', body: '' };
  }

  let index = fallbackIndex;
  let rest = text;

  for (const pattern of STEP_PREFIX_PATTERNS) {
    const prefixMatch = text.match(pattern);
    if (!prefixMatch) continue;
    const parsed = Number(prefixMatch[1]);
    if (Number.isFinite(parsed) && parsed > 0 && parsed < 200) {
      index = parsed;
    }
    rest = text.slice(prefixMatch[0].length).trim();
    break;
  }

  // 首句作为小标题：“直接代入验证。当 x=2 时……” → 标题 + 正文
  const titleMatch = rest.match(/^([^。；;！？\n]{2,18})[。；;]\s*/);
  if (titleMatch) {
    const title = titleMatch[1].trim();
    // 公式不充当标题
    if (!title.includes('$') && !/\\[a-zA-Z]/.test(title)) {
      return { index, title, body: rest.slice(titleMatch[0].length).trim() };
    }
  }

  return { index, title: '', body: rest };
};
