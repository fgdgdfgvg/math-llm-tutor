
import requests
import json

# 直接测试SymPy服务的/ode端点
url = "http://localhost:8000/ode"
data = {
    "equation": "求解二阶常系数齐次微分方程：y''-3y'+2y=0"
}

response = requests.post(url, json=data)
print(f"状态码: {response.status_code}")
print(f"响应: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
