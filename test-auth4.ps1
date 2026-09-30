# 测试注册新用户
Write-Host "=== 测试注册新用户 (testuser888) ===" -ForegroundColor Green
$registerBody = '{"username": "testuser888", "password": "testpass888"}'
try {
    $registerResponse = Invoke-RestMethod -Uri "http://localhost:3000/user/register" -Method POST -ContentType "application/json" -Body $registerBody
    Write-Host "注册成功!" -ForegroundColor Green
} catch {
    Write-Host "注册失败: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# 测试新用户登录
Write-Host "=== 测试新用户登录 (testuser888) ===" -ForegroundColor Green
$loginBody = '{"username": "testuser888", "password": "testpass888"}'
try {
    $loginResponse = Invoke-RestMethod -Uri "http://localhost:3000/user/login" -Method POST -ContentType "application/json" -Body $loginBody
    Write-Host "登录成功! Token: $($loginResponse.access_token.Substring(0, 20))..." -ForegroundColor Green
} catch {
    Write-Host "登录失败: $($_.Exception.Message)" -ForegroundColor Red
}
