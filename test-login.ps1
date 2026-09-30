# 先查询数据库中的用户
Write-Host "=== 查询用户 ===" -ForegroundColor Green
try {
    $user = Invoke-RestMethod -Uri "http://localhost:3000/user/list" -Method GET -Headers @{Authorization = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6InRlc3QiLCJzdWIiOiI2OWEwNTY2NDQyM2RlM2I4Y2Q2YjBiMWEiLCJpYXQiOjE3NzIxMTkzMzYsImV4cCI6MTc3MjIwNTczNn0.test_token"}
    Write-Host "用户列表: $($user | ConvertTo-Json)" -ForegroundColor Green
} catch {
    Write-Host "查询失败: $($_.Exception.Message)" -ForegroundColor Red
}

# 测试test用户登录
Write-Host ""
Write-Host "=== 测试test用户登录 ===" -ForegroundColor Green
$testLoginBody = '{"username": "test", "password": "test123"}'
try {
    $testLoginResponse = Invoke-RestMethod -Uri "http://localhost:3000/user/login" -Method POST -ContentType "application/json" -Body $testLoginBody
    Write-Host "test登录成功" -ForegroundColor Green
} catch {
    Write-Host "test登录失败: $($_.Exception.Message)" -ForegroundColor Red
}
