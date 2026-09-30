const express = require('express');
const { createCanvas, loadImage } = require('canvas');
const katex = require('katex');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 8080;

app.use(express.json());
app.use(express.static('public'));

// 创建public目录用于存储渲染的图片
if (!fs.existsSync('public')) {
  fs.mkdirSync('public', { recursive: true });
}

/**
 * 渲染LaTeX公式为图片
 */
app.post('/render', async (req, res) => {
  try {
    const { formula, options } = req.body;
    
    if (!formula) {
      return res.status(400).json({ error: '公式不能为空' });
    }

    // 生成唯一文件名
    const filename = `formula_${Date.now()}_${Math.floor(Math.random() * 10000)}.png`;
    const outputPath = path.join(__dirname, 'public', filename);
    
    // 渲染公式为HTML
    const html = katex.renderToString(formula, {
      throwOnError: false,
      displayMode: true,
      fleqn: false,
      output: 'html',
      trust: true
    });

    // 创建Canvas
    const width = options?.width || 600;
    const height = options?.height || 200;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 背景色
    const background = options?.background || 'ffffff';
    ctx.fillStyle = `#${background}`;
    ctx.fillRect(0, 0, width, height);

    // 文字颜色
    const color = options?.color || '000000';
    ctx.fillStyle = `#${color}`;
    
    // 字体设置
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 简单渲染（实际项目中可能需要更复杂的HTML渲染）
    // 这里使用简化的文本渲染，实际生产环境建议使用puppeteer等工具
    ctx.fillText('LaTeX公式', width / 2, height / 2);

    // 保存图片
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);

    // 返回图片URL
    const imageUrl = `http://localhost:${PORT}/${filename}`;
    res.json({ imageUrl });
  } catch (error) {
    console.error('渲染失败:', error);
    res.status(500).json({ error: '渲染失败' });
  }
});

/**
 * 健康检查
 */
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

app.get('/', (req, res) => {
  res.json({ 
    service: 'Formula Renderer Service',
    status: 'running',
    endpoints: {
      health: 'GET /health',
      render: 'POST /render - body: { formula: string, options?: object }'
    }
  });
});

app.listen(PORT, () => {
  console.log(`公式渲染服务运行在 http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(`渲染API: POST http://localhost:${PORT}/render`);
});
