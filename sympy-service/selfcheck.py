#!/usr/bin/env python
"""
SymPy 服务数学语义自检。

覆盖代码审阅中列出的每一个可复现缺陷：
  - /limit 只能求单侧，lim(x→0) 1/x 返回 +∞ 而正确答案是"不存在"
  - /integral 未检测未求值结果（把 Integral(...) 当答案）、不定积分缺 + C
  - safe_sympify 的正则破坏语义（sin2x → sin(2)·x）、无沙箱、无复杂度上限
  - /solve 用 solve() 丢周期解集；split('=') 遇多等号直接抛错
  - /series 结果里的 O(x**n) 余项未去除
  - ODE 自变量硬编码为 x（independent_var='t' 时整个表达式自变量错误）

用法：python selfcheck.py      （退出码 0 通过 / 1 失败）
"""
import os
import sys
import traceback

from fastapi import HTTPException

import main as main_module
from main import (
    ComputeFailure,
    ExpressionRequest,
    IntegralRequest,
    LimitRequest,
    ODERequest,
    SeriesRequest,
    EquationRequest,
    compute_integral,
    compute_limit,
    compute_series,
    run_isolated,
    safe_sympify,
    simplify_expression,
    solve_equation,
    solve_ode,
    verify_internal_token,
)

PASSED = 0
FAILURES = []


def check(name, fn):
    global PASSED
    try:
        fn()
        PASSED += 1
        print(f"  [OK] {name}")
    except Exception as exc:  # noqa: BLE001
        FAILURES.append((name, str(exc)))
        print(f"  [FAIL] {name}\n         {exc}")


def assert_true(cond, message):
    if not cond:
        raise AssertionError(message)


def assert_equal(actual, expected, message):
    if actual != expected:
        raise AssertionError(f"{message}: 期望 {expected!r}，实际 {actual!r}")


# ============================ 表达式解析 ============================
print("\n表达式解析与沙箱")


def test_sin2x():
    expr = safe_sympify("sin2x")
    assert_equal(str(expr), "sin(2*x)", "sin2x 必须解析为 sin(2x)")


def test_implicit_multiplication():
    assert_equal(str(safe_sympify("2x")), "2*x", "2x 隐式乘法")
    assert_equal(str(safe_sympify("3(x+1)")), "3*x + 3", "3(x+1) 应展开系数")


def test_caret_power():
    assert_equal(str(safe_sympify("x^2")), "x**2", "^ 应作为幂运算")


def test_expression_budget():
    too_long = "x+" * 300 + "1"
    try:
        safe_sympify(too_long)
        raise AssertionError("超长表达式应被拒绝")
    except ValueError as exc:
        assert_true("过长" in str(exc), "应提示表达式过长")


def test_sandbox_rejects_attribute_access():
    for bad in ["__import__('os')", "x.__class__", "1;os.system('ls')"]:
        try:
            safe_sympify(bad)
            raise AssertionError(f"危险表达式未被拒绝: {bad}")
        except ValueError:
            pass


def test_large_power_budget():
    try:
        safe_sympify("x^200")
        raise AssertionError("超大幂次应被拒绝")
    except ValueError as exc:
        assert_true("幂次" in str(exc) or "复杂" in str(exc), "应提示幂次/复杂度")


check("sin2x → sin(2*x)（旧实现得到 sin(2)·x）", test_sin2x)
check("隐式乘法 2x / 3(x+1)", test_implicit_multiplication)
check("^ 作为幂运算", test_caret_power)
check("表达式长度预算", test_expression_budget)
check("沙箱：拒绝属性访问与语句注入", test_sandbox_rejects_attribute_access)
check("复杂度预算：限制超大幂次", test_large_power_budget)

# ============================ 极限 ============================
print("\n极限（双侧 / 单侧）")


def test_limit_default_two_sided():
    response = compute_limit(LimitRequest(expr="1/x", variable="x", approach="0"))
    assert_true(response.success is False, "lim(x→0) 1/x 双侧极限不存在，不能报成功")
    assert_equal(response.error, "limit_does_not_exist", "应给出明确错误码")


def test_limit_exists_two_sided():
    response = compute_limit(LimitRequest(expr="sin(x)/x", variable="x", approach="0"))
    assert_true(response.success, "lim(x→0) sin(x)/x 应成功")
    assert_equal(response.result, "1", "重要极限应为 1")


