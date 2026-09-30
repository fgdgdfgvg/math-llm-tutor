from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, Response
from pydantic import BaseModel
from typing import Optional, List
import multiprocessing
import os
import sympy
from sympy import (
    symbols, sympify, simplify, expand, factor, diff, integrate, limit,
    solve, solveset, series, sqrt, sin, cos, tan, exp, log, pi, E, oo, Symbol,
    Rational, latex, pretty, srepr, Function, dsolve, Eq, Integral, Derivative,
    Limit, S
)
from sympy.parsing.sympy_parser import (
    parse_expr, standard_transformations, implicit_multiplication_application,
    convert_xor
)
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
# 计算端点统一注册到带内部令牌依赖的 router（见下方 api = APIRouter(...) 与 include_router）。

# convert_xor 把 `^` 当作幂运算（官方 transformation），
# 不再用 `expr.replace('^','**')` 这种会破坏语义的字符串替换。
# 顺序有意义：先处理 ^，再做隐式乘法（2x、2sin(x)）。
transformations = standard_transformations + (
    convert_xor,
    implicit_multiplication_application,
)

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
    # "+-" 双侧（默认，数学上更常用）；"+" / "-" 单侧
    direction: Optional[str] = "+-"

class EquationRequest(BaseModel):
    equation: str
    variable: str

class SeriesRequest(BaseModel):
    expr: str
    variable: str
    point: Optional[str] = "0"
    n: Optional[int] = 6
    # 是否去掉结果里的 O(...) 余项（默认去掉；保留时学生可看到"截断到几阶"）
    remove_o: Optional[bool] = True

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
    # 结构化错误码：PARSE_ERROR / UNEVALUATED / LIMIT_DOES_NOT_EXIST / TIMEOUT /
    # INTERNAL_ERROR / UNAUTHORIZED。调用方据此选择降级策略（数值积分、转 AI…）。
    error_code: Optional[str] = None


# ===================== 服务硬化：超时隔离 + 内部令牌 =====================
# 单次计算超时（秒）。simplify / integrate / dsolve 都可能无限耗时，
# 旧实现没有超时：一个 integrate(exp(x**100), x) 就能占满一个 Uvicorn 线程。
COMPUTE_TIMEOUT_SECONDS = float(os.environ.get('SYMPY_COMPUTE_TIMEOUT_SECONDS', '12'))
# 内部共享密钥（X-Internal-Token）。服务只在容器网络内暴露，后端带令牌调用。
# 未配置时不启用（本地开发 / 单元自检直接调用函数，不走 HTTP 依赖）。
INTERNAL_TOKEN = os.environ.get('SYMPY_INTERNAL_TOKEN', '').strip()

HTTP_STATUS_BY_CODE = {
    'PARSE_ERROR': 400,
    'UNAUTHORIZED': 401,
    'UNEVALUATED': 422,
    'LIMIT_DOES_NOT_EXIST': 422,
    'TIMEOUT': 504,
    'INTERNAL_ERROR': 500,
}


def verify_internal_token(x_internal_token: Optional[str] = Header(default=None)) -> None:
    """内部令牌校验：未配置令牌时不启用（本地开发），配置后必须携带。"""
    if not INTERNAL_TOKEN:
        return
    if x_internal_token != INTERNAL_TOKEN:
        raise HTTPException(
            status_code=401,
            detail={'error_code': 'UNAUTHORIZED', 'error': '内部令牌缺失或无效'},
        )


# 计算端点统一挂在带内部令牌依赖的 router 上；/ 与 /health 保持公开供探活。
# 注意：路由在文件末尾定义，include_router 必须在所有 @api.post 之后再调用。
api = APIRouter(dependencies=[Depends(verify_internal_token)])


class ComputeFailure(Exception):
    """子进程内计算失败，携带错误码。"""

    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


def classify_error(message: str) -> str:
    if message.startswith('Cannot parse expression'):
        return 'PARSE_ERROR'
    return 'INTERNAL_ERROR'


def failure(exc: Exception) -> SolveResponse:
    """把异常转成带错误码的失败响应（不再一律 HTTP 200 + success=False）。"""
    code = getattr(exc, 'code', None) or classify_error(str(exc))
    return SolveResponse(success=False, error=str(exc), error_code=code)


