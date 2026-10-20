import { z } from 'zod';

export const KnowledgeAreaEnum = z.enum([
  'limits',
  'derivatives',
  'integrals',
  'series',
  'differential_equations',
  'multivariable',
  'vector_calculus',
]);

export const DifficultyEnum = z.enum(['easy', 'medium', 'hard']);

export const InteractionModeEnum = z.enum([
  'drag_drop',
  'input',
  'choice',
  'slider',
  'graph_interaction',
  'multi_step',
  'proof_builder',
]);

export const TaskTypeEnum = z.enum([
  'exploration',
  'guided_practice',
  'challenge',
  'application',
  'assessment',
]);

export const CheckPointEnum = z.enum([
  'after_task',
  'after_phase',
  'on_demand',
]);

export const QuestionTypeEnum = z.enum([
  'multiple_choice',
  'short_answer',
  'calculation',
  'concept_map',
]);

export const VisualizationTypeEnum = z.enum([
  'dynamic_graph',
  'riemann_sum',
  'tangent_line',
  'slope_field',
  'surface_3d',
  'series_partial_sum',
  'vector_field',
]);

export const ParameterTypeEnum = z.enum([
  'slider',
  'dropdown',
  'input',
  'toggle',
  'range',
]);

export const InterventionTypeEnum = z.enum([
  'hint',
  'simplify',
  'challenge',
  'review_prerequisite',
  'take_break',
  'switch_method',
  'data_unavailable',
]);

const YamlTaskSchema = z.object({
  id: z.string().min(1),
  type: z.string(),
  title: z.string(),
  interaction_mode: InteractionModeEnum.optional(),
  description: z.string().optional(),
});

const YamlPhaseSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  concept_ids: z.array(z.string()),
  tasks: z.array(YamlTaskSchema),
});

const YamlQuestionSchema = z.object({
  id: z.string().min(1),
  type: QuestionTypeEnum,
  question: z.string(),
  options: z.array(z.string()).optional(),
  expected_answer: z.any(),
  explanation: z.string(),
  difficulty: z.number().min(0).max(1),
  concept_ids: z.array(z.string()).optional(),
});

const YamlFormativeCheckSchema = z.object({
  id: z.string().min(1),
  questions: z.array(YamlQuestionSchema),
  check_point: CheckPointEnum.optional().default('after_task'),
  passing_criteria: z
    .object({
      min_correct_rate: z.number().min(0).max(1).optional(),
      time_limit: z.number().positive().optional(),
    })
    .optional(),
  feedback: z
    .object({
      show_immediate_feedback: z.boolean().optional().default(true),
      detailed_explanations: z.boolean().optional().default(false),
      suggest_review_topics: z.boolean().optional().default(true),
    })
    .optional(),
});

const YamlVisualizationSchema = z.object({
  id: z.string().min(1),
  type: VisualizationTypeEnum,
  title: z.string().optional(),
  description: z.string().optional(),
  parameters: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        label: z.string(),
        type: ParameterTypeEnum,
        constraints: z.object({
          min: z.number().optional(),
          max: z.number().optional(),
          step: z.number().optional(),
          default_value: z.any(),
          options: z
            .array(z.object({ label: z.string(), value: z.any() }))
            .optional(),
        }),
        binding: z.object({
          target: z.string(),
          transform: z.string().optional(),
          unit: z.string().optional(),
        }),
        visibility: z
          .object({
            show_if: z.object({
              param: z.string(),
              condition: z.enum(['equals', 'greater', 'less']),
              value: z.any(),
            }),
          })
          .optional(),
      }),
    )
    .optional(),
});

export const ScenarioYamlSchema = z.object({
  scenario: z.object({
    id: z.string().min(1),
    name: z.string(),
    description: z.string().optional(),
    version: z.string(),
    knowledge_area: KnowledgeAreaEnum,
    difficulty: DifficultyEnum,
    estimated_duration: z.number().positive(),
  }),

  metadata: z
    .object({
      author: z.string().optional(),
      tags: z.array(z.string()).optional(),
      prerequisites: z.array(z.string()).optional(),
    })
    .optional(),

  learning_path: z.array(YamlPhaseSchema).optional(),

  visualizations: z.array(YamlVisualizationSchema).optional(),

  assessment: z
    .object({
      mastery_threshold: z.number().min(0).max(1).optional().default(0.8),
      formative_checks: z.array(YamlFormativeCheckSchema).optional(),
    })
    .optional(),
});

