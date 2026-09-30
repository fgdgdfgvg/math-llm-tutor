export enum KnowledgeNodeType {
  CONCEPT = 'Concept',
  THEOREM = 'Theorem',
  FORMULA = 'Formula',
  METHOD = 'Method',
  EXAMPLE = 'Example',
  PREREQUISITE = 'Prerequisite',
}

export enum KnowledgeRelationType {
  PREREQUISITE = 'PREREQUISITE',
  RELATED_TO = 'RELATED_TO',
  APPLIES_TO = 'APPLIES_TO',
  DERIVES_FROM = 'DERIVES_FROM',
  EXAMPLE_OF = 'EXAMPLE_OF',
  USES_METHOD = 'USES_METHOD',
  CONTAINS = 'CONTAINS',
}

export interface KnowledgeNode {
  id: string;
  name: string;
  type: KnowledgeNodeType;
  description: string;
  formula?: string;
  latex?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  examples?: string[];
}

export interface KnowledgeRelation {
  fromId: string;
  toId: string;
  type: KnowledgeRelationType;
  weight?: number;
  description?: string;
}

export interface ConceptNode extends KnowledgeNode {
  type: KnowledgeNodeType.CONCEPT;
  definition: string;
  properties: string[];
}

export interface TheoremNode extends KnowledgeNode {
  type: KnowledgeNodeType.THEOREM;
  statement: string;
  proof?: string;
  conditions: string[];
}

export interface FormulaNode extends KnowledgeNode {
  type: KnowledgeNodeType.FORMULA;
  expression: string;
  variables: string[];
  conditions?: string[];
}

export interface MethodNode extends KnowledgeNode {
  type: KnowledgeNodeType.METHOD;
  steps: string[];
  applicableTypes: string[];
  limitations?: string[];
}

export interface KnowledgePath {
  nodes: KnowledgeNode[];
  relations: KnowledgeRelation[];
  totalWeight: number;
}

export interface LearningPath {
  conceptId: string;
  path: KnowledgeNode[];
  estimatedTime: number;
  prerequisites: KnowledgeNode[];
}

export interface StudentKnowledgeState {
  conceptId: string;
  masteryLevel: number;
  lastPracticed?: Date;
  attemptsCount: number;
  correctCount: number;
}

export const MATH_KNOWLEDGE_AREAS = {
  LIMITS: 'limits',
  DERIVATIVES: 'derivatives',
  INTEGRALS: 'integrals',
  SERIES: 'series',
  DIFFERENTIAL_EQUATIONS: 'differential_equations',
  MULTIVARIABLE: 'multivariate_calculus',
} as const;

export const MATH_CONCEPTS = {
  LIMIT_DEFINITION: 'limit_definition',
  LIMIT_PROPERTIES: 'limit_properties',
  LIMIT_COMPUTATION: 'limit_computation',
  INFINITY_LIMITS: 'infinity_limits',
  CONTINUITY: 'continuity',
  DISCONTINUITY: 'discontinuity',
  DERIVATIVE_DEFINITION: 'derivative_definition',
  DERIVATIVE_RULES: 'derivative_rules',
  CHAIN_RULE: 'chain_rule',
  PRODUCT_RULE: 'product_rule',
  QUOTIENT_RULE: 'quotient_rule',
  IMPLICIT_DIFFERENTIATION: 'implicit_differentiation',
  HIGHER_DERIVATIVES: 'higher_derivatives',
  MEAN_VALUE_THEOREM: 'mean_value_theorem',
  EXTREME_VALUES: 'extreme_values',
  CONCAVITY: 'concavity',
  INTEGRAL_DEFINITION: 'integral_definition',
  INDEFINITE_INTEGRAL: 'indefinite_integral',
  DEFINITE_INTEGRAL: 'definite_integral',
  FUNDAMENTAL_THEOREM: 'fundamental_theorem',
  SUBSTITUTION_METHOD: 'substitution_method',
  INTEGRATION_BY_PARTS: 'integration_by_parts',
  PARTIAL_FRACTIONS: 'partial_fractions',
  IMPROPER_INTEGRALS: 'improper_integrals',
  TAYLOR_SERIES: 'taylor_series',
  POWER_SERIES: 'power_series',
  CONVERGENCE_TESTS: 'convergence_tests',
  LHOPITAL_RULE: 'lhopital_rule',
  DIFFERENTIAL_EQUATIONS: 'differential_equations',
  SEPARABLE_EQUATIONS: 'separable_equations',
  LINEAR_EQUATIONS: 'linear_equations',
} as const;
