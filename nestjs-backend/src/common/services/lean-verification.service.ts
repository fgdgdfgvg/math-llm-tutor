import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export enum VerificationStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  VERIFIED = 'verified',
  FAILED = 'failed',
  ERROR = 'error',
  TIMED_OUT = 'timed_out',
}

export enum TheoremCategory {
  LIMIT = 'limit',
  CONTINUITY = 'continuity',
  DERIVATIVE = 'derivative',
  INTEGRAL = 'integral',
  SERIES = 'series',
  DIFFERENTIAL_EQUATION = 'differential_equation',
  MULTIVARIABLE = 'multivariable',
  VECTOR = 'vector',
  ALGEBRA = 'algebra',
}

export interface VerificationStandard {
  id: string;
  name: string;
  description: string;
  category: TheoremCategory;
  requiredAxioms: string[];
  expectedTactics: string[];
  minProofSteps: number;
  maxProofSteps: number;
  acceptedTactics: string[];
}

export interface LeanProofAttempt {
  id: string;
  theoremName: string;
  statement: string;
  leanCode: string;
  category: TheoremCategory;
  status: VerificationStatus;
  feedback: string[];
  errorLines: number[];
  tacticsUsed: string[];
  proofSteps: number;
  timestamp: string;
  duration: number;
}

export interface VerificationReport {
  totalTheorems: number;
  verified: number;
  failed: number;
  pending: number;
  successRate: string;
  proofAttempts: LeanProofAttempt[];
  categoryBreakdown: Record<string, { total: number; verified: number }>;
  averageProofSteps: number;
  mostUsedTactics: string[];
}

@Injectable()
export class LeanVerificationService {
  private readonly logger = new Logger(LeanVerificationService.name);
  private leanWorkspace: string;
  private proofsDir: string;
  private readonly verificationStandards: VerificationStandard[];
  private proofHistory: LeanProofAttempt[] = [];
  private leanAvailable = false;

  constructor() {
    this.leanWorkspace =
      process.env.LEAN_WORKSPACE_DIR ||
      path.join(process.cwd(), 'lean_workspace');
    this.proofsDir = path.join(this.leanWorkspace, 'proofs');
    this.verificationStandards = this.initializeVerificationStandards();
    this.ensureWorkspace();
    void this.checkLeanAvailability();
  }

  private async checkLeanAvailability(): Promise<void> {
    try {
      const { stdout, stderr } = await execAsync('lake --version', {
        timeout: 5000,
      });
      this.leanAvailable = !stderr || stdout.includes('Lake');
      if (this.leanAvailable) {
        this.logger.log(`Lean 4 (Lake) 可用: ${stdout.trim()}`);
      } else {
        this.logger.warn('Lean 4 不可用，将使用模拟验证模式');
      }
    } catch {
      this.logger.log(
        'Lean 4 未安装，形式化验证将以模拟模式运行。如需启用完整验证，请安装 Lean 4:\n' +
          '  1. 安装 elan: curl https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh -sSf | sh\n' +
          '  2. 或访问: https://leanprover.github.io/lean4/doc/setup.html',
      );
      this.leanAvailable = false;
    }
  }

  /**
   * 准备工作目录。容器里以非 root 用户运行时 /app 可能不可写，
   * 这里失败则退到系统临时目录，避免建目录报错直接把整个应用启动流程打断。
   */
  private ensureWorkspace(): void {
    try {
      fs.mkdirSync(this.proofsDir, { recursive: true });
      return;
    } catch (error) {
      this.logger.warn(
        `无法使用 Lean 工作目录 ${this.leanWorkspace}（${(error as Error).message}），改用临时目录`,
      );
    }

    const fallback = path.join(os.tmpdir(), 'lean_workspace');
    try {
      this.leanWorkspace = fallback;
      this.proofsDir = path.join(fallback, 'proofs');
      fs.mkdirSync(this.proofsDir, { recursive: true });
    } catch (error) {
      this.logger.error(
        `连临时目录也不可用，形式化验证将不可用：${(error as Error).message}`,
      );
    }
  }