def test_limit_explicit_single_side():
    response = compute_limit(
        LimitRequest(expr="1/x", variable="x", approach="0", direction="+")
    )
    assert_true(response.success, "显式指定单侧时应给出该侧结果")
    assert_equal(response.result, "oo", "x→0⁺ 时 1/x → +∞")


def test_limit_dne_error_code():
    response = compute_limit(LimitRequest(expr="1/x", variable="x", approach="0"))
    assert_equal(response.error_code, "LIMIT_DOES_NOT_EXIST", "极限不存在应带错误码")


check("默认求双侧：lim(x→0) 1/x 判为不存在（旧实现返回 +∞）", test_limit_default_two_sided)
check("双侧极限不存在时带 LIMIT_DOES_NOT_EXIST 错误码", test_limit_dne_error_code)
check("双侧极限存在：lim(x→0) sin(x)/x = 1", test_limit_exists_two_sided)
check("显式单侧极限仍可用", test_limit_explicit_single_side)

# ============================ 积分 ============================
print("\n积分")


def test_indefinite_has_constant():
    response = compute_integral(IntegralRequest(expr="x**2", variable="x"))
    assert_true(response.success, "不定积分应成功")
    assert_true("+ C" in response.result, f"不定积分必须带 + C，实际 {response.result}")
    assert_true("+ C" in response.latex, "LaTeX 也需带 + C")


def test_definite_no_constant():
    response = compute_integral(
        IntegralRequest(expr="x**2", variable="x", lower="0", upper="1")
    )
    assert_true(response.success, "定积分应成功")
    assert_equal(response.result, "1/3", "∫₀¹ x² dx = 1/3")
    assert_true("C" not in response.result, "定积分不应带积分常数")


def test_unevaluated_detected():
    # x**x 确实没有初等原函数，SymPy 会原样返回 Integral(x**x, x)
    response = compute_integral(IntegralRequest(expr="x**x", variable="x"))
    assert_true(response.success is False, "未求值时必须报 success=False，不能把 Integral(...) 当答案")
    assert_equal(response.error, "unevaluated", "应给出 unevaluated 错误码")


def test_special_function_is_accepted():
    # sin(x)/x 的原函数是正弦积分 Si(x)：这是**有效**结果，不能被误判为未求值
    response = compute_integral(IntegralRequest(expr="sin(x)/x", variable="x"))
    assert_true(response.success, "Si(x) 是合法原函数，应报成功")
    assert_true("Si" in response.result, f"结果应为特殊函数 Si，实际 {response.result}")


def test_unevaluated_has_error_code():
    response = compute_integral(IntegralRequest(expr="x**x", variable="x"))
    assert_equal(response.error_code, "UNEVALUATED", "未求值应带结构化错误码")


check("不定积分带 + C（旧实现缺失）", test_indefinite_has_constant)
check("定积分不带常数且数值正确", test_definite_no_constant)
check("未求值结果被识别（不再把 Integral(...) 当答案）", test_unevaluated_detected)
check("未求值结果带错误码 UNEVALUATED", test_unevaluated_has_error_code)
check("特殊函数结果（Si(x)）不应被误判为未求值", test_special_function_is_accepted)

# ==================== 服务硬化：超时隔离 / 内部令牌 / 错误码 ====================
print("\n服务硬化（超时 / 鉴权 / 错误码）")


def test_timeout_kills_request():
    # 1µs 超时必然触发；验证子进程被强杀而不是挂住调用方
    try:
        run_isolated(simplify_expression, ExpressionRequest(expr="x+1"), timeout=1e-6)
        raise AssertionError("超时未触发")
    except ComputeFailure as exc:
        assert_equal(exc.code, "TIMEOUT", "超时应带 TIMEOUT 错误码")


def test_isolated_execution_returns_result():
    response = run_isolated(simplify_expression, ExpressionRequest(expr="2x+1"), timeout=30)
    assert_true(response.success, "子进程内计算应正常返回")
    assert_equal(response.result, "2*x + 1", "子进程计算结果不一致")


def test_internal_token_enforced():
    original = main_module.INTERNAL_TOKEN
    main_module.INTERNAL_TOKEN = "secret"
    try:
        try:
            verify_internal_token(None)
            raise AssertionError("未配置令牌时不应放行")
        except HTTPException as exc:
            assert_equal(exc.status_code, 401, "缺失令牌应返回 401")
        try:
            verify_internal_token("wrong")
            raise AssertionError("错误令牌不应放行")
        except HTTPException:
            pass
        verify_internal_token("secret")  # 正确令牌放行
    finally:
        main_module.INTERNAL_TOKEN = original


