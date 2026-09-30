
import requests
import json

# 测试通过后端求解微分方程
url = "http://localhost:3000/agents/solve"
data = {
    "problem": "求解二阶常系数齐次微分方程：y''-3y'+2y=0"
}

response = requests.post(url, json=data)
print(f"状态码: {response.status_code}")
print(f"响应: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
