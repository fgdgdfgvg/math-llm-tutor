/**
 * LaTeX → SymPy 表达式转换器（针对本基准集题面结构，健壮处理嵌套）。
 * 采用"扫描 + 平衡括号"递归解析 \frac / \sqrt / ^{}，避免正则无法处理嵌套的问题。
 * 转换失败的题由调用方显式标记 unsupported，绝不静默误判。
 */

// 找到从 start 开始、紧跟 '{' 的配对右括号位置（处理嵌套）
function matchBrace(s, start) {
  // start 指向 '{'
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}') { depth--; if (depth === 0) return i; }
  }
  throw new Error('括号不匹配');
}

function latexToSympy(input) {
  let s = input;
  // 去掉 $...$ 包裹
  s = s.replace(/^\$+|\$+$/g, '');

  // 逐字符扫描，处理 \frac \sqrt 和函数幂
  let result = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c !== '\\') { result += c; continue; }

    // 读取命令名（\ + 字母）
    let j = i + 1;
    while (j < s.length && /[a-zA-Z]/.test(s[j])) j++;
    const cmd = s.slice(i, j); // 如 \frac \sin \sqrt \pi \infty \int ...

    switch (cmd) {
      case '\\frac': {
        // \frac{a}{b}
        const b1 = s.indexOf('{', j);
        const e1 = matchBrace(s, b1);
        const b2 = s.indexOf('{', e1 + 1);
        const e2 = matchBrace(s, b2);
        const num = latexToSympy(s.slice(b1 + 1, e1));
        const den = latexToSympy(s.slice(b2 + 1, e2));
        result += `(${num})/(${den})`;
        i = e2;
        break;
      }
      case '\\sqrt': {
        // \sqrt{x} 或 \sqrt[n]{x}
        if (s[j] === '[') {
          const cb = s.indexOf(']', j);
          const b1 = s.indexOf('{', cb);
          const e1 = matchBrace(s, b1);
          const n = latexToSympy(s.slice(j + 1, cb));
          const x = latexToSympy(s.slice(b1 + 1, e1));
          result += `(${x})**(1/(${n}))`;
          i = e1;
        } else {
          const b1 = s.indexOf('{', j);
          const e1 = matchBrace(s, b1);
          const x = latexToSympy(s.slice(b1 + 1, e1));
          result += `sqrt(${x})`;
          i = e1;
        }
        break;
      }
      case '\\sin': case '\\cos': case '\\tan': case '\\cot':
      case '\\sec': case '\\csc': case '\\ln': case '\\log':
      case '\\exp': case '\\arcsin': case '\\arccos': case '\\arctan':
      case '\\sinh': case '\\cosh': case '\\tanh': {
        const fmap = { '\\sin': 'sin', '\\cos': 'cos', '\\tan': 'tan', '\\cot': 'cot',
          '\\sec': 'sec', '\\csc': 'csc', '\\ln': 'log', '\\log': 'log', '\\exp': 'exp',
          '\\arcsin': 'asin', '\\arccos': 'acos', '\\arctan': 'atan',
          '\\sinh': 'sinh', '\\cosh': 'cosh', '\\tanh': 'tanh' };
        const f = fmap[cmd];
        // 判断是否 \sin^{n}（函数幂，优先级高于普通括号参数）
        let k = j;
        if (s[k] === '^' && s[k + 1] === '{') {
          const eb = matchBrace(s, k + 1);
          const n = latexToSympy(s.slice(k + 2, eb));
          // 参数可能是 (x) 或紧跟的单个字母/表达式
          let argStart = eb + 1;
          // 跳过空格
          while (argStart < s.length && /\s/.test(s[argStart])) argStart++;
          let arg;
          if (s[argStart] === '(') {
            // 找配对 )
            let d = 0; let p = argStart;
            for (; p < s.length; p++) { if (s[p]==='(') d++; else if (s[p]===')'){ d--; if(d===0) break; } }
            arg = latexToSympy(s.slice(argStart + 1, p));
            i = p;
          } else {
            arg = s[argStart];
            i = argStart;
          }
          result += `${f}(${arg})**(${n})`;
        } else if (s[k] === '^') {
          // \sin^2 x
          let nEnd = k + 1;
          while (nEnd < s.length && /[0-9]/.test(s[nEnd])) nEnd++;
          const n = s.slice(k + 1, nEnd);
          let argStart = nEnd;
          while (argStart < s.length && /\s/.test(s[argStart])) argStart++;
          let arg;
          if (s[argStart] === '(') {
            let d = 0; let p = argStart;
            for (; p < s.length; p++) { if (s[p]==='(') d++; else if (s[p]===')'){ d--; if(d===0) break; } }
            arg = latexToSympy(s.slice(argStart + 1, p));
            i = p;
          } else {
            arg = s[argStart];
            i = argStart;
          }
          result += `${f}(${arg})**${n}`;
        } else {
          // 普通 \sin(x) 或 \sin x
          let argStart = j;
          while (argStart < s.length && /\s/.test(s[argStart])) argStart++;
          let arg;
          if (s[argStart] === '(') {
            let d = 0; let p = argStart;
            for (; p < s.length; p++) { if (s[p]==='(') d++; else if (s[p]===')'){ d--; if(d===0) break; } }
            arg = latexToSympy(s.slice(argStart + 1, p));
            i = p;
          } else if (s[argStart] === '{') {
            const eb = matchBrace(s, argStart);
            arg = latexToSympy(s.slice(argStart + 1, eb));
            i = eb;
          } else {
            // 单个字母参数
            arg = s[argStart];
            i = argStart;
          }
          result += `${f}(${arg})`;
        }
        break;
      }
      case '\\pi': result += 'pi'; i = j - 1; break;
      case '\\infty': result += 'oo'; i = j - 1; break;
      case '\\cdot': case '\\times': result += '*'; i = j - 1; break;
      case '\\left': case '\\right': case '\\,': case '\\;': case '\\!':
      case '\\quad': case '\\qquad': result += ''; i = j - 1; break;
      case '\\int': result += ''; i = j - 1; break;
      case '\\mathrm': case '\\operatorname': case '\\text': {
        const b1 = s.indexOf('{', j);
        const e1 = matchBrace(s, b1);
        result += s.slice(b1 + 1, e1);
        i = e1;
        break;
      }
      default:
        throw new Error(`未知LaTeX命令: ${cmd}`);
    }
  }

  // 收尾清理
  let out = result;
  out = out.replace(/\^\{([^{}]*)\}/g, (_, x) => `**(${x})`);
  out = out.replace(/\^([a-zA-Z0-9])/g, (_, x) => `**${x}`);
  out = out.replace(/_\{([^{}]*)\}/g, (_, x) => `_${x}`);
  out = out.replace(/_([a-zA-Z0-9])/g, (_, x) => `_${x}`);
  // 隐式乘法补齐：数字+字母（9x→9*x）、)+字母（)cos→)*cos）、)+数字、)+（
  out = out.replace(/(\d)([a-zA-Z])/g, '$1*$2');
  out = out.replace(/(\))([a-zA-Z])/g, '$1*$2');
  out = out.replace(/(\))(\d)/g, '$1*$2');
  out = out.replace(/(\))(\()/g, '$1*$2');
  // )后（可带空格）跟函数名/字母：sin(x)**(6) cos(x) → ...)*cos(x)
  out = out.replace(/(\))\s+([a-zA-Z])/g, '$1*$2');
  out = out.replace(/\s+/g, ' ').trim();
  return out;
}

module.exports = { latexToSympy };
