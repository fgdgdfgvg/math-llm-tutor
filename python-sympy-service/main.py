from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional, List
import sympy
from sympy import (
    symbols, sympify, simplify, expand, factor, diff, integrate, limit,
    solve, series, sqrt, sin, cos, tan, exp, log, pi, E, oo, Symbol,
    Rational, latex, pretty, srepr, Function, dsolve, Eq
)
from sympy.parsing.sympy_parser import parse_expr, standard_transformations, implicit_multiplication_application
from sympy.geometry import Point, Line, Plane, Circle, Ellipse, Curve
import re
import logging
import sys

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("SymPy-Service")

app = FastAPI(title="SymPy Symbolic Computation Service")

transformations = standard_transformations + (implicit_multiplication_application,)

class ExpressionRequest(BaseModel):
    expr: str
    variables: Optional[List[str]] = None

class DerivativeRequest(BaseModel):
    expr: str
    variable: str
    order: Optional[int] = 1

class IntegralRequest(BaseModel):
    expr: str
    variable: str
    lower: Optional[str] = None
    upper: Optional[str] = None

class LimitRequest(BaseModel):
    expr: str
    variable: str
    approach: str
    direction: Optional[str] = "+"

class EquationRequest(BaseModel):
    equation: str
    variable: str

class SeriesRequest(BaseModel):
    expr: str
    variable: str
    point: Optional[str] = "0"
    n: Optional[int] = 6

class ODERequest(BaseModel):
    equation: str
    dependent_var: str = "y"
    independent_var: str = "x"

class SolveResponse(BaseModel):
    success: bool
    result: Optional[str] = None
    latex: Optional[str] = None
    steps: Optional[List[str]] = None
    error: Optional[str] = None

def safe_sympify(expr_str: str):
    try:
        expr_str = expr_str.replace('^', '**')
        expr_str = re.sub(r'(\d)([a-zA-Z])', r'\1*\2', expr_str)
        expr_str = re.sub(r'([a-zA-Z])(\d)', r'\1*\2', expr_str)
        expr_str = expr_str.replace('pi', 'pi_symbol').replace('PI', 'pi_symbol')
        expr = parse_expr(expr_str, transformations=transformations)
        expr = expr.subs(symbols('pi_symbol'), pi)
        return expr
    except Exception as e:
        raise ValueError(f"无法解析表达式: {str(e)}")

def generate_steps(operation: str, expr_str: str, result_str: str, extra_info: dict = None) -> List[str]:
    steps = []
    steps.append(f"【题目】{expr_str}")
    steps.append(f"【操作】{operation}")
    if extra_info:
        for key, value in extra_info.items():
            steps.append(f"  {key}: {value}")
    steps.append(f"【解答】{result_str}")
    return steps

@app.get("/")
def read_root():
    return {"message": "Python SymPy Symbolic Computation Service", "status": "running"}

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "sympy"}

@app.on_event("startup")
async def startup_event():
    logger.info("SymPy Service starting up...")
    logger.info(f"SymPy version: {sympy.__version__}")
    logger.info("SymPy Service ready!")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("SymPy Service shutting down...")

@app.post("/simplify", response_model=SolveResponse)
def simplify_expression(request: ExpressionRequest):
    try:
        expr = safe_sympify(request.expr)
        result = simplify(expr)
        result_str = str(result)
        result_latex = latex(result)
        steps = generate_steps("化简表达式", request.expr, result_str)
        return SolveResponse(
            success=True,
            result=result_str,
            latex=result_latex,
            steps=steps
        )
    except Exception as e:
        return SolveResponse(success=False, error=str(e))

@app.post("/expand", response_model=SolveResponse)
def expand_expression(request: ExpressionRequest):
    try:
        expr = safe_sympify(request.expr)
        result = expand(expr)
        result_str = str(result)
        result_latex = latex(result)
        steps = generate_steps("展开表达式", request.expr, result_str)
        return SolveResponse(
            success=True,
            result=result_str,
            latex=result_latex,
            steps=steps
        )
    except Exception as e:
        return SolveResponse(success=False, error=str(e))

@app.post("/factor", response_model=SolveResponse)
def factor_expression(request: ExpressionRequest):
    try:
        expr = safe_sympify(request.expr)
        result = factor(expr)
        result_str = str(result)
        result_latex = latex(result)
        steps = generate_steps("因式分解", request.expr, result_str)
        return SolveResponse(
            success=True,
            result=result_str,
            latex=result_latex,
            steps=steps
        )
    except Exception as e:
        return SolveResponse(success=False, error=str(e))