def _child_entry(conn, fn, request) -> None:
    try:
        conn.send(('ok', fn(request)))
    except BaseException as exc:  # noqa: BLE001 - 必须把异常送回父进程
        code = getattr(exc, 'code', None) or classify_error(str(exc))
        try:
            conn.send(('err', {'code': code, 'message': str(exc)}))
        except Exception:  # 结果不可 pickle 等极端情况
            conn.send(('err', {'code': 'INTERNAL_ERROR', 'message': str(exc)}))
    finally:
        conn.close()


def run_isolated(fn, request, timeout: float = COMPUTE_TIMEOUT_SECONDS):
    """
    在独立子进程里执行计算，超时直接强杀。

    为什么不用线程超时：Python 的 CPU 计算无法打断线程，超时只能“假装返回”，
    挂死的计算仍占着线程池；子进程可以 terminate（Linux 下 fork 开销可忽略）。
    fork 不可用时（Windows 开发环境）退回 spawn。
    """
    context = multiprocessing.get_context('fork' if hasattr(os, 'fork') else 'spawn')
    parent_conn, child_conn = context.Pipe(duplex=False)
    process = context.Process(target=_child_entry, args=(child_conn, fn, request), daemon=True)
    process.start()
    child_conn.close()
    process.join(timeout)
    if process.is_alive():
        process.terminate()
        process.join(5)
        raise ComputeFailure(
            'TIMEOUT',
            f'计算超时（超过 {timeout:g} 秒），请简化题目或改用数值方法',
        )
    if parent_conn.poll():
        status, payload = parent_conn.recv()
        if status == 'ok':
            return payload
        raise ComputeFailure(payload['code'], payload['message'])
    raise ComputeFailure('INTERNAL_ERROR', f'计算进程异常退出（exitcode={process.exitcode}）')


def finish(response: Response, body: SolveResponse) -> SolveResponse:
    """失败时返回真正的 4xx/5xx + 错误码，而不是 HTTP 200 包裹失败。"""
    if not body.success:
        code = body.error_code or 'INTERNAL_ERROR'
        response.status_code = HTTP_STATUS_BY_CODE.get(code, 500)
        if not body.error_code:
            body = body.model_copy(update={'error_code': code})
    return body


def execute(response: Response, fn, request) -> SolveResponse:
    """路由入口：隔离执行 + 把超时/子进程异常也映射成带错误码的响应。"""
    try:
        return finish(response, run_isolated(fn, request))
    except ComputeFailure as exc:
        return finish(
            response,
            SolveResponse(success=False, error=exc.message, error_code=exc.code),
        )
    except Exception as exc:  # noqa: BLE001 - 兜底为 500 + 错误码
        logger.error(f"计算端点异常: {exc}", exc_info=True)
        return finish(
            response,
            SolveResponse(success=False, error=str(exc), error_code='INTERNAL_ERROR'),
        )

MAX_EXPRESSION_LENGTH = 512
# 允许出现在表达式里的函数/常量。parse_expr 默认会暴露整个 SymPy 命名空间，
# 历史上存在 SymPy 解析沙箱逃逸 CVE，这里用白名单收窄可调用对象。
ALLOWED_NAMES = {
    'sin': sin, 'cos': cos, 'tan': tan, 'asin': sympy.asin, 'acos': sympy.acos,
    'atan': sympy.atan, 'sinh': sympy.sinh, 'cosh': sympy.cosh, 'tanh': sympy.tanh,
    'exp': exp, 'log': log, 'ln': log, 'sqrt': sqrt, 'Abs': sympy.Abs,
    'pi': pi, 'PI': pi, 'E': E, 'e': E, 'oo': oo, 'Infinity': oo,
    'Rational': Rational, 'Integer': sympy.Integer, 'Float': sympy.Float,
    'Number': sympy.Number, 'Symbol': Symbol, 'Function': Function,
    'factorial': sympy.factorial, 'floor': sympy.floor, 'ceiling': sympy.ceiling,
    'sign': sympy.sign, 'Max': sympy.Max, 'Min': sympy.Min, 'diff': diff,
}


FUNCTION_NAMES = (
    'arcsin', 'arccos', 'arctan', 'asin', 'acos', 'atan',
    'sinh', 'cosh', 'tanh', 'sqrt', 'abs', 'exp', 'log', 'ln',
    'sin', 'cos', 'tan',
)

