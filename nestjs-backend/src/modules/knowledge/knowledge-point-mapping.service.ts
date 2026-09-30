import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 题库知识点（中文，如“极限计算”）与知识图谱概念 id（如 limit_definition）
 * 之间的映射，数据来自 datasets/knowledge-point-mapping.json。
 *
 * 练习记录按题库知识点归档，而知识图谱按概念 id 组织，
 * 这个服务负责在两者之间做翻译，否则图谱上的掌握度永远是 0。
 */
@Injectable()
export class KnowledgePointMappingService {
  private readonly logger = new Logger(KnowledgePointMappingService.name);

  /** 中文知识点 → 概念 id 列表 */
  private knowledgePointToConcepts = new Map<string, string[]>();
  /** 概念 id → 中文知识点 */
  private conceptToKnowledgePoint = new Map<string, string>();
  /** 子概念 / 别名 → 中文知识点 */
  private aliasToKnowledgePoint = new Map<string, string>();

  constructor() {
    this.loadMapping();
  }

  private loadMapping(): void {
    const mapping = this.readMappingFile();
    if (!mapping) return;

    const knowledgeMapping: Record<string, string[]> = mapping['知识点映射'] || {};
    const subConceptMapping: Record<string, string> = mapping['子概念映射'] || {};
    const aliasMapping: Record<string, string> = mapping['知识点别名映射'] || {};

    for (const [knowledgePoint, conceptIds] of Object.entries(knowledgeMapping)) {
      const ids = (Array.isArray(conceptIds) ? conceptIds : []).map((id) => String(id).trim());
      this.knowledgePointToConcepts.set(knowledgePoint.trim(), ids);
      for (const id of ids) {
        if (!this.conceptToKnowledgePoint.has(id)) {
          this.conceptToKnowledgePoint.set(id, knowledgePoint.trim());
        }
      }
    }

    for (const [subConcept, conceptId] of Object.entries(subConceptMapping)) {
      const knowledgePoint = this.conceptToKnowledgePoint.get(String(conceptId).trim());
      if (knowledgePoint) {
        this.aliasToKnowledgePoint.set(subConcept.trim(), knowledgePoint);
      }
    }

    for (const [alias, knowledgePoint] of Object.entries(aliasMapping)) {
      this.aliasToKnowledgePoint.set(alias.trim(), String(knowledgePoint).trim());
    }

    this.logger.log(
      `知识点映射加载完成：${this.knowledgePointToConcepts.size} 个知识点 / ${this.conceptToKnowledgePoint.size} 个概念`,
    );
  }

  private readMappingFile(): Record<string, any> | null {
    // 与 QuestionsService 相同的向上查找策略，兼容 dist/ 与 src/ 运行位置
    let currentDir = __dirname;
    for (let i = 0; i < 6; i++) {
      const candidate = path.join(currentDir, 'datasets', 'knowledge-point-mapping.json');
      try {
        const content = fs.readFileSync(candidate, 'utf8');
        return JSON.parse(content);
      } catch {
        currentDir = path.dirname(currentDir);
      }
    }
    this.logger.warn('未找到 datasets/knowledge-point-mapping.json，知识点映射为空');
    return null;
  }

  /** 中文知识点 → 该知识点下的所有图谱概念 id（别名会先归一化到标准知识点） */
  getConceptIds(knowledgePoint: string): string[] {
    if (!knowledgePoint) return [];
    const key = knowledgePoint.trim();

    const direct = this.knowledgePointToConcepts.get(key);
    if (direct) return direct;

    // 题库里写作“积分计算 / 导数与微分 / 级数与幂级数”等，
    // 映射表的标准知识点却是“积分 / 导数 / 级数”，必须经由别名映射归一化。
    const standard = this.aliasToKnowledgePoint.get(key);
    if (standard) return this.knowledgePointToConcepts.get(standard) || [];

    return [];
  }

  /** 把任意写法归一化为标准中文知识点 */
  getStandardKnowledgePoint(knowledgePoint: string): string | null {
    if (!knowledgePoint) return null;
    const key = knowledgePoint.trim();
    if (this.knowledgePointToConcepts.has(key)) return key;
    return this.aliasToKnowledgePoint.get(key) || null;
  }

  /** 某个知识点的全部等价写法（标准名 + 所有指向它的别名），用于查询归档记录 */
  getKnowledgePointVariants(knowledgePoint: string): string[] {
    const standard = this.getStandardKnowledgePoint(knowledgePoint);
    if (!standard) return knowledgePoint ? [knowledgePoint.trim()] : [];

    const variants = new Set<string>([standard, knowledgePoint.trim()]);
    for (const [alias, target] of this.aliasToKnowledgePoint) {
      if (target === standard) variants.add(alias);
    }
    return Array.from(variants);
  }

  /** 概念 id → 所属中文知识点 */
  getKnowledgePoint(conceptId: string): string | null {
    if (!conceptId) return null;
    const key = conceptId.trim();
    return this.conceptToKnowledgePoint.get(key) || this.aliasToKnowledgePoint.get(key) || null;
  }

  /** 某个学习记录（中文知识点）是否与图谱节点相关 */
  matchesConcept(knowledgePoint: string, conceptId: string): boolean {
    if (!knowledgePoint || !conceptId) return false;
    if (knowledgePoint.trim() === conceptId.trim()) return true;
    return this.getConceptIds(knowledgePoint).includes(conceptId.trim());
  }
}
