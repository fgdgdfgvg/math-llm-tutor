export {
  EPSILON_DELTA_FUNCTIONS,
  checkDelta,
  evaluateDelta,
  findOptimalDelta,
  searchOptimalDelta,
  describeDeltaVerification,
} from './epsilonDelta'
export type { EpsilonDeltaFunction, DeltaEvaluation, OptimalDeltaResult } from './epsilonDelta'

export {
  DERIVATIVE_FUNCTIONS,
  CONCAVITY_TERMS,
  MIN_STEP,
  computeTangentLine,
  computeSecantLine,
  forwardDifference,
  centralDifference,
  secondCentralDifference,
  analyzeConcavity,
  getConcavityLabel,
  compareDifferenceSchemes,
} from './derivative'
export type { DerivativeFunction, Concavity, ConcavityAnalysis, SecantLine } from './derivative'

export {
  INTEGRAL_FUNCTIONS,
  MAX_INTERVALS,
  computeRiemannSum,
  computeExactIntegral,
  computeRiemannRectangles,
  trapezoidSum,
  simpsonSum,
  computeQuadrature,
  computeHighPrecisionReference,
  validateIntegrationRange,
  compareMethods,
} from './integral'
export type {
  IntegralFunction,
  RiemannType,
  QuadratureMethod,
  RangeValidation,
  MethodComparison,
} from './integral'

export {
  TAYLOR_FUNCTIONS,
  factorial,
  taylorApprox,
  taylorCoeffs,
  describeTermLimits,
  isWithinConvergence,
  lagrangeRemainderBound,
  fourierSquareWave,
  measureGibbsOvershoot,
  computeErrorDistribution,
  checkConvergenceTrend,
} from './series'
export type { TaylorFunction, ErrorPoint, ErrorDistribution } from './series'

export {
  AREA_MAP,
  buildAdjacency,
  collectPrerequisites,
  findLearningPath,
  findShortestPath,
  getMasteryColor,
  getMasteryLabel,
  toPercentMastery,
} from './graph'
export type { LearningPath, LearningPathStep, AdjacencyOptions } from './graph'