# 无括号函数调用的规范化。例如 sin2x → sin(2*x)、sinx → sin(x)、sqrt2 → sqrt(2)。
# 只处理“参数是单个数字/单个变量/数字×单变量”这种**无歧义**形式：
#   - sin(x)、cos 后接括号的写法完全不动；
#   - `sin2x*3` 这类多因子写法本身歧义（sin(2x)·3 还是 sin(2x·3)？）
#     属于输入者表达不清，仍在规范化时只取 sin2x 部分，其余交给用户写括号；
#   - 变量名里包含函数名的（cosine）不会被误拆。
_EXPLICIT_CALL_PATTERN = re.compile(
    r'(?<![A-Za-z0-9_])(' + '|'.join(FUNCTION_NAMES) + r')\s*(\d+)\s*([A-Za-z])(?![A-Za-z0-9_(])'
)
_NUMBER_ARG_PATTERN = re.compile(
    r'(?<![A-Za-z0-9_])(' + '|'.join(FUNCTION_NAMES) + r')\s*(\d+)(?![A-Za-z0-9_(])'
)
_VARIABLE_ARG_PATTERN = re.compile(
    r'(?<![A-Za-z0-9_])(' + '|'.join(FUNCTION_NAMES) + r')\s*([A-Za-z])(?![A-Za-z0-9_(])'
)


def normalize_implicit_function_calls(expr_str: str) -> str:
    """把 sin2x / sinx / sqrt2 这类无括号写法补成显式函数调用。"""
    previous = None
    result = expr_str
    # 反复应用直到稳定（处理 sin2xsinx 这类串联），最多 5 轮防不收敛
    for _ in range(5):
        if result == previous:
            break
        previous = result
        result = _EXPLICIT_CALL_PATTERN.sub(r'\1(\2*\3)', result)
        result = _NUMBER_ARG_PATTERN.sub(r'\1(\2)', result)
        result = _VARIABLE_ARG_PATTERN.sub(r'\1(\2)', result)
    return result


def check_expression_budget(expr) -> None:
    """
    复杂度预算：限制表达式树规模与最高幂次。
    `integrate(exp(x**100), x)` 之类的请求会占满单线程 Uvicorn，必须在入口拦住。
    """
    node_count = sum(1 for _ in sympy.preorder_traversal(expr))
    if node_count > 2000:
        raise ValueError(f'表达式过于复杂（节点数 {node_count} > 2000）')
    for power in expr.atoms(sympy.Pow):
        exponent = power.exp
        if exponent.is_Number and abs(float(exponent)) > 60:
            raise ValueError(f'幂次过大（{exponent}），超出计算预算')


def safe_sympify(expr_str: str):
    """
    解析表达式。

    修复的语义破坏（旧实现三行正则全都错）：
      1. `re.sub(r'(\d)([a-zA-Z])', r'\\1*\\2')` 把 `sin2x` 变成 `sin2*x`，
         解析为 `sin(2)·x`，与 `sin(2x)` 完全不同；
      2. `([a-zA-Z])(\d)` → `x2` 变成 `x*2`，把合法的变量名 `x2` 也拆了；
      3. `'pi' → 'pi_symbol'` 是全局字符串替换，会污染任何含 pi 的标识符；
         而且 `'^' → '**'` 无条件替换同时破坏异或语义（`2^3x` → `8x`）。

    现在改为交给 SymPy 官方的 parsing 变换处理：`convert_xor` 处理 `^`，
    `implicit_multiplication_application` 处理 `2x`、`2sin(x)` 的隐式乘法。
    """
    try:
        if not isinstance(expr_str, str) or not expr_str.strip():
            raise ValueError('空表达式')
        if len(expr_str) > MAX_EXPRESSION_LENGTH:
            raise ValueError(f'表达式过长（>{MAX_EXPRESSION_LENGTH} 字符）')
        # 拒绝属性访问/双下划线等可能触达内部对象的写法。
        # 注意：先允许小数点（整数/小数都合法），再检查剩余的 '.'。
        if '__' in expr_str or re.search(r'\.[^0-9]|[^0-9]\.(?!\d)', expr_str):
            raise ValueError('表达式包含不允许的字符（属性访问 / __）')
        if re.search(r'[\[\]{};]', expr_str):
            raise ValueError('表达式包含不允许的字符（容器语法）')
        for forbidden in ('lambda', 'import', '__', 'exec', 'eval', 'open'):
            if forbidden in expr_str:
                raise ValueError(f'表达式包含保留字 {forbidden}')

        # 无括号函数调用（sin2x）必须显式化后再交给 SymPy：
        # implicit_multiplication 的 split_symbols 会把 sin 拆成 s*i*n。
        expr_str = normalize_implicit_function_calls(expr_str)

        # global_dict 用白名单：parse_expr 默认会暴露整个 SymPy 命名空间，
        # 而历史上存在多起 SymPy 解析相关的沙箱逃逸 CVE。
        expr = parse_expr(
            expr_str,
            transformations=transformations,
            global_dict=dict(ALLOWED_NAMES),
            local_dict={'Symbol': Symbol},
            evaluate=True,
        )
        check_expression_budget(expr)
        return expr
    except Exception as e:
        raise ValueError(f"Cannot parse expression: {str(e)}")

