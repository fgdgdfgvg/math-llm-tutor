# SymPy求解示例集合

## 一、导数求解示例

### 示例1：基础函数求导
**问题**：求 f(x) = x³ + 2x² - 5x + 3 的导数

**数学表达式**：`f'(x) = d/dx(x³ + 2x² - 5x + 3)`

**求解过程**：
```
f'(x) = d/dx(x³) + d/dx(2x²) - d/dx(5x) + d/dx(3)
      = 3x² + 4x - 5
```

**API调用**：
```json
POST /derivative
{
  "expr": "x^3 + 2*x^2 - 5*x + 3",
  "variable": "x"
}
```

**预期结果**：`3*x**2 + 4*x - 5`

---

### 示例2：复合函数求导（链式法则）
**问题**：求 f(x) = sin(x²) 的导数

**数学表达式**：`f'(x) = d/dx(sin(x²))`

**求解过程**：
```
设 u = x²，则 f(x) = sin(u)
f'(x) = cos(u) · u' = cos(x²) · 2x = 2x·cos(x²)
```

**API调用**：
```json
POST /derivative
{
  "expr": "sin(x^2)",
  "variable": "x"
}
```

**预期结果**：`2*x*cos(x**2)`

---

### 示例3：指数函数与对数函数求导
**问题**：求 f(x) = e^(2x) · ln(x) 的导数

**数学表达式**：`f'(x) = d/dx(e^(2x) · ln(x))`

**求解过程**：
```
使用乘积法则：(uv)' = u'v + uv'
f'(x) = d/dx(e^(2x)) · ln(x) + e^(2x) · d/dx(ln(x))
      = 2e^(2x) · ln(x) + e^(2x) · (1/x)
      = e^(2x) · (2ln(x) + 1/x)
```

**API调用**：
```json
POST /derivative
{
  "expr": "exp(2*x) * log(x)",
  "variable": "x"
}
```

**预期结果**：`2*exp(2*x)*log(x) + exp(2*x)/x`

---

## 二、积分求解示例

### 示例1：不定积分（基础）
**问题**：求 ∫(3x² + 2x - 1)dx

**数学表达式**：`∫(3x² + 2x - 1)dx`

**求解过程**：
```
∫(3x² + 2x - 1)dx = ∫3x²dx + ∫2xdx - ∫1dx
                  = x³ + x² - x + C
```

**API调用**：
```json
POST /integral
{
  "expr": "3*x^2 + 2*x - 1",
  "variable": "x"
}
```

**预期结果**：`x**3 + x**2 - x`

---

### 示例2：定积分
**问题**：求 ∫₀¹ x²dx

**数学表达式**：`∫₀¹ x²dx`

**求解过程**：
```
∫₀¹ x²dx = [x³/3]₀¹ = 1³/3 - 0³/3 = 1/3
```

**API调用**：
```json
POST /integral
{
  "expr": "x^2",
  "variable": "x",
  "lower": "0",
  "upper": "1"
}
```

**预期结果**：`1/3`

---

### 示例3：换元积分法
**问题**：求 ∫ x·e^(x²)dx

**数学表达式**：`∫ x·e^(x²)dx`

**求解过程**：
```
设 u = x²，则 du = 2xdx，即 xdx = du/2
∫ x·e^(x²)dx = ∫ e^u · (du/2) = (1/2)e^u + C = (1/2)e^(x²) + C
```

**API调用**：
```json
POST /integral
{
  "expr": "x * exp(x^2)",
  "variable": "x"
}
```

**预期结果**：`exp(x**2)/2`

---

## 三、极限求解示例

### 示例1：基本极限
**问题**：求 lim(x→0) sin(x)/x

**数学表达式**：`lim(x→0) sin(x)/x`

**求解过程**：
```
这是著名的极限，结果为1。
可以使用洛必达法则验证：
lim(x→0) sin(x)/x = lim(x→0) cos(x)/1 = cos(0) = 1
```

**API调用**：
```json
POST /limit
{
  "expr": "sin(x)/x",
  "variable": "x",
  "approach": "0"
}
```

**预期结果**：`1`

---

### 示例2：无穷极限
**问题**：求 lim(x→∞) (1 + 1/x)^x

**数学表达式**：`lim(x→∞) (1 + 1/x)^x`

**求解过程**：
```
这是自然常数e的定义。
lim(x→∞) (1 + 1/x)^x = e ≈ 2.71828...
```

**API调用**：
```json
POST /limit
{
  "expr": "(1 + 1/x)^x",
  "variable": "x",
  "approach": "oo"
}
```

**预期结果**：`E` (即 e)

---

### 示例3：洛必达法则应用
**问题**：求 lim(x→0) (e^x - 1 - x)/x²

**数学表达式**：`lim(x→0) (e^x - 1 - x)/x²`

