# 测试注册
Write-Host "=== 测试注册 ===" -ForegroundColor Green
$registerBody = '{"username": "testuser123", "password": "testpass123"}'
try {
    $registerResponse = Invoke-RestMethod -Uri "http://localhost:3000/user/register" -Method POST -ContentType "application/json" -Body $registerBody
    Write-Host "注册成功: $($registerResponse | ConvertTo-Json)" -ForegroundColor Green
} catch {
    Write-Host "注册失败: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.BaseStream.Position = 0
        $reader.DiscardBufferedData()
        $responseBody = $reader.ReadToEnd()
        Write-Host "错误详情: $responseBody" -ForegroundColor Red
    }
}

Write-Host ""

# 测试登录
Write-Host "=== 测试登录 ===" -ForegroundColor Green
$loginBody = '{"username": "testuser123", "password": "testpass123"}'
try {
    $loginResponse = Invoke-RestMethod -Uri "http://localhost:3000/user/login" -Method POST -ContentType "application/json" -Body $loginBody
    Write-Host "登录成功: $($loginResponse | ConvertTo-Json)" -ForegroundColor Green
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
