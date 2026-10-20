import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as yaml from 'js-yaml';
import * as chokidar from 'chokidar';
import { debounce } from 'lodash';
import {
  InteractiveScenario,
  ScenarioYamlConfig,
  LearningPhase,
  InteractiveTask,
  VisualizationConfig,
  AssessmentConfig,
  FormativeCheck,
  ParameterConfig,
} from '../types/interactive-learning.types';
import {
  ScenarioYamlSchema,
  ValidatedScenarioConfig,
} from '../types/interactive-learning.schemas';

export interface BrokenConfigInfo {
  scenarioId: string;
  filePath: string;
  error: string;
  timestamp: Date;
  rawContent?: string;
}

export interface ScenarioConfigServiceOptions {
  configPath?: string;
  maxFileSizeBytes?: number;
  enableFileWatcher?: boolean;
  watcherDebounceMs?: number;
}

function getDefaultConfigPath(): string {
  // 容器/只读部署下可通过环境变量指定可写目录
  if (process.env.SCENARIO_CONFIG_DIR) return process.env.SCENARIO_CONFIG_DIR;

  const isCompiled = __dirname.includes('dist');
  const baseDir = isCompiled
    ? path.join(__dirname, '..', '..', '..')
    : path.join(__dirname, '..', '..', '..', '..');
  return path.join(baseDir, 'config', 'scenarios');
}

const DEFAULT_OPTIONS: Required<ScenarioConfigServiceOptions> = {
  configPath: getDefaultConfigPath(),
  maxFileSizeBytes: 1024 * 1024,
  enableFileWatcher: true,
  watcherDebounceMs: 500,
};