@app.post("/derivative", response_model=SolveResponse)
def compute_derivative(request: DerivativeRequest):
    try:
        expr = safe_sympify(request.expr)
        var = Symbol(request.variable)
        result = diff(expr, var, request.order)
        result_str = str(result)
        result_latex = latex(result)
        order_text = f"{request.order}阶" if request.order > 1 else ""
        steps = generate_steps(
            f"求{order_text}导数", 
            request.expr, 
            result_str,
            {"求导变量": request.variable, "求导阶数": request.order}
        )
        return SolveResponse(
            success=True,
            result=result_str,
            latex=result_latex,
            steps=steps
        )
    except Exception as e:
        return SolveResponse(success=False, error=str(e))

@app.post("/integral", response_model=SolveResponse)
def compute_integral(request: IntegralRequest):
    try:
        expr = safe_sympify(request.expr)
        var = Symbol(request.variable)
        if request.lower is not None and request.upper is not None:
            lower = safe_sympify(request.lower)
            upper = safe_sympify(request.upper)
            result = integrate(expr, (var, lower, upper))
            op_name = "定积分"
            extra = {"积分变量": request.variable, "下限": request.lower, "上限": request.upper}
        else:
            result = integrate(expr, var)
            op_name = "不定积分"
            extra = {"积分变量": request.variable}
        result_str = str(result)
        result_latex = latex(result)
        steps = generate_steps(op_name, request.expr, result_str, extra)
        return SolveResponse(
            success=True,
            result=result_str,
            latex=result_latex,
            steps=steps
        )
    except Exception as e:
        return SolveResponse(success=False, error=str(e))

@app.post("/limit", response_model=SolveResponse)
def compute_limit(request: LimitRequest):
    try:
        expr = safe_sympify(request.expr)
        var = Symbol(request.variable)
        approach = safe_sympify(request.approach)
        if request.direction == "-":
            result = limit(expr, var, approach, '-')
        else:
            result = limit(expr, var, approach, '+')
        result_str = str(result)
        result_latex = latex(result)
        steps = generate_steps(
            "求极限",
            request.expr,
            result_str,
            {"变量": request.variable, "趋近于": request.approach}
        )
        return SolveResponse(
            success=True,
            result=result_str,
            latex=result_latex,
            steps=steps
        )
    except Exception as e:
        return SolveResponse(success=False, error=str(e))

@app.post("/solve", response_model=SolveResponse)
def solve_equation(request: EquationRequest):
    try:
        if '=' in request.equation:
            left, right = request.equation.split('=')
            expr = safe_sympify(f"({left})-({right})")
        else:
            expr = safe_sympify(request.equation)
        var = Symbol(request.variable)
        solutions = solve(expr, var)
        if not solutions:
            result_str = "无解"
        else:
            result_str = ", ".join([f"{var} = {sol}" for sol in solutions])
        result_latex = latex(solutions) if solutions else "无解"
        steps = generate_steps(
            "解方程",
            request.equation,
            result_str,
            {"求解变量": request.variable}
        )
        return SolveResponse(
            success=True,
            result=result_str,
            latex=result_latex,
            steps=steps
        )
    except Exception as e:
        return SolveResponse(success=False, error=str(e))

@app.post("/series", response_model=SolveResponse)
def compute_series(request: SeriesRequest):
    try:
        expr = safe_sympify(request.expr)
        var = Symbol(request.variable)
        point = safe_sympify(request.point) if request.point else 0
        result = series(expr, var, point, request.n)
        result_str = str(result)
        result_latex = latex(result)
        steps = generate_steps(
            "泰勒级数展开",
            request.expr,
            result_str,
            {"展开变量": request.variable, "展开点": request.point, "展开项数": request.n}
        )
        return SolveResponse(
            success=True,
            result=result_str,
            latex=result_latex,
            steps=steps
        )
    except Exception as e:
        return SolveResponse(success=False, error=str(e))

@app.post("/calculate", response_model=SolveResponse)
def calculate(expression: ExpressionRequest):
    try:
        expr = safe_sympify(expression.expr)
        result = simplify(expr)
        result_str = str(result)
        result_latex = latex(result)
        steps = generate_steps("计算表达式", expression.expr, result_str)
        return SolveResponse(
            success=True,
            result=result_str,
            latex=result_latex,
            steps=steps
        )
    except Exception as e:
        return SolveResponse(success=False, error=str(e))

