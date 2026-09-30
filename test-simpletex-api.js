const fs = require('fs');
const path = require('path');
const https = require('https');
const FormData = require('form-data');

// 配置信息
const config = {
  apiUrl: 'https://server.simpletex.cn/api/simpletex_ocr',
  appId: 'wPVKh4dOBZVVyILB5mwHhrbo',
  appSecret: 'hSLjAK02Krmt9oVwM10SiIRGYEsKSTYD'
};

// 生成16位随机字符串
function generateRandomStr() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// MD5加密
function md5(str) {
  const crypto = require('crypto');
  return crypto.createHash('md5').update(str).digest('hex');
}

// 生成签名
function generateSignature(data, appId, appSecret) {
  const randomStr = generateRandomStr();
  const timestamp = Math.floor(Date.now() / 1000).toString();

  // 收集所有参数
  const params = {
    ...data,
    'random-str': randomStr,
    'timestamp': timestamp,
    'app-id': appId
  };

  // 对key进行排序
  const sortedKeys = Object.keys(params).sort();
  
  // 生成签名字符串
  let signStr = '';
  for (const key of sortedKeys) {
    if (signStr) signStr += '&';
    signStr += `${key}=${params[key]}`;
  }
  
  // 添加secret
  signStr += `&secret=${appSecret}`;
  
  // 生成MD5签名
  const sign = md5(signStr);

  // 构建header
  const headers = {
    'app-id': appId,
    'random-str': randomStr,
    'timestamp': timestamp,
    'sign': sign
  };

  return { headers, signStr };
}

// 测试API调用
function testApiCall() {
  console.log('开始测试SimpleTex API调用...');
  
  // 创建FormData
  const formData = new FormData();
  formData.append('rec_mode', 'auto');
  
  // 添加测试图片
  const testImagePath = path.join(__dirname, 'test-image.png');
  if (fs.existsSync(testImagePath)) {
    formData.append('file', fs.createReadStream(testImagePath));
    console.log('已添加测试图片:', testImagePath);
  } else {
    console.warn('测试图片不存在:', testImagePath);
  }
  
  // 生成签名
  const { headers, signStr } = generateSignature({ rec_mode: 'auto' }, config.appId, config.appSecret);
  
  console.log('API URL:', config.apiUrl);
  console.log('Headers:', headers);
  console.log('Sign String:', signStr);
  
  // 发送请求
  const options = {
    method: 'POST',
    headers: {
      ...headers,
      ...formData.getHeaders()
    }
  };
  
  const req = https.request(config.apiUrl, options, (res) => {
    console.log('响应状态码:', res.statusCode);
    console.log('响应头:', res.headers);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('响应数据:', data);
      try {
        const jsonData = JSON.parse(data);
        console.log('解析后的响应:', jsonData);
      } catch (error) {
        console.error('解析响应失败:', error);
      }
    });
  });
  
  req.on('error', (error) => {
    console.error('请求错误:', error);
  });
  
  // 结束请求
  formData.pipe(req);
}

// 运行测试
testApiCall();
