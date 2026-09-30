<template>
  <view class="math-renderer" v-if="isReady">
    <view v-if="isH5" class="math-container">
      <!-- H5端使用直接渲染 -->
      <view v-html="renderedHtml" class="math-output"></view>
    </view>
    <view v-else class="math-content">
      <!-- 小程序端使用rich-text或图片渲染 -->
      <view v-if="isComplexFormula && formulaImageUrl" class="math-image-container">
        <image :src="formulaImageUrl" mode="widthFix" class="math-image"></image>
      </view>
      <rich-text v-else :nodes="renderedNodes"></rich-text>
    </view>

    <!-- 工具条：仅矩阵/分段函数这类真正复杂的公式才需要，且不遮挡内容 -->
    <view v-if="isH5 && showTools" class="math-tools">
      <text class="math-tool" @click="copyFormula">复制</text>
      <text class="math-tool" @click="showFullscreenModal">放大</text>
    </view>
  </view>
  <view v-else class="math-loading">
    <text>公式加载中...</text>
  </view>
  
  <!-- 全屏查看模态框 -->
  <view v-if="fullscreenModalVisible" class="fullscreen-overlay" @click="closeFullscreenModal">
    <view class="fullscreen-modal" @click.stop>
      <view class="fullscreen-header">
        <text class="fullscreen-title">公式全屏查看</text>
        <view class="fullscreen-close" @click="closeFullscreenModal">
          <text>×</text>
        </view>
      </view>
      <view class="fullscreen-content">
        <view v-html="renderedHtml" class="fullscreen-math"></view>
      </view>
      <view class="fullscreen-footer">
        <text class="fullscreen-hint">提示：可双指缩放查看</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue';
import MarkdownIt from 'markdown-it';
import { markdownItKatex } from '../utils/markdown-katex';
import { getApiUrl } from '@/config';

const props = defineProps<{
  content: string;
  /** 独立公式（如“最终答案”）居中展示；默认跟随文字行内展示 */
  display?: boolean;
}>();

/**
 * 内容规整：把题库里常见的几种写法统一成本地 KaTeX 插件能识别的形式。
 *
 * 1. 裸 LaTeX（题库 answer 字段大量如此，例如 \frac{1}{2} / \ln 2 / e^{-\frac{1}{2}}）
 *    之前会被当成普通文本，界面上直接显示反斜杠源码。
 * 2. 题干末尾自成一个公式且含分式/极限/积分等“高个子”算符时，按教材习惯独占一行，
 *    否则会被压进文字行里挤成一团。
 */
const BARE_LATEX_PATTERN =
  /\\(frac|dfrac|tfrac|sqrt|lim|int|iint|oint|sum|prod|sin|cos|tan|cot|sec|csc|ln|log|exp|arcsin|arccos|arctan|alpha|beta|gamma|delta|epsilon|varepsilon|theta|lambda|mu|nu|rho|sigma|tau|phi|varphi|omega|pi|infty|partial|nabla|to|rightarrow|leftarrow|cdot|times|div|pm|mp|leq|geq|neq|approx|equiv|sim|propto|left|right|begin|end|vec|bar|hat|dot|ddot|overline|underline|mathrm|mathbb|mathcal|text|displaystyle|quad|qquad|matrix|cases|array|binom|overline)/i;

