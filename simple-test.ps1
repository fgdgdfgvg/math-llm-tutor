# 简单测试用户管理API
Write-Host "=== 1. 注册admin用户 ===" -ForegroundColor Green
try {
    $adminBody = '{"username":"admin","password":"admin123"}'
    $adminRes = Invoke-RestMethod -Uri 'http://localhost:3000/user/register' -Method POST -ContentType 'application/json' -Body $adminBody
    Write-Host "✅ Admin用户注册成功" -ForegroundColor Green
} catch {
    Write-Host "ℹ️ Admin用户可能已存在，继续登录" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "=== 2. 登录获取Token ===" -ForegroundColor Green
$body = '{"username":"admin","password":"admin123"}'
$loginRes = Invoke-RestMethod -Uri 'http://localhost:3000/user/login' -Method POST -ContentType 'application/json' -Body $body
$token = $loginRes.access_token
Write-Host "✅ 登录成功，Token获取成功" -ForegroundColor Green
Write-Host ""

Write-Host "=== 3. 获取用户列表 ===" -ForegroundColor Green
try {
    $headers = @{"Authorization"="Bearer $token"}
    $listRes = Invoke-RestMethod -Uri 'http://localhost:3000/user/list' -Method GET -Headers $headers
    Write-Host "✅ 用户列表获取成功" -ForegroundColor Green
    $listRes | ConvertTo-Json -Depth 3
} catch {
    Write-Host "❌ 获取用户列表失败: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

Write-Host "=== 4. 创建新用户 ===" -ForegroundColor Green
try {
    $createBody = '{"username":"newtestuser","password":"test123"}'
    $headers = @{"Authorization"="Bearer $token"}
    $createRes = Invoke-RestMethod -Uri 'http://localhost:3000/user/create' -Method POST -Headers $headers -Body $createBody -ContentType 'application/json'
    Write-Host "✅ 用户创建成功" -ForegroundColor Green
    $createRes | ConvertTo-Json -Depth 3
} catch {
    Write-Host "❌ 创建用户失败: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

Write-Host "=== 5. 删除用户 ===" -ForegroundColor Green
try {
    $headers = @{"Authorization"="Bearer $token"}
    $deleteRes = Invoke-RestMethod -Uri 'http://localhost:3000/user/delete/newtestuser' -Method DELETE -Headers $headers
    Write-Host "✅ 用户删除成功" -ForegroundColor Green
    $deleteRes | ConvertTo-Json -Depth 3
} catch {
    Write-Host "❌ 删除用户失败: $($_.Exception.Message)" -ForegroundColor Red
}