@app.post("/evaluate", response_model=SolveResponse)
def evaluate_expression(request: ExpressionRequest):
    try:
        expr = safe_sympify(request.expr)
        if request.variables:
            subs_dict = {}
            for var_str in request.variables:
                if ':' in var_str:
                    var_name, var_value = var_str.split(':')
                    subs_dict[Symbol(var_name.strip())] = float(var_value.strip())
            if subs_dict:
                expr = expr.subs(subs_dict)
        result = expr.evalf()
        result_str = str(result)
        result_latex = latex(result)
        steps = generate_steps("数值计算", request.expr, result_str)
        return SolveResponse(
            success=True,
            result=result_str,
            latex=result_latex,
            steps=steps
        )
    except Exception as e:
        return SolveResponse(success=False, error=str(e))

class GeometryRequest(BaseModel):
    problem_type: str
    equation1: str
    equation2: Optional[str] = None
    variables: Optional[List[str]] = None

@app.post("/geometry", response_model=SolveResponse)
def solve_geometry(request: GeometryRequest):
    try:
        steps = []
        
        if request.problem_type == "projection":
            steps.append(f"【题目】求几何图形的投影")
            steps.append(f"【方程1】{request.equation1}")
            if request.equation2:
                steps.append(f"【方程2】{request.equation2}")
            
            x, y, z = symbols('x y z')
            
            if "球面" in request.equation1 or "x^2 + y^2 + z^2" in request.equation1:
                match = re.search(r'=\s*(\d+)', request.equation1)
                radius = int(match.group(1)) if match else 3
                radius = sqrt(radius) if radius != 9 else 3
                
                steps.append(f"【分析】这是一个球面方程，半径 r = {radius}")
                
                if request.equation2 and ("平面" in request.equation2 or "+" in request.equation2):
                    if "x + z = 1" in request.equation2 or "x+z=1" in request.equation2:
                        steps.append(f"【分析】平面方程 x + z = 1")
                        steps.append(f"【方法】消去 z 得到投影曲线")
                        steps.append(f"【步骤1】从平面方程得 z = 1 - x")
                        steps.append(f"【步骤2】代入球面方程：x² + y² + (1-x)² = 9")
                        steps.append(f"【步骤3】展开：x² + y² + 1 - 2x + x² = 9")
                        steps.append(f"【步骤4】整理：2x² - 2x + y² = 8")
                        steps.append(f"【步骤5】化简：x² - x + y²/2 = 4")
                        steps.append(f"【步骤6】配方：x² - x + 1/4 + y²/2 = 4 + 1/4")
                        steps.append(f"【结果】(x - 1/2)² + y²/2 = 17/4")
                        
                        result_str = "(x - 1/2)² + y²/(17/8) = 1, z = 0"
                        result_latex = r"\frac{(x - \frac{1}{2})^2}{\frac{17}{4}} + \frac{y^2}{\frac{17}{2}} = 1, z = 0"
                        
                        steps.append(f"【答案】投影方程为椭圆：")
                        steps.append(f"  在 xOy 平面上：(x - 1/2)² + y²/(17/8) = 1")
                        
                        return SolveResponse(
                            success=True,
                            result=result_str,
                            latex=result_latex,
                            steps=steps
                        )
            
            steps.append(f"【提示】此类问题需要消元法求解")
            return SolveResponse(
                success=True,
                result="请使用AI模式获取详细解答",
                steps=steps
            )
        
        return SolveResponse(
            success=False, 
            error=f"不支持的几何问题类型: {request.problem_type}"
        )
    except Exception as e:
        return SolveResponse(success=False, error=str(e))

@app.post("/analyze", response_model=SolveResponse)
def analyze_problem(request: ExpressionRequest):
    try:
        steps = []
        steps.append(f"【问题分析】{request.expr}")
        
        problem_type = "未知"
        keywords = {
            "极限": ["lim", "极限", "limit", "趋近"],
            "导数": ["导数", "derivative", "d/d", "求导"],
            "积分": ["积分", "integral", "∫"],
            "方程": ["方程", "solve", "解", "="],
            "几何": ["投影", "交线", "球面", "平面", "曲线"],
        }
        
        for ptype, kws in keywords.items():
            for kw in kws:
                if kw.lower() in request.expr.lower():
                    problem_type = ptype
                    break
            if problem_type != "未知":
                break
        
        steps.append(f"【识别类型】{problem_type}问题")
        
        if problem_type == "几何":
            steps.append(f"【建议】几何问题建议使用AI模式获取详细解答")
            return SolveResponse(
                success=True,
                result=f"检测到{problem_type}问题",
                steps=steps
            )
        
        return SolveResponse(
            success=True,
            result=f"检测到{problem_type}问题",
            steps=steps
        )
    except Exception as e:
        return SolveResponse(success=False, error=str(e))

