import requests
import json

# 测试微分方程求解端点
url = "http://localhost:8000/ode"
payload = {
    "equation": "y'' - 3*y' + 2*y = 0",
    "dependent_var": "y",
    "independent_var": "x"
}

print("正在测试 SymPy ODE 端点...")
print(f"请求 URL: {url}")
print(f"请求载荷: {json.dumps(payload, ensure_ascii=False, indent=2)}")
print("-" * 50)

try:
    response = requests.post(url, json=payload)
    print(f"响应状态码: {response.status_code}")
    print(f"响应内容:\n{json.dumps(response.json(), ensure_ascii=False, indent=2)}")
except Exception as e:
    print(f"请求失败: {e}")