const TALL_MATH_PATTERN =
  /\\(frac|dfrac|tfrac|lim|int|iint|oint|sum|prod|begin\{|binom|overline|sqrt\s*\[)/;

const isBareLatex = (text: string): boolean => {
  const trimmed = text.trim();
  if (!trimmed) return false;
  // 含中文说明文字的内容仍然按普通文本处理
  if (/[\u4e00-\u9fff]/.test(trimmed)) return false;
  return BARE_LATEX_PATTERN.test(trimmed);
};

const preprocessMathContent = (raw: string, display: boolean): string => {
  if (!raw) return '';
  let text = raw;

  // 整串就是裸 LaTeX
  if (!/\$|\\\(|\\\[/.test(text) && isBareLatex(text)) {
    return display ? `$$${text.trim()}$$` : `$${text.trim()}$`;
  }

  // 行尾独立公式含高个子算符 → 独立成行（居中显示）
  const trailing = text.match(/^([\s\S]*?)(\$[^$\n]+\$)\s*$/);
  if (trailing && trailing[1].trim() && TALL_MATH_PATTERN.test(trailing[2])) {
    text = `${trailing[1].trim()}\n\n$$${trailing[2].slice(1, -1)}$$`;
  }

  return text;
};

// 公式渲染缓存
const formulaCache = new Map<string, { html: string; imageUrl: string }>();

const isH5 = ref(false);
const isReady = ref(false);
const fullscreenModalVisible = ref(false);
const formulaImageUrl = ref('');
const isLoadingImage = ref(false);

onMounted(() => {
  isH5.value = typeof window !== 'undefined';
  isReady.value = true;
  checkAndRenderComplexFormula();
});

// 监听content变化，重新检查和渲染复杂公式
watch(() => props.content, () => {
  checkAndRenderComplexFormula();
});

// 复杂公式（矩阵、分段函数等）在窄屏上可能放不下，才需要“放大”入口。
// 以前用“长度 > 100”判断，导致几乎每道题都飘着一个放大镜，反而遮挡题面。
const showTools = computed(() => isComplexFormula.value);

// 检测是否为复杂公式
const isComplexFormula = computed(() => {
  const content = props.content;
  const complexPatterns = [
    '\\begin{matrix}',
    '\\begin{bmatrix}',
    '\\begin{align}',
    '\\begin{aligned}',
    '\\begin{gather}',
    '\\begin{cases}',
    '\\begin{array}',
    '\\begin{tabular}',
    '\\begin{tikzpicture}',
  ];
  return complexPatterns.some(pattern => content.includes(pattern));
});

// 检查并渲染复杂公式
const checkAndRenderComplexFormula = async () => {
  if (!isH5.value && isComplexFormula.value) {
    await renderComplexFormulaToImage();
  } else {
    formulaImageUrl.value = '';
  }
};

// 将复杂公式渲染为图片
const renderComplexFormulaToImage = async () => {
  if (!props.content) return;
  
  // 检查缓存
  const cacheKey = `image_${props.content}`;
  if (formulaCache.has(cacheKey)) {
    formulaImageUrl.value = formulaCache.get(cacheKey)?.imageUrl || '';
    return;
  }
  
  try {
    isLoadingImage.value = true;
    
    // 构建请求参数
    const formula = props.content;
    
    // 调用后端API渲染公式
    const response = await uni.request({
      url: getApiUrl('/formula-renderer/render'),
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
      },
      data: {
        formula,
        options: {
          width: 600,
          height: 200,
          color: '000000',
          background: 'ffffff',
        },
      },
    });
    
    // 后端统一包装为 { code, data, message }，图片地址在 data.data.imageUrl
    const payload: any = (response.data as any)?.data ?? response.data;
    const imageUrl = payload?.imageUrl;
    if (response.statusCode === 200 && imageUrl) {
      formulaImageUrl.value = imageUrl;
      // 缓存结果
      formulaCache.set(cacheKey, { html: '', imageUrl });
    } else {
      console.error('公式渲染失败:', response.data);
    }
  } catch (error) {
    console.error('公式渲染请求失败:', error);
  } finally {
    isLoadingImage.value = false;
  }
};

// 全屏查看相关方法
const showFullscreenModal = () => {
  fullscreenModalVisible.value = true;
};

const closeFullscreenModal = () => {
  fullscreenModalVisible.value = false;
};

// 复制公式
const copyFormula = () => {
  const content = props.content || '';
  if (navigator.clipboard) {
    navigator.clipboard.writeText(content).then(() => {
      console.log('公式已复制到剪贴板');
    }).catch(err => {
      console.error('复制失败:', err);
    });
  }
};

// KaTeX 宏定义配置
const katexOptions = {
  throwOnError: false,
  strict: false,
  errorColor: '#cc0000',
  macros: {
    '\\R': '\\mathbb{R}',
    '\\C': '\\mathbb{C}',
    '\\N': '\\mathbb{N}',
    '\\Z': '\\mathbb{Z}',
    '\\Q': '\\mathbb{Q}',
    '\\h': '\\hbar',
    '\\e': '\\mathrm{e}',
    '\\i': '\\mathrm{i}',
    '\\abs': '\\left|#1\\right|',
    '\\norm': '\\left\\|#1\\right\\|',
    '\\floor': '\\left\\lfloor#1\\right\\rfloor',
    '\\ceil': '\\left\\lceil#1\\right\\rceil',
  }
};

// 创建markdown-it实例
// typographer/linkify 会把 -- 、(c) 之类符号转换成排版符，对数学文本是干扰，关掉更可预测
// 数学渲染用本地插件 + 项目自己的 katex（见 utils/markdown-katex.ts）
const md = new MarkdownIt({
  html: true,
  linkify: false,
  typographer: false,
  breaks: true
}).use(markdownItKatex as any, katexOptions);

// H5端渲染
const renderedHtml = computed(() => {
  if (!props.content) return '';
  
  // 检查缓存
  const cacheKey = `html_${props.content}`;
  if (formulaCache.has(cacheKey)) {
    return formulaCache.get(cacheKey)?.html || '';
  }
  
  try {
    // 预处理内容，确保数学表达式正确格式化
    // （旧的 (\w)(\d+) / (\d+)\/(\d+) 正则会把 sin2x、1/2 这类普通文本
    //   改写成没有 $ 包裹的裸 LaTeX，结果界面上显示成源码，已经移除）
    const processedContent = preprocessMathContent(props.content, !!props.display);

    const result = md.render(processedContent);
    
    // 缓存结果
    formulaCache.set(cacheKey, { html: result, imageUrl: '' });
    return result;
  } catch (e) {
    console.error('公式渲染错误:', e);
    const errorHtml = `<div class="math-error">渲染错误，原始内容：\n${props.content}</div>`;
    formulaCache.set(cacheKey, { html: errorHtml, imageUrl: '' });
    return errorHtml;
  }
});

// 小程序端渲染（使用rich-text需要转换为nodes格式）
const renderedNodes = computed(() => {
  if (!props.content) return [];
  
  try {
    // 预处理内容，确保数学表达式正确格式化
    const processedContent = preprocessMathContent(props.content, !!props.display);

    const html = md.render(processedContent);
    
    // 为小程序端创建带内联样式的nodes
    return [
      {
        type: 'html', 
        name: 'div', 
        attrs: { 
          style: 'width: 100%; overflow-x: auto;'
        }, 
        children: [
          {
            type: 'html', 
            name: 'div',
            attrs: { style: 'width: 100%; line-height: 1.5;' },
            children: [{ type: 'html', text: html }]
          }
        ] 
      }
    ];
  } catch (e) {
    console.error('公式渲染错误:', e);
    // 降级显示原始内容
    return [
      {
        type: 'html', 
        name: 'div', 
        attrs: { style: 'color:red; padding: 10px;' }, 
        children: [{ type: 'text', text: `渲染错误，原始内容：\n${props.content}` }] 
      }
    ];
  }
});
</script>

<style scoped>
.math-renderer {
  width: 100%;
  position: relative;
  /* 继承父级字号/颜色：避免 13px 的解题步骤里冒出 16px 的公式，
     也保证错题本里“你的答案（红）/正确答案（绿）”等语义色不丢失 */
  font-size: inherit;
  color: inherit;
  line-height: 1.7;
  margin: 0;
  padding: 0;
}

.math-container {
  width: 100%;
  position: relative;
  /* 不再用写死的白色底，否则深色模式下会变成一块白色卡片 */
  background: transparent;
}

.math-content {
  width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
}

.math-image-container {
  width: 100%;
  padding: 10px 0;
  display: flex;
  justify-content: center;
}

.math-image {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
}

.math-output {
  width: 100%;
  padding: 0;
  overflow: visible;
  word-wrap: break-word;
}

/* 行内公式：只保留 KaTeX 自己的间距，不再叠加 padding/
   以前每个公式外层固定 50px 最小高度 + 12px 内边距，
   选项和解题步骤里就会到处是空白 */
.math-output :deep(.katex) {
  font-size: 1.05em;
}

/* 块级公式（\[ ... \] 或 $$...$$）：居中 + 超宽时横向滚动 */
.math-output :deep(.katex-display) {
  margin: 10px 0;
  padding: 0;
  background: transparent;
  overflow-x: auto;
  overflow-y: hidden;
  text-align: center;
}

.math-output :deep(.katex-display > .katex) {
  white-space: nowrap;
}

.math-tools {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 2px;
}

.math-tool {
  font-size: 12px;
  color: var(--text-secondary, #8a8f98);
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--border-color, #e5e7eb);
  cursor: pointer;
}

.math-loading {
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  font-size: 14px;
}

.math-error {
  min-height: 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #f56c6c;
  font-size: 14px;
  padding: 10px;
  text-align: center;
}

.math-error-detail {
  font-size: 12px;
  color: #909399;
  margin-top: 5px;
}

/* 全屏查看模态框 */
.fullscreen-modal {
  width: 95vw;
  max-height: 90vh;
  background: var(--bg-card, #fff);
  border-radius: 12px;
  overflow: hidden;
}

.fullscreen-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  border-bottom: 1px solid var(--border-color, #eee);
}

.fullscreen-title {
  font-size: 18px;
  font-weight: bold;
  color: var(--text-primary, #333);
}

.fullscreen-close {
  font-size: 24px;
  color: var(--text-secondary, #999);
  cursor: pointer;
}

.fullscreen-content {
  padding: 20px;
  max-height: 70vh;
  overflow: auto;
}

.fullscreen-math {
  font-size: 18px;
  line-height: 1.6;
}

.fullscreen-footer {
  padding: 15px 20px;
  border-top: 1px solid var(--border-color, #eee);
  text-align: center;
}

.fullscreen-hint {
  font-size: 14px;
  color: var(--text-secondary, #666);
}

.fullscreen-content :deep(.katex-display) {
  overflow-x: auto;
}

/* 全屏覆盖层 */
.fullscreen-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

/* 确保markdown渲染的内容正确显示 */
:deep(p) {
  margin: 0 0 8px;
  line-height: 1.75;
}

:deep(p:last-child) {
  margin-bottom: 0;
}

:deep(h1), :deep(h2), :deep(h3), :deep(h4), :deep(h5), :deep(h6) {
  margin-top: 20px;
  margin-bottom: 10px;
  font-weight: bold;
}

:deep(h1) {
  font-size: 24px;
}

:deep(h2) {
  font-size: 20px;
}

:deep(h3) {
  font-size: 18px;
}

:deep(ul), :deep(ol) {
  margin-left: 20px;
  margin-bottom: 10px;
}

:deep(li) {
  margin-bottom: 5px;
}

:deep(code) {
  background: #f8f9fa;
  padding: 2px 4px;
  border-radius: 4px;
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 14px;
}

:deep(pre) {
  background: #1e1e1e;
  padding: 12px;
  border-radius: 8px;
  overflow-x: auto;
  margin-bottom: 10px;
}

:deep(pre code) {
  background: none;
  color: #d4d4d4;
  white-space: pre;
}

/* 公式容器样式隔离 */
:deep(.math-error) {
  color: #f44336;
  background: rgba(244, 67, 54, 0.1);
  padding: 8px 12px;
  border-radius: 6px;
  margin: 10px 0;
  font-size: 14px;
  white-space: pre-wrap;
}
</style>

<style>
/* KaTeX样式（仅引入官方样式表，不再逐条覆盖它的内部结构）
   以前的 .frac/.msqrt/.msupsub 覆写把 KaTeX 自己的分式线、根号、
   上下标对齐规则改坏了（例如给 .frac-line 加 border-top 导致分数线变成双线），
   因此这里只保留少量必要规则。 */
@import 'katex/dist/katex.min.css';

.math-output .katex,
.formula-content .katex {
  text-indent: 0;
}

/* 超长公式横向滚动，避免撑破卡片 */
.katex-display {
  overflow-x: auto;
  overflow-y: hidden;
}

/* 深色模式：公式用当前文字颜色渲染 */
.theme-dark .katex {
  color: inherit;
}

/* 解决UniApp rich-text兼容性问题 */
rich-text {
  line-height: normal;
  font-size: inherit;
}
</style>