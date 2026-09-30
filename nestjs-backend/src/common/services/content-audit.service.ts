import { Injectable, Logger } from '@nestjs/common';
import { DataSourceService } from './data-source.service';
import * as fs from 'fs';
import * as path from 'path';

export interface AuditFinding {
  severity: 'error' | 'warning' | 'info';
  module: string;
  pointId?: string;
  field: string;
  message: string;
  suggestion: string;
}

export interface AuditReport {
  totalModules: number;
  totalKnowledgePoints: number;
  errors: number;
  warnings: number;
  infos: number;
  coverageRate: string;
  difficultyDistribution: Record<string, number>;
  prerequisiteIntegrity: string;
  findings: AuditFinding[];
  moduleScores: ModuleScore[];
}

export interface ModuleScore {
  moduleId: string;
  moduleName: string;
  score: number;
  kpCount: number;
  issueCount: number;
  status: 'pass' | 'needs_improvement' | 'fail';
}

export interface ContentCoverage {
  moduleId: string;
  moduleName: string;
  kpCount: number;
  requiredFields: string[];
  optionalFields: string[];
  completeness: number;
}

@Injectable()
export class ContentAuditService {
  private readonly logger = new Logger(ContentAuditService.name);
  private readonly datasetsDir = path.join(process.cwd(), '..', 'datasets');

  private readonly requiredFields = [
    'id',
    'name',
    'description',
    'formulas',
    'difficulty',
    'prerequisites',
    'applications',
    'common_mistakes',
    'exercise_types',
    'latex_templates',
  ];

  private readonly expectedModules = [
    'differential_equations_full_system',
    'definite_integral_applications_full',
    'multivariable_differential_calculus',
    'mean_value_theorems',
    'vector_algebra_spatial_geometry',
    'multiple_integrals',
    'curve_surface_integrals',
  ];

  private readonly expectedCoverageAreas = [
    '空间解析几何',
    '向量代数',
    '二重积分',
    '三重积分',
    '曲线积分',
    '曲面积分',
    '场论',
  ];

