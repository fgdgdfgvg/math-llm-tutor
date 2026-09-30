// API返回数据类型定义

// 知识图谱相关类型
export interface KnowledgeNode {
  id: string;
  name: string;
  type: string;
  description: string;
  formula?: string;
  latex?: string;
  difficulty: string;
  tags: string[];
  x?: number;
  y?: number;
  mastery?: number;
  practiceCount?: number;
  correctRate?: number;
  lastPractice?: string;
  accuracy?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
}

export interface LearningPath {
  name: string;
  description: string;
  icon: string;
  nodes: string[];
  isCustom?: boolean;
}

// 学习进度相关类型
export interface LearningProgress {
  conceptId: string;
  mastery: number;
  practiceCount: number;
  correctRate: number;
  lastPracticeDate: string;
}

// 题目相关类型
export interface Question {
  _id?: string;
  questionId?: string;
  content: string;
  knowledgePoint: string;
  difficulty: string;
  options?: string[];
  answer?: string | number;
  explanation?: string;
  analysis?: string;
  imageUrl?: string;
}

// 诊断结果相关类型
export interface DiagnosisResult {
  isCorrect: boolean;
  errorType?: string;
  errorSubType?: string;
  errorDescription?: string;
  knowledgeGaps?: string[];
  suggestions?: string[];
  metrics?: {
    timeSpent: number;
    attempts: number;
  };
  encouragement?: string;
}

// 反馈相关类型
export interface Feedback {
  summary: string;
  errorAnalysis?: string;
  conceptReview?: string;
  correctApproach?: string;
  practiceSuggestions?: string[];
  encouragement?: string;
}

// 健康检查相关类型
export interface HealthStatus {
  status: string;
  services?: Record<string, {
    status: string;
    message?: string;
  }>;
}

// 用户相关类型
export interface User {
  id: string;
  username: string;
  email: string;
  role?: string;
  createdAt?: string;
  updatedAt?: string;
}

// 认证相关类型
export interface AuthResponse {
  access_token: string;
  user: User;
}

// 学习统计相关类型
export interface LearningStats {
  totalConcepts: number;
  masteredConcepts: number;
  learningConcepts: number;
  averageMastery: number;
}

// 通用API响应类型
export interface ApiResponse<T = any> {
  code: number;
  data?: T;
  message?: string;
  status?: string;
}
