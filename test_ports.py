import requests

print("检查端口 8000 和其他可能的SymPy服务端口...")

# 检查常用的SymPy服务端口
ports = [8000, 8001, 8080, 3000]

for port in ports:
    url = f"http://localhost:{port}"
    try:
        response = requests.get(url, timeout=1)
        print(f"✓ 端口 {port} 有服务在运行: {response.text[:50]}")
        
        # 尝试访问健康端点
        health_url = f"{url}/health"
        try:
            health_resp = requests.get(health_url, timeout=1)
            print(f"  - 健康检查: {health_resp.json()}")
        except:
            pass
    except:
        print(f"✗ 端口 {port} 没有服务")
