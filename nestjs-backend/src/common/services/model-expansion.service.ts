import { Injectable, Logger } from '@nestjs/common';

export enum SpecializedModelType {
  MATHGLM = 'mathglm',
  WIZARDLM_MATH = 'wizardlm_math',
  LLEMMA = 'llemma',
  MINERVA = 'minerva',
  MATHBERT = 'mathbert',
  GEMMA_MATH = 'gemma_math',
  DEEPSEEK_MATH = 'deepseek_math',
  QWEN_MATH = 'qwen_math',
}

export interface SpecializedModelConfig {
  type: SpecializedModelType;
  name: string;
  description: string;
  strengths: string[];
  weaknesses: string[];
  targetCategories: string[];
  apiEndpoint?: string;
  modelId: string;
  maxTokens: number;
  temperature: number;
  supportsStreaming: boolean;
  supportsFormalProof: boolean;
  supportsMultiStep: boolean;
  isAvailable: boolean;
  priority: number;
}

export interface ModelBenchmark {
  modelType: SpecializedModelType;
  category: string;
  totalTests: number;
  passedTests: number;
  accuracy: number;
  averageLatencyMs: number;
  averageTokenUsage: number;
  hallucinationRate: number;
  formalVerificationRate: number;
  lastBenchmarked: string;
}

export interface ModelSelectionStrategy {
  problem: string;
  recommendedModel: SpecializedModelType;
  confidence: number;
  alternatives: SpecializedModelType[];
  reasoning: string;
  expectedPerformance: {
    accuracyEstimate: number;
    latencyEstimate: number;
  };
}

@Injectable()
export class ModelExpansionService {
  private readonly logger = new Logger(ModelExpansionService.name);
  private readonly specializedModels: Map<
    SpecializedModelType,
    SpecializedModelConfig
  >;
  private readonly benchmarks: ModelBenchmark[] = [];
  private selectionHistory: ModelSelectionStrategy[] = [];

  constructor() {
    this.specializedModels = new Map();
    this.initializeModels();
  }

  private initializeModels(): void {
    const models: SpecializedModelConfig[] = [
      {
        type: SpecializedModelType.MATHGLM,
        name: 'MathGLM',
        description:
          '专门针对数学推理优化的GLM系列模型，在算术、代数、微积分等方面表现优异',
        strengths: [
          '代数运算',
          '方程求解',
          '级数展开',
          '积分计算',
          '中文数学题',
        ],
        weaknesses: ['几何证明', '拓扑推理', '复杂符号推导'],
        targetCategories: [
          'integral_indefinite_basic',
          'integral_substitution',
          'integral_by_parts',
          'de_first_order',
          'de_higher_order',
          'series_power',
          'series_taylor',
          'multiple_integral_double',
          'multiple_integral_triple',
        ],
        modelId: 'THUDM/MathGLM-R1-0528-9B',
        maxTokens: 4096,
        temperature: 0.1,
        supportsStreaming: true,
        supportsFormalProof: false,
        supportsMultiStep: true,
        isAvailable: true,
        priority: 1,
      },
      {
        type: SpecializedModelType.LLEMMA,
        name: 'LLEMMA-34B',
        description:
          '基于CodeLlama在数学证明数据集上微调，擅长形式化推理和定理证明',
        strengths: ['定理证明', '逻辑推理', '形式化推导', '符号计算'],
        weaknesses: ['应用计算', '几何直观', '数值近似'],
        targetCategories: [
          'proof_theorem',
          'proof_inequality',
          'multivariable_lagrange',
          'multivariable_implicit',
          'de_higher_order',
          'de_system',
        ],
        modelId: 'EleutherAI/llemma_34b',
        maxTokens: 8192,
        temperature: 0.05,
        supportsStreaming: true,
        supportsFormalProof: true,
        supportsMultiStep: true,
        isAvailable: true,
        priority: 2,
      },
      {
        type: SpecializedModelType.WIZARDLM_MATH,
        name: 'WizardLM-Math-70B',
        description: '使用强化学习训练的大型数学推理模型，覆盖从基础到高等数学',
        strengths: ['复杂推理', '多步骤问题', '多变量问题', '微分方程'],
        weaknesses: ['小众数学领域', '领域特定符号', '超长链式推理'],
        targetCategories: [
          'de_system',
          'de_laplace',
          'de_series',
          'series_fourier',
          'application_physics',
          'application_engineering',
          'curve_integral_green',
          'surface_integral_gauss',
          'field_theory',
        ],
        modelId: 'WizardLM/WizardLM-2-8x22B-Math',
        maxTokens: 6144,
        temperature: 0.1,
        supportsStreaming: true,
        supportsFormalProof: true,
        supportsMultiStep: true,
        isAvailable: true,
        priority: 1,
      },
      {
        type: SpecializedModelType.GEMMA_MATH,
        name: 'Gemma-Math-27B',
        description:
          'Google Gemma系列专门针对数学推理优化的模型，计算速度和中文理解优秀',
        strengths: ['中文高数题', '快速计算', '应用题建模', '重积分计算'],
        weaknesses: ['前沿数学研究', '特殊形式化符号'],
        targetCategories: [
          'application_geometry',
          'application_physics',
          'application_economics',
          'multiple_integral_double',
          'multiple_integral_triple',
          'vector_algebra_dot',
          'vector_algebra_cross',
          'spatial_geometry_plane',
        ],
        modelId: 'google/gemma-math-27b',
        maxTokens: 4096,
        temperature: 0.15,
        supportsStreaming: true,
        supportsFormalProof: false,
        supportsMultiStep: true,
        isAvailable: true,
        priority: 2,
      },
      {
        type: SpecializedModelType.DEEPSEEK_MATH,
        name: 'DeepSeek-Math-67B',
        description:
          'DeepSeek专为数学问题优化的模型，在竞赛数学和高等数学中表现突出',
        strengths: ['高等数学推理', '证明题', '竞赛题', '复杂级数'],
        weaknesses: ['简单计算过度复杂化', '有时过度推理'],
        targetCategories: [
          'proof_theorem',
          'proof_inequality',
          'series_convergence',
          'curve_surface_comprehensive',
          'stokes_theorem',
          'gauss_divergence',
          'rolle_mvt',
        ],
        modelId: 'deepseek-ai/DeepSeek-Math-67B',
        maxTokens: 8192,
        temperature: 0.08,
        supportsStreaming: true,
        supportsFormalProof: true,
        supportsMultiStep: true,
        isAvailable: true,
        priority: 1,
      },
    ];

    for (const model of models) {
      this.specializedModels.set(model.type, model);
    }

    this.logger.log(
      `已初始化 ${this.specializedModels.size} 个专业数学模型: ${Array.from(this.specializedModels.keys()).join(', ')}`,
    );
  }

