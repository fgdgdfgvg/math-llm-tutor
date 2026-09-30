import os
import sys
import subprocess
import time
import requests

print("正在查找占用8000端口的进程...")
result = subprocess.run(['netstat', '-ano', '|', 'findstr', ':8000'], shell=True, capture_output=True, text=True)
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

print("\n等待2秒后启动新的SymPy服务...")
time.sleep(2)

# 启动统一的 sympy-service
print("\n启动 sympy-service...")
project_root = os.path.dirname(os.path.abspath(__file__))
service_dir = os.path.join(project_root, "sympy-service")
os.chdir(service_dir)

# 激活虚拟环境
venv_activate = os.path.join(service_dir, "venv", "Scripts", "activate.bat")
if os.path.exists(venv_activate):
    # Windows下启动服务
    subprocess.Popen([venv_activate, "&&", "python", "main.py"], shell=True)
else:
    subprocess.Popen(["python", "main.py"], shell=True)

print("\nSymPy服务正在启动...等待5秒...")
time.sleep(5)

# 测试服务是否运行
print("\n测试服务...")
try:
    health_resp = requests.get("http://localhost:8000/health", timeout=5)
    print(f"服务健康检查: {health_resp.json()}")
    
    # 测试ODE端点
    print("\n测试ODE端点...")
    ode_resp = requests.post(
        "http://localhost:8000/ode",
        json={
            "equation": "y'' - 3*y' + 2*y = 0",
            "dependent_var": "y",
            "independent_var": "x"
        },
        timeout=10
    )
    print(f"ODE端点响应: {ode_resp.status_code}")
    print(ode_resp.json())
    
except Exception as e:
    print(f"测试失败: {e}")