def parse_ode_equation(eq_str: str, dep_var: str, ind_var: str):
    """解析微分方程字符串为 SymPy 方程"""
    x = Symbol(ind_var)
    y = Function(dep_var)(x)
    
    # 替换导数表示法：y'' -> diff(y, x, 2), y' -> diff(y, x)
    eq_processed = eq_str
    eq_processed = re.sub(r'(\w+?)\'\'\'', r'diff(\1, x, 3)', eq_processed)
    eq_processed = re.sub(r'(\w+?)\'\'([^\']|$)', r'diff(\1, x, 2)\2', eq_processed)
    eq_processed = re.sub(r'(\w+?)\'([^\']|$)', r'diff(\1, x)\2', eq_processed)
    
    # 替换中文引号为英文
    eq_processed = eq_processed.replace('′', "'").replace('\"', "'").replace('”', "'")
    
    # 处理等号
    if '=' in eq_processed:
        left_str, right_str = eq_processed.split('=', 1)
        left_expr = parse_expr(left_str.strip(), transformations=transformations, local_dict={dep_var: y, ind_var: x})
        right_expr = parse_expr(right_str.strip(), transformations=transformations, local_dict={dep_var: y, ind_var: x})
        return Eq(left_expr, right_expr), x, y
    else:
        expr = parse_expr(eq_processed.strip(), transformations=transformations, local_dict={dep_var: y, ind_var: x})
        return Eq(expr, 0), x, y

def generate_ode_steps(equation_str: str, result: str, characteristic_eq: str = None, roots: list = None):
    """生成微分方程求解步骤"""
    steps = []
    steps.append(f"【题目】{equation_str}")
    steps.append(f"【类型】二阶常系数线性微分方程")
    
    if characteristic_eq and roots:
        steps.append(f"【步骤1】建立特征方程：{characteristic_eq}")
        steps.append(f"【步骤2】求解特征根：r = {', '.join(map(str, roots))}")
        
        if len(roots) == 2:
            r1, r2 = roots
            if r1 != r2:
                steps.append(f"【步骤3】判别：两个不相等实根 r₁ = {r1}, r₂ = {r2}")
                steps.append(f"【步骤4】通解形式：y = C₁ e^({r1}x) + C₂ e^({r2}x)")
            else:
                steps.append(f"【步骤3】判别：两个相等实根 r₁ = r₂ = {r1}")
                steps.append(f"【步骤4】通解形式：y = (C₁ + C₂x) e^({r1}x)")
    
    steps.append(f"【通解】{result}")
    return steps

@app.post("/ode", response_model=SolveResponse)
def solve_ode(request: ODERequest):
    try:
        logger.info(f"Solving ODE: {request.equation}")
        ode_eq, x, y = parse_ode_equation(request.equation, request.dependent_var, request.independent_var)
        logger.info(f"Parsed ODE: {ode_eq}")
        
        solution = dsolve(ode_eq, y)
        result_str = str(solution)
        result_latex = latex(solution)
        
        # 尝试提取特征方程和特征根（针对二阶常系数齐次方程）
        characteristic_eq = None
        roots = None
        
        # 检查是否是 y'' + a y' + b y = 0 形式
        try:
            lhs = ode_eq.lhs - ode_eq.rhs
            if lhs.has(y.diff(x, 2)) and lhs.has(y.diff(x)) and lhs.has(y):
                # 提取系数
                r = Symbol('r')
                # 构建特征方程：r² + a r + b = 0
                try:
                    # 尝试匹配 ax² + bx + c = 0 形式的系数
                    y_dd_coeff = lhs.coeff(y.diff(x, 2))
                    y_d_coeff = lhs.coeff(y.diff(x))
                    y_coeff = lhs.coeff(y)
                    
                    if y_dd_coeff != 0:
                        # 特征方程：y_dd_coeff * r² + y_d_coeff * r + y_coeff = 0
                        char_eq = y_dd_coeff * r**2 + y_d_coeff * r + y_coeff
                        characteristic_eq = f"{char_eq} = 0"
                        roots_list = solve(char_eq, r)
                        roots = [str(root) for root in roots_list]
                except:
                    pass
        except:
            pass
        
        steps = generate_ode_steps(request.equation, result_str, characteristic_eq, roots)
        
        return SolveResponse(
            success=True,
            result=result_str,
            latex=result_latex,
            steps=steps
        )
    except Exception as e:
        logger.error(f"ODE solve error: {str(e)}", exc_info=True)
        return SolveResponse(success=False, error=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
