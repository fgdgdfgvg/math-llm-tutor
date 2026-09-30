import os
import sys
import subprocess
import time
import requests

print("正在查找占用3000端口的进程...")
result = subprocess.run(['netstat', '-ano', '|', 'findstr', ':3000'], shell=True, capture_output=True, text=True)
print(result.stdout)

# 提取PID并杀掉
if result.stdout:
    lines = result.stdout.strip().split('\n')
    for line in lines:
        if 'LISTENING' in line:
            parts = line.split()
            pid = parts[-1]
            print(f"正在终止进程 {pid}...")
            try:
                subprocess.run(['taskkill', '/F', '/PID', pid], check=True)
                print(f"进程 {pid} 已终止")
            except Exception as e:
                print(f"终止进程失败: {e}")

print("\n等待2秒后启动新的后端服务...")
time.sleep(2)

# 启动后端
print("\n启动 NestJS 后端...")
os.chdir(r"d:\VS2022\code\DI_llm_ED\math_llm_tutor\nestjs-backend")

# 使用 npm run start:dev 启动
subprocess.Popen(['npm', 'run', 'start:dev'], shell=True)

print("\n后端正在启动...等待30秒让它完全启动...")
for i in range(30, 0, -1):
    print(f"等待... {i}秒", end='\r')
    time.sleep(1)

print("\n\n测试后端服务...")
try:
    # 测试健康端点
    health_resp = requests.get("http://localhost:3000/api/health", timeout=10)
    print(f"健康检查: {health_resp.status_code}")
    print(health_resp.text)
    
    # 测试我们的微分方程问题
    print("\n测试微分方程求解API...")
    solve_resp = requests.post(
        "http://localhost:3000/agents/solve",
        json={
            "problem": "求解二阶常系数齐次微分方程：y'' - 3y' + 2y = 0"
        },
        timeout=60
    )
    print(f"\n求解API响应状态码: {solve_resp.status_code}")
    result = solve_resp.json()
    
    print("\n" + "="*60)
    print("求解结果:")
    print(f"问题类型: {result.get('data', {}).get('problemType')}")
    print(f"最终答案: {result.get('data', {}).get('finalAnswer')}")
    print("\n详细解题步骤:")
    
    steps = result.get('data', {}).get('solutionSteps', [])
    for step in steps:
        try:
            step_data = eval(step)
            print(f"\n{step_data.get('stepTitle', '步骤')}:")
            print(f"  过程: {step_data.get('process', '')}")
            print(f"  结果: {step_data.get('result', '')}")
        except:
            print(f"\n{step}")
            
except Exception as e:
    print(f"\n测试失败: {e}")
    import traceback
    traceback.print_exc()

print("\n\n按任意键退出...")
input()
