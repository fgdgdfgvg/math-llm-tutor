const fs = require('fs');
const path = require('path');

// 控制器文件路径
const controllersPath = path.join(__dirname, 'nestjs-backend', 'src');

// 扫描结果
const scanResults = {
  totalControllers: 0,
  totalRoutes: 0,
  publicRoutes: 0,
  protectedRoutes: 0,
  issues: []
};

// 读取文件内容
function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

// 扫描控制器文件
function scanController(filePath) {
  const content = readFile(filePath);
  const fileName = path.basename(filePath);
  
  console.log(`扫描文件: ${fileName}`);
  
  // 提取所有路由装饰器
  const routePatterns = [
    /@Get\(['"]([^'"]+)['"]\)/g,
    /@Post\(['"]([^'"]+)['"]\)/g,
    /@Put\(['"]([^'"]+)['"]\)/g,
    /@Delete\(['"]([^'"]+)['"]\)/g,
    /@Patch\(['"]([^'"]+)['"]\)/g
  ];
  
  let routes = [];
  
  routePatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const route = match[1];
      const lineNumber = content.substring(0, match.index).split('\n').length;
      routes.push({ route, method: pattern.source.match(/@(\w+)/)[1], lineNumber });
    }
  });
  
  // 提取@Public()装饰器
  const publicPattern = /@Public\(\)/g;
  const publicMatches = [];
  let publicMatch;
  while ((publicMatch = publicPattern.exec(content)) !== null) {
    const lineNumber = content.substring(0, publicMatch.index).split('\n').length;
    publicMatches.push(lineNumber);
  }
  
  // 分析路由权限
  routes.forEach(route => {
    scanResults.totalRoutes++;
    
    // 检查该路由是否有@Public()装饰器
    const isPublic = publicMatches.some(line => {
      // 简单检查：如果@Public()装饰器在行号上位于路由之前，且在同一个方法内
      return line < route.lineNumber;
    });
    
    if (isPublic) {
      scanResults.publicRoutes++;
    } else {
      scanResults.protectedRoutes++;
    }
    
    // 检查敏感路由是否正确保护
    const sensitiveRoutes = ['/users', '/admin', '/auth', '/profile'];
    if (sensitiveRoutes.some(sensitive => route.route.includes(sensitive)) && isPublic) {
      scanResults.issues.push({
        file: fileName,
        route: route.route,
        method: route.method,
        line: route.lineNumber,
        issue: '敏感路由使用了@Public()装饰器，存在安全风险'
      });
    }
  });
  
  scanResults.totalControllers++;
}

// 递归扫描目录
function scanDirectory(directory) {
  const files = fs.readdirSync(directory);
  
  files.forEach(file => {
    const fullPath = path.join(directory, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      scanDirectory(fullPath);
    } else if (file.endsWith('.controller.ts')) {
      scanController(fullPath);
    }
  });
}

// 生成报告
function generateReport() {
  console.log('\n=== 接口安全检查报告 ===');
  console.log(`控制器数量: ${scanResults.totalControllers}`);
  console.log(`路由总数: ${scanResults.totalRoutes}`);
  console.log(`公开路由: ${scanResults.publicRoutes}`);
  console.log(`受保护路由: ${scanResults.protectedRoutes}`);
  
  if (scanResults.issues.length > 0) {
    console.log('\n=== 安全问题 ===');
    scanResults.issues.forEach((issue, index) => {
      console.log(`${index + 1}. 文件: ${issue.file}`);
      console.log(`   路由: ${issue.method} ${issue.route}`);
      console.log(`   行号: ${issue.line}`);
      console.log(`   问题: ${issue.issue}`);
      console.log('');
    });
  } else {
    console.log('\n=== 安全检查通过 ===');
    console.log('未发现明显的安全问题');
  }
  
  // 保存报告到文件
  const reportPath = path.join(__dirname, 'security-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(scanResults, null, 2));
  console.log(`\n报告已保存到: ${reportPath}`);
}

// 开始扫描
console.log('开始接口安全扫描...');
scanDirectory(controllersPath);
generateReport();
