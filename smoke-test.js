/**
 * 端到端冒烟测试：验证 /agents/solve 对五类典型问题的真实求解能力。
 *
 * 运行前需启动 MongoDB / SymPy / NestJS 后端，然后：
 *   node smoke-test.js
 * 可用 API_URL 覆盖后端地址，例如 API_URL=http://localhost:3000
 */
const baseUrl = process.env.API_URL || 'http://localhost:3000';

/**
 * 答案格式同时接受两种写法：
 *  - LaTeX（本地计算引擎输出的 3x^{2}、\frac{x^{3}}{3}）
 *  - Python（SymPy 可用时的 3*x**2）
 */
const POWER2 = /(?:3x\^\{2\}|3\s*\*\s*x\s*\*\*\s*2)/;
const CUBE_OVER_3 = /(?:\\frac\{x\^\{3\}\}\{3\}|x\^3\s*\/\s*3|x\s*\*\*\s*3\s*\/\s*3)/;

const cases = [
  { name: 'limit', problem: '计算极限：lim(x→0) sin(x)/x', expect: /^1$/ },
  { name: 'derivative', problem: '求导：x^3', expect: POWER2 },
  { name: 'integral', problem: '计算积分：x^2', expect: CUBE_OVER_3 },
  { name: 'equation', problem: '解方程：2x + 4 = 0', expect: /-2/ },
  { name: 'ode', problem: "求解微分方程：y'' - 3y' + 2y = 0", expect: /e\^|exp/ },
  // 回归：多项目曾被 early-return 的第一个 x^n 丢掉（x^3 + 2x 只算出 3x²）
  { name: 'derivative-poly', problem: '求导数 d/dx (x^3 + 2x)', expect: /3x\^\{2\}\s*\+\s*2|3\s*\*\s*x\s*\*\*\s*2\s*\+\s*2/ },
  { name: 'integral-poly', problem: '计算积分：x^2 + 3x', expect: /x\^\{3\}|x\s*\*\*\s*3/ },
];

const placeholderPatterns = [/执行中/, /需要配置\s*AI\s*模型/, /（第\s*\d+\s*步/];

/** 后端统一包了一层 { code, data, message } */
const unwrap = (body) => (body && typeof body === 'object' && 'data' in body ? body.data : body);

async function main() {
  let failed = 0;

  for (const testCase of cases) {
    const response = await fetch(`${baseUrl}/agents/solve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ problem: testCase.problem }),
    });

    if (!response.ok) {
      // 带上去体片段：限流（429）等情况的提示语需要被调用方（self-check.cjs）识别
      const body = await response.text().catch(() => '');
      const snippet = body.replace(/\s+/g, ' ').slice(0, 160);
      console.error(`✗ ${testCase.name}: HTTP ${response.status}${snippet ? ' — ' + snippet : ''}`);
      failed += 1;
      continue;
    }

    const result = unwrap(await response.json());
    const answer = String(result?.finalAnswer ?? '');

    if (!answer) {
      console.error(`✗ ${testCase.name}: 最终答案为空`);
      failed += 1;
      continue;
    }

    const dirty = placeholderPatterns.find((p) => p.test(answer) || p.test(JSON.stringify(result?.solutionSteps || [])));
    if (dirty) {
      console.error(`✗ ${testCase.name}: 出现占位/未完成内容 (${dirty})`);
      failed += 1;
      continue;
    }

    if (!testCase.expect.test(answer)) {
      console.error(`✗ ${testCase.name}: 答案不符合预期 -> ${answer}`);
      failed += 1;
      continue;
    }

    const stepCount = Array.isArray(result?.solutionSteps) ? result.solutionSteps.length : 0;
    console.log(`✓ ${testCase.name}: ${answer}（${stepCount} 个解题步骤）`);
  }

  if (failed > 0) {
    console.error(`\n${failed}/${cases.length} 个用例失败`);
    process.exitCode = 1;
    return;
  }

  console.log(`\n全部 ${cases.length} 个用例通过：求解链路真实可用。`);
}

main().catch((error) => {
  console.error(`冒烟测试异常：${error.message}`);
  console.error('请确认后端 / MongoDB / SymPy 服务均已启动。');
  process.exitCode = 1;
});
