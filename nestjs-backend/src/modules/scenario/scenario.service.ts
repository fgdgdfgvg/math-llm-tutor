import { Injectable } from '@nestjs/common';
import { Scenario, ScenarioTask, GameLevel } from './types';

@Injectable()
export class ScenarioService {
  private scenarios: Scenario[] = [
    {
      id: 'physics_motion',
      name: '物理运动轨迹建模',
      description: '通过数学建模分析物体的运动轨迹，应用微积分和力学知识',
      type: 'virtual_lab',
      difficulty: 'medium',
      subject: '微积分',
      objectives: [
        '理解位移、速度、加速度之间的关系',
        '应用导数和积分解决运动问题',
        '建立和求解运动微分方程'
      ],
      tasks: [
        {
          id: 'task1',
          title: '自由落体运动分析',
          description: '分析物体在重力作用下的自由落体运动，计算落地时间和速度',
          type: 'calculation',
          points: 10,
          timeLimit: 5,
          hints: [
            '使用加速度公式：a = g',
            '速度是加速度的积分',
            '位移是速度的积分'
          ]
        },
        {
          id: 'task2',
          title: '抛体运动轨迹',
          description: '计算物体以一定初速度和角度抛出后的运动轨迹',
          type: 'modeling',
          points: 15,
          timeLimit: 8,
          hints: [
            '分解速度为水平和垂直分量',
            '水平方向匀速运动',
            '垂直方向匀加速运动'
          ]
        }
      ],
      duration: 30
    },
    {
      id: 'economic_model',
      name: '经济模型求解',
      description: '应用微积分和优化理论分析经济模型，解决生产和消费问题',
      type: 'virtual_lab',
      difficulty: 'hard',
      subject: '微积分',
      objectives: [
        '建立成本和收益函数',
        '应用导数求极值',
        '分析市场均衡状态'
      ],
      tasks: [
        {
          id: 'task1',
          title: '利润最大化',
          description: '根据成本函数和需求函数，计算利润最大化的产量',
          type: 'calculation',
          points: 12,
          timeLimit: 6,
          hints: [
            '利润 = 收益 - 成本',
            '边际收益 = 边际成本时利润最大',
            '对利润函数求导并令其为零'
          ]
        },
        {
          id: 'task2',
          title: '消费者剩余分析',
          description: '计算市场均衡时的消费者剩余和生产者剩余',
          type: 'analysis',
          points: 18,
          timeLimit: 10,
          hints: [
            '消费者剩余是需求曲线以下的面积',
            '生产者剩余是供给曲线以上的面积',
            '使用积分计算面积'
          ]
        }
      ],
      duration: 45
    },
    {
      id: 'integral_challenge',
      name: '积分挑战赛',
      description: '通过一系列积分题目，挑战你的积分技巧和速度',
      type: 'game_level',
      difficulty: 'medium',
      subject: '积分',
      objectives: [
        '掌握各种积分方法',
        '提高解题速度和准确性',
        '培养数学思维能力'
      ],
      tasks: [
        {
          id: 'task1',
          title: '基础积分',
          description: '求解基本的不定积分',
          type: 'calculation',
          points: 5,
          timeLimit: 2,
          hints: [
            '回忆基本积分公式',
            '注意常数项'
          ]
        },
        {
          id: 'task2',
          title: '换元积分',
          description: '使用换元法求解积分',
          type: 'calculation',
          points: 10,
          timeLimit: 4,
          hints: [
            '选择合适的换元变量',
            '注意微分的转换'
          ]
        },
        {
          id: 'task3',
          title: '分部积分',
          description: '使用分部积分法求解积分',
          type: 'calculation',
          points: 15,
          timeLimit: 6,
          hints: [
            '正确选择u和dv',
            '应用分部积分公式'
          ]
        }
      ],
      duration: 20
    },
    {
      id: 'matrix_maze',
      name: '矩阵迷宫',
      description: '通过矩阵运算解决迷宫问题，找到从起点到终点的路径',
      type: 'game_level',
      difficulty: 'hard',
      subject: '线性代数',
      objectives: [
        '掌握矩阵运算',
        '理解线性变换',
        '培养空间思维能力'
      ],
      tasks: [
        {
          id: 'task1',
          title: '矩阵路径',
          description: '通过矩阵乘法找到正确的路径',
          type: 'calculation',
          points: 10,
          timeLimit: 5,
          hints: [
            '每个矩阵代表一个方向变换',
            '按照顺序相乘矩阵'
          ]
        },
        {
          id: 'task2',
          title: '逆矩阵解密',
          description: '使用逆矩阵解密路径信息',
          type: 'calculation',
          points: 15,
          timeLimit: 8,
          hints: [
            '逆矩阵可以撤销变换',
            '注意矩阵乘法的顺序'
          ]
        }
      ],
      duration: 25
    }
  ];