export type KnowledgeArea = z.infer<typeof KnowledgeAreaEnum>;
export type Difficulty = z.infer<typeof DifficultyEnum>;
export type InteractionMode = z.infer<typeof InteractionModeEnum>;
export type TaskType = z.infer<typeof TaskTypeEnum>;
export type CheckPoint = z.infer<typeof CheckPointEnum>;
export type QuestionType = z.infer<typeof QuestionTypeEnum>;
export type VisualizationType = z.infer<typeof VisualizationTypeEnum>;
export type ParameterType = z.infer<typeof ParameterTypeEnum>;
export type InterventionType = z.infer<typeof InterventionTypeEnum>;

export type ValidatedYamlTask = z.infer<typeof YamlTaskSchema>;
export type ValidatedYamlPhase = z.infer<typeof YamlPhaseSchema>;
export type ValidatedYamlQuestion = z.infer<typeof YamlQuestionSchema>;
export type ValidatedYamlFormativeCheck = z.infer<
  typeof YamlFormativeCheckSchema
>;
export type ValidatedYamlVisualization = z.infer<
  typeof YamlVisualizationSchema
>;
export type ValidatedScenarioConfig = z.infer<typeof ScenarioYamlSchema>;

export interface WeightConfig {
  userLevelBase: number;
  userLevelSensitivity: number;
  urgencyMultiplier: number;
  frequencyBase: number;
  frequencyLogBase: number;
  recencyDecayDays: number;
  recencyMinFactor: number;
  maxWeightCap: number;
}

export const DefaultWeightConfig: WeightConfig = {
  userLevelBase: 1.0,
  userLevelSensitivity: 0.4,
  urgencyMultiplier: 1.2,
  frequencyBase: 1.0,
  frequencyLogBase: 10,
  recencyDecayDays: 30,
  recencyMinFactor: 0.8,
  maxWeightCap: 1.0,
};

export type TagRelevanceMap = {
  [area in KnowledgeArea]: Array<{ tag: string; score: number }>;
};

export const DefaultTagRelevance: TagRelevanceMap = {
  limits: [
    { tag: '极限', score: 0.95 },
    { tag: 'limit', score: 0.9 },
    { tag: '收敛', score: 0.85 },
    { tag: '连续', score: 0.8 },
    { tag: 'epsilon-delta', score: 0.9 },
  ],
  derivatives: [
    { tag: '导数', score: 0.95 },
    { tag: 'derivative', score: 0.9 },
    { tag: '变化率', score: 0.85 },
    { tag: '切线', score: 0.8 },
    { tag: '微分', score: 0.9 },
  ],
  integrals: [
    { tag: '积分', score: 0.95 },
    { tag: 'integral', score: 0.9 },
    { tag: '不定积分', score: 0.9 },
    { tag: '定积分', score: 0.9 },
    { tag: '面积', score: 0.75 },
  ],
  series: [
    { tag: '级数', score: 0.95 },
    { tag: 'series', score: 0.9 },
    { tag: '收敛', score: 0.8 },
    { tag: '泰勒', score: 0.85 },
    { tag: '傅里叶', score: 0.8 },
  ],
  differential_equations: [
    { tag: '微分方程', score: 0.95 },
    { tag: 'ODE', score: 0.9 },
    { tag: '常微分', score: 0.85 },
    { tag: '偏微分', score: 0.8 },
  ],
  multivariable: [
    { tag: '多元', score: 0.95 },
    { tag: '偏导数', score: 0.9 },
    { tag: '梯度', score: 0.85 },
    { tag: 'multivariable', score: 0.9 },
  ],
  vector_calculus: [
    { tag: '向量', score: 0.95 },
    { tag: 'vector', score: 0.9 },
    { tag: '散度', score: 0.85 },
    { tag: '旋度', score: 0.85 },
    { tag: '曲线积分', score: 0.9 },
  ],
};

export interface CacheConfig {
  ttlMs: number;
  maxSize: number;
  enableRedis: boolean;
  redisUrl?: string;
  redisPrefix?: string;
}

export const DefaultCacheConfig: CacheConfig = {
  ttlMs: 5 * 60 * 1000,
  maxSize: 1000,
  enableRedis: false,
  redisPrefix: 'il:',
};
