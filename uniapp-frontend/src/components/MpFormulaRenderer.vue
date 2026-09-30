<template>
  <view class="mp-formula-renderer">
    <view v-if="platform === 'h5'" class="formula-h5" v-html="renderedHtml"></view>
    <view v-else class="formula-mp">
      <view v-for="(block, index) in parsedBlocks" :key="index" class="formula-block">
        <text v-if="block.type === 'text'" class="text-content" :style="textStyle">{{ block.content }}</text>
        <image
          v-else-if="block.type === 'math-image'"
          :src="block.imageUrl"
          class="math-image"
          :style="{ maxWidth: '100%', height: 'auto' }"
          mode="widthFix"
          @error="onImageError(block)"
        />
        <view v-else-if="block.type === 'math-text'" class="math-text-fallback" :style="mathTextStyle">
          <text>{{ block.content }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';

interface MathBlock {
  type: 'text' | 'math-image' | 'math-text';
  content: string;
  imageUrl?: string;
}

const props = defineProps<{
  latex: string;
  displayMode?: boolean;
  fontSize?: number;
}>();

const platform = ref<'h5' | 'mp-weixin' | 'mp-alipay' | 'mp-baidu' | 'other'>('h5');
const renderedHtml = ref('');
const parsedBlocks = ref<MathBlock[]>([]);
const imageLoadErrors = ref<Set<string>>(new Set());

const textStyle = computed(() => ({
  fontSize: `${props.fontSize || 16}px`,
  lineHeight: '1.8',
}));

const mathTextStyle = computed(() => ({
  fontSize: `${(props.fontSize || 16) * 1.1}px`,
  fontFamily: 'Times New Roman, serif',
}));

const detectPlatform = () => {
  // #ifdef H5
  platform.value = 'h5';
  // #endif
  // #ifdef MP-WEIXIN
  platform.value = 'mp-weixin';
  // #endif
  // #ifdef MP-ALIPAY
  platform.value = 'mp-alipay';
  // #endif
  // #ifdef MP-BAIDU
  platform.value = 'mp-baidu';
  // #endif
  // #ifndef H5 || MP-WEIXIN || MP-ALIPAY || MP-BAIDU
  platform.value = 'other';
  // #endif
};

const preprocessLatex = (text: string): string => {
  if (!text) return '';
  
  let processed = text;
  
  const matrixReplacements = [
    { pattern: /\\begin\{matrix\}([\s\S]*?)\\end\{matrix\}/g, prefix: 'pmatrix' },
    { pattern: /\\begin\{array\}\{[^}]*\}([\s\S]*?)\\end\{array\}/g, prefix: 'pmatrix' },
    { pattern: /\\begin\{bmatrix\}([\s\S]*?)\\end\{bmatrix\}/g, prefix: 'pmatrix' },
    { pattern: /\\begin\{vmatrix\}([\s\S]*?)\\end\{vmatrix\}/g, prefix: 'pmatrix' },
    { pattern: /\\begin\{Vmatrix\}([\s\S]*?)\\end\{Vmatrix\}/g, prefix: 'pmatrix' },
  ];

  for (const { pattern, prefix } of matrixReplacements) {
    processed = processed.replace(pattern, (match, content) => {
      return `\\begin{${prefix}}${content}\\end{${prefix}}`;
    });
  }

  processed = processed.replace(/\[\s*\\begin\{([^}]+)\}/g, '\\begin{$1}');
  processed = processed.replace(/\\end\{([^}]+)\}\s*\]/g, '\\end{$1}');
  
  processed = processed.replace(/\\text\{([^}]+)\}/g, '\\text{$1}');
  processed = processed.replace(/\\mathrm\{([^}]+)\}/g, '\\mathrm{$1}');
  
  return processed;
};

const renderH5 = (text: string): string => {
  if (!text) return '';
  
  try {
    const katex = require('katex');
    
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
          return `<span class="math-error">${formula}</span>`;
        }
      });
    });

    result = result.replace(/\n/g, '<br/>');
    result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    return result;
  } catch (e) {
    console.error('H5 render error:', e);
    return text;
  }
};

