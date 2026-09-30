# 测试bcrypt比较
Write-Host "=== 测试bcrypt比较 ===" -ForegroundColor Green

# 模拟注册时的密码哈希
$password = "testpass123"
Write-Host "原始密码: $password"

# 从之前的注册响应中获取的哈希值
$hashedPassword = "$2b$10$jhRK3f8A8hxG2T7EqF/xmuc5tzAJMqPwdTKB77F2UecTSBWfnVGOC"
Write-Host "数据库中的哈希: $hashedPassword"

# 直接调用后端验证API
Write-Host ""
Write-Host "=== 直接测试验证 ===" -ForegroundColor Green
$loginBody = '{"username": "testuser123", "password": "testpass123"}'
Write-Host "请求体: $loginBody"

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/user/login" -Method POST -ContentType "application/json" -Body $loginBody
    Write-Host "登录成功!" -ForegroundColor Green
} catch {
    Write-Host "登录失败: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.BaseStream.Position = 0
        $reader.DiscardBufferedData()
        $responseBody = $reader.ReadToEnd()
        Write-Host "错误详情: $responseBody" -ForegroundColor Red
    }
}