  getAllModels(): SpecializedModelConfig[] {
    return Array.from(this.specializedModels.values());
  }

  getModel(type: SpecializedModelType): SpecializedModelConfig | undefined {
    return this.specializedModels.get(type);
  }

  getModelsForCategory(category: string): SpecializedModelConfig[] {
    return Array.from(this.specializedModels.values())
      .filter((m) => m.targetCategories.includes(category))
      .sort((a, b) => a.priority - b.priority);
  }

  selectModel(problem: string, category: string): ModelSelectionStrategy {
    const candidates = this.getModelsForCategory(category);

    if (candidates.length === 0) {
      return {
        problem,
        recommendedModel: SpecializedModelType.MATHGLM,
        confidence: 0.3,
        alternatives: [SpecializedModelType.GEMMA_MATH],
        reasoning: `未找到针对 "${category}" 的专业模型，使用通用数学模型 MathGLM`,
        expectedPerformance: { accuracyEstimate: 0.6, latencyEstimate: 3000 },
      };
    }

    const primary = candidates[0];
    const alternatives = candidates.slice(1).map((m) => m.type);

    const benchmark = this.benchmarks
      .filter((b) => b.modelType === primary.type && b.category === category)
      .sort(
        (a, b) =>
          new Date(b.lastBenchmarked).getTime() -
          new Date(a.lastBenchmarked).getTime(),
      )[0];

    const accuracyEstimate = benchmark ? benchmark.accuracy : 0.85;
    const latencyEstimate = benchmark ? benchmark.averageLatencyMs : 3000;

    const modelNames = candidates.map((c) => c.name).join(', ');

    const strategy: ModelSelectionStrategy = {
      problem,
      recommendedModel: primary.type,
      confidence: Math.min(0.95, 0.5 + candidates.length * 0.15),
      alternatives: alternatives.slice(0, 2),
      reasoning: `匹配到 ${candidates.length} 个专业模型 (${modelNames})，推荐 ${primary.name}：${primary.description}`,
      expectedPerformance: { accuracyEstimate, latencyEstimate },
    };

    this.selectionHistory.push(strategy);
    if (this.selectionHistory.length > 500) {
      this.selectionHistory.shift();
    }

    return strategy;
  }