  private initializeVerificationStandards(): VerificationStandard[] {
    return [
      {
        id: 'limit_uniqueness',
        name: '极限唯一性定理',
        description: '若函数极限存在，则极限值唯一',
        category: TheoremCategory.LIMIT,
        requiredAxioms: ['Real.instLT', 'Real.instAdd', 'Filter.Tendsto'],
        expectedTactics: ['intro', 'apply', 'linarith', 'have'],
        minProofSteps: 5,
        maxProofSteps: 20,
        acceptedTactics: [
          'intro',
          'apply',
          'have',
          'linarith',
          'nlinarith',
          'calc',
          'rw',
          'simpa',
          'exact',
        ],
      },
      {
        id: 'squeeze_theorem',
        name: '夹逼定理（三明治定理）',
        description: '若g(x)≤f(x)≤h(x)且lim g=lim h=L，则lim f=L',
        category: TheoremCategory.LIMIT,
        requiredAxioms: [
          'Real.instLE',
          'Filter.Tendsto',
          'Filter.eventually_of_forall',
        ],
        expectedTactics: ['intro', 'apply', 'filter_upwards', 'linarith'],
        minProofSteps: 8,
        maxProofSteps: 30,
        acceptedTactics: [
          'intro',
          'apply',
          'have',
          'linarith',
          'filter_upwards',
          'calc',
          'rw',
          'simpa',
          'exact',
        ],
      },
      {
        id: 'ivt',
        name: '介值定理（Intermediate Value Theorem）',
        description: '连续函数在闭区间上可取到端点值之间的任何值',
        category: TheoremCategory.CONTINUITY,
        requiredAxioms: ['ContinuousOn', 'IsClosed', 'Set.IntermediateValue'],
        expectedTactics: ['intro', 'apply', 'have', 'by_cases', 'set'],
        minProofSteps: 10,
        maxProofSteps: 40,
        acceptedTactics: [
          'intro',
          'apply',
          'have',
          'linarith',
          'by_cases',
          'set',
          'calc',
          'rw',
          'simpa',
          'exact',
        ],
      },
      {
        id: 'extreme_value_theorem',
        name: '极值定理（Extreme Value Theorem）',
        description: '闭区间上的连续函数必取得最大值和最小值',
        category: TheoremCategory.CONTINUITY,
        requiredAxioms: ['ContinuousOn', 'IsCompact', 'exists_isMaxOn'],
        expectedTactics: ['intro', 'apply', 'have', 'rcases', 'obtain'],
        minProofSteps: 12,
        maxProofSteps: 45,
        acceptedTactics: [
          'intro',
          'apply',
          'have',
          'linarith',
          'rcases',
          'obtain',
          'calc',
          'rw',
          'simpa',
          'exact',
        ],
      },
      {
        id: 'rolle_theorem',
        name: "罗尔定理（Rolle's Theorem）",
        description:
          "若f在[a,b]上连续、(a,b)内可导、f(a)=f(b)，则存在c∈(a,b)使f'(c)=0",
        category: TheoremCategory.DERIVATIVE,
        requiredAxioms: ['ContinuousOn', 'HasDerivAt', 'isMaxOn', 'isMinOn'],
        expectedTactics: ['intro', 'have', 'rcases', 'apply', 'exact'],
        minProofSteps: 15,
        maxProofSteps: 50,
        acceptedTactics: [
          'intro',
          'apply',
          'have',
          'linarith',
          'rcases',
          'obtain',
          'calc',
          'rw',
          'simpa',
          'exact',
          'refine',
        ],
      },
      {
        id: 'mvt',
        name: '拉格朗日中值定理（Mean Value Theorem）',
        description:
          "若f在[a,b]上连续、(a,b)内可导，则存在c∈(a,b)使f'(c)=[f(b)-f(a)]/(b-a)",
        category: TheoremCategory.DERIVATIVE,
        requiredAxioms: ['ContinuousOn', 'HasDerivAt', 'Real.instDiv'],
        expectedTactics: ['intro', 'have', 'set', 'apply', 'use'],
        minProofSteps: 15,
        maxProofSteps: 55,
        acceptedTactics: [
          'intro',
          'apply',
          'have',
          'linarith',
          'rcases',
          'set',
          'calc',
          'rw',
          'simpa',
          'exact',
          'use',
          'refine',
          'field_simp',
        ],
      },
      {
        id: 'ftc_part1',
        name: '微积分基本定理（第一部分）',
        description: "若f连续，则F(x)=∫_a^x f(t)dt可导且F'(x)=f(x)",
        category: TheoremCategory.INTEGRAL,
        requiredAxioms: [
          'intervalIntegral',
          'ContinuousOn',
          'HasDerivAt',
          'measureTheory',
        ],
        expectedTactics: ['intro', 'apply', 'have', 'calc', 'rw'],
        minProofSteps: 12,
        maxProofSteps: 45,
        acceptedTactics: [
          'intro',
          'apply',
          'have',
          'linarith',
          'calc',
          'rw',
          'simpa',
          'exact',
          'refine',
        ],
      },
      {
        id: 'greens_theorem_plane',
        name: '格林公式（平面形式）',
        description: '平面闭区域上的二重积分等于其边界曲线上的曲线积分',
        category: TheoremCategory.MULTIVARIABLE,
        requiredAxioms: [
          'Measure.prod',
          'integral_divergence',
          'intervalIntegral',
        ],
        expectedTactics: ['intro', 'apply', 'have', 'calc', 'rw'],
        minProofSteps: 20,
        maxProofSteps: 80,
        acceptedTactics: [
          'intro',
          'apply',
          'have',
          'linarith',
          'calc',
          'rw',
          'simpa',
          'exact',
          'refine',
          'positivity',
        ],
      },
    ];
  }

