<template>
  <view class="formula-renderer">
    <view v-if="renderedHtml" class="formula-content" v-html="renderedHtml"></view>
    <view v-else class="formula-raw">{{ latex }}</view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import katex from 'katex';

const props = defineProps<{
  latex: string;
  displayMode?: boolean;
}>();

const renderedHtml = ref('');

const preprocessLatex = (text: string): string => {
  if (!text) return '';
  
  let processed = text;
  
  processed = processed.replace(
    /\\begin\{matrix\}([\s\S]*?)\\end\{matrix\}/g,
    (match, content) => {
      return `\\begin{pmatrix}${content}\\end{pmatrix}`;
    }
  );
  
  processed = processed.replace(
    /\\begin\{array\}\{[^}]*\}([\s\S]*?)\\end\{array\}/g,
    (match, content) => {
      return `\\begin{pmatrix}${content}\\end{pmatrix}`;
    }
  );
  
  processed = processed.replace(
    /\\begin\{bmatrix\}([\s\S]*?)\\end\{bmatrix\}/g,
    (match, content) => {
      return `\\begin{pmatrix}${content}\\end{pmatrix}`;
    }
  );
  
  processed = processed.replace(
    /\\begin\{vmatrix\}([\s\S]*?)\\end\{vmatrix\}/g,
    (match, content) => {
      return `\\begin{pmatrix}${content}\\end{pmatrix}`;
    }
  );
  
  processed = processed.replace(
    /\[\s*\\begin\{([^}]+)\}/g,
    '\\begin{$1}'
  );
  processed = processed.replace(
    /\\end\{([^}]+)\}\s*\]/g,
    '\\end{$1}'
  );
  
  return processed;
};

const renderLatex = (text: string): string => {
  if (!text) return '';

  // 知识图谱节点的 latex/formula 字段存的是裸 LaTeX（没有 $ 包裹），
  // 若不识别就会把 \lim_{x \to a} ... 原样显示成反斜杠文本。
  const hasDelimiter = /\$|\\\(|\\\[/.test(text);
  const looksLikeLatex = /\\[a-zA-Z]+/.test(text);
  if (!hasDelimiter && looksLikeLatex) {
    text = `$$${text}$$`;
  }

  const latexPatterns = [
    { pattern: /\$\$([\s\S]*?)\$\$/g, displayMode: true },
    { pattern: /\$([^$\n]+)\$/g, displayMode: false },
    { pattern: /\\\[([\s\S]*?)\\\]/g, displayMode: true },
    { pattern: /\\\(([^)\n]+)\\\)/g, displayMode: false },
  ];

  let result = text;

  latexPatterns.forEach(({ pattern, displayMode }) => {
    result = result.replace(pattern, (match, formula) => {
      try {
        const processedFormula = preprocessLatex(formula.trim());
        return katex.renderToString(processedFormula, {
          displayMode,
          throwOnError: false,
          output: 'html',
          strict: false,
          trust: true,
          macros: {
            '\\begin{pmatrix}': '\\left(\\begin{matrix}',
            '\\end{pmatrix}': '\\end{matrix}\\right)',
            '\\arraycolsep': '1em',
          },
        });
      } catch (e) {
        console.warn('KaTeX render error:', e);
        try {
          return katex.renderToString(formula.trim(), {
            displayMode,
            throwOnError: false,
            output: 'html',
          });
        } catch (e2) {
          return match;
        }
      }
    });
  });

  return result;
};

const processText = (text: string): string => {
  if (!text) return '';
  
  let result = renderLatex(text);
  
  result = result.replace(/\n/g, '<br/>');
  
  result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // 斜体只支持 *文字* 这种写法；a * b * c 里的乘号不能被当成强调符
  result = result.replace(/\*([^*\s][^*]*?)\*/g, '<em>$1</em>');
  
  // “1. xxx” 作为列表项时才换行（句首/行首），避免句子中间的 “x > 1. 5” 被拆断
  result = result.replace(/(^|[\n。；;])\s*(\d+)\.\s+/g, '$1<br/><strong>$2.</strong> ');
  
  return result;
};

const render = () => {
  renderedHtml.value = processText(props.latex);
};

watch(() => props.latex, render, { immediate: true });

onMounted(render);
</script>

<!-- KaTeX 官方样式必须全局引入：v-html 渲染出来的节点不带 scoped 属性 -->
<style>
@import 'katex/dist/katex.min.css';
</style>

<style scoped>
.formula-renderer {
  width: 100%;
  overflow-x: auto;
  color: inherit;
  font-size: inherit;
}

.formula-content {
  line-height: 1.8;
  word-break: break-word;
  padding: 0;
}

.formula-content :deep(.katex) {
  font-size: 1.05em;
}

.formula-content :deep(.katex-display) {
  margin: 10px 0;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 0;
}

.formula-content :deep(p) {
  margin: 0 0 8px;
}

.formula-content :deep(p:last-child) {
  margin-bottom: 0;
}

/* 矩阵/方程组分隔符宽度：KaTeX 默认偏窄，中文界面下容易挤在一起 */
.formula-content :deep(.arraycolsep) {
  width: 1.2em;
}

.formula-raw {
  font-family: 'Fira Code', 'Consolas', monospace;
  background: var(--bg-secondary, #f5f5f5);
  color: var(--text-primary, #333);
  padding: 10px;
  border-radius: 4px;
  white-space: pre-wrap;
}
</style>