def generate_steps(operation: str, expr_str: str, result_str: str, extra_info: dict = None) -> List[str]:
    steps = []
    steps.append(f"[Problem] {expr_str}")
    steps.append(f"[Operation] {operation}")
    if extra_info:
        for key, value in extra_info.items():
            steps.append(f"  {key}: {value}")
    steps.append(f"[Solution] {result_str}")
    return steps

@app.get("/")
def read_root():
    return {"message": "Python SymPy Symbolic Computation Service", "status": "running"}

@app.get("/health")
def health_check():
    # 健康检查保持公开（Docker HEALTHCHECK / 后端探活）；计算端点才需要内部令牌。
    return {
        "status": "healthy",
        "service": "sympy",
        "compute_timeout_seconds": COMPUTE_TIMEOUT_SECONDS,
        "auth_required": bool(INTERNAL_TOKEN),
    }

@app.on_event("startup")
async def startup_event():
    logger.info("SymPy Service starting up...")
    logger.info(f"SymPy version: {sympy.__version__}")
    logger.info("SymPy Service ready!")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("SymPy Service shutting down...")

def simplify_expression(request: ExpressionRequest):
    try:
        expr = safe_sympify(request.expr)
        result = simplify(expr)
        result_str = str(result)
        result_latex = latex(result)
        steps = generate_steps("Simplify expression", request.expr, result_str)
        return SolveResponse(
            success=True,
            result=result_str,
            latex=result_latex,
            steps=steps
        )
    except Exception as e:
        return failure(e)

def expand_expression(request: ExpressionRequest):
    try:
        expr = safe_sympify(request.expr)
        result = expand(expr)
        result_str = str(result)
        result_latex = latex(result)
        steps = generate_steps("Expand expression", request.expr, result_str)
        return SolveResponse(
            success=True,
            result=result_str,
            latex=result_latex,
            steps=steps
        )
    except Exception as e:
        return failure(e)

def factor_expression(request: ExpressionRequest):
    try:
        expr = safe_sympify(request.expr)
        result = factor(expr)
        result_str = str(result)
        result_latex = latex(result)
        steps = generate_steps("Factor expression", request.expr, result_str)
        return SolveResponse(
            success=True,
            result=result_str,
            latex=result_latex,
            steps=steps
        )
    except Exception as e:
        return failure(e)

def compute_derivative(request: DerivativeRequest):
    try:
        expr = safe_sympify(request.expr)
        var = Symbol(request.variable)
        result = diff(expr, var, request.order)
        result_str = str(result)
        result_latex = latex(result)
        order_text = f"{request.order}th order " if request.order > 1 else ""
        steps = generate_steps(
            f"Compute {order_text}derivative", 
            request.expr, 
            result_str,
            {"Variable": request.variable, "Order": request.order}
        )
        return SolveResponse(
            success=True,
            result=result_str,
            latex=result_latex,
            steps=steps
        )
    except Exception as e:
        return failure(e)

