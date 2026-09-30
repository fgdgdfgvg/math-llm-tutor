import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Question } from './schemas/question.schema';
import { Mistake } from './schemas/mistake.schema';
import * as fs from 'fs/promises';
import * as path from 'path';

interface GetQuestionsQuery {
  knowledgePoint?: string;
  difficulty?: string;
  type?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class QuestionsService {
  private readonly logger = new Logger(QuestionsService.name);
  private knowledgeMapping: Record<string, string[]> = {};
  private subConceptMapping: Record<string, string> = {};
  private knowledgeAliasMapping: Record<string, string> = {};

  constructor(
    @InjectModel(Question.name) private questionModel: Model<Question>,
    @InjectModel(Mistake.name) private mistakeModel: Model<Mistake>,
  ) {
    this.loadKnowledgeMapping().catch(error => {
      this.logger.error('Failed to load knowledge mapping during initialization:', error);
    });
  }

  private async loadKnowledgeMapping() {
    try {
      // 智能路径查找
      let currentDir = __dirname;
      let mappingPath = '';
      
      for (let i = 0; i < 5; i++) {
        const potentialPath = path.join(currentDir, 'datasets', 'knowledge-point-mapping.json');
        try {
          await fs.access(potentialPath);
          mappingPath = potentialPath;
          break;
        } catch {
          currentDir = path.dirname(currentDir);
        }
      }

      if (!mappingPath) {
        throw new Error('knowledge-point-mapping.json not found in any parent directory');
      }

      this.logger.log(`Found mapping file path: ${mappingPath}`);

      const mappingData = await fs.readFile(mappingPath, 'utf8');
      const mapping = JSON.parse(mappingData);
      
      // 加载知识点映射
      if (mapping['知识点映射']) {
        this.knowledgeMapping = mapping['知识点映射'];
      }
      
      // 加载子概念映射（用于将子概念 ID 映射到标准子概念 ID）
      if (mapping['子概念映射']) {
        this.subConceptMapping = mapping['子概念映射'];
      }
      
      // 加载知识点别名映射（用于处理数据库中不同的知识点名称）
      if (mapping['知识点别名映射']) {
        this.knowledgeAliasMapping = mapping['知识点别名映射'];
      }

      // 打印加载结果
      const keys = Object.keys(this.knowledgeMapping);
      this.logger.log(`Successfully loaded knowledge mapping with ${keys.length} knowledge points`);
      this.logger.log(`Sub-concept mapping count: ${Object.keys(this.subConceptMapping).length}`);
      this.logger.log(`Knowledge point alias count: ${Object.keys(this.knowledgeAliasMapping).length}`);
      
      if (keys.length > 0) {
        this.logger.log('Knowledge points list:', keys);
        keys.forEach(key => {
          this.logger.log(`${key}: [ ${this.knowledgeMapping[key].slice(0, 3).join(', ')} ${this.knowledgeMapping[key].length > 3 ? '...' : ''} ]`);
        });
      } else {
        this.logger.error('Knowledge mapping is empty! Please check JSON file content or path.');
      }

    } catch (error) {
      this.logger.error('Critical: Failed to load knowledge mapping:', error.message);
      this.logger.error('Please ensure datasets/knowledge-point-mapping.json exists in project root or parent directory');
      this.knowledgeMapping = {};
      this.subConceptMapping = {};
      this.knowledgeAliasMapping = {};
    }
  }

  /**
   * 根据前端传递的知识点 ID 查找对应的中文知识点名称
   */
  private findKnowledgePointName(knowledgePointId: string): string | null {
    if (!knowledgePointId) return null;
    
    const cleanId = knowledgePointId.trim();
    
    // 1. 直接匹配中文知识点名称
    if (this.knowledgeMapping[cleanId]) {
      this.logger.log(`Direct match found for knowledge point: "${cleanId}"`);
      return cleanId;
    }
    
    // 2. 遍历知识点映射，查找子概念 ID
    for (const [chinesePoint, conceptIds] of Object.entries(this.knowledgeMapping)) {
      const idsAsString = conceptIds.map(id => String(id).trim());
      if (idsAsString.includes(cleanId)) {
        this.logger.log(`Match found! ID "${cleanId}" belongs to knowledge point "${chinesePoint}"`);
        return chinesePoint;
      }
    }
    
    // 3. 通过子概念映射间接查找
    if (this.subConceptMapping[cleanId]) {
      const standardSubConcept = this.subConceptMapping[cleanId];
      this.logger.log(`Sub-concept mapping: "${cleanId}" -> "${standardSubConcept}"`);
      // 递归查找标准子概念属于哪个知识点
      for (const [chinesePoint, conceptIds] of Object.entries(this.knowledgeMapping)) {
        if (conceptIds.map(id => String(id).trim()).includes(standardSubConcept)) {
          this.logger.log(`Found knowledge point through sub-concept mapping: "${chinesePoint}"`);
          return chinesePoint;
        }
      }
    }
    
    // 4. 硬编码映射兜底
    const frontEndToBackendMap: Record<string, string> = {
      'limit': '极限计算',
      'derivative': '导数与微分',
      'integral': '积分计算',
      'series': '级数与幂级数',
      'differential_equation': '微分方程',
      'vector': '向量与空间解析几何',
      'linear_algebra': '线性代数与矩阵',
      // 新增映射
      'function': '极限计算',
      'function_limit': '极限计算',
      'partial_derivative': '导数与微分',
      'multivariable_function': '向量与空间解析几何',
      'hessian': '导数与微分',
      'gradient': '导数与微分',
      'double_integral': '积分计算',
      'triple_integral': '积分计算',
      'eigenvalue': '线性代数与矩阵',
      'eigenvector': '线性代数与矩阵',
      'matrix': '线性代数与矩阵',
      'determinant': '线性代数与矩阵',
      'fourier': '级数与幂级数',
      'laplace': '微分方程',
      'ode': '微分方程',
      'pde': '微分方程',
    };
    
    if (frontEndToBackendMap[cleanId]) {
      this.logger.log(`Hardcoded mapping hit: "${cleanId}" -> "${frontEndToBackendMap[cleanId]}"`);
      return frontEndToBackendMap[cleanId];
    }
    
    // 5. 知识点别名映射（处理数据库中的不同名称）
    if (this.knowledgeAliasMapping[cleanId]) {
      this.logger.log(`Knowledge point alias mapping hit: "${cleanId}" -> "${this.knowledgeAliasMapping[cleanId]}"`);
      return this.knowledgeAliasMapping[cleanId];
    }

    // 6. 关键词兜底：知识图谱的节点名/ID（如“极限的定义”"derivative_rules"）
    //    与题库知识点（如“极限计算”）并不是同一套命名，必须做一次语义匹配，
    //    否则请求会被当成“无法识别”而退化成全库随机出题（表现为无论点哪个知识点都是同一批题）。
    const keywordMatch = this.matchKnowledgePointByKeyword(cleanId);
    if (keywordMatch) {
      this.logger.log(`Keyword fallback hit: "${cleanId}" -> "${keywordMatch}"`);
      return keywordMatch;
    }

    this.logger.warn(`No matching knowledge point found for: ${cleanId}`);
    return null;
  }

  /**
   * 知识点关键词表：图谱概念名/ID 与题库中文知识点之间的语义桥。
   * 匹配时取“命中关键词最长”的那条，保证“微分方程”优先于“微分”。
   */
  private static readonly KNOWLEDGE_KEYWORDS: Array<[string, string]> = [
    // 极限
    ['极限', '极限计算'],
    ['洛必达', '极限计算'],
    ['lhopital', '极限计算'],
    ['l-hopital', '极限计算'],
    ['连续', '极限计算'],
    ['间断', '极限计算'],
    ['无穷', '极限计算'],
    ['limit', '极限计算'],
    ['continuity', '极限计算'],
    ['infinity', '极限计算'],
    // 导数
    ['偏导数', '导数'],
    ['偏导', '导数'],
    ['导数', '导数'],
    ['求导', '导数'],
    ['切线', '导数'],
    ['微分', '导数'],
    ['中值定理', '导数'],
    ['凹凸', '导数'],
    ['拐点', '导数'],
    ['极值', '导数'],
    ['最值', '导数'],
    ['梯度', '导数'],
    ['derivative', '导数'],
    ['gradient', '导数'],
    ['tangent', '导数'],
    // 积分
    ['定积分', '积分'],
    ['不定积分', '积分'],
    ['换元积分', '积分'],
    ['分部积分', '积分'],
    ['反常积分', '积分'],
    ['原函数', '积分'],
    ['积分', '积分'],
    ['integral', '积分'],
    // 级数
    ['泰勒级数', '级数'],
    ['幂级数', '级数'],
    ['傅里叶', '级数'],
    ['泰勒', '级数'],
    ['收敛', '级数'],
    ['级数', '级数'],
    ['series', '级数'],
    ['taylor', '级数'],
    ['fourier', '级数'],
    // 向量 / 空间解析几何
    ['空间解析几何', '向量'],
    ['多元函数', '向量'],
    ['向量', '向量'],
    ['vector', '向量'],
    ['multivariable', '向量'],
    // 线性代数
    ['线性代数', '线性代数'],
    ['矩阵', '线性代数'],
    ['行列式', '线性代数'],
    ['特征值', '线性代数'],
    ['特征向量', '线性代数'],
    ['matrix', '线性代数'],
    ['eigen', '线性代数'],
    ['determinant', '线性代数'],
    // 微分方程（放在“微分”之后由长度决胜）
    ['微分方程', '微分方程'],
    ['分离变量', '微分方程'],
    ['常微分', '微分方程'],
    ['differential_equation', '微分方程'],
    ['differential-equation', '微分方程'],
    ['ode', '微分方程'],
  ];

  private matchKnowledgePointByKeyword(input: string): string | null {
    const haystack = input.toLowerCase();
    let best: { keyword: string; knowledgePoint: string } | null = null;

    for (const [keyword, knowledgePoint] of QuestionsService.KNOWLEDGE_KEYWORDS) {
      if (!haystack.includes(keyword)) continue;
      if (!this.knowledgeMapping[knowledgePoint]) continue;
      if (!best || keyword.length > best.keyword.length) {
        best = { keyword, knowledgePoint };
      }
    }

    return best ? best.knowledgePoint : null;
  }

  /**
   * 解析前端传来的知识点标识：既支持题库中文知识点 / 子概念 ID，
   * 也支持知识图谱的节点 ID 与节点名称。
   */
  private resolveKnowledgePoint(input?: string | Array<string | undefined>): string | null {
    const candidates = (Array.isArray(input) ? input : [input])
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter((value) => value && value !== 'undefined' && value !== 'null');

    for (const candidate of candidates) {
      const resolved = this.findKnowledgePointName(candidate);
      if (resolved) return resolved;
    }

    return null;
  }

  /**
   * 根据知识点名称查询数据库，处理别名映射
   */
  private async queryQuestionsByKnowledgePoint(knowledgePointName: string): Promise<Question[]> {
    this.logger.log(`Querying knowledge point: ${knowledgePointName}`);
    
    // 精确匹配
    let questions = await this.questionModel.find({ knowledgePoint: knowledgePointName }).limit(50).exec();
    
    if (questions.length > 0) {
      this.logger.log(`Exact match successful, found ${questions.length} questions`);
      return questions;
    }
    
    // 尝试别名匹配（双向）
    // 1. 检查knowledgePointName是否是标准名称，查找对应的别名
    for (const [alias, standardName] of Object.entries(this.knowledgeAliasMapping)) {
      if (standardName === knowledgePointName) {
        this.logger.log(`Trying alias match (standard to alias): ${alias}`);
        questions = await this.questionModel.find({ knowledgePoint: alias }).limit(50).exec();
        if (questions.length > 0) {
          this.logger.log(`Alias match successful, found ${questions.length} questions`);
          return questions;
        }
      }
    }
    
    // 2. 检查knowledgePointName是否是别名，查找对应的标准名称
    if (this.knowledgeAliasMapping[knowledgePointName]) {
      const standardName = this.knowledgeAliasMapping[knowledgePointName];
      this.logger.log(`Trying standard name match (alias to standard): ${standardName}`);
      questions = await this.questionModel.find({ knowledgePoint: standardName }).limit(50).exec();
      if (questions.length > 0) {
        this.logger.log(`Standard name match successful, found ${questions.length} questions`);
        return questions;
      }
    }
    
    // 模糊匹配兜底（转义正则元字符，避免 ReDoS 与意外匹配）
    this.logger.log(`Exact match failed, trying fuzzy match: ${knowledgePointName}`);
    questions = await this.questionModel.find({
      knowledgePoint: { $regex: new RegExp(this.escapeRegex(knowledgePointName), 'i') },
    }).limit(50).exec();
    
    if (questions.length > 0) {
      this.logger.log(`Fuzzy match successful, found ${questions.length} questions`);
      return questions;
    }
    
    return [];
  }

  async getRandomQuestionByKnowledgePoint(
    knowledgePoint?: string | Array<string | undefined>,
  ): Promise<Question> {
    this.logger.log(`Received knowledge point: ${JSON.stringify(knowledgePoint)}`);

    let questions;

    // 1. 解析知识点（题库中文名 / 子概念 ID / 图谱节点 ID / 图谱节点名）
    const targetKnowledgePoint = this.resolveKnowledgePoint(knowledgePoint);
    const requestedKnowledgePoint = Array.isArray(knowledgePoint)
      ? knowledgePoint.some((value) => typeof value === 'string' && value.trim() && value !== 'undefined' && value !== 'null')
      : typeof knowledgePoint === 'string' && !!knowledgePoint.trim();

    if (requestedKnowledgePoint && !targetKnowledgePoint) {
      throw new NotFoundException('未识别的知识点，无法生成专项练习题');
    }

    if (targetKnowledgePoint) {
      questions = await this.queryQuestionsByKnowledgePoint(targetKnowledgePoint);

      if (questions.length === 0) {
        this.logger.warn(`No questions found for knowledge point "${targetKnowledgePoint}"`);
      } else {
        const randomIndex = Math.floor(Math.random() * questions.length);
        this.logger.log(`Returning random question: ${questions[randomIndex].questionId}`);
        return questions[randomIndex];
      }
    } else {
      this.logger.log('No knowledge point provided, returning random question');
    }

    // 2. 兜底：仅在完全没有指定知识点时返回全库随机题
    questions = await this.questionModel.find().limit(50).exec();
    if (questions.length === 0) {
      throw new NotFoundException('No questions found in database');
    }
    const randomIndex = Math.floor(Math.random() * questions.length);
    this.logger.log(`Returning random question: ${questions[randomIndex].questionId}`);
    return questions[randomIndex];
  }

  async getQuestionById(id: string): Promise<Question> {
    this.logger.log(`Requesting question by ID: ${id}`);
    
    // 验证ID有效性
    if (!id || id === 'undefined' || id === 'null' || id.trim() === '') {
      this.logger.error(`Invalid question ID: ${id}`);
      throw new NotFoundException(`Invalid question ID: ${id}`);
    }
    
    // 尝试通过questionId字段查找
    let question = await this.questionModel.findOne({ questionId: id }).exec();
    
    // 只有形如 ObjectId 的字符串才尝试 _id 查询，否则 mongoose 会抛 CastError（500）
    if (!question && /^[a-f\d]{24}$/i.test(id)) {
      this.logger.log(`Not found by questionId, trying by _id: ${id}`);
      question = await this.questionModel.findById(id).exec();
    }
    
    if (!question) {
      this.logger.error(`Question not found: ${id}`);
      throw new NotFoundException(`Question with ID ${id} not found`);
    }
    
    this.logger.log(`Successfully found question: ${question.questionId || question._id}`);
    return question;
  }

  async getQuestionsByConcept(conceptId: string, page: number = 1, limit: number = 10): Promise<{ questions: Question[]; total: number }> {
    this.logger.log(`Requesting concept questions list, ID: "${conceptId}"`);
    
    const targetKnowledgePoint = this.resolveKnowledgePoint(conceptId);
    
    if (!targetKnowledgePoint) {
      this.logger.warn(`No knowledge point mapping found: ${conceptId}`);
      return { questions: [], total: 0 };
    }

    const skip = (page - 1) * limit;
    const [questions, total] = await Promise.all([
      this.questionModel.find({ knowledgePoint: targetKnowledgePoint }).skip(skip).limit(limit).exec(),
      this.questionModel.countDocuments({ knowledgePoint: targetKnowledgePoint }).exec(),
    ]);

    // 如果精确匹配为空，尝试别名
    if (questions.length === 0) {
      for (const [alias, standardName] of Object.entries(this.knowledgeAliasMapping)) {
        if (standardName === targetKnowledgePoint) {
          const [aliasQuestions, aliasTotal] = await Promise.all([
            this.questionModel.find({ knowledgePoint: alias }).skip(skip).limit(limit).exec(),
            this.questionModel.countDocuments({ knowledgePoint: alias }).exec(),
          ]);
          if (aliasQuestions.length > 0) {
            return { questions: aliasQuestions, total: aliasTotal };
          }
        }
      }
    }

    return { questions, total };
  }

  async getQuestions(query: GetQuestionsQuery): Promise<{ questions: Question[]; total: number }> {
    const { knowledgePoint, difficulty, type, page = 1, limit = 10 } = query;
    const filter: any = {};

    if (knowledgePoint) {
      filter.knowledgePoint = knowledgePoint;
    }

    if (difficulty) {
      filter.difficulty = difficulty;
    }

    if (type) {
      filter.questionType = type;
    }

    const skip = (page - 1) * limit;
    const [questions, total] = await Promise.all([
      this.questionModel
        .find(filter)
        .skip(skip)
        .limit(limit)
        .exec(),
      this.questionModel.countDocuments(filter).exec(),
    ]);

    return { questions, total };
  }

  /**
   * 标准知识点名 + 所有指向它的别名。归档记录里可能写作“积分计算”，
   * 而解析出来的是“积分”，不展开别名就会查不到任何错题。
   */
  private knowledgePointVariants(standardName: string): string[] {
    const variants = new Set<string>([standardName]);
    for (const [alias, standard] of Object.entries(this.knowledgeAliasMapping)) {
      if (standard === standardName) variants.add(alias);
    }
    return Array.from(variants);
  }

  async getMistakesByConcept(userId: string, conceptId: string): Promise<Mistake[]> {
    const targetKnowledgePoint = this.resolveKnowledgePoint(conceptId);
    
    if (!targetKnowledgePoint) {
      return [];
    }

    return this.mistakeModel
      .find({
        userId,
        knowledgePoint: { $in: this.knowledgePointVariants(targetKnowledgePoint) },
      })
      .sort({ attemptedAt: -1 })
      .exec();
  }

  async getMistakesByCategory(userId: string, category?: string): Promise<Mistake[]> {
    this.logger.log(`Getting mistakes for user: ${userId}, category: ${category}`);
    
    const filter: any = { userId };
    
    // 如果指定了分类，添加分类过滤
    if (category && category !== 'all' && category !== '') {
      const targetKnowledgePoint = this.resolveKnowledgePoint(category);
      if (targetKnowledgePoint) {
        filter.knowledgePoint = { $in: this.knowledgePointVariants(targetKnowledgePoint) };
      }
    }

    return this.mistakeModel
      .find(filter)
      .sort({ attemptedAt: -1 })
      .exec();
  }

  async createMistake(mistakeData: {
    userId: string;
    questionId: string;
    questionContent: string;
    userAnswer: string;
    correctAnswer: string;
    solutionSteps: string[];
    knowledgePoint: string;
    subConcepts: string[];
    difficulty: string;
  }): Promise<Mistake> {
    const mistake = new this.mistakeModel({
      ...mistakeData,
      attemptedAt: new Date(),
    });
    return mistake.save();
  }

  async markMistakeAsReviewed(mistakeId: string, userId: string): Promise<Mistake> {
    const mistake = await this.mistakeModel.findById(mistakeId).exec();
    if (!mistake) {
      throw new NotFoundException(`Mistake with ID ${mistakeId} not found`);
    }

    // 验证用户权限
    if (mistake.userId !== userId) {
      throw new ForbiddenException('You do not have permission to modify this mistake');
    }

    mistake.reviewed = true;
    mistake.reviewedAt = new Date();
    return mistake.save();
  }

  async updateMistakeNotes(mistakeId: string, notes: string, userId: string): Promise<Mistake> {
    const mistake = await this.mistakeModel.findById(mistakeId).exec();
    if (!mistake) {
      throw new NotFoundException(`Mistake with ID ${mistakeId} not found`);
    }

    // 验证用户权限
    if (mistake.userId !== userId) {
      throw new ForbiddenException('You do not have permission to modify this mistake');
    }

    mistake.notes = notes;
    return mistake.save();
  }

  async getAllKnowledgePoints(): Promise<string[]> {
    const knowledgePoints = await this.questionModel
      .distinct('knowledgePoint')
      .exec();
    return knowledgePoints;
  }

  async getQuestionStats(): Promise<{
    total: number;
    byKnowledgePoint: Record<string, number>;
    byDifficulty: Record<string, number>;
  }> {
    const total = await this.questionModel.countDocuments().exec();

    const byKnowledgePoint: Record<string, number> = {};
    const knowledgePoints = await this.questionModel
      .aggregate([
        { $group: { _id: '$knowledgePoint', count: { $sum: 1 } } },
      ])
      .exec();

    knowledgePoints.forEach((item) => {
      byKnowledgePoint[item._id] = item.count;
    });

    const byDifficulty: Record<string, number> = {};
    const difficulties = await this.questionModel
      .aggregate([
        { $group: { _id: '$difficulty', count: { $sum: 1 } } },
      ])
      .exec();

    difficulties.forEach((item) => {
      byDifficulty[item._id] = item.count;
    });

    return { total, byKnowledgePoint, byDifficulty };
  }

  /**
   * 获取相似题目
   * @param category 知识点类别
   * @param limit 题目数量
   * @returns 题目列表
   */
  async getSimilarQuestions(category: string, limit: number = 3): Promise<Question[]> {
    this.logger.log(`Requesting similar questions, category: ${category}`);

    try {
      // 1. 映射为中文知识点
      const targetKnowledgePoint = this.resolveKnowledgePoint(category);
      if (!targetKnowledgePoint) {
        this.logger.warn(`No mapping for category: ${category}`);
        return [];
      }

      // 2. 查询该知识点下的题目
      let questions = await this.questionModel.find({ knowledgePoint: targetKnowledgePoint })
        .limit(limit)
        .exec();

      // 3. 如果精确查询为空，尝试别名
      if (questions.length === 0) {
        for (const [alias, standardName] of Object.entries(this.knowledgeAliasMapping)) {
          if (standardName === targetKnowledgePoint) {
            questions = await this.questionModel.find({ knowledgePoint: alias })
              .limit(limit)
              .exec();
            if (questions.length > 0) break;
          }
        }
      }

      // 4. 如果仍为空，尝试模糊匹配
      if (questions.length === 0) {
        questions = await this.questionModel.find({
          // 用户可控的查询参数直接拼进 RegExp 会产生 ReDoS 与意外匹配，先转义
          knowledgePoint: { $regex: new RegExp(this.escapeRegex(targetKnowledgePoint), 'i') },
        }).limit(limit).exec();
      }

      // 5. 同一知识点内轮换题目，避免每次“举一反三”都返回同几道
      const rotated = this.rotateWithinBundle(questions, limit);

      // 指定了知识点却没有匹配题时必须返回空集，不能跨知识点乱出题。
      // 前端会据此展示“暂无该知识点题目”，而不是把无关题目伪装成举一反三。
      return rotated;
    } catch (error) {
      this.logger.error('Error in getSimilarQuestions:', error);
      return [];
    }
  }

  /**
   * 转义正则元字符。
   * `new RegExp(userInput)` 既可能被构造成 ReDoS，也会让 `(`、`.` 等字符
   * 产生与用户意图无关的匹配。
   */
  private escapeRegex(input: string): string {
    return String(input ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 在已取回的一组题目中随机选取 limit 道。
   * 旧的“相似题”接口固定 `.limit(limit)`，同一知识点永远返回完全相同的前几道，
   * 学生在“举一反三”里反复看到同题。
   */
  private rotateWithinBundle(questions: Question[], limit: number): Question[] {
    if (questions.length <= limit) return questions.slice(0, limit);
    const pool = [...questions];
    const picked: Question[] = [];
    while (picked.length < limit && pool.length > 0) {
      const index = Math.floor(Math.random() * pool.length);
      picked.push(pool.splice(index, 1)[0]);
    }
    return picked;
  }

  /**
   * 辅助方法：获取随机题目。
   * 旧实现是 `find().limit(limit)`（永远返回集合里最早的 N 条，完全不是随机），
   * 这里改用聚合 `$sample`；驱动/版本不支持时回退到 count + skip 抽样。
   */
  private async getRandomQuestions(limit: number): Promise<Question[]> {
    const safeLimit = Math.min(Math.max(1, Math.floor(limit) || 1), 50);
    try {
      const sampled = await this.questionModel
        .aggregate([{ $sample: { size: safeLimit } }])
        .exec();
      if (sampled && sampled.length > 0) return sampled as Question[];
    } catch (error: any) {
      this.logger.warn(`$sample 随机抽取失败，回退到 skip 抽样: ${error?.message}`);
    }

    try {
      const total = await this.questionModel.estimatedDocumentCount().exec();
      if (total > 0) {
        const skip = Math.max(0, Math.floor(Math.random() * Math.max(1, total - safeLimit)));
        const page = await this.questionModel.find().skip(skip).limit(safeLimit).exec();
        if (page.length > 0) return page;
      }
    } catch (error: any) {
      this.logger.warn(`skip 抽样失败: ${error?.message}`);
    }

    return this.questionModel.find().limit(safeLimit).exec();
  }

  /**
   * 获取专项练习题目
   * @param knowledgePointId 知识点ID
   * @param difficulty 难度等级
   * @param limit 题目数量
   * @returns 题目列表
   */
  async getSpecialPracticeQuestions(knowledgePointId: string, difficulty?: string, limit: number = 10): Promise<Question[]> {
    this.logger.log(`Requesting special practice questions for knowledge point: ${knowledgePointId}, difficulty: ${difficulty}`);
    
    try {
      // 查找对应的中文知识点名称
      const targetKnowledgePoint = this.resolveKnowledgePoint(knowledgePointId);
      
      if (!targetKnowledgePoint) {
        this.logger.warn(`No knowledge point mapping found: ${knowledgePointId}`);
        return [];
      }
      
      // 构建查询条件
      const filter: any = { knowledgePoint: targetKnowledgePoint };
      
      // 添加难度过滤
      if (difficulty && difficulty !== 'all') {
        filter.difficulty = difficulty;
      }
      
      // 查询数据库
      let questions = await this.questionModel.find(filter).limit(limit).exec();
      
      // 如果精确匹配为空，尝试别名
      if (questions.length === 0) {
        for (const [alias, standardName] of Object.entries(this.knowledgeAliasMapping)) {
          if (standardName === targetKnowledgePoint) {
            const aliasFilter: any = { knowledgePoint: alias };
            if (difficulty && difficulty !== 'all') {
              aliasFilter.difficulty = difficulty;
            }
            questions = await this.questionModel.find(aliasFilter).limit(limit).exec();
            if (questions.length > 0) {
              break;
            }
          }
        }
      }
      
      // 如果仍然为空，尝试模糊匹配
      if (questions.length === 0) {
        const fuzzyFilter: any = {
          knowledgePoint: { $regex: new RegExp(this.escapeRegex(targetKnowledgePoint), 'i') },
        };
        if (difficulty && difficulty !== 'all') {
          fuzzyFilter.difficulty = difficulty;
        }
        questions = await this.questionModel.find(fuzzyFilter).limit(limit).exec();
      }
      
      this.logger.log(`Successfully found ${questions.length} special practice questions`);
      return questions;
    } catch (error) {
      this.logger.error('Error getting special practice questions:', error);
      return [];
    }
  }

  /**
   * 获取用户的错题列表
   * @param userId 用户ID
   * @param page 页码
   * @param limit 每页数量
   * @returns 错题列表和总数
   */
  async getUserMistakes(userId: string, page: number = 1, limit: number = 10): Promise<{ mistakes: Mistake[]; total: number }> {
    this.logger.log(`Getting mistakes for user: ${userId}, page: ${page}, limit: ${limit}`);
    
    const skip = (page - 1) * limit;
    const [mistakes, total] = await Promise.all([
      this.mistakeModel
        .find({ userId })
        .sort({ attemptedAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.mistakeModel.countDocuments({ userId }).exec()
    ]);
    
    return { mistakes, total };
  }

  /**
   * 获取用户按知识点分类的错题
   * @param userId 用户ID
   * @returns 按知识点分类的错题
   */
  async getMistakesByKnowledgePoint(userId: string): Promise<Record<string, Mistake[]>> {
    this.logger.log(`Getting mistakes by knowledge point for user: ${userId}`);
    
    const mistakes = await this.mistakeModel.find({ userId }).exec();
    
    // 按知识点分类
    const mistakesByKnowledgePoint: Record<string, Mistake[]> = {};
    
    mistakes.forEach(mistake => {
      const knowledgePoint = mistake.knowledgePoint || '未分类';
      if (!mistakesByKnowledgePoint[knowledgePoint]) {
        mistakesByKnowledgePoint[knowledgePoint] = [];
      }
      mistakesByKnowledgePoint[knowledgePoint].push(mistake);
    });
    
    return mistakesByKnowledgePoint;
  }
}