import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Question } from './schemas/question.schema';

/** datasets/math.json 里的原始题目结构（中文键） */
interface RawQuestion {
  题目编号?: string;
  知识点?: string;
  关联子概念?: string[];
  章节来源?: string;
  题目内容?: string;
  难度等级?: string;
  详细解法步骤?: string[];
  答案?: string;
  题型?: string;
  分值?: number;
  预计用时?: string;
}

const DIFFICULTIES = ['基础', '中等', '较难', '困难'];

/**
 * 题库初始化：让系统在没有手工导入数据的新环境（例如 docker compose 的全新数据卷）
 * 也能直接跑起来。
 *
 * 触发规则：
 *  - questions 集合为空时自动导入 datasets/math.json；
 *  - 设置 SEED_QUESTIONS=false 可关闭自动导入；
 *  - 设置 SEED_QUESTIONS=force 可强制重新导入（按 questionId 幂等覆盖）。
 */
@Injectable()
export class QuestionSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(QuestionSeedService.name);

  constructor(
    @InjectModel(Question.name) private questionModel: Model<Question>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const mode = (process.env.SEED_QUESTIONS || '').trim().toLowerCase();
    if (mode === 'false' || mode === '0' || mode === 'off') {
      this.logger.log('SEED_QUESTIONS 已关闭，跳过题库初始化');
      return;
    }

    try {
      const existing = await this.questionModel.estimatedDocumentCount();
      if (existing > 0 && mode !== 'force') {
        this.logger.log(`题库已有 ${existing} 道题目，跳过初始化`);
        return;
      }

      const source = await this.resolveDatasetFile();
      if (!source) {
        this.logger.warn(
          '未找到 datasets/math.json，跳过题库初始化（可设置 DATASETS_DIR 指定目录）',
        );
        return;
      }

      const imported = await this.importFromFile(source);
      this.logger.log(`题库初始化完成：${imported} 道题目（来源 ${source}）`);
    } catch (error) {
      this.logger.error(`题库初始化失败：${(error as Error).message}`);
    }
  }

  /** 依次尝试 DATASETS_DIR、当前工作目录及其上层目录，兼容本地与容器内路径 */
  private async resolveDatasetFile(): Promise<string | null> {
    const fileName = 'math.json';
    const candidates: string[] = [];

    if (process.env.DATASETS_DIR) {
      candidates.push(path.join(process.env.DATASETS_DIR, fileName));
    }

    let currentDir = process.cwd();
    for (let i = 0; i < 4; i++) {
      candidates.push(path.join(currentDir, 'datasets', fileName));
      currentDir = path.dirname(currentDir);
    }

    candidates.push(
      path.join(__dirname, '..', '..', '..', '..', 'datasets', fileName),
    );

    for (const candidate of candidates) {
      try {
        await fs.access(candidate);
        return candidate;
      } catch {
        // 继续尝试下一个候选路径
      }
    }

    return null;
  }

  private async importFromFile(filePath: string): Promise<number> {
    const raw = JSON.parse(await fs.readFile(filePath, 'utf8'));
    if (!Array.isArray(raw)) {
      throw new Error('math.json 顶层结构应为数组');
    }

    const docs = raw
      .filter((item) => item && item.题目编号 && item.题目内容)
      .map((item) => this.toDocument(item as RawQuestion));

    if (!docs.length) return 0;

    // 分批写入，避免单次请求过大
    const batchSize = 100;
    let processed = 0;
    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = docs.slice(i, i + batchSize);
      await this.questionModel.bulkWrite(
        batch.map((doc) => ({
          updateOne: {
            filter: { questionId: doc.questionId },
            update: { $set: doc, $setOnInsert: { createdAt: new Date() } },
            upsert: true,
          },
        })),
        { ordered: false },
      );
      processed += batch.length;
    }

    return processed;
  }

  /** 中文键 → 数据库字段，并做基础清洗（难度枚举、子概念去空） */
  private toDocument(item: RawQuestion) {
    const difficulty = DIFFICULTIES.includes(item.难度等级 || '')
      ? item.难度等级!
      : '中等';

    return {
      questionId: item.题目编号!.trim(),
      knowledgePoint: (item.知识点 || '未分类').trim(),
      subConcepts: Array.isArray(item.关联子概念)
        ? item.关联子概念.filter(
            (value): value is string =>
              typeof value === 'string' && !!value.trim(),
          )
        : [],
      chapterSource: item.章节来源 || '',
      content: item.题目内容!,
      difficulty,
      solutionSteps: Array.isArray(item.详细解法步骤) ? item.详细解法步骤 : [],
      answer: (item.答案 ?? '').toString(),
      questionType: item.题型 || '计算题',
      score: typeof item.分值 === 'number' ? item.分值 : undefined,
      estimatedTime: (item.预计用时 || '').replace(/分钟$/, ' 分钟'),
      updatedAt: new Date(),
    };
  }
}