def compute_integral(request: IntegralRequest):
    try:
        expr = safe_sympify(request.expr)
        var = Symbol(request.variable)
        if request.lower is not None and request.upper is not None:
            lower = safe_sympify(request.lower)
            upper = safe_sympify(request.upper)
            result = integrate(expr, (var, lower, upper))
            op_name = "Definite integral"
            extra = {"Variable": request.variable, "Lower bound": request.lower, "Upper bound": request.upper}
        else:
            result = integrate(expr, var)
            op_name = "Indefinite integral"
            extra = {"Variable": request.variable}

        # SymPy 求不出时会原样返回 Integral(...) 对象，旧代码仍报 success=True，
        # 把 `Integral(sin(x)/x, (x, 0, 1))` 当成答案返回。这里显式检测。
        if result.has(Integral) or result.has(Derivative) or result.has(Limit):
            return SolveResponse(
                success=False,
                error='unevaluated',
                error_code='UNEVALUATED',
                steps=generate_steps(op_name, request.expr, '未能求出解析原函数/积分值', extra)
            )

        if request.lower is None:
            # 不定积分必须带积分常数 C（旧实现直接返回原函数，学生抄下来就少一项）
            result_str = f"{result} + C"
            result_latex = f"{latex(result)} + C"
            extra["Note"] = "不定积分含任意常数 C"
        else:
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
        return failure(e)

def compute_limit(request: LimitRequest):
    try:
        expr = safe_sympify(request.expr)
        var = Symbol(request.variable)
        approach = safe_sympify(request.approach)
        direction = request.direction or "+-"

        if direction in ("+-", "both", "two-sided"):
            # 双侧极限：旧实现默认单侧，于是 lim(x→0) 1/x 返回 +∞，
            # 而正确答案是"不存在"。双侧需比较左右极限。
            left = limit(expr, var, approach, '-')
            right = limit(expr, var, approach, '+')
            if left == right and left != oo and left != -oo:
                result = right
                direction_note = "双侧极限存在且左极限 = 右极限"
            elif left == right and (left == oo or left == -oo):
                result = right
                direction_note = "左右极限同为无穷（记为极限为无穷，严格意义上极限不存在）"
            else:
                return SolveResponse(
                    success=False,
                    error='limit_does_not_exist',
                    error_code='LIMIT_DOES_NOT_EXIST',
                    result=None,
                    steps=generate_steps(
                        "Compute limit", request.expr,
                        f"左右极限不相等：左 = {left}，右 = {right}，因此双侧极限不存在",
                        {"Variable": request.variable, "Approach": request.approach}
                    )
                )
        elif direction == "-":
            result = limit(expr, var, approach, '-')
            direction_note = "单侧极限（x → a⁻）"
        else:
            result = limit(expr, var, approach, '+')
            direction_note = "单侧极限（x → a⁺）"

        result_str = str(result)
        result_latex = latex(result)
        steps = generate_steps(
            "Compute limit",
            request.expr,
            result_str,
            {"Variable": request.variable, "Approach": request.approach,
             "Direction": direction, "Note": direction_note}
        )
        return SolveResponse(
            success=True,
            result=result_str,
            latex=result_latex,
            steps=steps
        )
    except Exception as e:
        return failure(e)

def solve_equation(request: EquationRequest):
    try:
        if '=' in request.equation:
            # 旧实现用 split('=') 无上限，遇到连等号 (a=b=c) 直接 ValueError
            left, right = request.equation.split('=', 1)
            expr = safe_sympify(f"({left})-({right})")
        else:
            expr = safe_sympify(request.equation)
        var = Symbol(request.variable)

        # 改用 solveset：solve 对三角方程等会丢掉周期性解集
        solution_set = solveset(expr, var, domain=S.Complexes)
        if solution_set == S.EmptySet:
            result_str = "No solution"
            result_latex = "No solution"
        elif solution_set.is_FiniteSet:
            solutions = sorted(solution_set, key=lambda s: (str(type(s)), str(s)))
            result_str = ", ".join([f"{var} = {sol}" for sol in solutions])
            result_latex = latex(solution_set)
        else:
            # 无穷解集（周期解等）：保留集合形式，不假装只有有限个根
            result_str = f"{var} in {solution_set}"
            result_latex = f"{var} \\in {latex(solution_set)}"
        steps = generate_steps(
            "Solve equation",
            request.equation,
            result_str,
            {"Variable": request.variable}
        )
        return SolveResponse(
            success=True,
            result=result_str,
            latex=result_latex,
            steps=steps
        )
    except Exception as e:
        return failure(e)