**求解过程**：
```
当x→0时，分子→0，分母→0，是0/0型未定式。
应用洛必达法则：
lim(x→0) (e^x - 1 - x)/x² = lim(x→0) (e^x - 1)/(2x)
仍然是0/0型，再次应用洛必达：
= lim(x→0) e^x/2 = e^0/2 = 1/2
```

**API调用**：
```json
POST /limit
{
  "expr": "(exp(x) - 1 - x)/x^2",
  "variable": "x",
  "approach": "0"
}
```

**预期结果**：`1/2`

---

## 四、方程求解示例

### 示例1：一元二次方程
**问题**：解方程 x² - 5x + 6 = 0

**数学表达式**：`x² - 5x + 6 = 0`

**求解过程**：
```
因式分解：x² - 5x + 6 = (x-2)(x-3) = 0
解得：x = 2 或 x = 3
```

**API调用**：
```json
POST /solve
{
  "expr": "x^2 - 5*x + 6 = 0",
  "variable": "x"
}
```

**预期结果**：`[2, 3]`

---

### 示例2：三角方程
**问题**：解方程 sin(x) = 1/2

**数学表达式**：`sin(x) = 1/2`

**求解过程**：
```
sin(x) = 1/2
x = π/6 + 2kπ 或 x = 5π/6 + 2kπ，k∈Z
```

**API调用**：
```json
POST /solve
{
  "expr": "sin(x) = 1/2",
  "variable": "x"
}
```

**预期结果**：`π/6` (主值)

---

## 五、测试脚本

```python
import requests
import json

BASE_URL = "http://localhost:8000"

def test_derivative():
    tests = [
        {"expr": "x^3 + 2*x^2 - 5*x + 3", "variable": "x"},
        {"expr": "sin(x^2)", "variable": "x"},
        {"expr": "exp(2*x) * log(x)", "variable": "x"},
    ]
    
    print("=== 导数测试 ===")
    for i, test in enumerate(tests, 1):
        response = requests.post(f"{BASE_URL}/derivative", json=test)
        result = response.json()
        print(f"示例{i}: {test['expr']}")
        print(f"结果: {result.get('result', 'N/A')}")
        print()

def test_integral():
    tests = [
        {"expr": "3*x^2 + 2*x - 1", "variable": "x"},
        {"expr": "x^2", "variable": "x", "lower": "0", "upper": "1"},
        {"expr": "x * exp(x^2)", "variable": "x"},
    ]
    
    print("=== 积分测试 ===")
    for i, test in enumerate(tests, 1):
        response = requests.post(f"{BASE_URL}/integral", json=test)
        result = response.json()
        print(f"示例{i}: ∫{test['expr']}dx")
        print(f"结果: {result.get('result', 'N/A')}")
        print()

def test_limit():
    tests = [
        {"expr": "sin(x)/x", "variable": "x", "approach": "0"},
        {"expr": "(1 + 1/x)^x", "variable": "x", "approach": "oo"},
        {"expr": "(exp(x) - 1 - x)/x^2", "variable": "x", "approach": "0"},
    ]
    
    print("=== 极限测试 ===")
    for i, test in enumerate(tests, 1):
        response = requests.post(f"{BASE_URL}/limit", json=test)
        result = response.json()
        print(f"示例{i}: lim(x→{test['approach']}) {test['expr']}")
        print(f"结果: {result.get('result', 'N/A')}")
        print()

def test_solve():
    tests = [
        {"expr": "x^2 - 5*x + 6 = 0", "variable": "x"},
        {"expr": "sin(x) = 1/2", "variable": "x"},
    ]
    
    print("=== 方程求解测试 ===")
    for i, test in enumerate(tests, 1):
        response = requests.post(f"{BASE_URL}/solve", json=test)
        result = response.json()
        print(f"示例{i}: {test['expr']}")
        print(f"结果: {result.get('result', 'N/A')}")
        print()

if __name__ == "__main__":
    test_derivative()
    test_integral()
    test_limit()
    test_solve()
```

---

## 六、难度递增示例

### 导数难度递增
| 难度 | 示例 | 结果 |
|------|------|------|
| 简单 | x³ | 3x² |
| 中等 | sin(x²) | 2x·cos(x²) |
| 困难 | ln(sin(x))/cos(x) | (cot(x)·cos(x) + ln(sin(x))·sin(x))/cos²(x) |

### 积分难度递增
| 难度 | 示例 | 结果 |
|------|------|------|
| 简单 | x² | x³/3 |
| 中等 | x·e^x | e^x·(x-1) |
| 困难 | e^x·sin(x) | e^x·(sin(x)-cos(x))/2 |

### 极限难度递增
| 难度 | 示例 | 结果 |
|------|------|------|
| 简单 | lim(x→0) x/x | 1 |
| 中等 | lim(x→0) sin(x)/x | 1 |
| 困难 | lim(x→0) (1-cos(x))/x² | 1/2 |