  runFullAudit(): AuditReport {
    this.logger.log('Starting full content quality audit...');
    const findings: AuditFinding[] = [];
    const moduleScores: ModuleScore[] = [];
    let totalKp = 0;
    const difficultyDist: Record<string, number> = { easy: 0, medium: 0, hard: 0 };

    let allModules: any[] = [];
    try {
      const jsonFiles = fs
        .readdirSync(this.datasetsDir)
        .filter((f) => f.endsWith('-module.json') || f.endsWith('-module.full.json'));

      for (const file of jsonFiles) {
        try {
          const filePath = path.join(this.datasetsDir, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          const module = JSON.parse(content);

          allModules.push(module);
          const moduleFindings = this.auditModule(module, file);

          moduleFindings.forEach((f) => (f.module = module.module_name || file));
          findings.push(...moduleFindings);

          const kpCount = (module.knowledge_points || []).length;
          totalKp += kpCount;

          for (const kp of module.knowledge_points || []) {
            if (kp.difficulty) {
              difficultyDist[kp.difficulty] =
                (difficultyDist[kp.difficulty] || 0) + 1;
            }
          }

          const errors = moduleFindings.filter((f) => f.severity === 'error').length;
          const warnings = moduleFindings.filter((f) => f.severity === 'warning').length;
          const totalIssues = errors + warnings;
          const score = Math.max(0, 100 - errors * 15 - warnings * 5);

          moduleScores.push({
            moduleId: module.module_id || file,
            moduleName: module.module_name || file,
            score,
            kpCount,
            issueCount: totalIssues,
            status:
              score >= 90 ? 'pass' : score >= 70 ? 'needs_improvement' : 'fail',
          });
        } catch (err) {
          findings.push({
            severity: 'error',
            module: file,
            field: 'file',
            message: `无法解析模块文件: ${(err as Error).message}`,
            suggestion: '检查JSON格式是否有效',
          });
        }
      }
    } catch (err) {
      this.logger.error(`Failed to read datasets: ${(err as Error).message}`);
      findings.push({
        severity: 'error',
        module: 'all',
        field: 'directory',
        message: `无法读取datasets目录: ${(err as Error).message}`,
        suggestion: '确认datasets目录路径正确',
      });
    }

    const crossRefFindings = this.auditCrossReferences(allModules);
    findings.push(...crossRefFindings);

    const coverageFindings = this.auditCoverage(allModules, difficultyDist);
    findings.push(...coverageFindings);

    const errors = findings.filter((f) => f.severity === 'error').length;
    const warnings = findings.filter((f) => f.severity === 'warning').length;
    const infos = findings.filter((f) => f.severity === 'info').length;

    this.logger.log(
      `Audit complete: ${totalKp} KPs, ${errors} errors, ${warnings} warnings, ${infos} infos`,
    );

    return {
      totalModules: allModules.length,
      totalKnowledgePoints: totalKp,
      errors,
      warnings,
      infos,
      coverageRate: this.calculateCoverage(allModules),
      difficultyDistribution: difficultyDist,
      prerequisiteIntegrity: this.reportPrerequisiteIntegrity(allModules),
      findings,
      moduleScores,
    };
  }

  private auditModule(module: any, fileName: string): AuditFinding[] {
    const findings: AuditFinding[] = [];

    if (!module.module_id) {
      findings.push({
        severity: 'error',
        module: fileName,
        field: 'module_id',
        message: '缺少module_id字段',
        suggestion: '添加唯一的模块ID',
      });
    }

    if (!module.module_name) {
      findings.push({
        severity: 'error',
        module: fileName,
        field: 'module_name',
        message: '缺少module_name字段',
        suggestion: '添加模块名称',
      });
    }

    if (!module.knowledge_points || module.knowledge_points.length === 0) {
      findings.push({
        severity: 'error',
        module: fileName,
        field: 'knowledge_points',
        message: '模块没有知识点',
        suggestion: '添加至少一个知识点',
      });
      return findings;
    }

    const ids = new Set<string>();
    for (const kp of module.knowledge_points) {
      if (!kp.id) {
        findings.push({
          severity: 'error',
          module: module.module_name || fileName,
          pointId: 'unknown',
          field: 'id',
          message: '知识点缺少id字段',
          suggestion: '为每个知识点添加唯一ID',
        });
        continue;
      }

      if (ids.has(kp.id)) {
        findings.push({
          severity: 'error',
          module: module.module_name || fileName,
          pointId: kp.id,
          field: 'id',
          message: `知识点ID "${kp.id}" 重复`,
          suggestion: '确保每个知识点ID唯一',
        });
      }
      ids.add(kp.id);

      for (const field of this.requiredFields) {
        const val = kp[field];
        if (val === undefined || val === null) {
          findings.push({
            severity: 'warning',
            module: module.module_name || fileName,
            pointId: kp.id,
            field,
            message: `知识点 "${kp.name || kp.id}" 缺少 "${field}" 字段`,
            suggestion: `为知识点添加 "${field}" 内容`,
          });
        } else if (field === 'formulas' && Array.isArray(val) && val.length === 0) {
          findings.push({
            severity: 'warning',
            module: module.module_name || fileName,
            pointId: kp.id,
            field: 'formulas',
            message: `知识点 "${kp.name || kp.id}" 公式列表为空`,
            suggestion: '添加核心公式',
          });
        }
      }

      if (kp.difficulty && !['easy', 'medium', 'hard'].includes(kp.difficulty)) {
        findings.push({
          severity: 'warning',
          module: module.module_name || fileName,
          pointId: kp.id,
          field: 'difficulty',
          message: `无效的难度值: "${kp.difficulty}"`,
          suggestion: '使用 easy / medium / hard',
        });
      }

      const latexFindings = this.auditLatex(kp, module.module_name || fileName);
      findings.push(...latexFindings);
    }

    return findings;
  }

  private auditLatex(kp: any, moduleName: string): AuditFinding[] {
    const findings: AuditFinding[] = [];
    const latexFields = ['formulas', 'latex_templates'];

    for (const field of latexFields) {
      const values = kp[field];
      if (!Array.isArray(values)) continue;

      for (let i = 0; i < values.length; i++) {
        const latex = values[i];
        if (typeof latex !== 'string') continue;

        const openBraces = (latex.match(/\{/g) || []).length;
        const closeBraces = (latex.match(/\}/g) || []).length;
        if (openBraces !== closeBraces) {
          findings.push({
            severity: 'error',
            module: moduleName,
            pointId: kp.id,
            field: `${field}[${i}]`,
            message: `花括号不匹配（{${openBraces}个 vs }${closeBraces}个）`,
            suggestion: '检查LaTeX中的花括号配对',
          });
        }

        const beginCount = (latex.match(/\\begin\{/g) || []).length;
        const endCount = (latex.match(/\\end\{/g) || []).length;
        if (beginCount !== endCount) {
          findings.push({
            severity: 'error',
            module: moduleName,
            pointId: kp.id,
            field: `${field}[${i}]`,
            message: `\\begin/\\end环境不匹配（begin${beginCount}个 vs end${endCount}个）`,
            suggestion: '检查LaTeX环境的开闭配对',
          });
        }

        const leftCount = (latex.match(/\\left[\(\{\[]/g) || []).length;
        const rightCount = (latex.match(/\\right[\)\}\]]/g) || []).length;
        if (leftCount !== rightCount) {
          findings.push({
            severity: 'error',
            module: moduleName,
            pointId: kp.id,
            field: `${field}[${i}]`,
            message: `\\left/\\right不匹配（left${leftCount}个 vs right${rightCount}个）`,
            suggestion: '检查\\left和\\right的配对',
          });
        }
      }
    }

    return findings;
  }

  private auditCrossReferences(allModules: any[]): AuditFinding[] {
    const findings: AuditFinding[] = [];
    const allIds = new Set<string>();

    for (const mod of allModules) {
      for (const kp of mod.knowledge_points || []) {
        if (kp.id) allIds.add(kp.id);
      }
    }

    for (const mod of allModules) {
      const modName = mod.module_name || mod.module_id;
      for (const kp of mod.knowledge_points || []) {
        if (!kp.prerequisites || !Array.isArray(kp.prerequisites)) continue;

        for (const prereq of kp.prerequisites) {
          if (!allIds.has(prereq)) {
            const isCrossModule = !allModules
              .find((m) => m.module_id === mod.module_id)
              ?.knowledge_points?.some((k: any) => k.id === prereq);

            findings.push({
              severity: isCrossModule ? 'warning' : 'error',
              module: modName,
              pointId: kp.id,
              field: 'prerequisites',
              message: `前置知识点 "${prereq}" 不存在于任何模块中`,
              suggestion: `确认 "${prereq}" 的知识点ID是否正确，或添加该知识点`,
            });
          }
        }
      }
    }

    return findings;
  }

  private auditCoverage(
    allModules: any[],
    difficultyDist: Record<string, number>,
  ): AuditFinding[] {
    const findings: AuditFinding[] = [];
    const total = (difficultyDist.easy || 0) + (difficultyDist.medium || 0) + (difficultyDist.hard || 0);

    if (total === 0) return findings;

    const easyPct = ((difficultyDist.easy || 0) / total) * 100;
    const mediumPct = ((difficultyDist.medium || 0) / total) * 100;
    const hardPct = ((difficultyDist.hard || 0) / total) * 100;

    findings.push({
      severity: 'info',
      module: '全部',
      field: 'difficulty',
      message: `难度分布: 简单${easyPct.toFixed(1)}% (${difficultyDist.easy || 0}个), 中等${mediumPct.toFixed(1)}% (${difficultyDist.medium || 0}个), 困难${hardPct.toFixed(1)}% (${difficultyDist.hard || 0}个)`,
      suggestion:
        easyPct > 50
          ? '建议提高中等/困难知识点的比例'
          : '难度分布较为合理',
    });

    const expectedCount = this.expectedCoverageAreas.length;
    const coveredAreas = new Set<string>();
    for (const mod of allModules) {
      const desc = (mod.description || '') + (mod.module_name || '');
      for (const area of this.expectedCoverageAreas) {
        if (desc.includes(area)) coveredAreas.add(area);
      }
    }

    const missingAreas = this.expectedCoverageAreas.filter(
      (a) => !coveredAreas.has(a),
    );

    if (missingAreas.length > 0) {
      findings.push({
        severity: 'warning',
        module: '全部',
        field: 'coverage',
        message: `知识领域覆盖率: ${coveredAreas.size}/${expectedCount}，缺失: ${missingAreas.join(', ')}`,
        suggestion: '补充缺失知识领域的模块',
      });
    } else {
      findings.push({
        severity: 'info',
        module: '全部',
        field: 'coverage',
        message: `知识领域覆盖率: ${coveredAreas.size}/${expectedCount} (100%)`,
        suggestion: '',
      });
    }

    const allKpIds = new Set<string>();
    for (const mod of allModules) {
      for (const kp of mod.knowledge_points || []) {
        if (kp.id) allKpIds.add(kp.id);
      }
    }

    if (allKpIds.size < 50) {
      findings.push({
        severity: 'warning',
        module: '全部',
        field: 'total',
        message: `总知识点数量 (${allKpIds.size}) 偏少，建议达到50+个`,
        suggestion: '系统补充更多核心数学知识点',
      });
    }

    return findings;
  }

  private calculateCoverage(allModules: any[]): string {
    const coveredCount = this.expectedCoverageAreas.filter((area) => {
      for (const mod of allModules) {
        const desc = (mod.description || '') + (mod.module_name || '');
        if (desc.includes(area)) return true;
      }
      return false;
    }).length;

    const pct = this.expectedCoverageAreas.length > 0
      ? ((coveredCount / this.expectedCoverageAreas.length) * 100).toFixed(1) + '%'
      : 'N/A';
    return pct;
  }

  private reportPrerequisiteIntegrity(allModules: any[]): string {
    let brokenRefs = 0;
    const allIds = new Set<string>();

    for (const mod of allModules) {
      for (const kp of mod.knowledge_points || []) {
        if (kp.id) allIds.add(kp.id);
      }
    }

    for (const mod of allModules) {
      for (const kp of mod.knowledge_points || []) {
        if (!kp.prerequisites) continue;
        for (const prereq of kp.prerequisites) {
          if (!allIds.has(prereq)) brokenRefs++;
        }
      }
    }

    return brokenRefs === 0
      ? `完好（所有前置知识点引用均有效，已注册 ${allIds.size} 个知识点ID）`
      : `存在问题：${brokenRefs} 个断裂的前置引用`;
  }

  validateLatexExpression(latex: string): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    const openBraces = (latex.match(/\{/g) || []).length;
    const closeBraces = (latex.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      issues.push(`花括号不匹配: {${openBraces} vs }${closeBraces}`);
    }

    const beginCount = (latex.match(/\\begin\{/g) || []).length;
    const endCount = (latex.match(/\\end\{/g) || []).length;
    if (beginCount !== endCount) {
      issues.push(`环境不匹配: \\begin${beginCount} vs \\end${endCount}`);
    }

    return { valid: issues.length === 0, issues };
  }
}