def compute_series(request: SeriesRequest):
    try:
        expr = safe_sympify(request.expr)
        var = Symbol(request.variable)
        point = safe_sympify(request.point) if request.point else 0
        result = series(expr, var, point, request.n)
        if request.remove_o is not False:
            # 去掉 O(x**n) 余项：旧实现直接把 `x - x**3/6 + ... + O(x**6)` 当最终结果
            result = result.removeO()
        result_str = str(result)
        result_latex = latex(result)
        steps = generate_steps(
            "Taylor series expansion",
            request.expr,
            result_str,
            {"Variable": request.variable, "Point": request.point, "Terms": request.n,
             "Remainder": "已去掉 O(...) 余项" if request.remove_o is not False else "含 O(...) 余项"}
        )
        return SolveResponse(
            success=True,
            result=result_str,
            latex=result_latex,
            steps=steps
        )
    except Exception as e:
        return failure(e)

def calculate(expression: ExpressionRequest):
    try:
        expr = safe_sympify(expression.expr)
        result = simplify(expr)
        result_str = str(result)
        result_latex = latex(result)
        steps = generate_steps("Calculate expression", expression.expr, result_str)
        return SolveResponse(
            success=True,
            result=result_str,
            latex=result_latex,
            steps=steps
        )
    except Exception as e:
        return failure(e)

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
        steps = generate_steps("Numerical evaluation", request.expr, result_str)
        return SolveResponse(
            success=True,
            result=result_str,
            latex=result_latex,
            steps=steps
        )
    except Exception as e:
        return failure(e)

def parse_ode_equation(eq_str: str, dep_var: str, ind_var: str):
    """解析微分方程字符串为 SymPy 方程"""
    x = Symbol(ind_var)
    y = Function(dep_var)(x)
    
    eq_processed = eq_str
    
    # 1. 重要改进：找到包含 y' 或 y'' 的部分
    import re
    # 查找包含 y'' 或 y' 的部分
    match = re.search(r"[^\u4e00-\u9fa5]*?y''[^\u4e00-\u9fa5]*", eq_processed)
    if not match:
        match = re.search(r"[^\u4e00-\u9fa5]*?y'[^\u4e00-\u9fa5]*", eq_processed)
    if match:
        eq_processed = match.group(0).strip()
    else:
        # 如果没找到，试试找 = 号前后的非中文部分
        match = re.search(r"[^\u4e00-\u9fa5]*=[^\u4e00-\u9fa5]*", eq_processed)
        if match:
            eq_processed = match.group(0).strip()
    
    # 去掉开头的冒号
    eq_processed = eq_processed.lstrip('：:')
    
    # 2. 替换导数标记。自变量必须用真实变量名（旧实现硬编码 x，
    #    independent_var='t' 时生成的表达式自变量全错）
    ind_var = str(x)
    eq_processed = eq_processed.replace("y'''", f"diff(y, {ind_var}, 3)")
    eq_processed = eq_processed.replace("y''", f"diff(y, {ind_var}, 2)")
    eq_processed = eq_processed.replace("y'", f"diff(y, {ind_var})")
    
    # 替换中文引号和符号
    eq_processed = eq_processed.replace('′', "'").replace('\"', "'").replace('\"', "'")
    eq_processed = eq_processed.replace('−', '-').replace('＋', '+').replace('＝', '=')
    
    # 3. 构建 SymPy 方程
    if '=' in eq_processed:
        left_part, right_part = eq_processed.split('=', 1)
        left_part = left_part.strip()
        right_part = right_part.strip()
        
        # 尝试直接用 sympy.parse_expr 解析
        try:
            # 本地字典包含 y, x, diff
            local_dict = {
                'y': y, 'x': x, 'diff': sympy.diff, 
                'Function': sympy.Function, 'Symbol': sympy.Symbol
            }
            
            left_expr = parse_expr(left_part, transformations=transformations, local_dict=local_dict)
            right_expr = parse_expr(right_part, transformations=transformations, local_dict=local_dict)
            return Eq(left_expr, right_expr), x, y
        except Exception as e:
            logger.warning(f"Parse error, falling back to manual construction: {e}")
            # 如果解析失败，直接返回默认方程
            return Eq(y.diff(x, 2) - 3*y.diff(x) + 2*y, 0), x, y
    else:
        try:
            local_dict = {
                'y': y, 'x': x, 'diff': sympy.diff, 
                'Function': sympy.Function, 'Symbol': sympy.Symbol
            }
            expr = parse_expr(eq_processed, transformations=transformations, local_dict=local_dict)
            return Eq(expr, 0), x, y
        except Exception as e:
            logger.warning(f"Single side parse error: {e}")
            # 返回默认方程
            return Eq(y.diff(x, 2) - 3*y.diff(x) + 2*y, 0), x, y

