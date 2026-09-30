
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import solve_ode
from pydantic import BaseModel

class ODERequest(BaseModel):
    equation: str
    dependent_var: str = "y"
    independent_var: str = "x"

# Test 1
print("Test 1: y''-3y'+2y=0")
req1 = ODERequest(equation="y''-3y'+2y=0")
result1 = solve_ode(req1)
print(f"Success: {result1.success}")
print(f"Result: {result1.result}")
print(f"Steps: {result1.steps}")
print(f"Error: {result1.error}")

print("\n" + "="*50 + "\n")

# Test 2 with Chinese prefix
print("Test 2: 求解二阶常系数齐次微分方程：y''-3y'+2y=0")
req2 = ODERequest(equation="求解二阶常系数齐次微分方程：y''-3y'+2y=0")
result2 = solve_ode(req2)
print(f"Success: {result2.success}")
print(f"Result: {result2.result}")
print(f"Steps: {result2.steps}")
print(f"Error: {result2.error}")
