
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import parse_ode_equation

print("Testing parse_ode_equation with 'y''-3y'+2y=0'...")
try:
    eq, x, y = parse_ode_equation("y''-3y'+2y=0", "y", "x")
    print(f"Success! Parsed equation: {eq}")
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()

print("\nTesting parse_ode_equation with '求解二阶常系数齐次微分方程：y''-3y'+2y=0'...")
try:
    eq, x, y = parse_ode_equation("求解二阶常系数齐次微分方程：y''-3y'+2y=0", "y", "x")
    print(f"Success! Parsed equation: {eq}")
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