@Injectable()
export class ScenarioConfigService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScenarioConfigService.name);

  private scenarioCache: Map<string, InteractiveScenario> = new Map();
  private rawConfigCache: Map<string, ValidatedScenarioConfig> = new Map();
  private brokenConfigs: Map<string, BrokenConfigInfo> = new Map();
  private lastModifiedMap: Map<string, number> = new Map();

  private configPath: string;
  private options: Required<ScenarioConfigServiceOptions>;

  private watcher: chokidar.FSWatcher | null = null;
  private isWatcherActive = false;

  private readonly CONFIG_DIRECTORY = 'scenarios';
  private readonly SUPPORTED_FORMATS = ['.yaml', '.yml', '.json'];

  constructor(@Optional() options?: ScenarioConfigServiceOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.configPath = this.options.configPath;
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('Scenario Configuration Engine v2.0 initializing...');
    this.logger.debug(`Config path: ${this.configPath}`);
    this.logger.debug(`Max file size: ${this.options.maxFileSizeBytes} bytes`);

    // 场景配置只是增强能力，初始化失败不应该让整个应用起不来
    try {
      await this.ensureConfigDirectory();
      await this.loadAllScenariosAsync();

      if (this.options.enableFileWatcher) {
        await this.startChokidarWatcher();
      }
    } catch (error) {
      this.logger.warn(
        `场景配置初始化失败，已跳过：${(error as Error).message}`,
      );
    }

    this.logger.log(
      `Loaded ${this.scenarioCache.size} scenarios, ${this.brokenConfigs.size} broken configs`,
    );
  }

  onModuleDestroy(): Promise<void> {
    return this.stopWatcher();
  }

  async getScenario(scenarioId: string): Promise<InteractiveScenario | null> {
    const cached = this.scenarioCache.get(scenarioId);

    if (cached) {
      return cached;
    }

    return this.loadAndValidateScenarioFromFile(scenarioId);
  }

  async getAllScenarios(): Promise<InteractiveScenario[]> {
    return Array.from(this.scenarioCache.values());
  }

  async getScenariosByKnowledgeArea(
    area: string,
  ): Promise<InteractiveScenario[]> {
    const scenarios = Array.from(this.scenarioCache.values());
    return scenarios.filter((s) => s.knowledgeArea === area);
  }

  async getScenariosByDifficulty(
    difficulty: string,
  ): Promise<InteractiveScenario[]> {
    const scenarios = Array.from(this.scenarioCache.values());
    return scenarios.filter((s) => s.difficulty === difficulty);
  }

  getBrokenConfigs(): BrokenConfigInfo[] {
    return Array.from(this.brokenConfigs.values());
  }

  getBrokenConfig(scenarioId: string): BrokenConfigInfo | undefined {
    return this.brokenConfigs.get(scenarioId);
  }

  async validateScenarioConfig(config: unknown): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    validatedConfig?: ValidatedScenarioConfig;
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const validatedConfig = ScenarioYamlSchema.parse(config);

      const customWarnings = this.performCustomValidation(validatedConfig);
      warnings.push(...customWarnings);

      return {
        isValid: true,
        errors,
        warnings,
        validatedConfig,
      };
    } catch (error: any) {
      if (error.name === 'ZodError') {
        const zodError = error as any;
        (zodError.issues || zodError.errors || []).forEach((err: any) => {
          errors.push(
            `[${(err.path || []).join('.')}] ${err.message}${
              err?.received
                ? ` (received: ${JSON.stringify(err.received)})`
                : ''
            }`,
          );
        });
      } else {
        errors.push(`Validation error: ${error.message}`);
      }

      return { isValid: false, errors, warnings };
    }
  }

  async createScenarioFromYaml(
    yamlContent: string,
  ): Promise<InteractiveScenario> {
    this.validateYamlSize(yamlContent);

    let rawConfig: unknown;

    try {
      rawConfig = yaml.load(yamlContent);
    } catch (error: any) {
      throw new Error(`YAML parsing failed: ${error.message}`);
    }

    const validation = await this.validateScenarioConfig(rawConfig);

    if (!validation.isValid) {
      throw new Error(
        `Invalid configuration:\n${validation.errors.join('\n')}`,
      );
    }

    if (
      validation.warnings.length > 0 &&
      validation.validatedConfig?.scenario?.id
    ) {
      this.logger.warn(
        `Warnings for ${validation.validatedConfig.scenario.id}:\n${validation.warnings.join('\n')}`,
      );
    }

    if (!validation.validatedConfig) {
      throw new Error(
        'Configuration validation succeeded but no validated config returned',
      );
    }

    return this.transformToInteractiveScenario(validation.validatedConfig);
  }

  async reloadScenario(scenarioId: string): Promise<void> {
    this.scenarioCache.delete(scenarioId);
    this.rawConfigCache.delete(scenarioId);

    try {
      const scenario = await this.loadAndValidateScenarioFromFile(scenarioId);

      if (scenario) {
        this.scenarioCache.set(scenarioId, scenario);
        this.brokenConfigs.delete(scenarioId);
        this.logger.log(`Successfully reloaded scenario: ${scenarioId}`);
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to reload scenario ${scenarioId}: ${error.message}`,
      );

      const filePath = this.resolveFilePath(scenarioId);
      let rawContent: string | undefined;

      try {
        rawContent = await fs.readFile(filePath, 'utf-8');
      } catch (readError) {
        this.logger.warn(`Could not read broken config file: ${filePath}`);
      }

      this.brokenConfigs.set(scenarioId, {
        scenarioId,
        filePath,
        error: error.message,
        timestamp: new Date(),
        rawContent: rawContent?.slice(0, 1000),
      });
    }
  }

  private async loadAllScenariosAsync(): Promise<void> {
    try {
      const exists = await this.directoryExists();

      if (!exists) {
        this.logger.log(
          'Config directory does not exist, skipping initial load',
        );
        return;
      }

      const files = await fs.readdir(this.configPath);
      const validFiles = files.filter((file) =>
        this.SUPPORTED_FORMATS.includes(path.extname(file).toLowerCase()),
      );

      this.logger.log(`Found ${validFiles.length} scenario files to load`);

      const loadPromises = validFiles.map(async (file) => {
        const ext = path.extname(file).toLowerCase();
        const scenarioId = path.basename(file, ext);

        try {
          const scenario =
            await this.loadAndValidateScenarioFromFile(scenarioId);

          if (scenario) {
            this.scenarioCache.set(scenarioId, scenario);
          }
        } catch (error: any) {
          this.logger.error(
            `Failed to load scenario ${scenarioId}: ${error.message}`,
          );

          const filePath = path.join(this.configPath, file);
          let rawContent: string | undefined;

          try {
            rawContent = await fs.readFile(filePath, 'utf-8');
          } catch (readError) {
            this.logger.warn(`Could not read broken config file: ${filePath}`);
          }

          this.brokenConfigs.set(scenarioId, {
            scenarioId,
            filePath,
            error: error.message,
            timestamp: new Date(),
            rawContent: rawContent?.slice(0, 1000),
          });
        }
      });

      await Promise.all(loadPromises);
    } catch (error: any) {
      this.logger.error(`Fatal error loading scenarios: ${error.message}`);
      throw error;
    }
  }

  private async loadAndValidateScenarioFromFile(
    scenarioId: string,
  ): Promise<InteractiveScenario | null> {
    for (const ext of this.SUPPORTED_FORMATS) {
      const filePath = path.join(this.configPath, `${scenarioId}${ext}`);

      try {
        await fs.access(filePath);

        const stat = await fs.stat(filePath);
        this.validateFileSize(stat.size, filePath);

        const content = await fs.readFile(filePath, 'utf-8');

        let config: unknown;

        if (ext === '.json') {
          config = JSON.parse(content);
        } else {
          config = yaml.load(content);
        }

        const validation = await this.validateScenarioConfig(config);

        if (!validation.isValid || !validation.validatedConfig) {
          throw new Error(
            `Schema validation failed:\n${validation.errors.join('\n')}`,
          );
        }

        this.lastModifiedMap.set(scenarioId, stat.mtimeMs);
        this.rawConfigCache.set(scenarioId, validation.validatedConfig);

        return this.transformToInteractiveScenario(validation.validatedConfig);
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          this.logger.error(
            `Error loading scenario ${filePath}: ${error.message}`,
          );
          throw error;
        }
      }
    }

    return null;
  }

  private async ensureConfigDirectory(): Promise<void> {
    const exists = await this.directoryExists();

    if (!exists) {
      try {
        await fs.mkdir(this.configPath, { recursive: true });
        this.logger.log(`Created config directory: ${this.configPath}`);
      } catch (error) {
        // 容器里 /app 通常不可写，退回临时目录
        const fallback = path.join(os.tmpdir(), 'scenario-config');
        this.logger.warn(
          `无法写入 ${this.configPath}（${(error as Error).message}），改用临时目录 ${fallback}`,
        );
        this.configPath = fallback;
        await fs.mkdir(this.configPath, { recursive: true });
      }

      await this.createSampleScenarios();
    }
  }

  private async directoryExists(): Promise<boolean> {
    try {
      await fs.access(this.configPath);
      return true;
    } catch {
      return false;
    }
  }

  private async createSampleScenarios(): Promise<void> {
    const sampleLimitScenario = this.generateSampleLimitScenario();
    const sampleDerivativeScenario = this.generateSampleDerivativeScenario();

    await this.saveScenarioToFileAsync(sampleLimitScenario);
    await this.saveScenarioToFileAsync(sampleDerivativeScenario);

    this.logger.log('Created sample scenario configurations');
  }

  private async saveScenarioToFileAsync(
    config: ScenarioYamlConfig,
  ): Promise<void> {
    const filePath = path.join(this.configPath, `${config.scenario.id}.yaml`);
    const yamlContent = yaml.dump(config, { indent: 2, lineWidth: 120 });

    await fs.writeFile(filePath, yamlContent, 'utf-8');
    this.logger.log(`Saved scenario configuration: ${config.scenario.id}`);
  }

  private async startChokidarWatcher(): Promise<void> {
    try {
      this.watcher = chokidar.watch(this.configPath, {
        ignored: /(^|[\/\\])\../,
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 200,
          pollInterval: 100,
        },
      });

      const debouncedReload = debounce(async (scenarioId: string) => {
        this.logger.log(`Reloading scenario due to file change: ${scenarioId}`);
        await this.reloadScenario(scenarioId);
      }, this.options.watcherDebounceMs);

      this.watcher.on('add', (filePath) => {
        const scenarioId = this.extractScenarioIdFromPath(filePath);
        this.logger.log(`New scenario file detected: ${scenarioId}`);
        debouncedReload(scenarioId);
      });

      this.watcher.on('change', (filePath) => {
        const scenarioId = this.extractScenarioIdFromPath(filePath);
        this.logger.log(`Scenario file changed: ${scenarioId}`);
        debouncedReload(scenarioId);
      });

      this.watcher.on('unlink', (filePath) => {
        const scenarioId = this.extractScenarioIdFromPath(filePath);
        this.logger.log(`Scenario file deleted: ${scenarioId}`);
        this.scenarioCache.delete(scenarioId);
        this.rawConfigCache.delete(scenarioId);
        this.brokenConfigs.delete(scenarioId);
        this.lastModifiedMap.delete(scenarioId);
      });

      this.watcher.on('error', (error: Error) => {
        this.logger.error(`Watcher error: ${error.message}`);
      });

      this.isWatcherActive = true;
      this.logger.log(
        'Started chokidar file watcher for scenario configurations',
      );
    } catch (error: any) {
      this.logger.warn(
        `Failed to start chokidar watcher: ${error.message}. File watching disabled.`,
      );
      this.isWatcherActive = false;
    }
  }

  private async stopWatcher(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
      this.isWatcherActive = false;
      this.logger.log('Stopped file watcher');
    }
  }

  private extractScenarioIdFromPath(filePath: string): string {
    const basename = path.basename(filePath);
    const ext = path.extname(basename);
    return basename.slice(0, -ext.length) || basename;
  }

  private resolveFilePath(scenarioId: string): string {
    for (const ext of this.SUPPORTED_FORMATS) {
      const filePath = path.join(this.configPath, `${scenarioId}${ext}`);
      try {
        fsSync.accessSync(filePath);
        return filePath;
      } catch {
        continue;
      }
    }
    return path.join(this.configPath, `${scenarioId}.yaml`);
  }

  private validateYamlSize(content: string): void {
    const sizeInBytes = Buffer.byteLength(content, 'utf-8');

    if (sizeInBytes > this.options.maxFileSizeBytes) {
      throw new Error(
        `YAML content too large: ${(sizeInBytes / 1024).toFixed(1)}KB exceeds limit of ${
          this.options.maxFileSizeBytes / 1024
        }KB`,
      );
    }
  }

  private validateFileSize(sizeInBytes: number, filePath: string): void {
    if (sizeInBytes > this.options.maxFileSizeBytes) {
      throw new Error(
        `File too large: ${filePath} (${(sizeInBytes / 1024).toFixed(1)}KB exceeds limit of ${
          this.options.maxFileSizeBytes / 1024
        }KB)`,
      );
    }
  }

  private performCustomValidation(config: ValidatedScenarioConfig): string[] {
    const warnings: string[] = [];

    if (!config.learning_path || config.learning_path.length === 0) {
      warnings.push('No learning phases defined - scenario may be incomplete');
    } else {
      config.learning_path.forEach((phase, index) => {
        if (!phase.tasks || phase.tasks.length === 0) {
          warnings.push(`Learning phase "${phase.id}" has no tasks`);
        }

        if (phase.tasks && phase.tasks.length > 10) {
          warnings.push(
            `Learning phase "${phase.id}" has many tasks (${phase.tasks.length}) - consider splitting`,
          );
        }
      });
    }

    if (
      config.assessment?.mastery_threshold !== undefined &&
      (config.assessment.mastery_threshold < 0.5 ||
        config.assessment.mastery_threshold > 0.95)
    ) {
      warnings.push(
        `Unusual mastery threshold: ${config.assessment.mastery_threshold} (typical range: 0.5-0.95)`,
      );
    }

    return warnings;
  }

  private generateSampleLimitScenario(): ScenarioYamlConfig {
    return {
      scenario: {
        id: 'limits_interactive',
        name: '极限探索之旅',
        description: '通过交互式可视化深入理解极限的概念、计算和应用',
        version: '1.0.0',
        knowledge_area: 'limits',
        difficulty: 'medium',
        estimated_duration: 45,
      },
      metadata: {
        author: 'System',
        tags: ['极限', 'ε-δ语言', '连续性', '洛必达法则'],
        prerequisites: ['函数基础'],
      },
      learning_path: [
        {
          id: 'phase1_concept',
          name: '直观理解极限',
          concept_ids: ['limit_definition', 'limit_properties'],
          tasks: [
            {
              id: 'task_epsilon_delta',
              type: 'exploration',
              title: 'ε-δ语言可视化',
              interaction_mode: 'slider',
              description: '通过调整ε和δ参数，观察函数值如何逼近极限值',
              validation: {
                expected_answer: null,
                hint_system: {
                  max_hints: 3,
                  hints: [
                    {
                      level: 1,
                      content: 'ε表示允许的误差范围',
                      cost: 5,
                      type: 'text',
                    },
                    {
                      level: 2,
                      content: 'δ定义x的范围使得f(x)在ε内',
                      cost: 10,
                      type: 'text',
                    },
                  ],
                },
                feedback_messages: {
                  correct: '完美！你理解了ε-δ的定义',
                  partial: '接近了，再试试调整参数',
                  incorrect: '提示：观察当δ减小时发生什么',
                },
              },
              scoring: {
                max_points: 20,
                time_bonus: true,
                hint_penalty: 5,
                attempt_penalty: 2,
              },
            },
            {
              id: 'task_limit_intuition',
              type: 'guided_practice',
              title: '极限的直观认识',
              interaction_mode: 'graph_interaction',
              description: '观察不同函数在某点的极限行为',
              validation: {
                expected_answer: { lim_x_0_sinx_over_x: 1 },
                hint_system: { max_hints: 2, hints: [] },
                feedback_messages: {
                  correct: '正确！',
                  partial: '部分正确',
                  incorrect: '再观察图像',
                },
              },
              scoring: {
                max_points: 15,
                time_bonus: false,
                hint_penalty: 3,
                attempt_penalty: 1,
              },
            },
          ],
        },
        {
          id: 'phase2_computation',
          name: '极限计算方法',
          concept_ids: [
            'limit_computation',
            'lhopital_rule',
            'infinity_limits',
          ],
          tasks: [
            {
              id: 'task_direct_substitution',
              type: 'guided_practice',
              title: '直接代入法练习',
              interaction_mode: 'input',
              description: '使用直接代入法计算极限',
              validation: {
                expected_answer: '10',
                tolerance: 0.001,
                hint_system: { max_hints: 3, hints: [] },
                feedback_messages: {
                  correct: '完全正确！',
                  partial: '答案接近但不够精确',
                  incorrect: '提示：先检查函数在该点是否有定义',
                },
              },
              scoring: {
                max_points: 15,
                time_bonus: true,
                hint_penalty: 4,
                attempt_penalty: 2,
              },
            },
            {
              id: 'task_lhopital_challenge',
              type: 'challenge',
              title: '洛必达法则挑战',
              interaction_mode: 'multi_step',
              description: '应用洛必达法则求解未定式极限',
              adaptive_difficulty: {
                enabled: true,
                adjustment_factor: 0.1,
                min_difficulty: 0.3,
                max_difficulty: 0.9,
              },
              validation: {
                expected_answer: '0.5',
                hint_system: { max_hints: 4, hints: [] },
                feedback_messages: {
                  correct: '出色！掌握了洛必达法则',
                  partial: '思路正确，检查计算过程',
                  incorrect: '确认这是0/0或∞/∞型未定式',
                },
              },
              scoring: {
                max_points: 25,
                time_bonus: true,
                hint_penalty: 5,
                attempt_penalty: 3,
              },
            },
          ],
        },
        {
          id: 'phase3_application',
          name: '极限的实际应用',
          concept_ids: ['continuity', 'discontinuity'],
          tasks: [
            {
              id: 'task_motion_instantaneous',
              type: 'application',
              title: '瞬时速度问题',
              interaction_mode: 'graph_interaction',
              description: '利用极限概念求解物理中的瞬时速度问题',
              validation: {
                expected_answer: { velocity: 4, unit: 'm/s' },
                hint_system: { max_hints: 3, hints: [] },
                feedback_messages: {
                  correct: '完美！你将极限概念应用到实际问题中',
                  partial: '方法正确，数值需要调整',
                  incorrect: '提示：瞬时速度是平均速度的极限',
                },
              },
              scoring: {
                max_points: 30,
                time_bonus: true,
                hint_penalty: 6,
                attempt_penalty: 2,
              },
            },
          ],
        },
      ],
      visualizations: [
        {
          id: 'epsilon_delta_viz',
          type: 'dynamic_graph',
          title: 'ε-δ可视化',
          description: '展示ε-δ定义的几何意义',
          data_binding: { source: 'dynamic' },
          parameters: [
            {
              id: 'epsilon',
              name: 'epsilon',
              label: 'ε (误差范围)',
              type: 'slider',
              constraints: {
                min: 0.01,
                max: 1,
                step: 0.01,
                default_value: 0.1,
              },
              binding: { target: 'epsilon', unit: '' },
            },
            {
              id: 'delta',
              name: 'delta',
              label: 'δ (邻域半径)',
              type: 'slider',
              constraints: {
                min: 0.01,
                max: 1,
                step: 0.01,
                default_value: 0.1,
              },
              binding: { target: 'delta', unit: '' },
            },
          ],
          interactions: {
            enabled: true,
            modes: ['drag', 'zoom'],
            callbacks: ['onParamChange'],
          },
          styling: { theme: 'light', show_grid: true, show_axes: true },
        },
        {
          id: 'tangent_line_viz',
          type: 'tangent_line',
          title: '割线到切线',
          description: '观察割线如何趋近于切线',
          data_binding: { source: 'user_input' },
          parameters: [
            {
              id: 'h',
              name: 'h',
              label: '增量h',
              type: 'slider',
              constraints: {
                min: 0.001,
                max: 2,
                step: 0.001,
                default_value: 1,
              },
              binding: { target: 'h', unit: '' },
            },
          ],
          interactions: {
            enabled: true,
            modes: ['drag'],
            callbacks: ['onHover'],
          },
          styling: { theme: 'auto', show_axes: true },
        },
      ],
      assessment: {
        mastery_threshold: 0.75,
        formative_checks: [
          {
            id: 'check_phase1',
            check_point: 'after_phase',
            questions: [
              {
                id: 'q1',
                type: 'multiple_choice',
                question: '当x→0时，sin(x)/x的极限是什么？',
                options: ['0', '1', '∞', '不存在'],
                expected_answer: '1',
                explanation: '这是重要极限之一，可通过夹逼定理证明',
                difficulty: 0.3,
                concept_ids: ['limit_definition'],
              },
              {
                id: 'q2',
                type: 'calculation',
                question: '计算 lim(x→2) (x² - 4)/(x - 2)',
                expected_answer: '4',
                explanation: '因式分解后约去(x-2)，得到lim(x→2)(x+2)=4',
                difficulty: 0.5,
                concept_ids: ['limit_computation'],
              },
            ],
            passing_criteria: { min_correct_rate: 0.7 },
            feedback: {
              show_immediate_feedback: true,
              detailed_explanations: true,
              suggest_review_topics: true,
            },
          },
        ],
      },
    };
  }

  private generateSampleDerivativeScenario(): ScenarioYamlConfig {
    return {
      scenario: {
        id: 'derivatives_interactive',
        name: '导数与变化率',
        description: '探索导数的几何意义、计算方法和实际应用',
        version: '1.0.0',
        knowledge_area: 'derivatives',
        difficulty: 'medium',
        estimated_duration: 50,
      },
      metadata: {
        author: 'System',
        tags: ['导数', '变化率', '切线', '链式法则'],
        prerequisites: ['limits_interactive'],
      },
      learning_path: [
        {
          id: 'phase1_geometric',
          name: '几何意义探索',
          concept_ids: ['derivative_definition'],
          tasks: [
            {
              id: 'task_tangent_slope',
              type: 'exploration',
              title: '切线斜率探索器',
              interaction_mode: 'graph_interaction',
              description: '通过拖动点观察割线如何变为切线',
              validation: {
                expected_answer: null,
                hint_system: { max_hints: 3, hints: [] },
                feedback_messages: {
                  correct: '你发现了导数的几何意义！',
                  partial: '继续尝试',
                  incorrect: '提示：让两个点越来越近',
                },
              },
              scoring: {
                max_points: 20,
                time_bonus: true,
                hint_penalty: 5,
                attempt_penalty: 2,
              },
            },
          ],
        },
        {
          id: 'phase2_rules',
          name: '求导法则训练',
          concept_ids: ['derivative_rules', 'chain_rule', 'product_rule'],
          tasks: [
            {
              id: 'task_chain_rule_builder',
              type: 'exploration',
              title: '链式法则拆解器',
              interaction_mode: 'drag_drop',
              description: '将复合函数拆分为外层和内层函数',
              validation: {
                expected_answer: { outer: 'sin(u)', inner: 'x²' },
                hint_system: { max_hints: 3, hints: [] },
                feedback_messages: {
                  correct: '完美拆解！',
                  partial: '部分正确',
                  incorrect: '识别哪个是外层函数',
                },
              },
              scoring: {
                max_points: 15,
                time_bonus: false,
                hint_penalty: 3,
                attempt_penalty: 1,
              },
            },
          ],
        },
      ],
      visualizations: [
        {
          id: 'derivative_graph',
          type: 'dynamic_graph',
          title: '原函数与导函数对比',
          description: "同时显示f(x)和f'(x)",
          data_binding: { source: 'dynamic' },
          parameters: [],
          interactions: {
            enabled: true,
            modes: ['hover', 'click'],
            callbacks: [],
          },
          styling: { theme: 'light', show_grid: true },
        },
      ],
      assessment: {
        mastery_threshold: 0.8,
        formative_checks: [],
      },
    };
  }

  private transformToInteractiveScenario(
    config: ValidatedScenarioConfig,
  ): InteractiveScenario {
    const learningPath: LearningPhase[] = (config.learning_path || []).map(
      (phase, index) => ({
        id: phase.id,
        name: phase.name,
        order: index,
        conceptIds: phase.concept_ids || [],
        objectives: [],
        tasks: (phase.tasks || []).map((task) =>
          this.transformTask(task, phase.id),
        ),
        duration: 15,
      }),
    );

    const visualizations: VisualizationConfig[] = (
      config.visualizations || []
    ).map((viz) => ({
      id: viz.id,
      type: viz.type as VisualizationConfig['type'],
      title: viz.title || '',
      description: viz.description || '',
      dataBinding: { source: 'static' },
      parameters: (viz.parameters || []).map((param) => ({
        id: param.id,
        name: param.name,
        label: param.label,
        type: param.type as ParameterConfig['type'],
        constraints: {
          min: param.constraints?.min,
          max: param.constraints?.max,
          step: param.constraints?.step,
          defaultValue: param.constraints?.default_value,
          options: param.constraints?.options,
        },
        binding: {
          target: param.binding?.target,
          unit: param.binding?.unit,
        },
      })),
      interactions: {
        enabled: true,
        modes: [],
        callbacks: [],
      },
      styling: {
        theme: 'auto',
        showGrid: false,
        showAxes: false,
      },
    }));

    const assessment: AssessmentConfig = {
      formativeChecks: (config.assessment?.formative_checks || []).map(
        (check) => ({
          id: check.id,
          phaseId: '',
          title: `阶段检查: ${check.id}`,
          checkPoint: check.check_point || 'after_phase',
          questions: (check.questions || []).map((q) => ({
            id: q.id,
            type: q.type as any,
            question: q.question,
            options: q.options,
            expectedAnswer: q.expected_answer,
            explanation: q.explanation || '',
            difficulty: q.difficulty || 0.5,
            conceptIds: q.concept_ids || [],
          })),
          passingCriteria: {
            minCorrectRate: check.passing_criteria?.min_correct_rate || 0.7,
            timeLimit: check.passing_criteria?.time_limit,
          },
          feedback: {
            showImmediateFeedback:
              check.feedback?.show_immediate_feedback ?? true,
            detailedExplanations: check.feedback?.detailed_explanations ?? true,
            suggestReviewTopics: check.feedback?.suggest_review_topics ?? true,
          },
        }),
      ),
      summativeTask: undefined,
      adaptiveDifficulty: true,
      masteryThreshold: config.assessment?.mastery_threshold || 0.7,
      retryPolicy: {
        maxAttempts: 3,
        cooldownPeriod: 60,
        showExplanationAfter: 2,
      },
      analytics: {
        trackTimeSpent: true,
        trackHintUsage: true,
        trackErrorPatterns: true,
        generateReport: true,
      },
    };

    return {
      id: config.scenario.id,
      name: config.scenario.name,
      description: config.scenario.description || '',
      version: config.scenario.version || '1.0.0',
      knowledgeArea: config.scenario.knowledge_area,
      difficulty: config.scenario.difficulty,
      estimatedDuration: config.scenario.estimated_duration || 30,

      learningPath,
      interactiveElements: {
        visualizations,
        dynamicParameters: [],
        stepByStepGuide: [],
      },

      assessment,

      metadata: {
        author: config.metadata?.author || 'System',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: config.metadata?.tags || [],
        prerequisites: config.metadata?.prerequisites || [],
      },
    };
  }

  private transformTask(task: any, phaseId: string): InteractiveTask {
    return {
      id: task.id,
      phaseId,
      title: task.title,
      description: task.description || '',
      type: task.type as InteractiveTask['type'],
      interactionMode:
        task.interaction_mode as InteractiveTask['interactionMode'],

      content: {
        text: task.description,
      },

      validation: {
        expectedAnswer: task.validation?.expected_answer,
        tolerance: task.validation?.tolerance,
        acceptedFormats: task.validation?.accepted_formats,
        hintSystem: {
          maxHints: task.validation?.hint_system?.max_hints || 3,
          progressiveReveal: true,
          hints: (task.validation?.hint_system?.hints || []).map(
            (hint: any) => ({
              level: hint.level,
              content: hint.content,
              cost: hint.cost || 5,
              type: hint.type || 'text',
            }),
          ),
        },
        feedbackMessages: task.validation?.feedback_messages || {
          correct: '正确！',
          partial: '部分正确',
          incorrect: '再试一次',
        },
      },

      scoring: task.scoring || {
        maxPoints: 10,
        timeBonus: false,
        hintPenalty: 5,
        attemptPenalty: 2,
      },

      adaptiveDifficulty: task.adaptive_difficulty || {
        enabled: false,
        adjustmentFactor: 0.1,
        minDifficulty: 0.3,
        maxDifficulty: 0.9,
      },
    };
  }

  getCacheStatistics(): {
    totalScenarios: number;
    cacheSize: number;
    brokenCount: number;
    lastUpdateTimes: Map<string, number>;
    isWatcherActive: boolean;
  } {
    return {
      totalScenarios: this.scenarioCache.size,
      cacheSize: this.scenarioCache.size,
      brokenCount: this.brokenConfigs.size,
      lastUpdateTimes: new Map(this.lastModifiedMap),
      isWatcherActive: this.isWatcherActive,
    };
  }

  async clearCache(): Promise<void> {
    this.scenarioCache.clear();
    this.rawConfigCache.clear();
    this.lastModifiedMap.clear();
    this.logger.log('Scenario cache cleared');
  }
}