  generateLeanCode(
    theoremName: string,
    statement: string,
    category: TheoremCategory,
  ): string {
    const standard = this.verificationStandards.find(
      (s) => s.category === category,
    );
    const imports = this.generateImports(category);

    return `${imports}

/-- ${statement} -/
theorem ${theoremName} :
  ${this.translateToLeanTypes(statement, category)} :=
by
  -- TODO: 填写证明
  sorry`;
  }

  private generateImports(category: TheoremCategory): string {
    const imports = ['import Mathlib'];
    switch (category) {
      case TheoremCategory.LIMIT:
        imports.push('import Mathlib.Topology.Basic');
        imports.push('import Mathlib.Topology.Algebra.Order.Monoid');
        break;
      case TheoremCategory.CONTINUITY:
        imports.push('import Mathlib.Topology.Basic');
        imports.push('import Mathlib.Topology.Algebra.Order.IntermediateValue');
        break;
      case TheoremCategory.DERIVATIVE:
        imports.push('import Mathlib.Analysis.Calculus.Deriv.Basic');
        imports.push('import Mathlib.Analysis.Calculus.MeanInequalities');
        break;
      case TheoremCategory.INTEGRAL:
        imports.push('import Mathlib.MeasureTheory.Integral.IntervalIntegral');
        imports.push('import Mathlib.Analysis.Calculus.FDeriv.Basic');
        break;
      case TheoremCategory.MULTIVARIABLE:
        imports.push('import Mathlib.Analysis.Calculus.FDeriv.Basic');
        imports.push('import Mathlib.MeasureTheory.Integral.DivergenceTheorem');
        break;
      default:
        imports.push('import Mathlib.Tactic');
    }
    return imports.join('\n');
  }

  private translateToLeanTypes(
    statement: string,
    category: TheoremCategory,
  ): string {
    const lower = statement.toLowerCase();

    if (lower.includes('极限') && lower.includes('唯一')) {
      return '∀ {f : ℝ → ℝ} {a L₁ L₂ : ℝ}, Tendsto f (𝓝 a) (𝓝 L₁) → Tendsto f (𝓝 a) (𝓝 L₂) → L₁ = L₂';
    }
    if (lower.includes('夹逼') || lower.includes('三明治')) {
      return '∀ {f g h : ℝ → ℝ} {a L : ℝ}, (∀ᶠ x in 𝓝 a, g x ≤ f x ∧ f x ≤ h x) → Tendsto g (𝓝 a) (𝓝 L) → Tendsto h (𝓝 a) (𝓝 L) → Tendsto f (𝓝 a) (𝓝 L)';
    }
    if (lower.includes('介值')) {
      return '∀ {f : ℝ → ℝ} {a b : ℝ}, ContinuousOn f (Set.Icc a b) → ∀ y, f a ≤ y ∧ y ≤ f b → ∃ x ∈ Set.Icc a b, f x = y';
    }
    if (lower.includes('极值') || lower.includes('最大值最小值')) {
      return '∀ {f : ℝ → ℝ} {a b : ℝ}, ContinuousOn f (Set.Icc a b) → ∃ x₁ x₂ ∈ Set.Icc a b, (∀ x ∈ Set.Icc a b, f x₁ ≤ f x ∧ f x ≤ f x₂)';
    }
    if (lower.includes('罗尔')) {
      return '∀ {f : ℝ → ℝ} {a b : ℝ}, a < b → ContinuousOn f (Set.Icc a b) → (∀ x ∈ Set.Ioo a b, HasDerivAt f (deriv f x) x) → f a = f b → ∃ c ∈ Set.Ioo a b, deriv f c = 0';
    }
    if (lower.includes('拉格朗日') || lower.includes('中值定理')) {
      return '∀ {f : ℝ → ℝ} {a b : ℝ}, a < b → ContinuousOn f (Set.Icc a b) → (∀ x ∈ Set.Ioo a b, HasDerivAt f (deriv f x) x) → ∃ c ∈ Set.Ioo a b, deriv f c = (f b - f a) / (b - a)';
    }
    if (lower.includes('微积分基本定理')) {
      return '∀ {f : ℝ → ℝ} {a : ℝ}, ContinuousOn f (Set.univ : Set ℝ) → HasDerivAt (λ x => ∫ t in a..x, f t) (f (a := ?_)) ?_';
    }
    if (lower.includes('格林')) {
      return 'theorem greens_formula ... := ...';
    }

    return statement;
  }

