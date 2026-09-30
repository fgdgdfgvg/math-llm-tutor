export interface Scenario {
  id: string;
  name: string;
  description: string;
  type: 'virtual_lab' | 'game_level' | 'collaborative';
  difficulty: 'easy' | 'medium' | 'hard';
  subject: string;
  objectives: string[];
  tasks: ScenarioTask[];
  duration: number; // 预计完成时间（分钟）
}

export interface ScenarioTask {
  id: string;
  title: string;
  description: string;
  type: 'calculation' | 'modeling' | 'analysis' | 'proof';
  points: number;
  timeLimit: number; // 时间限制（分钟）
  hints: string[];
  solution?: string;
}

export interface GameLevel {
  id: string;
  name: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  unlocked: boolean;
  completed: boolean;
  score: number;
  maxScore: number;
  nextLevel?: string;
}
