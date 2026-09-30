// 第三方库缺少类型声明时在此统一补充，避免 vue-tsc 报 TS7016
declare module 'markdown-it' {
  const MarkdownIt: any;
  export default MarkdownIt;
}

// markdown-it 的数学渲染已改为本地实现（src/utils/markdown-katex.ts），
// 不再依赖 npm 上的 markdown-it-katex（它内嵌的 katex 0.6 会渲染错公式）。
