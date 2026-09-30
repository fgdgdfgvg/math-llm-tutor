import { KnowledgeStats } from '../types';

export const mockKnowledgeStats: KnowledgeStats[] = [
  {
    conceptId: 'function',
    conceptName: '函数',
    mastery: 85,
    practiceCount: 20,
    correctRate: 80,
    errorPatterns: ['计算错误']
  },
  {
    conceptId: 'limit',
    conceptName: '极限',
    mastery: 70,
    practiceCount: 15,
    correctRate: 75,
    errorPatterns: ['概念混淆', '计算错误']
  },
  {
    conceptId: 'derivative',
    conceptName: '导数',
    mastery: 65,
    practiceCount: 18,
    correctRate: 70,
    errorPatterns: ['链式法则错误', '乘积法则错误']
  },
  {
    conceptId: 'integral',
    conceptName: '积分',
    mastery: 60,
    practiceCount: 12,
    correctRate: 65,
    errorPatterns: ['换元法错误', '分部积分错误']
  },
  {
    conceptId: 'differential_equation',
    conceptName: '微分方程',
    mastery: 55,
    practiceCount: 10,
    correctRate: 60,
    errorPatterns: ['分离变量错误', '积分常数错误']
  }
];

export const mockClassAverage = {
  mastery: 65,
  strategy: 60,
  antiInterference: 65,
  accuracy: 70,
  speed: 68,
};
