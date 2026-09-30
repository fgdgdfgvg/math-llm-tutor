/**
 * markdown-it 的 KaTeX 数学插件（本地实现）
 *
 * 背景：项目原来用 npm 上的 markdown-it-katex@2.0.3，它的依赖声明是 katex@^0.6.0，
 * npm 会把 0.6.0 装进 markdown-it-katex/node_modules 并被优先解析。
 * 那是 2017 年的版本，题库里大量出现的 \dots、\dfrac、\text、\operatorname 等
 * 命令都不支持（例如「1^2+2^2+\dots+n^2」会直接渲染成红色的 \dots），
 * 排版细节也与现代 KaTeX 差别很大。
 *
 * 这里按 markdown-it-katex 的规则（MIT）重写，渲染改由项目自身的 katex@0.16 完成，
 * 保证全站公式（题目、答案、解题步骤）用的是同一个现代渲染器。
 */
import katex from 'katex';

export interface KatexPluginOptions {
  throwOnError?: boolean;
  strict?: boolean;
  errorColor?: string;
  macros?: Record<string, string>;
  [key: string]: unknown;
}

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** 判断 $ 是否可以作为公式起止符（与 markdown-it-katex 保持一致） */
const isValidDelim = (state: any, pos: number) => {
  const max = state.posMax;
  const prevChar = pos > 0 ? state.src.charCodeAt(pos - 1) : -1;
  const nextChar = pos + 1 <= max ? state.src.charCodeAt(pos + 1) : -1;

  let canOpen = true;
  let canClose = true;

  if (prevChar === 0x20 || prevChar === 0x09 || (nextChar >= 0x30 && nextChar <= 0x39)) {
    canClose = false;
  }
  if (nextChar === 0x20 || nextChar === 0x09) {
    canOpen = false;
  }

  return { canOpen, canClose };
};

/** 行内公式 $...$ */
const mathInline = (state: any, silent: boolean): boolean => {
  if (state.src[state.pos] !== '$') return false;

  let res = isValidDelim(state, state.pos);
  if (!res.canOpen) {
    if (!silent) state.pending += '$';
    state.pos += 1;
    return true;
  }

  const start = state.pos + 1;
  let match = start;
  while ((match = state.src.indexOf('$', match)) !== -1) {
    let pos = match - 1;
    while (state.src[pos] === '\\') pos -= 1;
    if ((match - pos) % 2 === 1) break;
    match += 1;
  }

  if (match === -1) {
    if (!silent) state.pending += '$';
    state.pos = start;
    return true;
  }

  if (match - start === 0) {
    if (!silent) state.pending += '$$';
    state.pos = start + 1;
    return true;
  }

  res = isValidDelim(state, match);
  if (!res.canClose) {
    if (!silent) state.pending += '$';
    state.pos = start;
    return true;
  }

  const token = state.push('math_inline', 'math', 0);
  token.markup = '$';
  token.content = state.src.slice(start, match);

  state.pos = match + 1;
  return true;
};

/** 块级公式 $$...$$ */
const mathBlock = (state: any, start: number, end: number, silent: boolean): boolean => {
  let pos = state.bMarks[start] + state.tShift[start];
  let max = state.eMarks[start];

  if (pos + 2 > max) return false;
  if (state.src.slice(pos, pos + 2) !== '$$') return false;

  pos += 2;
  let firstLine = state.src.slice(pos, max);
  let found = false;

  if (silent) return true;
  if (firstLine.trim().slice(-2) === '$$') {
    firstLine = firstLine.trim().slice(0, -2);
    found = true;
  }

  let next = start;
  let lastLine = '';
  while (!found) {
    next += 1;
    if (next >= end) break;

    pos = state.bMarks[next] + state.tShift[next];
    max = state.eMarks[next];

    if (pos < max && state.tShift[next] < state.blkIndent) break;

    if (state.src.slice(pos, max).trim().slice(-2) === '$$') {
      const lastPos = state.src.slice(0, max).lastIndexOf('$$');
      lastLine = state.src.slice(pos, lastPos);
      found = true;
    }
  }

  state.line = next + 1;

  const token = state.push('math_block', 'math', 0);
  token.block = true;
  token.content =
    (firstLine && firstLine.trim() ? `${firstLine}\n` : '') +
    state.getLines(start + 1, next, state.tShift[start], true) +
    (lastLine && lastLine.trim() ? lastLine : '');
  token.map = [start, state.line];
  token.markup = '$$';
  return true;
};

export const markdownItKatex = (md: any, options: KatexPluginOptions = {}): void => {
  const renderKatex = (latex: string, displayMode: boolean): string => {
    try {
      return katex.renderToString(latex, {
        throwOnError: false,
        strict: false,
        ...options,
        displayMode,
      });
    } catch (error) {
      // 极端情况下（例如用户输入了半截公式）保留原文，避免整段内容消失
      const message = error instanceof Error ? error.message : String(error);
      return `<span class="katex-error" title="${escapeHtml(message)}">${escapeHtml(latex)}</span>`;
    }
  };

  md.inline.ruler.after('escape', 'math_inline', mathInline as any);
  md.block.ruler.after('blockquote', 'math_block', mathBlock as any, {
    alt: ['paragraph', 'reference', 'blockquote', 'list'],
  });

  md.renderer.rules.math_inline = (tokens: any[], idx: number) =>
    renderKatex(tokens[idx].content, false);
  md.renderer.rules.math_block = (tokens: any[], idx: number) =>
    `<p>${renderKatex(tokens[idx].content, true)}</p>\n`;
};

export default markdownItKatex;
