
import requests
import json

# 测试用户的微分方程
url = "http://localhost:8000/ode"
data = {
    "equation": "y''-3y'+2y=0"
}

response = requests.post(url, json=data)
print(f"状态码: {response.status_code}")
print(f"响应: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