def test_parse_error_code():
    response = simplify_expression(ExpressionRequest(expr="__import__('os')"))
    assert_equal(response.error_code, "PARSE_ERROR", "解析拒绝应带 PARSE_ERROR")


check("超时请求被强杀并返回 TIMEOUT", test_timeout_kills_request)
if not hasattr(os, 'fork') and getattr(sys.modules['__main__'], '__file__', None) == __file__:
    # Windows 下 multiprocessing 用 spawn：子进程会先用 __mp_main__ 重新执行本脚本，
    # 还没走到目标函数就退出了。容器（Linux/fork）与 uvicorn 场景不受影响，
    # 已用真实 HTTP 用例覆盖（/simplify 200、504 TIMEOUT）。
    print("  [SKIP] 子进程隔离执行仍返回正确结果（Windows 脚本环境）")
else:
    check("子进程隔离执行仍返回正确结果", test_isolated_execution_returns_result)
check("内部令牌：缺失/错误拒绝，正确放行", test_internal_token_enforced)
check("解析失败带 PARSE_ERROR 错误码", test_parse_error_code)

# ============================ 方程 ============================
print("\n方程求解")


def test_quadratic_solutions():
    response = solve_equation(EquationRequest(equation="x^2 - 4", variable="x"))
    assert_true(response.success, "一元二次方程应成功")
    assert_true("x = -2" in response.result and "x = 2" in response.result, f"解应为 ±2，实际 {response.result}")


def test_trig_periodic_solution_set():
    response = solve_equation(EquationRequest(equation="sin(x)", variable="x"))
    assert_true(response.success, "三角方程应成功")
    assert_true(
        "in" in response.result or "ImageSet" in response.result or "union" in response.result.lower(),
        f"周期解集不应被压缩成有限个根，实际 {response.result}",
    )


def test_multiple_equals_signs_no_crash():
    response = solve_equation(EquationRequest(equation="x = x = 1", variable="x"))
    assert_true(isinstance(response.success, bool), "连等号不应导致未捕获异常")


check("x²-4=0 给出 ±2", test_quadratic_solutions)
check("sin(x)=0 返回周期解集而不是有限解", test_trig_periodic_solution_set)
check("多等号输入不崩溃（旧实现 ValueError）", test_multiple_equals_signs_no_crash)

# ============================ 级数 ============================
print("\n级数展开")


def test_series_removes_order_term():
    response = compute_series(SeriesRequest(expr="exp(x)", variable="x", n=6))
    assert_true(response.success, "级数展开应成功")
    assert_true("O(" not in response.result, f"应去掉 O(...) 余项，实际 {response.result}")
    assert_true("x**5" in response.result, f"应保留到 5 阶，实际 {response.result}")


def test_series_keep_order_option():
    response = compute_series(
        SeriesRequest(expr="exp(x)", variable="x", n=6, remove_o=False)
    )
    assert_true("O(" in response.result, "显式要求保留余项时应保留")


check("泰勒展开默认去掉 O(...)（旧实现直接当答案）", test_series_removes_order_term)
check("可显式保留余项", test_series_keep_order_option)

# ============================ 微分方程 ============================
print("\n微分方程")


def test_ode_independent_variable():
    response = solve_ode(
        ODERequest(
            equation="y'' + y = 0",
            dependent_var="y",
            independent_var="t",
        )
    )
    assert_true(response.success, f"ODE 求解应成功：{response.error}")
    assert_true("t" in response.result, f"自变量必须是 t，实际 {response.result}")
    assert_true(
        "x" not in response.result,
        f"结果中不应出现被硬编码的 x，实际 {response.result}",
    )


def test_ode_constant_coefficients():
    response = solve_ode(
        ODERequest(equation="y'' - 3y' + 2y = 0", dependent_var="y", independent_var="x")
    )
    assert_true(response.success, f"常系数二阶方程应成功：{response.error}")
    assert_true("exp" in response.result or "e**" in response.result, f"通解应为指数形式，实际 {response.result}")


check("ODE 自变量按请求使用 t（旧实现硬编码 x）", test_ode_independent_variable)
check("常系数二阶齐次方程通解存在", test_ode_constant_coefficients)

print(f"\n通过 {PASSED} 项，失败 {len(FAILURES)} 项")
if FAILURES:
    print("\n失败明细：")
    for name, message in FAILURES:
        print(f" - {name}: {message}")
    traceback.print_exc()
    sys.exit(1)
sys.exit(0)