const renderMiniProgram = (text: string): MathBlock[] => {
  if (!text) return [];
  
  const blocks: MathBlock[] = [];
  let remaining = text;

  const latexPatterns = [
    { regex: /^\$\$([\s\S]*?)\$\$/, displayMode: true },
    { regex: /^\$([^$\n]+?)\$/, displayMode: false },
    { regex: /^\\\[([\s\S]*?)\\\]/, displayMode: true },
    { regex: /^\\\(([^)\n]+?)\\\)/, displayMode: false },
  ];

  while (remaining.length > 0) {
    let matched = false;

    for (const { regex, displayMode } of latexPatterns) {
      const match = remaining.match(regex);
      if (match) {
        const latex = preprocessLatex(match[1].trim());
        const imageKey = `${displayMode}-${latex}`;
        
        if (imageLoadErrors.value.has(imageKey)) {
          blocks.push({
            type: 'math-text',
            content: formatLatexAsText(latex),
          });
        } else {
          const imageUrl = generateMathImageUrl(latex, displayMode);
          blocks.push({
            type: 'math-image',
            content: latex,
            imageUrl,
          });
        }
        
        remaining = remaining.slice(match[0].length);
        matched = true;
        break;
      }
    }

    if (!matched) {
      const newlineMatch = remaining.match(/^\n+/);
      if (newlineMatch) {
        blocks.push({ type: 'text', content: '\n'.repeat(newlineMatch[0].length) });
        remaining = remaining.slice(newlineMatch[0].length);
        continue;
      }

      const textMatch = remaining.match(/^[^$\n\\]+/);
      if (textMatch) {
        blocks.push({ type: 'text', content: textMatch[0] });
        remaining = remaining.slice(textMatch[0].length);
        continue;
      }

      blocks.push({ type: 'text', content: remaining[0] });
      remaining = remaining.slice(1);
    }
  }

  return blocks;
};

const generateMathImageUrl = (latex: string, displayMode: boolean): string => {
  const encodedLatex = encodeURIComponent(latex);
  const fontSize = props.fontSize || 16;
  const textColor = '000000';
  
  return `https://latex.codecogs.com/png.latex?\\dpi{${fontSize}}${displayMode ? '\\displaystyle' : ''}${encodedLatex}`;
};

const formatLatexAsText = (latex: string): string => {
  let formatted = latex;
  
  formatted = formatted.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)');
  formatted = formatted.replace(/\\sqrt\{([^}]+)\}/g, '√($1)');
  formatted = formatted.replace(/\\sqrt\[(\d+)\]\{([^}]+)\}/g, '$1√($2)');
  formatted = formatted.replace(/\\sum/g, 'Σ');
  formatted = formatted.replace(/\\prod/g, 'Π');
  formatted = formatted.replace(/\\int/g, '∫');
  formatted = formatted.replace(/\\lim/g, 'lim');
  formatted = formatted.replace(/\\infty/g, '∞');
  formatted = formatted.replace(/\\alpha/g, 'α');
  formatted = formatted.replace(/\\beta/g, 'β');
  formatted = formatted.replace(/\\gamma/g, 'γ');
  formatted = formatted.replace(/\\delta/g, 'δ');
  formatted = formatted.replace(/\\theta/g, 'θ');
  formatted = formatted.replace(/\\pi/g, 'π');
  formatted = formatted.replace(/\\pm/g, '±');
  formatted = formatted.replace(/\\times/g, '×');
  formatted = formatted.replace(/\\div/g, '÷');
  formatted = formatted.replace(/\\cdot/g, '·');
  formatted = formatted.replace(/\\leq/g, '≤');
  formatted = formatted.replace(/\\geq/g, '≥');
  formatted = formatted.replace(/\\neq/g, '≠');
  formatted = formatted.replace(/\\approx/g, '≈');
  formatted = formatted.replace(/\\rightarrow/g, '→');
  formatted = formatted.replace(/\\leftarrow/g, '←');
  formatted = formatted.replace(/\\partial/g, '∂');
  formatted = formatted.replace(/\\nabla/g, '∇');
  formatted = formatted.replace(/\\forall/g, '∀');
  formatted = formatted.replace(/\\exists/g, '∃');
  formatted = formatted.replace(/\\in/g, '∈');
  formatted = formatted.replace(/\\notin/g, '∉');
  formatted = formatted.replace(/\\subset/g, '⊂');
  formatted = formatted.replace(/\\supset/g, '⊃');
  formatted = formatted.replace(/\\cup/g, '∪');
  formatted = formatted.replace(/\\cap/g, '∩');
  formatted = formatted.replace(/\\emptyset/g, '∅');
  formatted = formatted.replace(/\\therefore/g, '∴');
  formatted = formatted.replace(/\\because/g, '∵');
  formatted = formatted.replace(/\\angle/g, '∠');
  formatted = formatted.replace(/\\perp/g, '⊥');
  formatted = formatted.replace(/\\parallel/g, '∥');
  formatted = formatted.replace(/\\triangle/g, '△');
  formatted = formatted.replace(/\\circ/g, '°');
  formatted = formatted.replace(/\\degree/g, '°');
  formatted = formatted.replace(/\\left\(/g, '(');
  formatted = formatted.replace(/\\right\)/g, ')');
  formatted = formatted.replace(/\\left\[/g, '[');
  formatted = formatted.replace(/\\right\]/g, ']');
  formatted = formatted.replace(/\\left\{/g, '{');
  formatted = formatted.replace(/\\right\}/g, '}');
  formatted = formatted.replace(/\\left\|/g, '|');
  formatted = formatted.replace(/\\right\|/g, '|');
  formatted = formatted.replace(/\\left\\|/g, '‖');
  formatted = formatted.replace(/\\right\\|/g, '‖');
  formatted = formatted.replace(/\\text\{([^}]+)\}/g, '$1');
  formatted = formatted.replace(/\\mathrm\{([^}]+)\}/g, '$1');
  formatted = formatted.replace(/\\mathbf\{([^}]+)\}/g, '$1');
  formatted = formatted.replace(/\\mathit\{([^}]+)\}/g, '$1');
  formatted = formatted.replace(/\^([^{}]+)/g, '^($1)');
  formatted = formatted.replace(/_([^{}]+)/g, '_($1)');
  formatted = formatted.replace(/\^\{([^}]+)\}/g, '^($1)');
  formatted = formatted.replace(/_\{([^}]+)\}/g, '_($1)');
  formatted = formatted.replace(/\\[a-zA-Z]+/g, '');
  formatted = formatted.replace(/[{}]/g, '');
  formatted = formatted.replace(/\\begin\{[^}]+\}/g, '');
  formatted = formatted.replace(/\\end\{[^}]+\}/g, '');
  
  return formatted.trim();
};

