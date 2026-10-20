import {
  Injectable,
  Logger,
  OnModuleInit,
  NotFoundException,
} from '@nestjs/common';
import { Neo4jService } from './neo4j/neo4j.service';
import {
  KnowledgeNodeType,
  KnowledgeRelationType,
  KnowledgeNode,
  KnowledgeRelation,
  LearningPath,
  MATH_CONCEPTS,
} from './interfaces/knowledge.interfaces';

interface SearchResult {
  name: string;
  type: string;
  description: string;
  score: number;
  relatedCount: number;
  difficulty: string;
}

interface ConceptRecommendation {
  conceptId: string;
  name: string;
  reason: string;
  priority: number;
  estimatedTime: number;
}

interface KnowledgeStrength {
  conceptId: string;
  name: string;
  strength: number;
  relationType: string;
}

@Injectable()
export class KnowledgeService implements OnModuleInit {
  private readonly logger = new Logger(KnowledgeService.name);
  private useFallback = false;
  private fallbackNodes: KnowledgeNode[] = [];
  private fallbackEdges: KnowledgeRelation[] = [];

  constructor(private readonly neo4jService: Neo4jService) {}

  async onModuleInit() {
    await this.waitForNeo4jAndInit();
  }

  private async waitForNeo4jAndInit(): Promise<void> {
    const maxRetries = 10;
    const retryDelay = 1000;

    for (let i = 0; i < maxRetries; i++) {
      if (this.neo4jService.isInitialized()) {
        try {
          await this.initializeKnowledgeGraph();
          this.logger.log('Knowledge graph initialized with Neo4j');
          return;
        } catch (error: any) {
          this.logger.warn(`Neo4j initialization failed: ${error.message}`);
        }
      }

      if (i < maxRetries - 1) {
        this.logger.log(
          `Waiting for Neo4j to initialize... (${i + 1}/${maxRetries})`,
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }

    this.logger.warn(
      'Neo4j not available after retries, using in-memory fallback',
    );
    this.useFallback = true;
    this.initializeFallback();
  }

  private initializeFallback(): void {
    this.fallbackNodes = this.getDefaultMathConcepts() as KnowledgeNode[];
    this.fallbackEdges = this.getDefaultRelations();
    this.logger.log(
      `Initialized fallback with ${this.fallbackNodes.length} concepts`,
    );
  }

  private async initializeKnowledgeGraph(): Promise<void> {
    try {
      const existingNodes = await this.neo4jService.findNodes('Knowledge', {});
      if (existingNodes.length === 0) {
        this.logger.log('Initializing knowledge graph with default data...');
        await this.seedKnowledgeGraph();
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to initialize knowledge graph: ${error.message}`,
      );
      throw error;
    }
  }

  private async seedKnowledgeGraph(): Promise<void> {
    const concepts = this.getDefaultMathConcepts();

    for (const concept of concepts) {
      await this.createConcept(concept);
    }

    const relations = this.getDefaultRelations();
    for (const relation of relations) {
      await this.createRelation(relation);
    }

    this.logger.log(
      `Seeded ${concepts.length} concepts and ${relations.length} relations`,
    );
  }

  private getDefaultMathConcepts(): Partial<KnowledgeNode>[] {
    return [
      {
        id: MATH_CONCEPTS.LIMIT_DEFINITION,
        name: '极限的定义',
        type: KnowledgeNodeType.CONCEPT,
        description:
          '极限是微积分的基础概念，描述函数在某点附近的行为趋势。设函数f(x)在点x₀的某去心邻域内有定义，如果存在常数L，对于任意给定的正数ε，总存在正数δ，使得当0<|x-x₀|<δ时，有|f(x)-L|<ε，则称L为f(x)当x趋近于x₀时的极限。',
        formula: 'lim(x→a) f(x) = L',
        latex: '\\lim_{x \\to a} f(x) = L',
        difficulty: 'medium',
        tags: ['极限', '基础概念', '微积分入门', 'ε-δ语言'],
        examples: [
          'lim(x→0) sin(x)/x = 1',
          'lim(x→∞) 1/x = 0',
          'lim(x→0) (e^x - 1)/x = 1',
        ],
      },
      {
        id: MATH_CONCEPTS.LIMIT_PROPERTIES,
        name: '极限的性质',
        type: KnowledgeNodeType.CONCEPT,
        description:
          '极限具有四则运算性质、复合函数极限性质、保号性等。这些性质是极限计算和证明的基础工具。',
        formula:
          'lim[f(x)±g(x)] = lim f(x) ± lim g(x); lim[f(x)·g(x)] = lim f(x) · lim g(x)',
        difficulty: 'easy',
        tags: ['极限', '性质', '运算', '保号性'],
      },
      {
        id: MATH_CONCEPTS.LIMIT_COMPUTATION,
        name: '极限的计算方法',
        type: KnowledgeNodeType.METHOD,
        description:
          '计算极限的常用方法包括：直接代入法、因式分解法、有理化法、等价无穷小替换、洛必达法则、泰勒展开等。选择合适的方法取决于极限的类型和形式。',
        difficulty: 'medium',
        tags: ['极限', '计算', '方法', '技巧'],
      },
      {
        id: MATH_CONCEPTS.INFINITY_LIMITS,
        name: '无穷大与无穷小',
        type: KnowledgeNodeType.CONCEPT,
        description:
          '无穷大和无穷小是极限的特殊情况。无穷小是以零为极限的变量，无穷大是绝对值无限增大的变量。它们之间有密切的关系：无穷大的倒数是无穷小，非零无穷小的倒数是无穷大。',
        formula:
          '若lim f(x) = ∞，则lim 1/f(x) = 0；若lim f(x) = 0且f(x)≠0，则lim 1/f(x) = ∞',
        difficulty: 'medium',
        tags: ['极限', '无穷', '无穷小', '无穷大'],
      },
      {
        id: MATH_CONCEPTS.CONTINUITY,
        name: '连续性',
        type: KnowledgeNodeType.CONCEPT,
        description:
          '函数在某点连续需要满足三个条件：函数在该点有定义、极限存在、极限值等于函数值。连续性是微积分中非常重要的概念，可导必连续，但连续不一定可导。',
        formula: 'lim(x→a) f(x) = f(a)',
        latex: '\\lim_{x \\to a} f(x) = f(a)',
        difficulty: 'medium',
        tags: ['连续', '极限', '函数性质', '间断点'],
      },
      {
        id: MATH_CONCEPTS.DISCONTINUITY,
        name: '间断点',
        type: KnowledgeNodeType.CONCEPT,
        description:
          '函数不连续的点称为间断点。间断点分为可去间断点（左右极限存在且相等但不等于函数值）、跳跃间断点（左右极限存在但不相等）、无穷间断点（极限为无穷）和振荡间断点。',
        difficulty: 'medium',
        tags: ['间断点', '连续', '分类', '第一类间断点', '第二类间断点'],
      },
      {
        id: MATH_CONCEPTS.DERIVATIVE_DEFINITION,
        name: '导数的定义',
        type: KnowledgeNodeType.CONCEPT,
        description:
          '导数表示函数在某点的瞬时变化率，几何意义是曲线在该点切线的斜率。导数的本质是差商的极限，即函数增量与自变量增量之比当自变量增量趋近于零时的极限。',
        formula: "f'(x) = lim(h→0) [f(x+h) - f(x)] / h",
        latex: "f'(x) = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h}",
        difficulty: 'medium',
        tags: ['导数', '微分', '变化率', '切线斜率'],
      },
      {
        id: MATH_CONCEPTS.DERIVATIVE_RULES,
        name: '基本求导公式',
        type: KnowledgeNodeType.FORMULA,
        description:
          '常用函数的导数公式是求导的基础。包括幂函数、指数函数、对数函数、三角函数、反三角函数的导数公式。这些公式需要熟练记忆和应用。',
        formula:
          "(x^n)' = nx^(n-1); (e^x)' = e^x; (ln x)' = 1/x; (sin x)' = cos x; (cos x)' = -sin x",
        difficulty: 'easy',
        tags: ['导数', '公式', '基本', '记忆'],
      },
      {
        id: MATH_CONCEPTS.CHAIN_RULE,
        name: '链式法则',
        type: KnowledgeNodeType.METHOD,
        description:
          "链式法则是复合函数求导的基本方法。对于复合函数y=f(g(x))，其导数为y'=f'(g(x))·g'(x)。链式法则的关键是正确识别复合结构，由外向内逐层求导。",
        formula: "[f(g(x))]' = f'(g(x)) · g'(x)",
        latex: "\\frac{d}{dx}f(g(x)) = f'(g(x)) \\cdot g'(x)",
        difficulty: 'medium',
        tags: ['链式法则', '复合函数', '求导方法', '逐层求导'],
      },
      {
        id: MATH_CONCEPTS.PRODUCT_RULE,
        name: '乘积法则',
        type: KnowledgeNodeType.METHOD,
        description:
          "乘积法则用于求两个函数乘积的导数。公式为(fg)'=f'g+fg'，即乘积的导数等于第一个函数的导数乘以第二个函数，加上第一个函数乘以第二个函数的导数。",
        formula: "[f(x)g(x)]' = f'(x)g(x) + f(x)g'(x)",
        difficulty: 'easy',
        tags: ['导数', '乘积', '法则', '莱布尼茨法则'],
      },
      {
        id: MATH_CONCEPTS.QUOTIENT_RULE,
        name: '商法则',
        type: KnowledgeNodeType.METHOD,
        description:
          "商法则用于求两个函数商的导数。公式为(f/g)'=(f'g-fg')/g²，可以由乘积法则推导得出。使用时要注意分母的平方。",
        formula: "[f(x)/g(x)]' = [f'(x)g(x) - f(x)g'(x)] / g²(x)",
        difficulty: 'medium',
        tags: ['导数', '商', '法则'],
      },
      {
        id: MATH_CONCEPTS.IMPLICIT_DIFFERENTIATION,
        name: '隐函数求导',
        type: KnowledgeNodeType.METHOD,
        description:
          '隐函数求导用于处理y不能显式表示为x的函数的情况。方法是对方程两边同时对x求导，然后解出dy/dx。求导时要注意y是x的函数，对y求导要乘以dy/dx。',
        difficulty: 'medium',
        tags: ['隐函数', '求导', '方法', '链式法则应用'],
      },
      {
        id: MATH_CONCEPTS.HIGHER_DERIVATIVES,
        name: '高阶导数',
        type: KnowledgeNodeType.CONCEPT,
        description:
          '高阶导数是导数的导数。二阶导数表示函数的凹凸性，正为凹（下凸），负为凸（上凸）。高阶导数在泰勒展开、微分方程中有重要应用。',
        formula: "f''(x) = d/dx[f'(x)]; f^(n)(x) = d/dx[f^(n-1)(x)]",
        difficulty: 'medium',
        tags: ['高阶导数', '二阶导数', '凹凸性', '拐点'],
      },
      {
        id: MATH_CONCEPTS.MEAN_VALUE_THEOREM,
        name: '中值定理',
        type: KnowledgeNodeType.THEOREM,
        description:
          "拉格朗日中值定理是微分学的基本定理之一。如果函数f在闭区间[a,b]上连续，在开区间(a,b)内可导，则在(a,b)内至少存在一点c，使得f'(c)=(f(b)-f(a))/(b-a)。中值定理建立了函数值与导数值之间的联系。",
        formula: "f'(c) = [f(b) - f(a)] / (b - a), c∈(a,b)",
        difficulty: 'hard',
        tags: ['中值定理', '拉格朗日', '定理', '微分学基本定理'],
      },
      {
        id: MATH_CONCEPTS.EXTREME_VALUES,
        name: '极值与最值',
        type: KnowledgeNodeType.CONCEPT,
        description:
          '极值是函数在某邻域内的最大值或最小值，最值是函数在整个定义域或给定区间内的最大值或最小值。极值点处导数为零或导数不存在，但导数为零的点不一定是极值点。',
        formula: "极值点的必要条件：f'(x) = 0 或 f'(x) 不存在",
        difficulty: 'medium',
        tags: ['极值', '最值', '优化', '驻点', '临界点'],
      },
      {
        id: MATH_CONCEPTS.CONCAVITY,
        name: '凹凸性与拐点',
        type: KnowledgeNodeType.CONCEPT,
        description:
          '函数的凹凸性由二阶导数的符号决定。二阶导数大于零时函数为凹（下凸），小于零时为凸（上凸）。拐点是凹凸性改变的点，拐点处二阶导数为零或不存在。',
        formula: "f''(x) > 0 凹（下凸）；f''(x) < 0 凸（上凸）",
        difficulty: 'medium',
        tags: ['凹凸性', '拐点', '二阶导数', '曲线形状'],
      },
      {
        id: MATH_CONCEPTS.INTEGRAL_DEFINITION,
        name: '积分的定义',
        type: KnowledgeNodeType.CONCEPT,
        description:
          '积分是导数的逆运算，分为不定积分和定积分。不定积分是求原函数的过程，定积分表示函数曲线下的面积。积分是微积分的核心概念之一。',
        formula: '∫f(x)dx = F(x) + C',
        latex: '\\int f(x)\\,dx = F(x) + C',
        difficulty: 'medium',
        tags: ['积分', '不定积分', '原函数', '积分常数'],
      },
      {
        id: MATH_CONCEPTS.INDEFINITE_INTEGRAL,
        name: '不定积分',
        type: KnowledgeNodeType.CONCEPT,
        description:
          '不定积分是求原函数的过程，结果包含积分常数C。不定积分的基本性质包括线性性质，基本积分公式需要熟练掌握。',
        formula: "∫f(x)dx = F(x) + C，其中F'(x) = f(x)",
        difficulty: 'medium',
        tags: ['不定积分', '原函数', '积分常数', '线性性质'],
      },
      {
        id: MATH_CONCEPTS.DEFINITE_INTEGRAL,
        name: '定积分',
        type: KnowledgeNodeType.CONCEPT,
        description:
          '定积分表示函数在区间[a,b]上的累积效应，几何意义是曲线y=f(x)与x轴在区间[a,b]上围成的有向面积。定积分的值只与被积函数和积分区间有关，与积分变量符号无关。',
        formula: '∫[a,b] f(x)dx = F(b) - F(a)',
        difficulty: 'medium',
        tags: ['定积分', '面积', '累积', '牛顿-莱布尼茨公式'],
      },
      {
        id: MATH_CONCEPTS.FUNDAMENTAL_THEOREM,
        name: '微积分基本定理',
        type: KnowledgeNodeType.THEOREM,
        description:
          '微积分基本定理（牛顿-莱布尼茨公式）建立了微分和积分之间的桥梁。它表明定积分可以通过原函数在积分区间端点的值来计算，是计算定积分的基本方法。',
        formula: "∫[a,b] f(x)dx = F(b) - F(a)，其中F'(x) = f(x)",
        latex: '\\int_a^b f(x)\\,dx = F(b) - F(a)',
        difficulty: 'hard',
        tags: ['基本定理', '牛顿-莱布尼茨', '定积分', '微分与积分'],
      },
      {
        id: MATH_CONCEPTS.SUBSTITUTION_METHOD,
        name: '换元积分法',
        type: KnowledgeNodeType.METHOD,
        description:
          "换元积分法是最重要的积分方法之一。第一类换元（凑微分法）将被积表达式凑成f(g(x))g'(x)dx的形式；第二类换元通过变量替换x=φ(t)简化积分。换元后要注意回代或变换积分限。",
        formula: "∫f(g(x))g'(x)dx = ∫f(u)du，其中u=g(x)",
        difficulty: 'medium',
        tags: ['换元', '积分方法', '凑微分', '变量替换'],
      },
      {
        id: MATH_CONCEPTS.INTEGRATION_BY_PARTS,
        name: '分部积分法',
        type: KnowledgeNodeType.METHOD,
        description:
          '分部积分法适用于被积函数是两个函数乘积的情况。公式为∫udv=uv-∫vdu。关键是选择合适的u和dv，一般按照"反对幂三指"的顺序选择u。',
        formula: '∫u dv = uv - ∫v du',
        difficulty: 'medium',
        tags: ['分部积分', '积分方法', '乘积', 'LIATE规则'],
      },
      {
        id: MATH_CONCEPTS.PARTIAL_FRACTIONS,
        name: '有理函数积分',
        type: KnowledgeNodeType.METHOD,
        description:
          '有理函数积分的基本方法是将有理函数分解为部分分式，然后分别积分。部分分式分解需要根据分母的因式分解情况确定分解形式。',
        difficulty: 'hard',
        tags: ['部分分式', '有理函数', '积分', '分解'],
      },
      {
        id: MATH_CONCEPTS.IMPROPER_INTEGRALS,
        name: '反常积分',
        type: KnowledgeNodeType.CONCEPT,
        description:
          '反常积分包括无穷限积分和无界函数积分。无穷限积分将无穷限转化为极限来计算，无界函数积分将瑕点作为极限来处理。反常积分可能收敛也可能发散。',
        formula: '∫[a,∞] f(x)dx = lim(b→∞) ∫[a,b] f(x)dx',
        difficulty: 'hard',
        tags: ['反常积分', '无穷限', '瑕积分', '收敛', '发散'],
      },
      {
        id: MATH_CONCEPTS.TAYLOR_SERIES,
        name: '泰勒级数',
        type: KnowledgeNodeType.FORMULA,
        description:
          '泰勒级数是用多项式逼近函数的重要工具。函数在某点的泰勒展开式包含了该点的所有导数信息。泰勒级数在近似计算、极限计算、函数逼近中有广泛应用。',
        formula: 'f(x) = Σ f⁽ⁿ⁾(a)/n! · (x-a)ⁿ',
        latex: 'f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(a)}{n!}(x-a)^n',
        difficulty: 'hard',
        tags: ['泰勒展开', '级数', '函数逼近', '麦克劳林'],
      },
      {
        id: MATH_CONCEPTS.POWER_SERIES,
        name: '幂级数',
        type: KnowledgeNodeType.CONCEPT,
        description:
          '幂级数是形如Σaₙ(x-c)ⁿ的级数。幂级数在其收敛域内定义了一个函数，可以进行逐项求导和积分。收敛半径R决定了幂级数的收敛范围。',
        difficulty: 'hard',
        tags: ['幂级数', '收敛半径', '收敛域', '逐项求导'],
      },
      {
        id: MATH_CONCEPTS.CONVERGENCE_TESTS,
        name: '级数审敛法',
        type: KnowledgeNodeType.METHOD,
        description:
          '级数审敛法用于判断级数的收敛性。常用的方法包括比较判别法、比值判别法、根值判别法、积分判别法、莱布尼茨判别法（交错级数）等。',
        difficulty: 'hard',
        tags: ['级数', '收敛', '判别法', '比值判别法', '根值判别法'],
      },
      {
        id: MATH_CONCEPTS.LHOPITAL_RULE,
        name: '洛必达法则',
        type: KnowledgeNodeType.THEOREM,
        description:
          '洛必达法则是处理未定式极限的重要工具。对于0/0或∞/∞型未定式，可以将分子分母分别求导后再求极限。使用洛必达法则前要确认是未定式，且分子分母在去心邻域内可导。',
        formula: "lim f(x)/g(x) = lim f'(x)/g'(x)（0/0或∞/∞型）",
        latex: "\\lim \\frac{f(x)}{g(x)} = \\lim \\frac{f'(x)}{g'(x)}",
        difficulty: 'medium',
        tags: ['洛必达', '未定式', '极限计算', '0/0型', '∞/∞型'],
      },
      {
        id: MATH_CONCEPTS.DIFFERENTIAL_EQUATIONS,
        name: '微分方程',
        type: KnowledgeNodeType.CONCEPT,
        description:
          '微分方程是含有未知函数及其导数的方程。微分方程的阶数是方程中最高阶导数的阶数。解微分方程就是求满足方程的函数。微分方程在物理、工程等领域有广泛应用。',
        difficulty: 'hard',
        tags: ['微分方程', '阶数', '通解', '特解'],
      },
      {
        id: MATH_CONCEPTS.SEPARABLE_EQUATIONS,
        name: '可分离变量方程',
        type: KnowledgeNodeType.METHOD,
        description:
          '可分离变量微分方程可以将变量分离到等式两边，然后两边分别积分求解。形如dy/dx=f(x)g(y)的方程，分离变量后得到dy/g(y)=f(x)dx，两边积分即可。',
        formula: 'dy/dx = f(x)g(y) → ∫dy/g(y) = ∫f(x)dx',
        difficulty: 'medium',
        tags: ['微分方程', '分离变量', '求解方法'],
      },
      {
        id: MATH_CONCEPTS.LINEAR_EQUATIONS,
        name: '一阶线性微分方程',
        type: KnowledgeNodeType.METHOD,
        description:
          "一阶线性微分方程形如y'+P(x)y=Q(x)。求解方法有常数变易法和公式法。通解公式为y=e^(-∫P(x)dx)[∫Q(x)e^(∫P(x)dx)dx+C]。",
        formula: 'y = e^(-∫P(x)dx) [∫Q(x)e^(∫P(x)dx)dx + C]',
        difficulty: 'hard',
        tags: ['微分方程', '线性', '通解公式', '常数变易法'],
      },
    ];
  }

  private getDefaultRelations(): KnowledgeRelation[] {
    return [
      {
        fromId: MATH_CONCEPTS.LIMIT_PROPERTIES,
        toId: MATH_CONCEPTS.LIMIT_DEFINITION,
        type: KnowledgeRelationType.PREREQUISITE,
        weight: 1.0,
        description: '理解极限定义是掌握极限性质的前提',
      },
      {
        fromId: MATH_CONCEPTS.LIMIT_COMPUTATION,
        toId: MATH_CONCEPTS.LIMIT_DEFINITION,
        type: KnowledgeRelationType.PREREQUISITE,
        weight: 1.0,
        description: '极限计算需要理解极限定义',
      },
      {
        fromId: MATH_CONCEPTS.INFINITY_LIMITS,
        toId: MATH_CONCEPTS.LIMIT_DEFINITION,
        type: KnowledgeRelationType.PREREQUISITE,
        weight: 0.9,
        description: '无穷大无穷小是极限的特殊情况',
      },
      {
        fromId: MATH_CONCEPTS.CONTINUITY,
        toId: MATH_CONCEPTS.LIMIT_DEFINITION,
        type: KnowledgeRelationType.PREREQUISITE,
        weight: 1.0,
        description: '理解极限是理解连续性的前提',
      },
      {
        fromId: MATH_CONCEPTS.DISCONTINUITY,
        toId: MATH_CONCEPTS.CONTINUITY,
        type: KnowledgeRelationType.PREREQUISITE,
        weight: 1.0,
        description: '理解连续才能理解间断',
      },
      {
        fromId: MATH_CONCEPTS.DERIVATIVE_DEFINITION,
        toId: MATH_CONCEPTS.LIMIT_DEFINITION,
        type: KnowledgeRelationType.PREREQUISITE,
        weight: 1.0,
        description: '导数定义依赖于极限概念',
      },
      {
        fromId: MATH_CONCEPTS.DERIVATIVE_RULES,
        toId: MATH_CONCEPTS.DERIVATIVE_DEFINITION,
        type: KnowledgeRelationType.PREREQUISITE,
        weight: 1.0,
        description: '基本求导公式源于导数定义',
      },
      {
        fromId: MATH_CONCEPTS.CHAIN_RULE,
        toId: MATH_CONCEPTS.DERIVATIVE_DEFINITION,
        type: KnowledgeRelationType.PREREQUISITE,
        weight: 0.8,
        description: '链式法则需要理解导数定义',
      },
      {
        fromId: MATH_CONCEPTS.CHAIN_RULE,
        toId: MATH_CONCEPTS.DERIVATIVE_RULES,
        type: KnowledgeRelationType.PREREQUISITE,
        weight: 0.7,
        description: '链式法则需要掌握基本求导公式',
      },
      {
        fromId: MATH_CONCEPTS.PRODUCT_RULE,
        toId: MATH_CONCEPTS.DERIVATIVE_DEFINITION,
        type: KnowledgeRelationType.PREREQUISITE,
        weight: 0.8,
        description: '乘积法则源于导数定义',
      },
      {
        fromId: MATH_CONCEPTS.QUOTIENT_RULE,
        toId: MATH_CONCEPTS.PRODUCT_RULE,
        type: KnowledgeRelationType.RELATED_TO,
        weight: 0.8,
        description: '商法则可由乘积法则推导',
      },
      {
        fromId: MATH_CONCEPTS.IMPLICIT_DIFFERENTIATION,
        toId: MATH_CONCEPTS.CHAIN_RULE,
        type: KnowledgeRelationType.PREREQUISITE,
        weight: 1.0,
        description: '隐函数求导需要链式法则',
      },
      {
        fromId: MATH_CONCEPTS.HIGHER_DERIVATIVES,
        toId: MATH_CONCEPTS.DERIVATIVE_DEFINITION,
        type: KnowledgeRelationType.PREREQUISITE,
        weight: 1.0,
        description: '高阶导数是导数的推广',
      },
      {
        fromId: MATH_CONCEPTS.MEAN_VALUE_THEOREM,
        toId: MATH_CONCEPTS.DERIVATIVE_DEFINITION,
        type: KnowledgeRelationType.PREREQUISITE,
        weight: 1.0,
        description: '中值定理依赖于导数概念',
      },
      {
        fromId: MATH_CONCEPTS.MEAN_VALUE_THEOREM,
        toId: MATH_CONCEPTS.CONTINUITY,
        type: KnowledgeRelationType.PREREQUISITE,
        weight: 1.0,
        description: '中值定理需要函数连续',
      },
      {
        fromId: MATH_CONCEPTS.EXTREME_VALUES,
        toId: MATH_CONCEPTS.DERIVATIVE_DEFINITION,
        type: KnowledgeRelationType.PREREQUISITE,
        weight: 1.0,
        description: '极值求法依赖于导数',
      },
      {
        fromId: MATH_CONCEPTS.CONCAVITY,
        toId: MATH_CONCEPTS.HIGHER_DERIVATIVES,
        type: KnowledgeRelationType.PREREQUISITE,
        weight: 1.0,
        description: '凹凸性由二阶导数判断',
      },
      {
        fromId: MATH_CONCEPTS.INTEGRAL_DEFINITION,
        toId: MATH_CONCEPTS.DERIVATIVE_DEFINITION,
        type: KnowledgeRelationType.RELATED_TO,
        weight: 0.9,
        description: '积分是导数的逆运算',
      },
      {
        fromId: MATH_CONCEPTS.INDEFINITE_INTEGRAL,
        toId: MATH_CONCEPTS.INTEGRAL_DEFINITION,
        type: KnowledgeRelationType.PREREQUISITE,
        weight: 1.0,
        description: '不定积分是积分的基本形式',
      },
      {
        fromId: MATH_CONCEPTS.DEFINITE_INTEGRAL,
        toId: MATH_CONCEPTS.INTEGRAL_DEFINITION,
        type: KnowledgeRelationType.PREREQUISITE,
        weight: 1.0,
        description: '定积分是积分的应用形式',
      },
      {
        fromId: MATH_CONCEPTS.FUNDAMENTAL_THEOREM,
        toId: MATH_CONCEPTS.DERIVATIVE_DEFINITION,
        type: KnowledgeRelationType.PREREQUISITE,
        weight: 1.0,
        description: '基本定理连接微分和积分',
      },
      {
        fromId: MATH_CONCEPTS.FUNDAMENTAL_THEOREM,
        toId: MATH_CONCEPTS.INTEGRAL_DEFINITION,
        type: KnowledgeRelationType.PREREQUISITE,
        weight: 1.0,
        description: '需要理解积分定义',
      },
      {
        fromId: MATH_CONCEPTS.SUBSTITUTION_METHOD,
        toId: MATH_CONCEPTS.INTEGRAL_DEFINITION,
        type: KnowledgeRelationType.PREREQUISITE,
        weight: 1.0,
        description: '换元法是积分的基本方法',
      },
      {
        fromId: MATH_CONCEPTS.SUBSTITUTION_METHOD,
        toId: MATH_CONCEPTS.CHAIN_RULE,
        type: KnowledgeRelationType.RELATED_TO,
        weight: 0.9,
        description: '换元积分与链式法则互逆',
      },
      {
        fromId: MATH_CONCEPTS.INTEGRATION_BY_PARTS,
        toId: MATH_CONCEPTS.INTEGRAL_DEFINITION,
        type: KnowledgeRelationType.PREREQUISITE,
        weight: 1.0,
        description: '分部积分是重要的积分方法',
      },
      {
        fromId: MATH_CONCEPTS.INTEGRATION_BY_PARTS,
        toId: MATH_CONCEPTS.PRODUCT_RULE,
        type: KnowledgeRelationType.RELATED_TO,
        weight: 0.9,
        description: '分部积分由乘积法则推导',
      },
      {
        fromId: MATH_CONCEPTS.PARTIAL_FRACTIONS,
        toId: MATH_CONCEPTS.INTEGRAL_DEFINITION,
        type: KnowledgeRelationType.PREREQUISITE,
        weight: 0.8,
        description: '部分分式是有理函数积分的方法',
      },
      {
        fromId: MATH_CONCEPTS.IMPROPER_INTEGRALS,
        toId: MATH_CONCEPTS.DEFINITE_INTEGRAL,
        type: KnowledgeRelationType.PREREQUISITE,
        weight: 1.0,
        description: '反常积分是定积分的推广',
      },
      {
        fromId: MATH_CONCEPTS.IMPROPER_INTEGRALS,
        toId: MATH_CONCEPTS.INFINITY_LIMITS,
        type: KnowledgeRelationType.PREREQUISITE,
        weight: 0.9,
        description: '反常积分涉及无穷极限',
      },
      {
        fromId: MATH_CONCEPTS.TAYLOR_SERIES,
        toId: MATH_CONCEPTS.DERIVATIVE_DEFINITION,
        type: KnowledgeRelationType.PREREQUISITE,
        weight: 1.0,
        description: '泰勒展开需要高阶导数',
      },
      {
        fromId: MATH_CONCEPTS.TAYLOR_SERIES,
        toId: MATH_CONCEPTS.HIGHER_DERIVATIVES,
        type: KnowledgeRelationType.PREREQUISITE,
        weight: 1.0,
        description: '泰勒展开需要计算高阶导数',
      },
      {
        fromId: MATH_CONCEPTS.POWER_SERIES,
        toId: MATH_CONCEPTS.TAYLOR_SERIES,
        type: KnowledgeRelationType.RELATED_TO,
        weight: 0.9,
        description: '泰勒级数是特殊的幂级数',
      },
      {
        fromId: MATH_CONCEPTS.CONVERGENCE_TESTS,
        toId: MATH_CONCEPTS.POWER_SERIES,
        type: KnowledgeRelationType.PREREQUISITE,
        weight: 0.8,
        description: '审敛法用于判断级数收敛性',
      },
      {
        fromId: MATH_CONCEPTS.LHOPITAL_RULE,
        toId: MATH_CONCEPTS.LIMIT_DEFINITION,
        type: KnowledgeRelationType.PREREQUISITE,
        weight: 0.9,
        description: '洛必达法则用于求极限',
      },
      {
        fromId: MATH_CONCEPTS.LHOPITAL_RULE,
        toId: MATH_CONCEPTS.DERIVATIVE_DEFINITION,
        type: KnowledgeRelationType.PREREQUISITE,
        weight: 1.0,
        description: '洛必达法则需要求导',
      },
      {
        fromId: MATH_CONCEPTS.DIFFERENTIAL_EQUATIONS,
        toId: MATH_CONCEPTS.DERIVATIVE_DEFINITION,
        type: KnowledgeRelationType.PREREQUISITE,
        weight: 1.0,
        description: '微分方程涉及导数',
      },
      {
        fromId: MATH_CONCEPTS.DIFFERENTIAL_EQUATIONS,
        toId: MATH_CONCEPTS.INTEGRAL_DEFINITION,
        type: KnowledgeRelationType.PREREQUISITE,
        weight: 1.0,
        description: '解微分方程需要积分',
      },
      {
        fromId: MATH_CONCEPTS.SEPARABLE_EQUATIONS,
        toId: MATH_CONCEPTS.DIFFERENTIAL_EQUATIONS,
        type: KnowledgeRelationType.PREREQUISITE,
        weight: 1.0,
        description: '可分离变量方程是微分方程的基础类型',
      },
      {
        fromId: MATH_CONCEPTS.LINEAR_EQUATIONS,
        toId: MATH_CONCEPTS.DIFFERENTIAL_EQUATIONS,
        type: KnowledgeRelationType.PREREQUISITE,
        weight: 1.0,
        description: '一阶线性方程是重要的微分方程类型',
      },
    ];
  }

  async createConcept(concept: Partial<KnowledgeNode>): Promise<KnowledgeNode> {
    if (this.useFallback) {
      const node = {
        ...concept,
        createdAt: new Date().toISOString(),
      } as KnowledgeNode;
      this.fallbackNodes.push(node);
      return node;
    }

    const node = { ...concept, createdAt: new Date().toISOString() };
    const result = await this.neo4jService.createNode('Knowledge', node);
    return result as KnowledgeNode;
  }

  async createRelation(relation: KnowledgeRelation): Promise<void> {
    if (this.useFallback) {
      this.fallbackEdges.push(relation);
      return;
    }

    await this.neo4jService.createRelation(
      'Knowledge',
      relation.fromId,
      relation.type,
      'Knowledge',
      relation.toId,
      { weight: relation.weight, description: relation.description },
    );
  }

  async getConcept(id: string): Promise<KnowledgeNode | null> {
    if (this.useFallback) {
      const exact = this.fallbackNodes.find((n) => n.id === id);
      if (exact) return exact;

      return (
        this.fallbackNodes.find(
          (n) =>
            n.id.startsWith(id) ||
            id.startsWith(n.id) ||
            n.id.replace(/_/g, '').toLowerCase() ===
              id.replace(/-/g, '').toLowerCase(),
        ) || null
      );
    }

    const result = await this.neo4jService.findNodeById('Knowledge', id);
    return result as KnowledgeNode | null;
  }

  async getAllConcepts(): Promise<KnowledgeNode[]> {
    if (this.useFallback) {
      return this.fallbackNodes;
    }

    const results = await this.neo4jService.findNodes('Knowledge', {});
    return results as KnowledgeNode[];
  }

  async getPrerequisites(conceptId: string): Promise<KnowledgeNode[]> {
    if (this.useFallback) {
      const prereqIds = this.fallbackEdges
        .filter(
          (e) =>
            e.toId === conceptId &&
            e.type === KnowledgeRelationType.PREREQUISITE,
        )
        .map((e) => e.fromId);
      return this.fallbackNodes.filter((n) => prereqIds.includes(n.id));
    }

    const results = await this.neo4jService.findRelatedNodes(
      'Knowledge',
      conceptId,
      KnowledgeRelationType.PREREQUISITE,
      'incoming',
    );
    return results as KnowledgeNode[];
  }

  async getDependentConcepts(conceptId: string): Promise<KnowledgeNode[]> {
    if (this.useFallback) {
      const depIds = this.fallbackEdges
        .filter(
          (e) =>
            e.fromId === conceptId &&
            e.type === KnowledgeRelationType.PREREQUISITE,
        )
        .map((e) => e.toId);
      return this.fallbackNodes.filter((n) => depIds.includes(n.id));
    }

    const results = await this.neo4jService.findRelatedNodes(
      'Knowledge',
      conceptId,
      KnowledgeRelationType.PREREQUISITE,
      'outgoing',
    );
    return results as KnowledgeNode[];
  }

  async getRelatedConcepts(conceptId: string): Promise<KnowledgeNode[]> {
    if (this.useFallback) {
      const relatedIds = this.fallbackEdges
        .filter(
          (e) =>
            (e.fromId === conceptId || e.toId === conceptId) &&
            e.type === KnowledgeRelationType.RELATED_TO,
        )
        .map((e) => (e.fromId === conceptId ? e.toId : e.fromId));
      return this.fallbackNodes.filter((n) => relatedIds.includes(n.id));
    }

    const results = await this.neo4jService.findRelatedNodes(
      'Knowledge',
      conceptId,
      KnowledgeRelationType.RELATED_TO,
      'both',
    );
    return results as KnowledgeNode[];
  }

  async getLearningPath(conceptId: string): Promise<LearningPath> {
    const concept = await this.getConcept(conceptId);
    if (!concept) {
      throw new NotFoundException(`Concept ${conceptId} not found`);
    }

    const visited = new Set<string>();
    const path: KnowledgeNode[] = [];
    await this.buildLearningPath(conceptId, path, visited);

    const prerequisites = await this.getPrerequisites(conceptId);

    return {
      conceptId,
      path,
      estimatedTime: path.length * 30,
      prerequisites,
    };
  }

  private async buildLearningPath(
    conceptId: string,
    path: KnowledgeNode[],
    visited: Set<string>,
  ): Promise<void> {
    if (visited.has(conceptId)) {
      return;
    }
    visited.add(conceptId);

    const prerequisites = await this.getPrerequisites(conceptId);
    for (const prereq of prerequisites) {
      if (prereq.id) {
        await this.buildLearningPath(prereq.id, path, visited);
      }
    }

    const concept = await this.getConcept(conceptId);
    if (concept) {
      path.push(concept);
    }
  }

  async searchConcepts(query: string): Promise<SearchResult[]> {
    if (this.useFallback) {
      const lowerQuery = query.toLowerCase();
      const results = this.fallbackNodes
        .filter(
          (n) =>
            n.name.toLowerCase().includes(lowerQuery) ||
            n.description.toLowerCase().includes(lowerQuery) ||
            n.tags?.some((t) => t.toLowerCase().includes(lowerQuery)),
        )
        .map((n) => ({
          name: n.name,
          type: n.type,
          description: n.description,
          score: this.calculateSearchScore(n, query),
          relatedCount: this.fallbackEdges.filter(
            (e) => e.fromId === n.id || e.toId === n.id,
          ).length,
          difficulty: n.difficulty,
        }));
      return results.sort((a, b) => b.score - a.score).slice(0, 10);
    }

    const cypher = `
      MATCH (n:Knowledge)
      WHERE n.name CONTAINS $query 
         OR n.description CONTAINS $query
         OR any(tag IN n.tags WHERE tag CONTAINS $query)
      OPTIONAL MATCH (n)-[r]-()
      WITH n, count(r) as relatedCount
      RETURN n.name as name, n.type as type, n.description as description, 
             n.difficulty as difficulty, relatedCount
    `;
    const results = await this.neo4jService.runQuery(cypher, { query });

    return results
      .map((r: any) => ({
        name: r.name,
        type: r.type,
        description: r.description,
        score: this.calculateSearchScore(
          { name: r.name, description: r.description },
          query,
        ),
        relatedCount: r.relatedCount || 0,
        difficulty: r.difficulty,
      }))
      .sort((a: SearchResult, b: SearchResult) => b.score - a.score)
      .slice(0, 10);
  }

  private calculateSearchScore(
    node: Partial<KnowledgeNode>,
    query: string,
  ): number {
    let score = 0;
    const lowerQuery = query.toLowerCase();

    if (node.name?.toLowerCase().includes(lowerQuery)) {
      score += 10;
      if (node.name.toLowerCase() === lowerQuery) {
        score += 5;
      }
    }

    if (node.description?.toLowerCase().includes(lowerQuery)) {
      score += 5;
    }

    if (node.tags?.some((t) => t.toLowerCase().includes(lowerQuery))) {
      score += 3;
    }

    return score;
  }

  async getConceptsByTag(tag: string): Promise<KnowledgeNode[]> {
    if (this.useFallback) {
      return this.fallbackNodes.filter((n) => n.tags?.includes(tag));
    }

    const cypher = `
      MATCH (n:Knowledge)
      WHERE $tag IN n.tags
      RETURN n
    `;
    const results = await this.neo4jService.runQuery(cypher, { tag });
    return results.map((r: any) => r.n || r) as KnowledgeNode[];
  }

  async getConceptsByDifficulty(
    difficulty: 'easy' | 'medium' | 'hard',
  ): Promise<KnowledgeNode[]> {
    if (this.useFallback) {
      return this.fallbackNodes.filter((n) => n.difficulty === difficulty);
    }

    const results = await this.neo4jService.findNodes('Knowledge', {
      difficulty,
    });
    return results as KnowledgeNode[];
  }

  async getKnowledgeGraph(): Promise<{
    nodes: KnowledgeNode[];
    edges: KnowledgeRelation[];
  }> {
    if (this.useFallback) {
      return { nodes: this.fallbackNodes, edges: this.fallbackEdges };
    }

    const nodes = await this.getAllConcepts();

    const edgesCypher = `
      MATCH (a:Knowledge)-[r]->(b:Knowledge)
      RETURN a.id as fromId, type(r) as type, b.id as toId, r.weight as weight, r.description as description
    `;
    const edgesResult = await this.neo4jService.runQuery(edgesCypher);

    const edges: KnowledgeRelation[] = edgesResult.map((r: any) => ({
      fromId: r.fromId,
      toId: r.toId,
      type: r.type as KnowledgeRelationType,
      weight: r.weight,
      description: r.description,
    }));

    return { nodes, edges };
  }

  async getConceptStrengths(conceptId: string): Promise<KnowledgeStrength[]> {
    if (this.useFallback) {
      return this.fallbackEdges
        .filter((e) => e.fromId === conceptId || e.toId === conceptId)
        .map((e) => ({
          conceptId: e.fromId === conceptId ? e.toId : e.fromId,
          name:
            this.fallbackNodes.find(
              (n) => n.id === (e.fromId === conceptId ? e.toId : e.fromId),
            )?.name || '',
          strength: e.weight || 0.5,
          relationType: e.type,
        }));
    }

    const cypher = `
      MATCH (a:Knowledge {id: $conceptId})-[r]-(b:Knowledge)
      RETURN b.id as conceptId, b.name as name, r.weight as strength, type(r) as relationType
    `;
    const results = await this.neo4jService.runQuery(cypher, { conceptId });

    return results.map((r: any) => ({
      conceptId: r.conceptId,
      name: r.name,
      strength: r.strength || 0.5,
      relationType: r.relationType,
    }));
  }

  async getRecommendations(
    conceptId: string,
    masteryLevel: number,
  ): Promise<ConceptRecommendation[]> {
    const concept = await this.getConcept(conceptId);
    if (!concept) return [];

    const recommendations: ConceptRecommendation[] = [];

    if (masteryLevel < 0.4) {
      const prereqs = await this.getPrerequisites(conceptId);
      for (const prereq of prereqs.slice(0, 3)) {
        recommendations.push({
          conceptId: prereq.id,
          name: prereq.name,
          reason: `巩固「${prereq.name}」有助于理解「${concept.name}」`,
          priority: 1,
          estimatedTime: 20,
        });
      }
    } else if (masteryLevel < 0.7) {
      recommendations.push({
        conceptId,
        name: concept.name,
        reason: '继续练习巩固当前知识点',
        priority: 2,
        estimatedTime: 15,
      });
    } else {
      const dependents = await this.getDependentConcepts(conceptId);
      for (const dep of dependents.slice(0, 3)) {
        recommendations.push({
          conceptId: dep.id,
          name: dep.name,
          reason: `已具备学习「${dep.name}」的基础`,
          priority: 3,
          estimatedTime: 30,
        });
      }
    }

    return recommendations.sort((a, b) => a.priority - b.priority);
  }

  isUsingFallback(): boolean {
    return this.useFallback;
  }

  async getCommonMistakes(
    query: string,
  ): Promise<{ mistake: string; tip: string }[]> {
    const mistakes: { mistake: string; tip: string }[] = [];
    // query 缺省时不能直接调用 toLowerCase()（会抛 500），
    // 且无关键词时应返回通用常见错误列表，供知识页「常见错误」面板展示
    const lowerQuery = (query ?? '').toString().trim().toLowerCase();

    const mistakeDatabase: Record<string, { mistake: string; tip: string }[]> =
      {
        极限: [
          {
            mistake: '混淆极限值与函数值',
            tip: '极限值是函数趋近的值，不一定是函数在该点的值',
          },
          { mistake: '忽略极限存在的条件', tip: '左右极限相等时极限才存在' },
          {
            mistake: '未定式直接代入',
            tip: '0/0或∞/∞型需要用洛必达法则或等价无穷小替换',
          },
          { mistake: '忽略极限的保号性', tip: '极限大于零则函数在附近大于零' },
          {
            mistake: '无穷小代换使用不当',
            tip: '只有乘除因子才能用等价无穷小代换，加减要谨慎',
          },
        ],
        导数: [
          {
            mistake: '混淆导数与函数值',
            tip: '导数表示变化率，不是函数值本身',
          },
          { mistake: '链式法则应用错误', tip: '复合函数求导要逐层求导并相乘' },
          { mistake: '忽略定义域', tip: '求导前要确认函数在定义域内可导' },
          { mistake: '隐函数求导遗漏项', tip: "对y求导要乘以y'" },
          {
            mistake: '极值点判断错误',
            tip: '导数为零不一定是极值点，需要进一步判断',
          },
        ],
        积分: [
          { mistake: '忘记积分常数C', tip: '不定积分必须加上常数C' },
          { mistake: '换元法忘记回代', tip: '换元积分后要换回原变量' },
          { mistake: '定积分上下限弄反', tip: '定积分下限小于上限时结果为正' },
          {
            mistake: '分部积分选错u和dv',
            tip: '按LIATE规则选择u（对数、反三角、代数、三角、指数）',
          },
          {
            mistake: '忽略被积函数的定义域',
            tip: '积分前要确认被积函数在积分区间内有定义',
          },
        ],
        limit: [
          {
            mistake: '混淆极限值与函数值',
            tip: '极限值是函数趋近的值，不一定是函数在该点的值',
          },
          { mistake: '忽略极限存在的条件', tip: '左右极限相等时极限才存在' },
        ],
        derivative: [
          {
            mistake: '混淆导数与函数值',
            tip: '导数表示变化率，不是函数值本身',
          },
          { mistake: '链式法则应用错误', tip: '复合函数求导要逐层求导并相乘' },
        ],
        integral: [
          { mistake: '忘记积分常数C', tip: '不定积分必须加上常数C' },
          { mistake: '换元法忘记回代', tip: '换元积分后要换回原变量' },
        ],
        洛必达: [
          {
            mistake: '非未定式使用洛必达',
            tip: '只有0/0或∞/∞型才能使用洛必达法则',
          },
          {
            mistake: '洛必达法则使用后未化简',
            tip: '每次使用洛必达后要检查是否仍为未定式',
          },
          {
            mistake: '忽略洛必达法则的条件',
            tip: '需要函数在邻域内可导且分母导数不为零',
          },
        ],
        泰勒: [
          { mistake: '泰勒展开阶数不够', tip: '展开阶数要满足精度要求' },
          { mistake: '忽略余项', tip: '泰勒展开要考虑余项的影响' },
          { mistake: '展开点选择错误', tip: '选择使计算最简单的展开点' },
        ],
        微分方程: [
          { mistake: '分离变量时遗漏情况', tip: '注意g(y)=0的情况' },
          { mistake: '常数C遗漏', tip: '通解必须包含任意常数' },
          { mistake: '初始条件使用错误', tip: '先求通解再代入初始条件' },
        ],
        级数: [
          { mistake: '混淆收敛与发散', tip: '级数收敛要求部分和极限存在' },
          { mistake: '忽略收敛域', tip: '幂级数要确定收敛半径和收敛域' },
          { mistake: '审敛法使用条件错误', tip: '每种审敛法都有适用条件' },
        ],
      };

    if (!lowerQuery) {
      for (const keywordMistakes of Object.values(mistakeDatabase)) {
        mistakes.push(...keywordMistakes);
      }
      return mistakes.slice(0, 10);
    }

    for (const [keyword, keywordMistakes] of Object.entries(mistakeDatabase)) {
      if (lowerQuery.includes(keyword.toLowerCase())) {
        mistakes.push(...keywordMistakes);
      }
    }

    return mistakes.slice(0, 5);
  }
}