  recordBenchmark(benchmark: ModelBenchmark): void {
    this.benchmarks.push(benchmark);
    if (this.benchmarks.length > 200) {
      this.benchmarks.shift();
    }
    this.logger.log(
      `基准测试记录: ${benchmark.modelType} @ ${benchmark.category} = ${(benchmark.accuracy * 100).toFixed(1)}%`,
    );
  }

  getBenchmarks(modelType?: SpecializedModelType): ModelBenchmark[] {
    return modelType
      ? this.benchmarks.filter((b) => b.modelType === modelType)
      : this.benchmarks;
  }

  generateModelComparisonReport(): any {
    const modelPerformance = new Map<
      SpecializedModelType,
      {
        totalTests: number;
        totalPassed: number;
        avgAccuracy: number;
        avgLatency: number;
        avgHallucination: number;
        avgFormalVerification: number;
        categories: string[];
      }
    >();

    for (const bm of this.benchmarks) {
      let perf = modelPerformance.get(bm.modelType);
      if (!perf) {
        perf = {
          totalTests: 0,
          totalPassed: 0,
          avgAccuracy: 0,
          avgLatency: 0,
          avgHallucination: 0,
          avgFormalVerification: 0,
          categories: [],
        };
        modelPerformance.set(bm.modelType, perf);
      }
      perf.totalTests += bm.totalTests;
      perf.totalPassed += bm.passedTests;
      perf.avgAccuracy = bm.accuracy;
      perf.avgLatency = bm.averageLatencyMs;
      perf.avgHallucination = bm.hallucinationRate;
      perf.avgFormalVerification = bm.formalVerificationRate;
      if (!perf.categories.includes(bm.category)) {
        perf.categories.push(bm.category);
      }
    }

    const report: any[] = [];
    for (const [type, perf] of modelPerformance) {
      const model = this.specializedModels.get(type);
      report.push({
        type,
        name: model?.name || type,
        totalTests: perf.totalTests,
        overallAccuracy:
          ((perf.totalPassed / Math.max(1, perf.totalTests)) * 100).toFixed(1) +
          '%',
        averageLatency: perf.avgLatency + 'ms',
        hallucinationRate: (perf.avgHallucination * 100).toFixed(1) + '%',
        formalVerificationRate:
          (perf.avgFormalVerification * 100).toFixed(1) + '%',
        coveredCategories: perf.categories.length,
        available: model?.isAvailable ?? false,
      });
    }

    return report.sort((a, b) => {
      const accA = parseFloat(a.overallAccuracy) || 0;
      const accB = parseFloat(b.overallAccuracy) || 0;
      return accB - accA;
    });
  }

  generateSampleBenchmarks(): void {
    const categories = [
      'multiple_integral_double',
      'multiple_integral_triple',
      'curve_integral_green',
      'surface_integral_gauss',
      'field_theory',
      'vector_algebra_dot',
      'vector_algebra_cross',
      'spatial_geometry_plane',
    ];

    const modelTypes = [
      SpecializedModelType.MATHGLM,
      SpecializedModelType.GEMMA_MATH,
      SpecializedModelType.DEEPSEEK_MATH,
      SpecializedModelType.WIZARDLM_MATH,
      SpecializedModelType.LLEMMA,
    ];

    for (const mt of modelTypes) {
      for (const cat of categories.slice(0, 4)) {
        const accuracy = 0.65 + Math.random() * 0.3;
        this.recordBenchmark({
          modelType: mt,
          category: cat,
          totalTests: 50,
          passedTests: Math.floor(50 * accuracy),
          accuracy,
          averageLatencyMs: 1000 + Math.floor(Math.random() * 4000),
          averageTokenUsage: 500 + Math.floor(Math.random() * 2000),
          hallucinationRate: 0.02 + Math.random() * 0.08,
          formalVerificationRate:
            mt === SpecializedModelType.DEEPSEEK_MATH ||
            mt === SpecializedModelType.LLEMMA
              ? 0.6 + Math.random() * 0.35
              : 0.1 + Math.random() * 0.2,
          lastBenchmarked: new Date().toISOString(),
        });
      }
    }

    this.logger.log(`已生成 ${this.benchmarks.length} 样本基准测试数据`);
  }

  getSelectionHistory(limit: number = 50): ModelSelectionStrategy[] {
    return this.selectionHistory.slice(-limit);
  }
}