const onImageError = (block: MathBlock) => {
  if (block.type === 'math-image') {
    const imageKey = `${block.imageUrl}-${block.content}`;
    imageLoadErrors.value.add(imageKey);
    block.type = 'math-text';
    block.content = formatLatexAsText(block.content);
  }
};

const render = () => {
  if (platform.value === 'h5') {
    renderedHtml.value = renderH5(props.latex);
  } else {
    parsedBlocks.value = renderMiniProgram(props.latex);
  }
};

watch(() => props.latex, render, { immediate: true });

onMounted(() => {
  detectPlatform();
  render();
});
</script>

<style scoped>
.mp-formula-renderer {
  width: 100%;
  overflow-x: auto;
}

.formula-h5 {
  line-height: 1.8;
  word-break: break-word;
  padding: 10px 0;
}

.formula-mp {
  line-height: 1.8;
  word-break: break-word;
  padding: 10px 0;
}

.formula-block {
  display: inline;
  vertical-align: middle;
}

.text-content {
  white-space: pre-wrap;
  word-break: break-word;
}

.math-image {
  max-width: 100%;
  vertical-align: middle;
  margin: 4px 2px;
}

.math-text-fallback {
  display: inline-block;
  padding: 4px 8px;
  background: #f5f5f5;
  border-radius: 4px;
  margin: 2px;
  font-style: italic;
}

.math-error {
  color: #f44336;
  background: #ffebee;
  padding: 2px 6px;
  border-radius: 4px;
}
</style>

<style>
@import 'katex/dist/katex.min.css';

.katex {
  font-size: 1.1em;
}

.katex-display {
  margin: 15px 0;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 10px 0;
}

.katex-display > .katex {
  white-space: normal;
}

.arraycolsep {
  width: 1.5em !important;
}

.mtable {
  margin: 0 10px !important;
  border-collapse: separate !important;
  border-spacing: 0.5em 0.3em !important;
}

.mtable .mtd {
  padding: 0.2em 0.4em !important;
  min-width: 1.5em !important;
  text-align: center !important;
}
</style>
