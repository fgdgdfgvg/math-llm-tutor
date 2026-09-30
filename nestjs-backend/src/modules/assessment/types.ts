export interface AssessmentResult {
  overallMastery: number;
  strategyMaturity: number;
  antiInterference: number;
  predictiveScore: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

export interface KnowledgeStats {
  conceptId: string;
  conceptName: string;
  mastery: number;
  practiceCount: number;
  correctRate: number;
  errorPatterns: string[];
}
