# 测试注册新用户
Write-Host "=== 测试注册新用户 ===" -ForegroundColor Green
$registerBody = '{"username": "testuser999", "password": "testpass999"}'
try {
    $registerResponse = Invoke-RestMethod -Uri "http://localhost:3000/user/register" -Method POST -ContentType "application/json" -Body $registerBody
    Write-Host "注册成功!" -ForegroundColor Green
} catch {
    Write-Host "注册失败: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# 测试新用户登录
Write-Host "=== 测试新用户登录 ===" -ForegroundColor Green
$loginBody = '{"username": "testuser999", "password": "testpass999"}'
try {
    $loginResponse = Invoke-RestMethod -Uri "http://localhost:3000/user/login" -Method POST -ContentType "application/json" -Body $loginBody
    Write-Host "登录成功! Token: $($loginResponse.access_token.Substring(0, 20))..." -ForegroundColor Green
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
