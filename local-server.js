const http = require('http');
const fs = require('fs');
const path = require('path');
// 使用正确的导入方式
const fetch = require('node-fetch');

// 服务器配置
const PORT = 3000;
const HOST = 'localhost';

// 支持的文件类型
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.wasm': 'application/wasm'
};

// 创建HTTP服务器
const server = http.createServer(async (req, res) => {
    console.log(`请求: ${req.url}`);
    
    // 处理API代理请求
    if (req.url.startsWith('/api/proxy/')) {
        await handleApiProxy(req, res);
        return;
    }
    
    // 处理静态文件请求
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './test-simpletex-api-improved.html';
    }
    
    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';
    
    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code == 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Server Error: ' + error.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// 处理API代理请求
async function handleApiProxy(req, res) {
    try {
        // 提取目标API URL
        const encodedUrl = req.url.replace('/api/proxy/', '');
        const apiUrl = decodeURIComponent(encodedUrl);
        console.log(`=== 代理请求开始 ===`);
        console.log(`代理请求到: ${apiUrl}`);
        console.log(`请求方法: ${req.method}`);
        console.log(`请求头:`, req.headers);
        
        // 读取请求体
        let body = [];
        for await (const chunk of req) {
            body.push(chunk);
        }
        body = Buffer.concat(body);
        console.log(`请求体大小: ${body.length} bytes`);
        
        // 构建请求选项
        const options = {
            method: req.method,
            headers: {
                ...req.headers
            }
        };
        
        // 移除可能导致问题的头
        delete options.headers['host'];
        delete options.headers['connection'];
        delete options.headers['content-length'];
        delete options.headers['origin'];
        delete options.headers['referer'];
        
        // 添加Host头
        options.headers['Host'] = new URL(apiUrl).host;
        
        console.log(`修改后的请求头:`, options.headers);
        
        // 添加请求体
        if (body.length > 0) {
            options.body = body;
        }
        
        // 发送请求到目标API
        console.log(`发送请求到API服务器...`);
        const response = await fetch(apiUrl, options);
        
        console.log(`API响应状态: ${response.status} ${response.statusText}`);
        console.log(`API响应头:`, Object.fromEntries(response.headers.entries()));
        
        // 读取响应体
        const responseBody = await response.text();
        console.log(`API响应体:`, responseBody);
        
        // 设置响应头
        res.writeHead(response.status, {
            ...response.headers,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, app-id, random-str, timestamp, sign'
        });
        
        // 发送响应
        res.end(responseBody);
        console.log(`=== 代理请求结束 ===`);
        
    } catch (error) {
        console.error('代理错误:', error);
        res.writeHead(500);
        res.end('代理错误: ' + error.message);
    }
}

// 启动服务器
server.listen(PORT, HOST, () => {
    console.log(`本地服务器运行在 http://${HOST}:${PORT}`);
    console.log(`访问 http://${HOST}:${PORT} 开始测试`);
    console.log('按 Ctrl+C 停止服务器');
});

// 处理服务器错误
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`端口 ${PORT} 已被占用，请关闭占用该端口的进程后重试`);
    } else {
        console.error('服务器错误:', error);
    }
    process.exit(1);
});