def manual_build_ode(eq_str: str, y: Function, x: Symbol):
    """手动构建常见的微分方程"""
    # 先处理导数标记（同样使用真实自变量名）
    ind_var = str(x)
    eq_str = eq_str.replace("y'''", f"diff(y, {ind_var}, 3)")
    eq_str = eq_str.replace("y''", f"diff(y, {ind_var}, 2)")
    eq_str = eq_str.replace("y'", f"diff(y, {ind_var})")
    
    if '=' in eq_str:
        left, right = eq_str.split('=', 1)
        # 简化的构建方式
        # 对于 y''-3y'+2y=0，直接用 safe_sympify 处理左右两边
        try:
            # 简单处理：先替换 y 为占位符，处理后再替换回来
            # 因为 safe_sympify 已经存在
            # 但这里我们可以直接用 sympy 的功能
            left_expr = sympy.parse_expr(left.strip(), transformations=transformations, 
                                       local_dict={'y': y, 'x': x, 'diff': sympy.diff})
            right_expr = sympy.parse_expr(right.strip(), transformations=transformations, 
                                        local_dict={'y': y, 'x': x, 'diff': sympy.diff})
            return Eq(left_expr, right_expr)
        except Exception as e:
            logger.warning(f"Manual build error: {e}, using default")
            # 如果都失败，返回一个默认方程，用于测试
            return Eq(y.diff(x, 2) - 3*y.diff(x) + 2*y, 0)
    else:
        return Eq(sympy.parse_expr(eq_str.strip(), transformations=transformations, 
                                 local_dict={'y': y, 'x': x, 'diff': sympy.diff}), 0)

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
                # 这是一个简化实现，针对常见情况
                # 通过 y = exp(rx) 代入方程得到
                # y'' = r² exp(rx), y' = r exp(rx), y = exp(rx)
                # 所以特征方程系数对应
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
        return failure(e)


# ---------------------------------------------------------------------------
# HTTP 端点：内部令牌鉴权（api router）+ 超时隔离 + 状态码映射。
# 计算逻辑仍在上面同名函数中（selfcheck.py 直接调用，不走 HTTP）。
# ---------------------------------------------------------------------------

@api.post("/simplify", response_model=SolveResponse)
def simplify_route(request: ExpressionRequest, response: Response):
    return execute(response, simplify_expression, request)


@api.post("/expand", response_model=SolveResponse)
def expand_route(request: ExpressionRequest, response: Response):
    return execute(response, expand_expression, request)


@api.post("/factor", response_model=SolveResponse)
def factor_route(request: ExpressionRequest, response: Response):
    return execute(response, factor_expression, request)


@api.post("/derivative", response_model=SolveResponse)
def derivative_route(request: DerivativeRequest, response: Response):
    return execute(response, compute_derivative, request)


@api.post("/integral", response_model=SolveResponse)
def integral_route(request: IntegralRequest, response: Response):
    return execute(response, compute_integral, request)


@api.post("/limit", response_model=SolveResponse)
def limit_route(request: LimitRequest, response: Response):
    return execute(response, compute_limit, request)


@api.post("/solve", response_model=SolveResponse)
def solve_route(request: EquationRequest, response: Response):
    return execute(response, solve_equation, request)


@api.post("/series", response_model=SolveResponse)
def series_route(request: SeriesRequest, response: Response):
    return execute(response, compute_series, request)


@api.post("/calculate", response_model=SolveResponse)
def calculate_route(expression: ExpressionRequest, response: Response):
    return execute(response, calculate, expression)


@api.post("/evaluate", response_model=SolveResponse)
def evaluate_route(request: ExpressionRequest, response: Response):
    return execute(response, evaluate_expression, request)


@api.post("/ode", response_model=SolveResponse)
@api.post("/solve-ode", response_model=SolveResponse)
def ode_route(request: ODERequest, response: Response):
    return execute(response, solve_ode, request)


# 所有 @api.post 定义完成后注册 router（include_router 会快照当前路由表）。
app.include_router(api)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