  async verifyTheorem(
    theoremName: string,
    statement: string,
    category: TheoremCategory,
    leanCode?: string,
  ): Promise<LeanProofAttempt> {
    const startTime = Date.now();
    const attemptId = `lean_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;

    const code =
      leanCode || this.generateLeanCode(theoremName, statement, category);
    const standard = this.verificationStandards.find(
      (s) => s.category === category,
    );

    const attempt: LeanProofAttempt = {
      id: attemptId,
      theoremName,
      statement,
      leanCode: code,
      category,
      status: VerificationStatus.IN_PROGRESS,
      feedback: [],
      errorLines: [],
      tacticsUsed: [],
      proofSteps: 0,
      timestamp: new Date().toISOString(),
      duration: 0,
    };

    if (this.leanAvailable) {
      await this.runLeanVerification(attempt);
    } else {
      this.runSimulatedVerification(attempt, standard);
    }

    attempt.duration = Date.now() - startTime;
    this.proofHistory.push(attempt);
    return attempt;
  }

  private async runLeanVerification(attempt: LeanProofAttempt): Promise<void> {
    const filePath = path.join(this.proofsDir, `${attempt.id}.lean`);

    try {
      fs.writeFileSync(filePath, attempt.leanCode, 'utf-8');

      const { stdout, stderr } = await execAsync(`lean ${filePath}`, {
        timeout: 30000,
        cwd: this.leanWorkspace,
      });

      if (stderr) {
        const errorLines = stderr
          .split('\n')
          .filter((l) => l.includes('error'))
          .map((l) => parseInt((l.match(/:(\d+):/) || ['', '0'])[1], 10));

        attempt.status =
          errorLines.length > 0
            ? VerificationStatus.FAILED
            : VerificationStatus.VERIFIED;
        attempt.feedback = stderr.split('\n').filter((l) => l.trim());
        attempt.errorLines = errorLines;
      } else {
        attempt.status = VerificationStatus.VERIFIED;
        attempt.feedback = ['Lean 4 验证通过'];
      }
    } catch (err) {
      const errStr = (err as Error).message;
      if (errStr.includes('ETIMEDOUT') || errStr.includes('killed')) {
        attempt.status = VerificationStatus.TIMED_OUT;
        attempt.feedback = ['验证超时（超过30秒）'];
      } else {
        attempt.status = VerificationStatus.ERROR;
        attempt.feedback = [errStr];
      }
    }
  }

  private runSimulatedVerification(
    attempt: LeanProofAttempt,
    standard?: VerificationStandard,
  ): void {
    const code = attempt.leanCode;
    const issues: string[] = [];

    if (!code.includes('import Mathlib') && !code.includes('import ')) {
      issues.push('缺少必要的导入语句（Mathlib）');
      attempt.errorLines.push(1);
    }

    if (code.includes('sorry') || code.includes('TODO')) {
      issues.push('证明未完成：存在"sorry"占位符');
    }

    if (code.includes(':= by') && !code.includes('sorry')) {
      const proofBody = code.split(':= by')[1] || '';
      const tacticKeywords = [
        'intro',
        'apply',
        'have',
        'calc',
        'rw',
        'simp',
        'exact',
        'refine',
        'rcases',
        'linarith',
        'nlinarith',
        'positivity',
        'field_simp',
        'ring',
        'omega',
        'nlinarith',
      ];
      const tactics = tacticKeywords.filter((t) => proofBody.includes(t));

      for (const line of proofBody.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.includes(' ')) {
          const firstWord = trimmed.split(' ')[0];
          if (tacticKeywords.includes(firstWord)) {
            tactics.push(firstWord);
          }
        }
      }

      attempt.tacticsUsed = [...new Set(tactics)];

      if (standard && standard.expectedTactics.length > 0) {
        const missing = standard.expectedTactics.filter(
          (et) => !tactics.includes(et),
        );
        for (const miss of missing) {
          issues.push(`可能缺少关键策略: "${miss}"`);
        }
      }

      attempt.proofSteps = proofBody.split('\n').filter((l) => l.trim()).length;
    }

    if (issues.length === 0 && !code.includes('sorry')) {
      attempt.status = VerificationStatus.VERIFIED;
      attempt.feedback = [
        '模拟验证通过（Lean 4环境未安装，基于语法和策略分析）',
      ];
    } else if (issues.length > 0 && !code.includes('sorry')) {
      attempt.status = VerificationStatus.FAILED;
      attempt.feedback = issues;
    } else {
      attempt.status = VerificationStatus.PENDING;
      attempt.feedback = ['证明未完成，等待填写'];
    }
  }

  getVerificationStandards(): VerificationStandard[] {
    return this.verificationStandards;
  }

  getVerificationStandard(
    category: TheoremCategory,
  ): VerificationStandard | undefined {
    return this.verificationStandards.find((s) => s.category === category);
  }

  generateReport(): VerificationReport {
    const total = this.proofHistory.length;
    const verified = this.proofHistory.filter(
      (a) => a.status === VerificationStatus.VERIFIED,
    ).length;
    const failed = this.proofHistory.filter(
      (a) => a.status === VerificationStatus.FAILED,
    ).length;
    const pending = this.proofHistory.filter(
      (a) =>
        a.status === VerificationStatus.PENDING ||
        a.status === VerificationStatus.IN_PROGRESS,
    ).length;
    const successRate =
      total > 0 ? ((verified / total) * 100).toFixed(1) + '%' : 'N/A';

    const categoryBreakdown: Record<
      string,
      { total: number; verified: number }
    > = {};
    for (const attempt of this.proofHistory) {
      const cat = attempt.category;
      if (!categoryBreakdown[cat]) {
        categoryBreakdown[cat] = { total: 0, verified: 0 };
      }
      categoryBreakdown[cat].total++;
      if (attempt.status === VerificationStatus.VERIFIED) {
        categoryBreakdown[cat].verified++;
      }
    }

    const allTactics = this.proofHistory.flatMap((a) => a.tacticsUsed);
    const tacticFreq: Record<string, number> = {};
    for (const t of allTactics) {
      tacticFreq[t] = (tacticFreq[t] || 0) + 1;
    }
    const mostUsedTactics = Object.entries(tacticFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([t]) => t);

    const avgSteps =
      this.proofHistory.length > 0
        ? this.proofHistory.reduce((sum, a) => sum + a.proofSteps, 0) /
          this.proofHistory.length
        : 0;

    return {
      totalTheorems: total,
      verified,
      failed,
      pending,
      successRate,
      proofAttempts: this.proofHistory,
      categoryBreakdown,
      averageProofSteps: Math.round(avgSteps * 10) / 10,
      mostUsedTactics,
    };
  }

  async verifyBatch(
    theorems: {
      name: string;
      statement: string;
      category: TheoremCategory;
      leanCode?: string;
    }[],
  ): Promise<LeanProofAttempt[]> {
    const results: LeanProofAttempt[] = [];
    for (const thm of theorems) {
      const result = await this.verifyTheorem(
        thm.name,
        thm.statement,
        thm.category,
        thm.leanCode,
      );
      results.push(result);
    }
    return results;
  }

  getLeanAvailability(): boolean {
    return this.leanAvailable;
  }

  clearHistory(): void {
    this.proofHistory = [];
    this.logger.log('验证历史已清除');
  }
}