  private gameLevels: GameLevel[] = [
    {
      id: 'level1',
      name: '积分入门',
      description: '基础积分练习',
      difficulty: 'easy',
      unlocked: true,
      completed: false,
      score: 0,
      maxScore: 100,
      nextLevel: 'level2'
    },
    {
      id: 'level2',
      name: '导数挑战',
      description: '导数计算与应用',
      difficulty: 'medium',
      unlocked: false,
      completed: false,
      score: 0,
      maxScore: 150,
      nextLevel: 'level3'
    },
    {
      id: 'level3',
      name: '微分方程',
      description: '一阶微分方程求解',
      difficulty: 'hard',
      unlocked: false,
      completed: false,
      score: 0,
      maxScore: 200,
      nextLevel: 'level4'
    },
    {
      id: 'level4',
      name: '综合挑战',
      description: '综合应用各种数学知识',
      difficulty: 'hard',
      unlocked: false,
      completed: false,
      score: 0,
      maxScore: 300
    }
  ];

  async getScenarios(): Promise<Scenario[]> {
    return this.scenarios;
  }

  async getScenarioById(id: string): Promise<Scenario | null> {
    return this.scenarios.find(scenario => scenario.id === id) || null;
  }

  async getScenariosByType(type: string): Promise<Scenario[]> {
    return this.scenarios.filter(scenario => scenario.type === type);
  }

  async getScenariosByDifficulty(difficulty: string): Promise<Scenario[]> {
    return this.scenarios.filter(scenario => scenario.difficulty === difficulty);
  }

  async getGameLevels(): Promise<GameLevel[]> {
    return this.gameLevels;
  }

  async getGameLevelById(id: string): Promise<GameLevel | null> {
    return this.gameLevels.find(level => level.id === id) || null;
  }

  async completeGameLevel(userId: string, levelId: string, score: number): Promise<GameLevel> {
    const level = this.gameLevels.find(l => l.id === levelId);
    if (!level) {
      throw new Error('Level not found');
    }

    level.completed = true;
    level.score = Math.max(level.score, score);

    // 解锁下一关
    if (level.nextLevel) {
      const nextLevel = this.gameLevels.find(l => l.id === level.nextLevel);
      if (nextLevel) {
        nextLevel.unlocked = true;
      }
    }

    return level;
  }

  async createCollaborativeSession(userId: string, scenarioId: string): Promise<any> {
    // 创建协作会话
    const sessionId = `session_${Date.now()}`;
    return {
      sessionId,
      scenarioId,
      creator: userId,
      participants: [userId],
      status: 'active',
      createdAt: new Date().toISOString(),
      tasks: []
    };
  }

  async joinCollaborativeSession(sessionId: string, userId: string): Promise<any> {
    // 加入协作会话
    return {
      sessionId,
      userId,
      status: 'joined',
      joinedAt: new Date().toISOString()
    };
  }

  async submitTask(userId: string, scenarioId: string, taskId: string, answer: unknown): Promise<{
    userId: string;
    scenarioId: string;
    taskId: string;
    isCorrect: boolean;
    score: number;
    submittedAt: string;
  }> {
    // 提交任务答案
    const scenario = this.scenarios.find(s => s.id === scenarioId);
    const task = scenario?.tasks.find(t => t.id === taskId);

    if (!scenario || !task) {
      throw new Error('Scenario or task not found');
    }

    // 这里应该有实际的答案验证逻辑
    const isCorrect = this.validateAnswer(task, answer);

    return {
      userId,
      scenarioId,
      taskId,
      isCorrect,
      score: isCorrect ? task.points : 0,
      submittedAt: new Date().toISOString()
    };
  }

  private validateAnswer(task: ScenarioTask, answer: unknown): boolean {
    // 简单的答案验证逻辑
    // 实际应用中应该根据具体任务类型进行验证
    return typeof answer === 'string' && answer.length > 0;
  }
}
