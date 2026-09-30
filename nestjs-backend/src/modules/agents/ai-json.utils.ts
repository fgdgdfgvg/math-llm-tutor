/**
 * AI 返回内容的 JSON 提取与解析工具。
 *
 * 背景：智能体的 AI 输出经常不是纯 JSON——常见形态有：
 *   1. 包在 markdown 代码块里（```json ... ```）
 *   2. 前后夹杂说明文字
 *   3. 照抄提示词模板里的占位值（如 "accuracy": 0-1，这是非法 JSON）
 *   4. 末尾多一个逗号 / 使用单引号 / 中文引号
 * 以前的 `content.match(/\{[\s\S]*\}/)` + JSON.parse 遇到以上任一情况就整段失败，
 * 调用方只能静默降级到规则引擎，AI 的判断完全被浪费。
 *
 * 策略按成本递增依次尝试，任何一步成功即返回：
 *   a. 剥掉代码围栏后直接 parse
 *   b. 扫描所有「括号配平」的候选子串逐个 parse（选结构得分最高的）
 *   c. 常见语法修复（0-1 → 0.5、尾逗号、中文引号、单引号键）后再 parse
 *   d. 仍失败返回 null，由调用方决定降级策略
 */

/** 给候选 JSON 打分：键越像预期字段名、结构越完整，越可能是真正的结果对象 */
function scoreCandidate(text: string): number {
  let score = 0;
  // 常见智能体输出字段
  const knownKeys = [
    'accuracy', 'completeness', 'clarity', 'suggestions', 'improvements', 'rating',
    'isValid', 'errorMessage', 'confidence', 'stepTitle', 'keyPoint', 'formula',
    'result', 'process', 'highlight', 'final_answer', 'problemType', 'keyConditions',
    'macroStrategy', 'steps', 'estimatedDifficulty',
  ];
  for (const key of knownKeys) {
    if (text.includes(`"${key}"`)) score += 2;
  }
  // 嵌套深度适度（数组/对象）通常是完整结构
  const opens = (text.match(/[{[]/g) || []).length;
  const closes = (text.match(/[}\]]/g) || []).length;
  if (opens > 0 && opens === closes) score += 3;
  // 越长越可能是完整对象（但不是决定性因素）
  score += Math.min(text.length / 100, 5);
  return score;
}

/** 剥掉 markdown 代码围栏与首尾多余说明 */
function stripCodeFence(content: string): string {
  return content
    .replace(/```(?:json|JSON)?\s*/g, '')
    .replace(/```/g, '')
    .trim();
}

/** 扫描所有括号配平的候选子串（考虑字符串内的括号不算结构括号） */
function balancedCandidates(text: string): string[] {
  const candidates: string[] = [];
  const opening = new Set(['{', '[']);
  const closing: Record<string, string> = { '{': '}', '[': ']' };

  for (let start = 0; start < text.length; start++) {
    const openChar = text[start];
    if (!opening.has(openChar)) continue;
    const stack: string[] = [];
    let inString = false;
    let escaped = false;

    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\' && inString) {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;

      if (opening.has(ch)) {
        stack.push(ch);
      } else if (ch === '}' || ch === ']') {
        const expected = closing[stack[stack.length - 1]];
        if (ch !== expected) break; // 括号类型不配对，这个起点作废
        stack.pop();
        if (stack.length === 0) {
          candidates.push(text.slice(start, i + 1));
          break;
        }
      }
    }
  }
  return candidates;
}

/** 常见 AI 语法问题的保守修复：只修确定无害的模式 */
function repairCommonIssues(text: string): string[] {
  const variants: string[] = [];

  // 1. 提示词模板占位值被照抄："accuracy": 0-1 → 合法数值
  //    形如 "key": A-B（A、B 是数字）→ 取中点；"0-1" 这种字符串同理
  let fixed = text.replace(
    /(:\s*)"(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)"(\s*[,}\]])/g,
    (_m, colon, lo, hi, tail) => `${colon}${(Number(lo) + Number(hi)) / 2}${tail}`,
  );
  fixed = fixed.replace(
    /(:\s*)(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)(\s*[,}\]])/g,
    (_m, colon, lo, hi, tail) => `${colon}${(Number(lo) + Number(hi)) / 2}${tail}`,
  );
  if (fixed !== text) variants.push(fixed);

  // 2. 尾逗号（},] 或 ,]）
  fixed = text.replace(/,(\s*[}\]])/g, '$1');
  if (fixed !== text) variants.push(fixed);

  // 3. 中文引号 → 英文引号
  fixed = text.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  if (fixed !== text) variants.push(fixed);

  // 4. 单引号键 → 双引号键（仅在双引号缺失时才需要；保守处理 "{'key': ...}" 形态）
  if (!text.includes('"') && /'[^']+'\s*:/.test(text)) {
    fixed = text.replace(/'([^']+)'\s*:/g, '"$1":');
    variants.push(fixed);
  }

  // 5. 截断的对象：补齐缺失的右括号后尝试（AI 输出被 maxTokens 截断时的最后挣扎）
  const opens = (text.match(/[{[]/g) || []).length;
  const closes = (text.match(/[}\]]/g) || []).length;
  if (opens > closes) {
    let repaired = text.replace(/,\s*$/, ''); // 去掉悬空逗号
    const stack: string[] = [];
    let inString = false;
    let escaped = false;
    for (const ch of repaired) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\' && inString) { escaped = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (!inString) {
        if (ch === '{' || ch === '[') stack.push(ch);
        else if (ch === '}' || ch === ']') stack.pop();
      }
    }
    // 逐层补右括号（内层先补）
    while (stack.length) {
      const open = stack.pop();
      repaired += open === '{' ? '}' : ']';
    }
    variants.push(repaired);
  }

  return variants;
}

/**
 * 从 AI 返回的任意文本中提取第一个可解析的 JSON 对象。
 * 成功返回解析后的对象，失败返回 null（不抛异常）。
 */
export function extractAiJson<T = Record<string, any>>(content: string): T | null {
  if (!content || typeof content !== 'string') return null;

  const cleaned = stripCodeFence(content);

  // a. 直接 parse（含整段就是 JSON 的情况）
  const directAttempts = [cleaned, content.trim()];
  for (const attempt of directAttempts) {
    try {
      const parsed = JSON.parse(attempt);
      if (parsed && typeof parsed === 'object') return parsed as T;
    } catch {
      /* 继续下一策略 */
    }
  }

  // 收集所有候选：括号配平子串 + 整段文本兜底（截断对象没有任何配平子串，
  // 但修复补齐后仍可能可解析）
  const candidates = [...balancedCandidates(cleaned), cleaned];

  // b+c. 每个候选先直接 parse，失败则尝试常见语法修复，全部成功者按得分取最优
  let best: { parsed: any; score: number } | null = null;
  const consider = (candidate: string, bonus = 0) => {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object') {
        const score = scoreCandidate(candidate) + bonus;
        if (!best || score > best.score) best = { parsed, score };
      }
    } catch {
      /* 该候选不合法 */
    }
  };

  for (const candidate of candidates) {
    consider(candidate);
    for (const repaired of repairCommonIssues(candidate)) {
      consider(repaired, 1); // 修复成功略有加分
    }
  }

  return best ? (best as { parsed: any; score: number }).parsed as T : null;
}
