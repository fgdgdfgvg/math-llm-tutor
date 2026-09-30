// rule-engine.templates.ts - 规则引擎模板库 (200+模板)
// 覆盖高等数学各大领域的解题步骤模板和解题计划模板

// ============================================
// 第一步：题目分类模式
// ============================================
export interface ProblemClassificationPattern {
  category: string;
  subcategory: string;
  patterns: string[];
  priority: number;
}

export const CLASSIFICATION_PATTERNS: ProblemClassificationPattern[] = [
  // === 极限 (34 patterns) ===
  { category: 'limit', subcategory: 'rational-function', patterns: ['有理函数', '多项式之比', '分式'], priority: 1 },
  { category: 'limit', subcategory: 'lhopital', patterns: ['洛必达', 'L\'Hôpital', 'lhopital', '不定式', '0/0', '∞/∞'], priority: 1 },
  { category: 'limit', subcategory: 'important-limit', patterns: ['sin(x)/x', '(1+1/x)^x', '重要极限', '(1+x)^{1/x}'], priority: 1 },
  { category: 'limit', subcategory: 'equivalent-infinitesimal', patterns: ['等价无穷小', '无穷小替换', '〜'], priority: 2 },
  { category: 'limit', subcategory: 'taylor-expansion', patterns: ['泰勒展开', 'Taylor', '麦克劳林', 'Maclaurin'], priority: 2 },
  { category: 'limit', subcategory: 'squeeze-theorem', patterns: ['夹逼定理', '夹逼', 'squeeze', '迫敛'], priority: 2 },
  { category: 'limit', subcategory: 'infinity', patterns: ['x→∞', 'n→∞', '无穷大', '∞'], priority: 1 },
  { category: 'limit', subcategory: 'one-sided', patterns: ['左极限', '右极限', '单侧', 'x→0+', 'x→0-', 'x→a+', 'x→a-'], priority: 2 },
  { category: 'limit', subcategory: 'sequence', patterns: ['数列极限', '数列', 'sequence', '单调有界'], priority: 2 },
  { category: 'limit', subcategory: 'stolz', patterns: ['Stolz', '施托尔茨', '施笃兹', '∞/∞型数列'], priority: 3 },
  { category: 'limit', subcategory: 'continuity', patterns: ['连续', '间断点', '连续性', '跳跃间断', '可去间断'], priority: 2 },
  { category: 'limit', subcategory: 'infinity-comparison', patterns: ['无穷大的阶', '无穷小比较', '高阶无穷小', '低阶无穷小'], priority: 2 },
  { category: 'limit', subcategory: 'piecewise', patterns: ['分段函数', '分段极限', '左右极限不等'], priority: 2 },
  { category: 'limit', subcategory: 'root-form', patterns: ['根式', '√', '有理化', '共轭'], priority: 2 },
  { category: 'limit', subcategory: 'trigonometric', patterns: ['三角极限', 'sin', 'cos', 'tan', 'cot', 'sec', 'csc'], priority: 1 },
  { category: 'limit', subcategory: 'exponential-log', patterns: ['指数极限', '对数极限', 'e^', 'ln', 'log', 'a^'], priority: 2 },
  { category: 'limit', subcategory: 'inf-power', patterns: ['1^∞', '幂指函数', '1的无穷大次方'], priority: 2 },
  { category: 'limit', subcategory: 'definite-integral-limit', patterns: ['定积分定义求极限', '黎曼和', '∑→∫'], priority: 3 },

  // === 导数与微分 (32 patterns) ===
  { category: 'derivative', subcategory: 'basic-power', patterns: ['幂函数求导', 'x^n', '幂法则', 'power rule'], priority: 1 },
  { category: 'derivative', subcategory: 'chain-rule', patterns: ['链式法则', 'chain rule', '复合函数', 'f(g(x))'], priority: 1 },
  { category: 'derivative', subcategory: 'product-rule', patterns: ['乘积法则', 'product rule', 'f·g', 'f*g', 'uv'], priority: 1 },
  { category: 'derivative', subcategory: 'quotient-rule', patterns: ['商法则', 'quotient rule', 'f/g', '分式求导'], priority: 1 },
  { category: 'derivative', subcategory: 'trigonometric', patterns: ['sin', 'cos', 'tan', 'cot', 'sec', 'csc', '三角求导'], priority: 1 },
  { category: 'derivative', subcategory: 'inverse-trig', patterns: ['arcsin', 'arccos', 'arctan', '反三角求导'], priority: 2 },
  { category: 'derivative', subcategory: 'exponential', patterns: ['e^', 'a^', '指数函数求导'], priority: 1 },
  { category: 'derivative', subcategory: 'logarithmic', patterns: ['ln', 'log', '对数求导'], priority: 1 },
  { category: 'derivative', subcategory: 'implicit', patterns: ['隐函数', 'implicit', 'F(x,y)=0', '隐函数求导'], priority: 2 },
  { category: 'derivative', subcategory: 'parametric', patterns: ['参数方程', '显式参数', 'x(t)', 'y(t)'], priority: 2 },
  { category: 'derivative', subcategory: 'higher-order', patterns: ['高阶导数', 'y\'\'', 'f\'\'', 'n阶导数', '二阶导数'], priority: 2 },
  { category: 'derivative', subcategory: 'logarithmic-diff', patterns: ['对数求导法', '取对数', '两边取ln'], priority: 2 },
  { category: 'derivative', subcategory: 'mean-value-theorem', patterns: ['中值定理', '罗尔定理', '拉格朗日', '柯西中值', 'mean value'], priority: 2 },
  { category: 'derivative', subcategory: 'tangent-normal', patterns: ['切线', '法线', '切线方程', '法线方程', '切点'], priority: 1 },
  { category: 'derivative', subcategory: 'monotonicity', patterns: ['单调性', '递增', '递减', '极值', '单调区间'], priority: 1 },
  { category: 'derivative', subcategory: 'extreme-values', patterns: ['极值', '极大值', '极小值', '最大值', '最小值', '最值'], priority: 1 },
  { category: 'derivative', subcategory: 'concavity', patterns: ['凹凸性', '凸函数', '凹函数', '拐点', 'inflection'], priority: 2 },
  { category: 'derivative', subcategory: 'asymptotes', patterns: ['渐近线', '水平渐近', '垂直渐近', '斜渐近'], priority: 2 },
  { category: 'derivative', subcategory: 'curvature', patterns: ['曲率', '曲率半径', 'curvature', '弧微分'], priority: 3 },
  { category: 'derivative', subcategory: 'lhospital', patterns: ['洛必达法则', "L'Hôpital", '0/0型', '∞/∞型'], priority: 2 },
  { category: 'derivative', subcategory: 'taylor-polynomial', patterns: ['泰勒多项式', 'Taylor多项式', '近似'], priority: 3 },
  { category: 'derivative', subcategory: 'related-rates', patterns: ['相关变化率', 'related rates', '变化率'], priority: 3 },

  // === 积分 (35 patterns) ===
  { category: 'integral', subcategory: 'basic-power', patterns: ['x^n', '幂函数积分', '∫x^n'], priority: 1 },
  { category: 'integral', subcategory: 'substitution', patterns: ['换元法', 'substitution', 'u=', '变量替换', '凑微分'], priority: 1 },
  { category: 'integral', subcategory: 'integration-by-parts', patterns: ['分部积分', '∫udv', 'by parts', '分部积分法'], priority: 1 },
  { category: 'integral', subcategory: 'trigonometric', patterns: ['sin', 'cos', 'tan', 'cot', 'sec', 'csc', '三角积分'], priority: 1 },
  { category: 'integral', subcategory: 'rational-function', patterns: ['有理函数积分', '部分分式', 'partial fraction', '真分式'], priority: 2 },
  { category: 'integral', subcategory: 'trig-substitution', patterns: ['三角换元', '√(a²-x²)', '√(a²+x²)', '√(x²-a²)'], priority: 2 },
  { category: 'integral', subcategory: 'exponential', patterns: ['e^', 'a^', '指数函数积分'], priority: 1 },
  { category: 'integral', subcategory: 'logarithmic', patterns: ['ln', 'log', '对数函数积分'], priority: 2 },
  { category: 'integral', subcategory: 'definite', patterns: ['定积分', '∫_a^b', 'definite integral', 'N-L公式'], priority: 1 },
  { category: 'integral', subcategory: 'improper', patterns: ['反常积分', '瑕积分', '无穷限', 'improper', '发散', '收敛'], priority: 2 },
  { category: 'integral', subcategory: 'area', patterns: ['面积', '平面图形面积', '曲线围成'], priority: 2 },
  { category: 'integral', subcategory: 'volume', patterns: ['体积', '旋转体', '截面', '体积元素'], priority: 2 },
  { category: 'integral', subcategory: 'arc-length', patterns: ['弧长', 's=', 'ds', '曲线弧长'], priority: 3 },
  { category: 'integral', subcategory: 'surface-area', patterns: ['旋转曲面面积', '侧面积', 'surface area'], priority: 3 },
  { category: 'integral', subcategory: 'work', patterns: ['功', '做功', '变力做功'], priority: 3 },
  { category: 'integral', subcategory: 'center-of-mass', patterns: ['质心', '形心', '重心', 'center of mass'], priority: 3 },
  { category: 'integral', subcategory: 'odd-even', patterns: ['奇偶性', '对称区间', '奇函数积分', '偶函数积分'], priority: 2 },
  { category: 'integral', subcategory: 'periodic', patterns: ['周期函数积分', '周期'], priority: 3 },
  { category: 'integral', subcategory: 'wallis', patterns: ['Wallis', 'sin^n', 'cos^n', '华里士'], priority: 3 },
  { category: 'integral', subcategory: 'reduction', patterns: ['递推公式', '降次', '归纳'], priority: 3 },

  // === 微分方程 (18 patterns) ===
  { category: 'diff-equation', subcategory: 'separable', patterns: ['可分离', '分离变量', 'separable', 'dy/dx=f(x)g(y)'], priority: 1 },
  { category: 'diff-equation', subcategory: 'first-order-linear', patterns: ['一阶线性', 'y\'+P(x)y=Q(x)', '常数变易'], priority: 1 },
  { category: 'diff-equation', subcategory: 'exact', patterns: ['全微分方程', '恰当方程', 'exact', 'Mdx+Ndy=0'], priority: 2 },
  { category: 'diff-equation', subcategory: 'integrating-factor', patterns: ['积分因子', 'integrating factor'], priority: 3 },
  { category: 'diff-equation', subcategory: 'bernoulli', patterns: ['伯努利方程', 'Bernoulli', "y'+Py=Qy^n"], priority: 2 },
  { category: 'diff-equation', subcategory: 'homogeneous', patterns: ['齐次方程', '齐次', 'homogeneous', 'dy/dx=f(y/x)'], priority: 2 },
  { category: 'diff-equation', subcategory: 'second-order-constant', patterns: ['二阶常系数', 'y\'\'+py\'+qy=0', '特征方程', '特征根'], priority: 1 },
  { category: 'diff-equation', subcategory: 'second-order-nonhomogeneous', patterns: ['非齐次', '特解', '待定系数法', '非齐次项'], priority: 2 },
  { category: 'diff-equation', subcategory: 'variation-of-parameters', patterns: ['常数变易法', 'variation of parameters'], priority: 3 },
  { category: 'diff-equation', subcategory: 'euler', patterns: ['欧拉方程', 'Euler方程', 'x²y\'\'+axy\'+by=0'], priority: 3 },
  { category: 'diff-equation', subcategory: 'laplace', patterns: ['拉普拉斯变换', 'Laplace', 'ℒ', 's域'], priority: 2 },
  { category: 'diff-equation', subcategory: 'series-solution', patterns: ['级数解法', '幂级数解'], priority: 3 },
  { category: 'diff-equation', subcategory: 'system', patterns: ['微分方程组', '方程组', 'system of ODE'], priority: 3 },
  { category: 'diff-equation', subcategory: 'applications', patterns: ['应用', '冷却', '人口', '弹簧', '振动', '电路'], priority: 3 },
  { category: 'diff-equation', subcategory: 'riccati', patterns: ['Riccati', '黎卡提', "y'=P(x)y²+Q(x)y+R(x)"], priority: 3 },
  { category: 'diff-equation', subcategory: 'clairaut', patterns: ['Clairaut', '克莱罗'], priority: 3 },
  { category: 'diff-equation', subcategory: 'reduction-order', patterns: ['降阶法', '降阶', 'reduction of order'], priority: 2 },

  // === 无穷级数 (20 patterns) ===
  { category: 'series', subcategory: 'geometric', patterns: ['等比级数', '几何级数', 'geometric', 'a·r^n'], priority: 1 },
  { category: 'series', subcategory: 'p-series', patterns: ['p级数', '调和级数', 'Σ1/n^p', 'p-series'], priority: 1 },
  { category: 'series', subcategory: 'comparison-test', patterns: ['比较判别法', '比较法', 'comparison test'], priority: 1 },
  { category: 'series', subcategory: 'limit-comparison', patterns: ['极限比较', 'limit comparison'], priority: 2 },
  { category: 'series', subcategory: 'ratio-test', patterns: ['比值判别法', 'D\'Alembert', '达朗贝尔', 'ratio test', 'lim|a_{n+1}/a_n|'], priority: 1 },
  { category: 'series', subcategory: 'root-test', patterns: ['根值判别法', '柯西判别法', 'root test', 'lim√[n](|a_n|)'], priority: 2 },
  { category: 'series', subcategory: 'integral-test', patterns: ['积分判别法', 'integral test', '反常积分解'], priority: 2 },
  { category: 'series', subcategory: 'alternating', patterns: ['交错级数', 'alternating', '莱布尼茨', '(-1)^n', '(-1)^{n-1}'], priority: 1 },
  { category: 'series', subcategory: 'absolute-convergence', patterns: ['绝对收敛', '条件收敛', 'absolute convergence'], priority: 2 },
  { category: 'series', subcategory: 'power-series', patterns: ['幂级数', 'Σa_n(x-a)^n', 'power series', '收敛半径', '收敛区间'], priority: 1 },
  { category: 'series', subcategory: 'taylor', patterns: ['泰勒级数', 'Taylor series', 'Σf^{(n)}(a)/n!·(x-a)^n', 'expanded'], priority: 1 },
  { category: 'series', subcategory: 'maclaurin', patterns: ['麦克劳林', 'Maclaurin', 'a=0', 'x=0展开'], priority: 1 },
  { category: 'series', subcategory: 'fourier', patterns: ['傅里叶级数', 'Fourier', '三角级数', 'a_0/2+Σ'], priority: 2 },
  { category: 'series', subcategory: 'summation', patterns: ['级数求和', '求和', '级数和'], priority: 2 },
  { category: 'series', subcategory: 'function-expansion', patterns: ['函数展开', '展开为级数', '展开成'], priority: 2 },
  { category: 'series', subcategory: 'convergence-radius', patterns: ['收敛半径', '收敛域', 'radius of convergence'], priority: 1 },
  { category: 'series', subcategory: 'termwise-diff', patterns: ['逐项求导', '逐项微分', 'term-by-term differentiation'], priority: 3 },
  { category: 'series', subcategory: 'termwise-integration', patterns: ['逐项积分', 'term-by-term integration'], priority: 3 },
  { category: 'series', subcategory: 'abeI', patterns: ['Abel定理', '阿贝尔定理'], priority: 3 },
  { category: 'series', subcategory: 'dirichlet', patterns: ['Dirichlet判别法', '狄利克雷'], priority: 3 },

  // === 多元微积分 (18 patterns) ===
  { category: 'multivariable', subcategory: 'partial-derivative', patterns: ['偏导数', '∂f/∂x', 'partial derivative', '∂'], priority: 1 },
  { category: 'multivariable', subcategory: 'total-differential', patterns: ['全微分', 'dz=∂f/∂x·dx+∂f/∂y·dy', 'total differential'], priority: 1 },
  { category: 'multivariable', subcategory: 'chain-rule-multi', patterns: ['多元链式法则', '∂z/∂t', 'chain rule'], priority: 2 },
  { category: 'multivariable', subcategory: 'directional-derivative', patterns: ['方向导数', '∂f/∂⃗u', '梯度·方向', 'gradient', '∇'], priority: 2 },
  { category: 'multivariable', subcategory: 'gradient', patterns: ['梯度', '∇f', 'grad', 'gradient vector'], priority: 2 },
  { category: 'multivariable', subcategory: 'tangent-plane', patterns: ['切平面', '法向量', 'tangent plane', 'normal vector'], priority: 2 },
  { category: 'multivariable', subcategory: 'extreme-multi', patterns: ['多元极值', '驻点', '鞍点', 'Hessian', '黑塞矩阵'], priority: 2 },
  { category: 'multivariable', subcategory: 'lagrange', patterns: ['拉格朗日乘子', 'Lagrange multiplier', '条件极值', '约束'], priority: 2 },
  { category: 'multivariable', subcategory: 'double-integral', patterns: ['二重积分', '∬', 'double integral', '累次积分'], priority: 1 },
  { category: 'multivariable', subcategory: 'double-polar', patterns: ['极坐标二重积分', 'rdrdθ', 'polar'], priority: 2 },
  { category: 'multivariable', subcategory: 'triple-integral', patterns: ['三重积分', '∭', 'triple integral'], priority: 2 },
  { category: 'multivariable', subcategory: 'triple-cylindrical', patterns: ['柱坐标', 'cylindrical', 'ρ,φ,z'], priority: 2 },
  { category: 'multivariable', subcategory: 'triple-spherical', patterns: ['球坐标', 'spherical', 'r,θ,φ'], priority: 3 },
  { category: 'multivariable', subcategory: 'jacobian', patterns: ['雅可比', 'Jacobian', '∂(x,y)/∂(u,v)', '坐标变换'], priority: 2 },
  { category: 'multivariable', subcategory: 'implicit-function-theorem', patterns: ['隐函数定理', '隐函数存在定理', '∂y/∂x=-F_x/F_y'], priority: 3 },
  { category: 'multivariable', subcategory: 'line-integral', patterns: ['曲线积分', '∮', 'line integral', '第一类曲线', '第二类曲线'], priority: 2 },
  { category: 'multivariable', subcategory: 'surface-integral', patterns: ['曲面积分', 'surface integral', '第一类曲面', '第二类曲面'], priority: 2 },
  { category: 'multivariable', subcategory: 'green-gauss-stokes', patterns: ['格林公式', '高斯公式', '斯托克斯公式', 'Green', 'Gauss', 'Stokes'], priority: 2 },

  // === 向量与空间解析几何 (16 patterns) ===
  { category: 'vector-geometry', subcategory: 'vector-operations', patterns: ['向量', '⃗', 'vector', '矢量', '模', '单位向量'], priority: 1 },
  { category: 'vector-geometry', subcategory: 'dot-product', patterns: ['点积', '内积', 'dot product', '⃗a·⃗b', '数量积'], priority: 1 },
  { category: 'vector-geometry', subcategory: 'cross-product', patterns: ['叉积', '外积', 'cross product', '⃗a×⃗b', '向量积'], priority: 1 },
  { category: 'vector-geometry', subcategory: 'mixed-product', patterns: ['混合积', '(⃗a×⃗b)·⃗c', 'scalar triple'], priority: 2 },
  { category: 'vector-geometry', subcategory: 'line-equation', patterns: ['直线方程', '点向式', '参数方程', '对称式'], priority: 1 },
  { category: 'vector-geometry', subcategory: 'plane-equation', patterns: ['平面方程', '点法式', '一般式', 'Ax+By+Cz+D=0'], priority: 1 },
  { category: 'vector-geometry', subcategory: 'distance', patterns: ['距离', '点到直线', '点到平面', '异面直线'], priority: 2 },
  { category: 'vector-geometry', subcategory: 'angle', patterns: ['夹角', 'angle', '直线夹角', '平面夹角', '线面角'], priority: 2 },
  { category: 'vector-geometry', subcategory: 'intersection', patterns: ['交点', '交线', '联合方程'], priority: 2 },
  { category: 'vector-geometry', subcategory: 'surfaces', patterns: ['曲面方程', '二次曲面', '旋转曲面', '柱面', '锥面'], priority: 2 },
  { category: 'vector-geometry', subcategory: 'quadric-surfaces', patterns: ['椭球面', '抛物面', '双曲面', '椭圆抛物面'], priority: 3 },
  { category: 'vector-geometry', subcategory: 'space-curves', patterns: ['空间曲线', '参数曲线', '螺线', 'helix'], priority: 3 },
  { category: 'vector-geometry', subcategory: 'projection', patterns: ['投影', 'projection', '正交投影'], priority: 2 },
  { category: 'vector-geometry', subcategory: 'coplanarity', patterns: ['共面', 'coplanar', '混合积=0'], priority: 3 },
  { category: 'vector-geometry', subcategory: 'parallel-perpendicular', patterns: ['平行', '垂直', 'parallel', 'perpendicular', '正交'], priority: 1 },
  { category: 'vector-geometry', subcategory: 'coordinate-transformation', patterns: ['坐标变换', '平移', '旋转', 'coordinate'], priority: 3 },

  // === 线性代数 (16 patterns) ===
  { category: 'linear-algebra', subcategory: 'matrix-operations', patterns: ['矩阵', 'matrix', '加法', '数乘', '矩阵乘'], priority: 1 },
  { category: 'linear-algebra', subcategory: 'determinant', patterns: ['行列式', 'det', 'determinant', '|A|'], priority: 1 },
  { category: 'linear-algebra', subcategory: 'inverse-matrix', patterns: ['逆矩阵', 'A^{-1}', '伴随矩阵', 'inverse'], priority: 1 },
  { category: 'linear-algebra', subcategory: 'rank', patterns: ['秩', 'rank', '行秩', '列秩', '秩的不等式'], priority: 2 },
  { category: 'linear-algebra', subcategory: 'linear-system', patterns: ['线性方程组', 'Ax=b', '解的结构', '基础解系'], priority: 1 },
  { category: 'linear-algebra', subcategory: 'eigenvalue', patterns: ['特征值', '特征向量', 'eigenvalue', 'eigenvector', 'det(A-λI)=0'], priority: 1 },
  { category: 'linear-algebra', subcategory: 'diagonalization', patterns: ['对角化', 'diagonalization', 'P^{-1}AP', '可对角化'], priority: 2 },
  { category: 'linear-algebra', subcategory: 'orthogonalization', patterns: ['Gram-Schmidt', '正交化', '施密特', '标准正交基'], priority: 2 },
  { category: 'linear-algebra', subcategory: 'quadratic-form', patterns: ['二次型', 'quadratic form', '正定', '合同', '标准形', '规范形'], priority: 2 },
  { category: 'linear-algebra', subcategory: 'linear-dependence', patterns: ['线性相关', '线性无关', '线性组合', '线性表出'], priority: 2 },
  { category: 'linear-algebra', subcategory: 'basis-dimension', patterns: ['基', '维数', 'basis', 'dimension', '坐标'], priority: 2 },
  { category: 'linear-algebra', subcategory: 'linear-transformation', patterns: ['线性变换', 'linear transformation', '核', '像', 'kernel'], priority: 2 },
  { category: 'linear-algebra', subcategory: 'inner-product', patterns: ['内积空间', 'inner product', '正交补', ',,⟨,⟩'], priority: 3 },
  { category: 'linear-algebra', subcategory: 'jordan', patterns: ['Jordan标准形', '若尔当'], priority: 3 },
  { category: 'linear-algebra', subcategory: 'svd', patterns: ['SVD', '奇异值分解', 'singular value'], priority: 3 },
  { category: 'linear-algebra', subcategory: 'cramer', patterns: ['克拉默法则', "Cramer's rule"], priority: 2 },
];

// ============================================
// 第二步：解题步骤模板 (用于 solver.agent.ts)
// ============================================
export interface StepTemplate {
  title: string;
  keyPoint: string;
  formula: string;
  process: string;
  highlight: string;
}

export interface RuleStepTemplates {
  category: string;
  subcategory: string;
  templates: StepTemplate[];
}

export const RULE_STEP_TEMPLATES: RuleStepTemplates[] = [
  // === 极限 (20组) ===
  {
    category: 'limit', subcategory: 'rational-function',
    templates: [
      { title: '分析函数结构', keyPoint: '函数结构分析', formula: '', process: '识别分子分母的多项式次数，确定极限类型', highlight: '分子分母的最高次项决定了x→∞时的极限值' },
      { title: '提取最高次项', keyPoint: '提取公因子', formula: '\\frac{a_nx^n+\\cdots}{b_mx^m+\\cdots}=x^{n-m}\\cdot\\frac{a_n+\\cdots}{b_m+\\cdots}', process: '分子分母同时除以x的最高次幂', highlight: '确保提取后的分式在x→∞时有明确极限' },
      { title: '计算极限值', keyPoint: '极限计算', formula: '', process: '令x→∞，确定极限值（有限/无穷大/不存在）', highlight: '当分子次数<分母次数时极限为0，相等时为系数比，大于时为无穷大' },
    ],
  },
  {
    category: 'limit', subcategory: 'lhopital',
    templates: [
      { title: '验证不定式条件', keyPoint: '洛必达使用条件', formula: '', process: '代入趋近值验证是否为0/0型或∞/∞型不定式', highlight: '洛必达法则仅适用于0/0或∞/∞不定式，其他类型需先转化为这两种形式' },
      { title: '分子分母分别求导', keyPoint: '洛必达法则应用', formula: '\\lim_{x\\to a}\\frac{f(x)}{g(x)}=\\lim_{x\\to a}\\frac{f\'(x)}{g\'(x)}', process: '对分子分母分别求导（不是商的导数！）', highlight: '注意这是分别求导，不要误用商法则' },
      { title: '重复应用直到可求值', keyPoint: '迭代求解', formula: '', process: '若求导后仍为不定式，可重复使用洛必达法则', highlight: '每次使用后都要重新验证是否仍为不定式' },
    ],
  },
  {
    category: 'limit', subcategory: 'important-limit',
    templates: [
      { title: '识别重要极限类型', keyPoint: '重要极限公式', formula: '\\lim_{x\\to 0}\\frac{\\sin x}{x}=1,\\quad\\lim_{x\\to\\infty}(1+\\frac{1}{x})^x=e', process: '判断表达式是否与两个重要极限形式相似', highlight: '注意自变量趋近的方向和表达式结构必须严格匹配' },
      { title: '变量代换化为标准形', keyPoint: '变量代换', formula: '', process: '通过变量代换将表达式化为标准重要极限形式', highlight: '代换时必须注意新变量的趋近方向' },
      { title: '应用重要极限公式', keyPoint: '公式应用', formula: '', process: '直接应用重要极限公式得出结果', highlight: '系数不匹配时需要额外处理' },
    ],
  },
  {
    category: 'limit', subcategory: 'equivalent-infinitesimal',
    templates: [
      { title: '识别无穷小', keyPoint: '无穷小识别', formula: '', process: '确定x的趋近值，找出哪些函数趋近于0', highlight: '等价无穷小替换只能在乘除中使用，不能在加减中直接替换' },
      { title: '应用等价替换', keyPoint: '等价替换公式', formula: '\\sin x\\sim x,\\ \\tan x\\sim x,\\ 1-\\cos x\\sim\\frac{x^2}{2},\\ e^x-1\\sim x,\\ \\ln(1+x)\\sim x', process: '用等价无穷小替换相关表达式', highlight: '不同阶的无穷小不能互相替换，需要注意阶的匹配' },
      { title: '化简计算', keyPoint: '化简求极限', formula: '', process: '替换后化简表达式并计算极限', highlight: '替换后检查是否有遗漏的无穷小量' },
    ],
  },
  {
    category: 'limit', subcategory: 'taylor-expansion',
    templates: [
      { title: '选择展开阶数', keyPoint: '泰勒展开策略', formula: '', process: '根据表达式结构确定需要的展开阶数', highlight: '展开阶数一般取到足以消除不定式为止' },
      { title: '写出泰勒展开', keyPoint: '常见函数的泰勒展开', formula: 'e^x=1+x+\\frac{x^2}{2!}+\\cdots,\\ \\sin x=x-\\frac{x^3}{3!}+\\cdots,\\ \\cos x=1-\\frac{x^2}{2!}+\\cdots', process: '将各函数展开到选定阶数', highlight: '注意保留足够阶数，否则误差可能影响结果' },
      { title: '代入化简求极限', keyPoint: '展开式化简', formula: '', process: '代入泰勒展开式，合并同阶项，求极限', highlight: '高阶无穷小项可以忽略' },
    ],
  },
  {
    category: 'limit', subcategory: 'squeeze-theorem',
    templates: [
      { title: '构造上下界', keyPoint: '夹逼不等式', formula: '', process: '利用不等式性质构造比原数列/函数小的下界和比原数列/函数大的上界', highlight: '上下界必须在目标点有相同的极限' },
      { title: '计算上下界极限', keyPoint: '边界极限计算', formula: 'g(x)\\le f(x)\\le h(x),\\ \\lim g(x)=\\lim h(x)=L\\Rightarrow\\lim f(x)=L', process: '分别计算上下界的极限', highlight: '上下界应该尽量简单，便于计算极限' },
      { title: '根据夹逼定理得结论', keyPoint: '夹逼定理结论', formula: '', process: '由夹逼定理，原函数的极限等于上下界的共同极限', highlight: '这是处理含三角函数振荡问题的典型方法' },
    ],
  },
  {
    category: 'limit', subcategory: 'infinity',
    templates: [
      { title: '分析无穷大比较', keyPoint: '无穷大阶比较', formula: '', process: '比较分子分母的无穷大阶，确定极限类型（∞/∞或确定）', highlight: '指数函数增长最快，然后是幂函数，对数函数增长最慢' },
      { title: '提取最高阶', keyPoint: '提取主导项', formula: '', process: '在分子分母中提取增长速度最快的项', highlight: '提取后非主导项将趋近于0' },
      { title: '计算最终极限', keyPoint: '极限值', formula: '', process: '计算化简后的极限', highlight: '检查是否有特殊情况需要额外处理' },
    ],
  },
  {
    category: 'limit', subcategory: 'one-sided',
    templates: [
      { title: '分析左右侧趋近方向', keyPoint: '单侧极限定义', formula: '\\lim_{x\\to a^+}f(x),\\quad\\lim_{x\\to a^-}f(x)', process: '明确计算左极限还是右极限，注意符号变化', highlight: ' |x| 类函数在x=0处左右极限不同，需要格外注意' },
      { title: '代入趋近值', keyPoint: '单侧代入', formula: '', process: '根据趋近侧确定变量的符号和绝对值表达式', highlight: '左右侧可能影响表达式中绝对值和分段函数的取值' },
      { title: '若左右极限不等则极限不存在', keyPoint: '极限存在判定', formula: '', process: '比较左右极限，若不等则极限不存在', highlight: '这是判断跳跃间断点的核心方法' },
    ],
  },
  {
    category: 'limit', subcategory: 'sequence',
    templates: [
      { title: '分析数列形式', keyPoint: '数列极限特征', formula: '', process: '识别数列通项公式的类型和复杂度', highlight: '常考类型：递推数列、有界数列×无穷小数列' },
      { title: '使用数列极限方法', keyPoint: '数列方法选择', formula: '\\lim_{n\\to\\infty}a_n = L', process: '单调有界→收敛；夹逼定理；Stolz定理；或转化为函数极限', highlight: '函数极限的结论可以推广到数列极限（海涅定理）' },
      { title: '得出结论', keyPoint: '数列收敛判断', formula: '', process: '给出数列极限值或判断发散', highlight: '注意数列极限与函数极限的联系与区别' },
    ],
  },
  {
    category: 'limit', subcategory: 'continuity',
    templates: [
      { title: '检查三个连续条件', keyPoint: '连续定义验证', formula: '\\lim_{x\\to a}f(x)=f(a)', process: '逐一验证：①f(a)有定义 ②极限存在 ③极限值=f(a)', highlight: '三个条件缺一不可，任一条件不满足即为间断点' },
      { title: '间断点分类', keyPoint: '间断点类型', formula: '', process: '根据左右极限的情况判断间断类型（可去/跳跃/无穷/振荡）', highlight: '第一类间断点：左右极限均存在；第二类：至少一个不存在' },
      { title: '参数求解/结论得出', keyPoint: '连续性应用', formula: '', process: '求使函数连续的参数值，或给出间断分析结论', highlight: '分段函数在分界点的连续性是典型考点' },
    ],
  },

  // === 导数 (18组) ===
  {
    category: 'derivative', subcategory: 'basic-power',
    templates: [
      { title: '应用幂法则', keyPoint: '幂法则 (Power Rule)', formula: '\\frac{d}{dx}(x^n)=nx^{n-1}', process: '将指数作为系数，指数减1', highlight: '适用于任意实数指数n（正整数/负整数/分数/无理数）' },
      { title: '处理系数和常数项', keyPoint: '线性性质', formula: '\\frac{d}{dx}(cf(x))=c\\frac{d}{dx}f(x)', process: '常系数保留，常数项导数为0', highlight: '常数项的导数为0，不要遗漏' },
      { title: '输出导函数', keyPoint: '结果化简', formula: '', process: '合并同类项，化简导函数', highlight: '注意符号和系数的准确性' },
    ],
  },
  {
    category: 'derivative', subcategory: 'chain-rule',
    templates: [
      { title: '识别内外函数', keyPoint: '复合函数拆解', formula: '', process: '设外层函数f和内层函数g，使得原函数=f(g(x))', highlight: '正确识别内外层函数是链式法则正确应用的前提' },
      { title: '分别求内外函数导数', keyPoint: '分类求导', formula: 'f\'(g(x))\\cdot g\'(x)', process: '先对外层函数求导（保留内层），再对内层函数求导，相乘', highlight: '外导乘内导，逻辑是：先外后内，逐层递进' },
      { title: '若有更多层继续', keyPoint: '多层链式法则', formula: '(f(g(h(x))))\'=f\'(g(h(x)))\\cdot g\'(h(x))\\cdot h\'(x)', process: '从最外层开始，逐层向内，每层导数的自变量是内层整体', highlight: '多层复合需逐层链式法则，每一步都不能遗漏' },
    ],
  },
  {
    category: 'derivative', subcategory: 'product-rule',
    templates: [
      { title: '分解为两个函数', keyPoint: '函数分解', formula: '', process: '将原函数表示为 u·v 的形式，明确u和v各是什么', highlight: '如果多于两个因子相乘，可先两两分组再用乘积法则' },
      { title: '分别求u\'和v\'', keyPoint: '求导', formula: '', process: '单独计算u的导数和v的导数', highlight: '这里的求导可能还需要链式法则' },
      { title: '应用乘积法则公式', keyPoint: '乘积法则', formula: '(uv)\'=u\'v+uv\'', process: '第一个函数导数乘以第二个函数，加上第一个函数乘以第二个函数导数', highlight: '两项的顺序可以互换，但不要遗漏其中一项' },
    ],
  },
  {
    category: 'derivative', subcategory: 'quotient-rule',
    templates: [
      { title: '确定分子分母', keyPoint: '函数分解', formula: '', process: '明确分子函数u(x)和分母函数v(x)', highlight: '商法则应用前确认分母不为0' },
      { title: '计算u\'和v\'', keyPoint: '求导', formula: '', process: '分别计算分子和分母的导数', highlight: '注意v\'的计算可能需要链式法则' },
      { title: '代入商法则公式', keyPoint: '商法则', formula: '\\left(\\frac{u}{v}\\right)\'=\\frac{u\'v-uv\'}{v^2}', process: '分子：u\'v - uv\'，分母：v²', highlight: '记住口诀：上导下不导，减上不导下导，除以分母平方' },
    ],
  },
  {
    category: 'derivative', subcategory: 'trigonometric',
    templates: [
      { title: '匹配三角求导公式', keyPoint: '三角基本公式', formula: '(\\sin x)\'=\\cos x,\\ (\\cos x)\'=-\\sin x,\\ (\\tan x)\'=\\sec^2 x', process: '根据函数类型匹配对应的基本求导公式', highlight: 'sin→cos不变号，cos→sin要变号，tan→sec²' },
      { title: '复合三角函数的链式法则', keyPoint: '复合三角求导', formula: '', process: '若三角函数内嵌套其他函数，需使用链式法则', highlight: '如 (sin(2x))\' = cos(2x)·2 = 2cos(2x)' },
      { title: '化简导数表达式', keyPoint: '结果化简', formula: '', process: '利用三角恒等式化简导数', highlight: '有时需要用cos²x + sin²x = 1或二倍角公式简化结果' },
    ],
  },
  {
    category: 'derivative', subcategory: 'logarithmic-diff',
    templates: [
      { title: '两边取对数', keyPoint: '取对数', formula: '\\ln(y) = \\ln(\\text{复杂表达式})', process: '对等式两边取自然对数，将对数性质中的乘除化为加减', highlight: '特别适用于多个因子的乘除、幂指函数等复杂形式' },
      { title: '两边求导', keyPoint: '隐式求导', formula: '', process: '对两边关于x求导，左边通过链式法则得y\'/y', highlight: '注意lny对x求导得 y\'/y' },
      { title: '解出y\'', keyPoint: '求解导数', formula: 'y\'=y\\cdot\\frac{d}{dx}(\\ln y)', process: '移项求出y\'，再代入原函数表达式', highlight: '这是处理x^{f(x)}等幂指函数最有效的方法' },
    ],
  },
  {
    category: 'derivative', subcategory: 'implicit',
    templates: [
      { title: '对等式两边同时求导', keyPoint: '隐函数求导', formula: '\\frac{dy}{dx}=-\\frac{F_x}{F_y}', process: '对恒等式F(x,y(x))=0关于x求导，利用链式法则', highlight: '每一项中遇到y(x)时都要乘以y\'' },
      { title: '整理合并含y\'的项', keyPoint: '整理方程', formula: '', process: '将含有y\'的项移到一边，不含y\'的项移到另一边', highlight: '不要遗漏任何一项链式法则中的y\'' },
      { title: '解出y\'表达式', keyPoint: '求解隐函数导数', formula: '', process: '用代数方法解出y\'的表达式', highlight: '最终表达式通常既含x也含y' },
    ],
  },
  {
    category: 'derivative', subcategory: 'higher-order',
    templates: [
      { title: '求一阶导数', keyPoint: '一阶导数', formula: 'f\'(x)=...', process: '先用基本方法求出一阶导数', highlight: '一阶导数的准确性决定高阶导数的正确性' },
      { title: '递推法求高阶', keyPoint: '高阶导数递推', formula: 'f^{(n)}(x)', process: '对一阶导数继续求导得二阶，以此类推，或找归纳模式', highlight: '常见函数的高阶导数有规律可循：如sin x^{(n)} = sin(x+nπ/2)' },
      { title: '写出n阶导数公式', keyPoint: 'n阶导数通式', formula: '', process: '归纳出n阶导数的通项公式', highlight: '莱布尼茨公式适用于乘积函数的高阶导数： (uv)^{(n)} = ΣC(n,k)u^{(n-k)}v^{(k)}' },
    ],
  },
  {
    category: 'derivative', subcategory: 'mean-value-theorem',
    templates: [
      { title: '构造辅助函数', keyPoint: '辅助函数构造', formula: '', process: '根据定理要求构造满足条件的辅助函数', highlight: '罗尔定理：φ(x)=f(x)-kx-b等；拉格朗日：φ(x)=f(x)-[f(b)-f(a)]x/(b-a)' },
      { title: '验证定理条件', keyPoint: '条件验证', formula: '', process: '验证：闭区间连续、开区间可导、端点值相等（罗尔）', highlight: '条件是应用定理的前提，必须逐一确认' },
      { title: '得出结论', keyPoint: '定理应用', formula: '', process: '应用定理得到存在某点满足导数为0（罗尔）或导数等于平均变化率（拉格朗日）', highlight: '中值定理常用于证明不等式、恒等式和函数性质' },
    ],
  },
  {
    category: 'derivative', subcategory: 'extreme-values',
    templates: [
      { title: '求一阶导数并令其为零', keyPoint: '求驻点', formula: 'f\'(x)=0', process: '计算f\'(x)，解方程f\'(x)=0求出所有驻点', highlight: '驻点是极值的必要条件，但不是充分条件（如y=x³在x=0处）' },
      { title: '用二阶导数判断极值', keyPoint: '二阶判别法', formula: 'f\'\'(x_0)>0\\Rightarrow极小值,\\ f\'\'(x_0)<0\\Rightarrow极大值', process: '计算二阶导数在各驻点处的值，正为极小值点，负为极大值点', highlight: '若二阶导数为0，需用更高阶导数或一阶导数符号变化来判断' },
      { title: '比较端点值和极值', keyPoint: '最值问题', formula: '', process: '闭区间上的最值需比较驻点值和端点值', highlight: '最值必定在驻点或区间端点处取得' },
    ],
  },
  {
    category: 'derivative', subcategory: 'monotonicity',
    templates: [
      { title: '分析一阶导数符号', keyPoint: '单调性判别', formula: 'f\'(x)>0\\Rightarrow递增,\\ f\'(x)<0\\Rightarrow递减', process: '求出f\'(x)，在定义域内分析其正负号分布', highlight: '利用f\'(x)=0的点和f\'(x)不存在的点划分区间' },
      { title: '划分单调区间', keyPoint: '区间划分', formula: '', process: '以驻点和不可导点为界划分区间，逐区间确定单调性', highlight: '注意定义域限制——只考虑函数有定义的区间' },
      { title: '总结单调区间', keyPoint: '结论', formula: '', process: '给出递增区间和递减区间的完整结论', highlight: '单调区间用开区间还是闭区间取决于端点处是否有定义' },
    ],
  },
  {
    category: 'derivative', subcategory: 'concavity',
    templates: [
      { title: '计算二阶导数', keyPoint: '二阶导数', formula: 'y\'\'', process: '对一阶导数再求导得二阶导数', highlight: '二阶导数揭示了函数曲线的弯曲方向' },
      { title: '分析凹凸性', keyPoint: '凹凸判别', formula: 'y\'\'>0\\Rightarrow凹(concave\\ up),\\ y\'\'<0\\Rightarrow凸(concave\\ down)', process: 'y\'\'>0为上凹（或称下凸），y\'\'<0为上凸', highlight: '注意中外凹凸定义的差异：国内f\'\'>0称为凹函数，国外称为convex' },
      { title: '求拐点', keyPoint: '拐点', formula: 'y\'\'=0\\ \\text{且符号改变}\\Rightarrow\\text{拐点(inflection point)}', process: '解y\'\'=0，验证y\'\'在该点左右符号是否改变的', highlight: '拐点是曲线凹凸性改变的点，也是曲线上弯曲方向反转的位置' },
    ],
  },
  {
    category: 'derivative', subcategory: 'tangent-normal',
    templates: [
      { title: '求切线斜率', keyPoint: '切点导数', formula: 'k=f\'(x_0)', process: '切线斜率=f\'(x_0)，法线斜率=-1/f\'(x_0)（f\'(x_0)≠0）', highlight: '法线是过切点且垂直于切线的直线' },
      { title: '代入点斜式方程', keyPoint: '直线方程', formula: 'y-y_0=k(x-x_0)', process: '利用点(x₀,y₀)和斜率k写出直线方程', highlight: '确保切点在曲线上：y₀=f(x₀)' },
      { title: '化为标准形式', keyPoint: '方程化简', formula: '', process: '整理方程为Ax+By+C=0形式或斜截式y=kx+b', highlight: '根据题目要求选择适当的表达形式' },
    ],
  },
  {
    category: 'derivative', subcategory: 'asymptotes',
    templates: [
      { title: '求水平渐近线', keyPoint: '水平渐近', formula: '\\lim_{x\\to\\pm\\infty}f(x)=c\\Rightarrow y=c', process: '计算x→∞时的极限，若存在则得水平渐近线', highlight: '函数最多有两条水平渐近线（左右无穷大不同极限）' },
      { title: '求垂直渐近线', keyPoint: '垂直渐近', formula: '\\lim_{x\\to a}f(x)=\\pm\\infty\\Rightarrow x=a', process: '寻找使分母为零或函数值趋于无穷大的点', highlight: '垂直渐近线出现在分母零点、对数定义域边界等位置' },
      { title: '求斜渐近线', keyPoint: '斜渐近', formula: 'k=\\lim_{x\\to\\pm\\infty}\\frac{f(x)}{x},\\ b=\\lim_{x\\to\\pm\\infty}(f(x)-kx)\\Rightarrow y=kx+b', process: '先求斜率k，再求截距b', highlight: '当k存在且有限，b也存在且有限时，y=kx+b为斜渐近线' },
    ],
  },
  {
    category: 'derivative', subcategory: 'parametric',
    templates: [
      { title: '求一阶导数', keyPoint: '参数求导', formula: '\\frac{dy}{dx}=\\frac{dy/dt}{dx/dt}=\\frac{y\'(t)}{x\'(t)}', process: 'y对x的导数 = y对t的导数 ÷ x对t的导数', highlight: '分母x\'(t)必须不为0，否则切线垂直（斜率不存在）' },
      { title: '求二阶导数', keyPoint: '参数二阶导数', formula: '\\frac{d^2y}{dx^2}=\\frac{d}{dt}\\left(\\frac{y\'}{x\'}\\right)/x\'', process: '对一阶导数的分子再关于t求导，然后除以x\'(t)', highlight: '二阶导数公式较长，建议分步计算避免错误' },
      { title: '整理结果', keyPoint: '结果化简', formula: '', process: '尽可能用t的一元表达式表示导数结果', highlight: '特殊曲线上（如椭圆参数式）注意验证结果的对称性' },
    ],
  },
  {
    category: 'derivative', subcategory: 'exponential',
    templates: [
      { title: '识别指数函数类型', keyPoint: '指数求导公式', formula: '(e^x)\'=e^x,\\ (a^x)\'=a^x\\ln a', process: 'e^x的导数等于自身，a^x的导数等于自身乘以lna', highlight: 'e^x是唯一求导后不变的函数' },
      { title: '复合指数函数求导', keyPoint: '复合指数', formula: '(e^{g(x)})\'=e^{g(x)}\\cdot g\'(x)', process: '使用链式法则，外层指数函数求导保留，内层函数求导相乘', highlight: '指数函数的导函数与原函数只差一个内层导数因子' },
      { title: '化简结果', keyPoint: '结果整理', formula: '', process: '提取公因子，简化表达式', highlight: 'e^{某式}是正的，不会改变导数的符号' },
    ],
  },
  {
    category: 'derivative', subcategory: 'lhospital',
    templates: [
      { title: '验证不定式类型', keyPoint: '洛必达先验条件', formula: '', process: '代入验证是否为0/0或∞/∞不定式，其他类型需先转换为这两种', highlight: '不是所有极限都能用洛必达法则，必须先验证条件' },
      { title: '分子分母分别求导', keyPoint: '分子分母求导', formula: '\\lim_{x\\to a}\\frac{f(x)}{g(x)}=\\lim_{x\\to a}\\frac{f\'(x)}{g\'(x)}', process: '只对分子分母求导（不是商的求导），保持分式形式', highlight: '极为常见的错误：把洛必达法则当成商法则使用！' },
      { title: '重复至不定式消失', keyPoint: '迭代应用', formula: '', process: '若一次应用后仍为不定式，可重复使用；若某步后导数为非不定式则停止', highlight: '每次应用后都须重新检查是否为0/0或∞/∞' },
    ],
  },

  // === 积分 (20组) ===
  {
    category: 'integral', subcategory: 'basic-power',
    templates: [
      { title: '应用幂法则积分', keyPoint: '幂法则', formula: '\\int x^n dx = \\frac{x^{n+1}}{n+1} + C\\ (n\\neq -1)', process: '指数加1，除以新指数，添加积分常数C', highlight: 'n=-1是特殊情形：∫x⁻¹dx = ln|x| + C' },
      { title: '逐项积分', keyPoint: '积分的线性性质', formula: '', process: '对多项式的每一项分别积分', highlight: '常数系数保留，最后统一加一个积分常数C' },
      { title: '输出原函数', keyPoint: '原函数', formula: '', process: '写出原函数，确保添加+C', highlight: '不写+C会导致扣分，这是不定积分的必要组成部分' },
    ],
  },
  {
    category: 'integral', subcategory: 'substitution',
    templates: [
      { title: '选择合适的代换', keyPoint: '换元策略', formula: 'u=g(x),\\ du=g\'(x)dx', process: '令u=某表达式，使被积式简化；常见代换：设u=内层函数', highlight: '换元的关键：置换后的du·dx必须完整覆盖原被积表达式' },
      { title: '用du替代dx', keyPoint: '变量替换', formula: '\\int f(g(x))g\'(x)dx=\\int f(u)du', process: '将原x的积分转换为u的积分，用du替换dx', highlight: 'x的积分限也需同步转换为u的积分限' },
      { title: '积分后代回原变量', keyPoint: '回代', formula: 'F(g(x))+C', process: '对新变量积分后，将u=g(x)代回，结果用x表示', highlight: '定积分换元时不需要回代，直接代入新的积分限即可' },
    ],
  },
  {
    category: 'integral', subcategory: 'integration-by-parts',
    templates: [
      { title: '分解为u和dv', keyPoint: '分部策略', formula: '\\int u\\,dv = uv - \\int v\\,du', process: '选择u（优先取对数>反三角>幂函数>三角>指数）和dv', highlight: '口诀：对数（log）、反三角（invTrig）、幂（power）、三角（trig）、指数（exp）=LIPET策略' },
      { title: '求du和v', keyPoint: '微分积分', formula: '', process: 'd(u) = u\'dx（微分），v = ∫dv（积分），两步都不难', highlight: 'v不需要加积分常数C（最终结果会自然包含）' },
      { title: '代入公式并积分余项', keyPoint: '分部积分计算', formula: 'uv - \\int v\\,du', process: '计算uv，再对∫vdu积分（可能需再次分部或换元）', highlight: '如果新积分∫vdu比原积分更难，说明u和dv选择不当' },
    ],
  },
  {
    category: 'integral', subcategory: 'trigonometric',
    templates: [
      { title: '利用三角恒等式降次', keyPoint: '三角降次公式', formula: '\\sin^2 x = \\frac{1-\\cos 2x}{2},\\ \\cos^2 x = \\frac{1+\\cos 2x}{2}', process: '将被积函数中的高次三角幂化为倍角公式或和差化积', highlight: '降次后往往可以得到容易积分的表达式' },
      { title: '奇次幂凑微分', keyPoint: '凑微分策略', formula: '\\int \\sin^n x\\cos x\\,dx=\\frac{\\sin^{n+1}x}{n+1}+C', process: '将奇数次的那个三角函数的1次方与dx凑成d(另一个三角)', highlight: '特别适用于∫sin^m x·cos^n x dx型，有一方为奇数次' },
      { title: '特殊形用Wallis公式', keyPoint: '华里士公式', formula: '', process: '对0→π/2上∫sin^n x dx型用已知公式直接计算', highlight: 'Wallis公式简化了大量重复计算' },
    ],
  },
  {
    category: 'integral', subcategory: 'rational-function',
    templates: [
      { title: '判断真分式/假分式', keyPoint: '分式类型判别', formula: '', process: '若分子次数≥分母次数，先做除法拆成多项式+真分式', highlight: '多项式部分可以直接积分，真分式再做部分分式分解' },
      { title: '因式分解分母', keyPoint: '分母分解', formula: '', process: '将分母分解为一次式和不可约二次式的乘积', highlight: '重根情况需要各阶对应的分式' },
      { title: '部分分式分解', keyPoint: '部分分式法', formula: '\\frac{1}{(x+a)(x+b)}=\\frac{A}{x+a}+\\frac{B}{x+b}', process: '将有理函数拆分为若干简单分式之和，逐项积分', highlight: '分别积分后合并结果；分母为二次式的分式要用三角换元' },
    ],
  },
  {
    category: 'integral', subcategory: 'trig-substitution',
    templates: [
      { title: '识别根式类型', keyPoint: '三角换元识别', formula: '', process: '√(a²-x²)→x=a·sinθ，√(a²+x²)→x=a·tanθ，√(x²-a²)→x=a·secθ', highlight: '三角换元将根号转化为三角函数可以消去的平方关系' },
      { title: '执行三角代换', keyPoint: '代换执行', formula: '', process: '用三角函数代替x，dx变为对应的三角函数微分', highlight: '积分完成后需要回代原变量，使用反三角函数' },
      { title: '三角函数积分后回代', keyPoint: '化简回代', formula: '', process: '完成三角函数积分后将θ=arccos/sin/tan代回x表达式', highlight: '回代步骤容易出错，建议画直角三角形辅助' },
    ],
  },
  {
    category: 'integral', subcategory: 'definite',
    templates: [
      { title: '应用N-L公式', keyPoint: '牛顿-莱布尼茨公式', formula: '\\int_a^b f(x)dx = F(b) - F(a) = [F(x)]_a^b', process: '先求原函数F(x)，再计算F(b)-F(a)', highlight: '这是定积分计算的核心方法' },
      { title: '利用对称性简化', keyPoint: '对称性技巧', formula: '\\int_{-a}^a f(x)dx=\\begin{cases}0&f\\text{是奇函数}\\\\2\\int_0^a f(x)dx&f\\text{是偶函数}\\end{cases}', process: '奇函数对称区间定积分为0，偶函数为2倍右半区间', highlight: '利用奇偶性可以大幅减少计算量' },
      { title: '代回积分限', keyPoint: '积分限处理', formula: '', process: '换元定积分需同步更新积分限；N-L公式直接代入原积分限', highlight: '换元时忘记更新积分限是极为常见的错误' },
    ],
  },
  {
    category: 'integral', subcategory: 'improper',
    templates: [
      { title: '化为极限形式', keyPoint: '反常积分定义', formula: '\\int_a^{+\\infty}f(x)dx=\\lim_{b\\to+\\infty}\\int_a^b f(x)dx', process: '将无穷限/瑕疵化为极限形式，变成正常定积分求极限', highlight: '反常积分的敛散性取决于这个极限是否存在且有限' },
      { title: 'p-积分的敛散判别', keyPoint: 'p-积分结论', formula: '\\int_1^{+\\infty}\\frac{dx}{x^p}\\begin{cases}收敛&p>1\\\\发散&p\\le 1\\end{cases}', process: '与1/x^p比较：p>1收敛，p≤1发散', highlight: 'p=1时是著名的发散情形（调和级数的积分类比）' },
      { title: '得出收敛/发散结论', keyPoint: '敛散判断', formula: '', process: '若极限有限则收敛，无穷大或不存在则发散', highlight: '收敛还需考虑绝对收敛和条件收敛（主要针对瑕积分）' },
    ],
  },
  {
    category: 'integral', subcategory: 'area',
    templates: [
      { title: '确定围成区域', keyPoint: '区域分析', formula: '', process: '画出曲线草图或分析曲线位置，确定积分区间', highlight: '注意区分上曲线与下曲线，积分式是 (上曲线 - 下曲线)' },
      { title: '建立面积积分式', keyPoint: '面积公式', formula: 'S=\\int_a^b [f_上(x)-f_下(x)]dx', process: '用定积分表示平面图形面积', highlight: '若用y积分，积分式是 (右曲线 - 左曲线)dy' },
      { title: '计算定积分得面积', keyPoint: '积分计算', formula: '', process: '计算定积分，得出面积数值', highlight: '面积总是非负数，若积分结果为负说明函数上下位置判断有误' },
    ],
  },

  // === 向量与空间几何 (10组) ===
  {
    category: 'vector-geometry', subcategory: 'vector-operations',
    templates: [
      { title: '提取向量分量', keyPoint: '向量分解', formula: '\\vec{a}=a_x\\vec{i}+a_y\\vec{j}+a_z\\vec{k}=(a_x,a_y,a_z)', process: '将向量分解为坐标分量，便于代数运算', highlight: '向量模：|⃗a|=√(a_x²+a_y²+a_z²)' },
      { title: '执行向量运算', keyPoint: '向量运算', formula: '', process: '加法：对应分量相加；数乘：各分量乘以标量', highlight: '向量运算按分量独立进行，与标量运算类似' },
      { title: '化简结果', keyPoint: '结果标准化', formula: '', process: '合并同类分量，写出最简形式', highlight: '单位向量 = 原向量 ÷ 模' },
    ],
  },
  {
    category: 'vector-geometry', subcategory: 'dot-product',
    templates: [
      { title: '代入点积公式', keyPoint: '点积计算', formula: '\\vec{a}\\cdot\\vec{b}=a_xb_x+a_yb_y+a_zb_z=|\\vec{a}||\\vec{b}|\\cos\\theta', process: '用分量法或模长夹角法计算点积', highlight: '点积结果是一个数（标量），不是向量' },
      { title: '利用点积求夹角', keyPoint: '夹角计算', formula: '\\cos\\theta=\\frac{\\vec{a}\\cdot\\vec{b}}{|\\vec{a}||\\vec{b}|}', process: '由点积反推两向量的夹角', highlight: '⃗a·⃗b=0 ⟺ ⃗a⊥⃗b（正交/垂直）' },
      { title: '利用点积求投影', keyPoint: '投影计算', formula: '\\text{Proj}_{\\vec{b}}\\vec{a}=\\frac{\\vec{a}\\cdot\\vec{b}}{|\\vec{b}|^2}\\vec{b}', process: '计算a在b上的正交投影向量', highlight: '投影长度为 |⃗a|cosθ = (⃗a·⃗b)/|⃗b|' },
    ],
  },
  {
    category: 'vector-geometry', subcategory: 'cross-product',
    templates: [
      { title: '计算叉积', keyPoint: '叉积公式', formula: '\\vec{a}\\times\\vec{b}=\\begin{vmatrix}\\vec{i}&\\vec{j}&\\vec{k}\\\\a_x&a_y&a_z\\\\b_x&b_y&b_z\\end{vmatrix}', process: '用行列式展开法或记忆口诀计算叉积', highlight: '叉积结果是一个向量，方向由右手定则确定' },
      { title: '理解叉积的几何意义', keyPoint: '几何意义', formula: '|\\vec{a}\\times\\vec{b}|=|\\vec{a}||\\vec{b}|\\sin\\theta', process: '叉积的模 = 以a,b为边的平行四边形面积', highlight: '叉积方向同时垂直于a和b' },
      { title: '利用叉积求法向量', keyPoint: '法向量', formula: '', process: '两个向量的叉积即为它们的公垂向量', highlight: '常用于求平面的法向量' },
    ],
  },
  {
    category: 'vector-geometry', subcategory: 'line-equation',
    templates: [
      { title: '确定直线的方向向量', keyPoint: '方向向量', formula: '', process: '由两点或已知方向确定直线的方向向量⃗s', highlight: '方向向量只需方向正确，可以倍乘任意非零常数' },
      { title: '写出标准方程', keyPoint: '直线方程', formula: '\\frac{x-x_0}{m}=\\frac{y-y_0}{n}=\\frac{z-z_0}{p}', process: '点向式（对称式）：过点(x₀,y₀,z₀)，方向(m,n,p)', highlight: '若某个分母为0，保留0分母但理解为分子也为0' },
      { title: '化为参数方程', keyPoint: '参数式', formula: '\\begin{cases}x=x_0+mt\\\\y=y_0+nt\\\\z=z_0+pt\\end{cases}', process: '令比例=t，解出x,y,z关于t的参数式', highlight: '参数式便于求交点、距离等后续计算' },
    ],
  },
  {
    category: 'vector-geometry', subcategory: 'plane-equation',
    templates: [
      { title: '确定法向量', keyPoint: '平面法向量', formula: '\\vec{n}=(A,B,C)', process: '由已知条件（三点/线面关系等）求平面的法向量', highlight: '法向量可以用两点叉积或已知垂直线方向确定' },
      { title: '写出平面方程', keyPoint: '点法式→一般式', formula: 'A(x-x_0)+B(y-y_0)+C(z-z_0)=0', process: '过点(x₀,y₀,z₀)，法向量(A,B,C)的点法式', highlight: '展开得一般式：Ax+By+Cz+D=0' },
      { title: '化简为标准形式', keyPoint: '方程标准化', formula: 'Ax+By+Cz+D=0', process: '化为一般式后即可直接读取法向量(A,B,C)', highlight: '若有特殊需求可写截距式：x/a + y/b + z/c = 1' },
    ],
  },
  {
    category: 'vector-geometry', subcategory: 'distance',
    templates: [
      { title: '识别距离类型', keyPoint: '距离分类', formula: '', process: '判断求 点到直线 / 点到平面 / 直线间 / 直线与平面 的距离', highlight: '每种距离有对应公式，不要混淆' },
      { title: '代入距离公式', keyPoint: '距离计算', formula: 'd=\\frac{|Ax_0+By_0+Cz_0+D|}{\\sqrt{A^2+B^2+C^2}}', process: '点到平面距离：代入点坐标与平面系数', highlight: '直线间距离需先判断是否平行/异面' },
      { title: '得出距离值', keyPoint: '结果', formula: '', process: '化简计算得最终距离', highlight: '距离总是正数' },
    ],
  },
  {
    category: 'vector-geometry', subcategory: 'angle',
    templates: [
      { title: '利用方向/法向量求夹角', keyPoint: '夹角公式', formula: '\\cos\\theta=\\frac{|\\vec{n}_1\\cdot\\vec{n}_2|}{|\\vec{n}_1||\\vec{n}_2|}', process: '直线夹角→方向向量夹角；平面夹角→法向量夹角', highlight: '取值范围：[0°,90°]（取锐角）' },
      { title: '线面角计算', keyPoint: '线面角', formula: '\\sin\\theta=\\frac{|\\vec{s}\\cdot\\vec{n}|}{|\\vec{s}||\\vec{n}|}', process: '直线与平面的夹角 = 方向向量与法向量夹角的余角', highlight: '线面角∈[0°,90°]' },
    ],
  },

  // === 线性代数 (10组) ===
  {
    category: 'linear-algebra', subcategory: 'determinant',
    templates: [
      { title: '选择展开方法', keyPoint: '行列式展开', formula: '', process: '2阶：ad-bc直接计算；3阶：Sarrus法则；高阶：按行/列展开或化为三角阵', highlight: '选择含0最多的行/列展开可大幅简化计算' },
      { title: '利用性质简化', keyPoint: '行列式性质', formula: '|A^T|=|A|,\\ |AB|=|A||B|,\\ |kA|=k^n|A|', process: '利用行列式的性质简化计算', highlight: '两行互换变号；某行乘以k则行列式乘以k' },
      { title: '计算得结果', keyPoint: '结果', formula: '', process: '逐步计算得最终行列式值', highlight: '行列式为0 ⟺ 矩阵奇异/不可逆' },
    ],
  },
  {
    category: 'linear-algebra', subcategory: 'matrix-operations',
    templates: [
      { title: '确认矩阵维度兼容', keyPoint: '运算条件', formula: '', process: '矩阵乘法：A(m×n)·B(n×p)=C(m×p)', highlight: '矩阵乘法不满足交换律：AB≠BA一般' },
      { title: '执行矩阵运算', keyPoint: '运算规则', formula: 'C_{ij}=\\sum_{k=1}^n A_{ik}B_{kj}', process: 'C的第i行第j列=A的第i行与B的第j列点积', highlight: '矩阵乘法的结合律：(AB)C = A(BC)' },
      { title: '检查结果', keyPoint: '结果验证', formula: '', process: '确认结果维度正确，各元素计算无误', highlight: '单位矩阵I满足：AI=IA=A' },
    ],
  },
  {
    category: 'linear-algebra', subcategory: 'inverse-matrix',
    templates: [
      { title: '判断可逆性', keyPoint: '可逆条件', formula: 'det(A)\\neq 0 \\Rightarrow A^{-1}\\text{ exists}', process: '先计算行列式，若不为0则矩阵可逆', highlight: '奇异矩阵（|A|=0）无逆矩阵' },
      { title: '求伴随矩阵', keyPoint: '伴随矩阵', formula: 'A^*=\\text{adj}(A)=[A_{ji}]', process: '计算各元素的代数余子式，注意转置排列', highlight: '伴随矩阵的行列交换对应原矩阵的余子式' },
      { title: '写出逆矩阵', keyPoint: '逆矩阵公式', formula: 'A^{-1}=\\frac{1}{|A|}A^*', process: '将伴随矩阵各元素除以行列式值', highlight: '验证：A·A^{-1}=I' },
    ],
  },
  {
    category: 'linear-algebra', subcategory: 'linear-system',
    templates: [
      { title: '写出增广矩阵', keyPoint: '增广矩阵', formula: '[A|b]', process: '将系数矩阵A与常数向量b合并为增广矩阵', highlight: '增广矩阵完整描述了线性方程组的全部信息' },
      { title: '高斯消元法化简', keyPoint: '行简化', formula: '', process: '通过行变换将增广矩阵化为行最简形', highlight: '行变换不改变方程组的解' },
      { title: '根据秩判断解的情况', keyPoint: '解的结构', formula: 'r(A)=r([A|b])=n\\Rightarrow唯一解, <n\\Rightarrow无穷多解', process: '比较系数矩阵和增广矩阵的秩', highlight: 'r(A)≠r([A|b])时无解' },
      { title: '写出解', keyPoint: '通解/特解', formula: '', process: '若无穷多解，给出基础解系+特解', highlight: '解的结构：通解=特解+齐次通解' },
    ],
  },
  {
    category: 'linear-algebra', subcategory: 'eigenvalue',
    templates: [
      { title: '建立特征方程', keyPoint: '特征多项式', formula: '\\det(A-\\lambda I)=0', process: '计算|A-λI|得到关于λ的多项式方程', highlight: '特征多项式是n次的，有n个特征值（可重根）' },
      { title: '求特征值', keyPoint: '特征值', formula: '', process: '解特征方程得到所有特征值λ₁,λ₂,...,λₙ', highlight: '迹=Σλᵢ；行列式=Πλᵢ' },
      { title: '求特征向量', keyPoint: '特征向量', formula: '(A-\\lambda_i I)\\vec{x}=0', process: '对每个λᵢ，解齐次方程组(A-λᵢI)x=0', highlight: '特征向量可以倍乘任意非零常数' },
    ],
  },
  {
    category: 'linear-algebra', subcategory: 'diagonalization',
    templates: [
      { title: '求所有特征值和特征向量', keyPoint: '特征分析', formula: '', process: '按特征值求法得到完整的特征数据', highlight: '需要n个线性无关的特征向量才能对角化' },
      { title: '构造矩阵P和Λ', keyPoint: '对角化', formula: 'P^{-1}AP=\\Lambda=\\text{diag}(\\lambda_1,...,\\lambda_n)', process: 'P的列=特征向量，Λ=特征值对角矩阵', highlight: '验证：A=PΛP^{-1}' },
      { title: '验证对角化条件', keyPoint: '可对角化判定', formula: '', process: 'P各列线性无关可逆，则A可对角化', highlight: '实对称矩阵一定可以对角化' },
    ],
  },
  {
    category: 'linear-algebra', subcategory: 'quadratic-form',
    templates: [
      { title: '写出二次型矩阵A', keyPoint: '二次型矩阵', formula: 'f(x)=\\vec{x}^T A \\vec{x}', process: '将二次型的系数填入对称矩阵', highlight: '注意交叉项系数平分：2x₁x₂→a₁₂=a₂₁=1' },
      { title: '求特征值', keyPoint: '特征值', formula: '', process: '解|A-λI|=0得特征值', highlight: '二次型矩阵A总是对称的' },
      { title: '判定正定性', keyPoint: '正定性/类型', formula: '', process: '全正→正定；全负→负定；有正有负→不定；含零→半定', highlight: 'Sylvester判据：各顺序主子式>0为正定' },
    ],
  },

  // === 曲线与曲面积分 (8组) ===
  {
    category: 'multivariable', subcategory: 'line-integral-type1',
    templates: [
      { title: '参数化曲线C', keyPoint: '参数方程', formula: '\\begin{cases}x=x(t)\\\\y=y(t)\\end{cases},\\ t\\in[a,b]', process: '将积分曲线写为参数方程形式', highlight: '曲线参数化是第一类曲线积分的第一步' },
      { title: '计算弧微元ds', keyPoint: 'ds表达式', formula: 'ds=\\sqrt{[x\'(t)]^2+[y\'(t)]^2}\\,dt', process: '由参数导数求出弧长微元', highlight: '三维空间：ds=√(x\'²+y\'²+z\'²)dt' },
      { title: '代入积分并计算', keyPoint: '积分计算', formula: '\\int_C f(x,y)ds=\\int_a^b f(x(t),y(t))\\sqrt{(x\')^2+(y\')^2}\\,dt', process: '将f(x,y)中的x,y用参数表示，乘ds后定积分', highlight: '积分结果与路径方向无关（第一类曲线积分）' },
    ],
  },
  {
    category: 'multivariable', subcategory: 'line-integral-type2',
    templates: [
      { title: '参数化并写出向量表达式', keyPoint: '向量积分', formula: '\\int_C Pdx+Qdy=\\int_a^b [P(x,y)x\'+Q(x,y)y\']dt', process: '将Pdx+Qdy用参数t统一表达', highlight: '第二类曲线积分的值与路径方向有关' },
      { title: '判断是否与路径无关', keyPoint: '路径无关条件', formula: '\\frac{\\partial P}{\\partial y}=\\frac{\\partial Q}{\\partial x}', process: '若Py=Qx全平面成立，则积分与路径无关', highlight: '此时可选取最简单的路径（如折线）进行计算' },
      { title: '利用格林公式转化', keyPoint: '格林公式', formula: '\\oint_C Pdx+Qdy=\\iint_D\\left(\\frac{\\partial Q}{\\partial x}-\\frac{\\partial P}{\\partial y}\\right)dxdy', process: '封闭曲线→二重积分（注意正向）', highlight: '使用格林公式可避开曲线参数化的繁杂计算' },
    ],
  },
  {
    category: 'multivariable', subcategory: 'surface-integral-type1',
    templates: [
      { title: '确定曲面方程和投影区域', keyPoint: '曲面分析', formula: 'z=f(x,y),\\ (x,y)\\in D_{xy}', process: '明确曲面的表达式和在坐标面上的投影区域', highlight: '投影区域D的确定是第一类曲面积分的关键' },
      { title: '计算面积微元dS', keyPoint: '面积微元', formula: 'dS=\\sqrt{1+f_x^2+f_y^2}\\,dxdy', process: '由曲面偏导数计算面积微元', highlight: 'dS始终取正值，与曲面方向无关' },
      { title: '化为二重积分计算', keyPoint: '积分计算', formula: '\\iint_{\\Sigma}f(x,y,z)dS=\\iint_D f(x,y,f(x,y))\\sqrt{1+f_x^2+f_y^2}\\,dxdy', process: '将曲面积分化为投影区域的二重积分', highlight: '第一类曲面积分与曲面取向无关' },
    ],
  },
  {
    category: 'multivariable', subcategory: 'surface-integral-type2',
    templates: [
      { title: '确定曲面侧和法向量', keyPoint: '曲面侧', formula: '', process: '明确积分曲面取上侧/下侧，确定法向量方向', highlight: '曲面侧方向改变会导致积分值变号' },
      { title: '化为二重积分', keyPoint: '第二类曲面', formula: '\\iint_{\\Sigma} R(x,y,z)dxdy=\\pm\\iint_D R(x,y,f(x,y))dxdy', process: '将第二类曲面积分化为投影区域的二重积分', highlight: '符号：上侧取+，下侧取-' },
      { title: '利用高斯公式转换', keyPoint: '高斯（散度）定理', formula: '\\oiint_{\\Sigma} \\vec{F}\\cdot d\\vec{S}=\\iiint_{\\Omega} \\nabla\\cdot\\vec{F}\\,dV', process: '封闭曲面→三重积分', highlight: '散度∇·F = ∂P/∂x + ∂Q/∂y + ∂R/∂z' },
    ],
  },
  {
    category: 'multivariable', subcategory: 'green-gauss-stokes',
    templates: [
      { title: '识别适用的积分定理', keyPoint: '三大定理选择', formula: '', process: '平面封闭曲线→格林；空间封闭曲面→高斯；空间曲线围成曲面→斯托克斯', highlight: '三大定理将低维积分转化为高维积分' },
      { title: '计算旋度/散度', keyPoint: '微分运算', formula: '\\nabla\\times\\vec{F}=\\begin{vmatrix}\\vec{i}&\\vec{j}&\\vec{k}\\\\\\partial_x&\\partial_y&\\partial_z\\\\P&Q&R\\end{vmatrix}', process: '计算旋度（Stokes用）或散度（Gauss用）', highlight: '旋度是向量，散度是标量' },
      { title: '在高一维区域上积分', keyPoint: '转化积分', formula: '', process: '将原曲线/曲面积分转化为二重/三重积分', highlight: '转化后可能仍需用换元、分部等方法计算' },
    ],
  },
];

// ============================================
// 第三步：解题计划模板 (用于 planner.agent.ts)
// ============================================
export interface PlanTemplate {
  category: string;
  subcategory: string;
  macroStrategy: string;
  steps: Array<{
    id: string;
    description: string;
    tool: string;
    expectedOutput: string;
    microOperations: string[];
  }>;
  alternativeApproaches: string[];
  knowledgePoints: string[];
}

export const PLAN_TEMPLATES: PlanTemplate[] = [
  // 极限 (10组)
  {
    category: 'limit', subcategory: 'rational-function',
    macroStrategy: '提取分子分母的最高次项，比较次数确定极限类型，计算极限值',
    steps: [
      { id: 'step1', description: '识别分子分母多项式次数', tool: 'llm', expectedOutput: '分子n次，分母m次', microOperations: ['展开多项式', '找出分子分母最高次项', '记录次数'] },
      { id: 'step2', description: '分子分母同除x^{max(n,m)}', tool: 'sympy', expectedOutput: '化简为标准∞/∞形式', microOperations: ['提出最高次幂', '化简分式', '检查是否有简化空间'] },
      { id: 'step3', description: '计算化简后极限', tool: 'sympy', expectedOutput: '极限值', microOperations: ['比较次数', '计算系数比', '确定结果为0/系数比/无穷大'] },
    ],
    alternativeApproaches: ['洛必达法则', '提取最高次项法'],
    knowledgePoints: ['函数极限', '多项式比值的极限', '无穷大阶的比较'],
  },
  {
    category: 'limit', subcategory: 'lhopital',
    macroStrategy: '验证洛必达法则适用条件，分子分母分别求导，重复至不定式消失',
    steps: [
      { id: 'step1', description: '代入趋近值验证不定式类型', tool: 'llm', expectedOutput: '确认为0/0或∞/∞型', microOperations: ['代入趋近值', '检查分子分母是否同时→0或→∞', '确认可使用洛必达法则'] },
      { id: 'step2', description: '分子分母分别求导并化简', tool: 'sympy', expectedOutput: '求导后的(分子/分母)表达式', microOperations: ['分子单独求导', '分母单独求导', '化简分式'] },
      { id: 'step3', description: '计算求导后极限、必要时重复', tool: 'sympy', expectedOutput: '极限值', microOperations: ['代入计算新分式极限', '若仍不定式则重复step2', '输出最终结果'] },
    ],
    alternativeApproaches: ['等价无穷小替换', '泰勒展开法'],
    knowledgePoints: ['洛必达法则', '不定式极限', '极限计算'],
  },
  {
    category: 'limit', subcategory: 'taylor-expansion',
    macroStrategy: '确定展开阶数，对各函数做泰勒展开，代入化简后计算极限',
    steps: [
      { id: 'step1', description: '分析不定式阶数确定展开阶数', tool: 'llm', expectedOutput: '需展开到3阶或更精确', microOperations: ['代入趋近值确定分子分母的最低非零阶', '考虑消去项可能需要的更高阶'] },
      { id: 'step2', description: '写出各函数的泰勒展开式', tool: 'llm', expectedOutput: '各函数截取到第n阶展开公式', microOperations: ['回忆常用展开公式', '写出展开至所需阶的完整表达式', '标记高阶无穷小项O(x^k)'] },
      { id: 'step3', description: '代入原式并化简求极限', tool: 'sympy', expectedOutput: '极限值', microOperations: ['代入展开式', '合并同阶项', '确定主导项和极限值'] },
    ],
    alternativeApproaches: ['洛必达法则', '等价无穷小替换'],
    knowledgePoints: ['泰勒展开', '麦克劳林公式', '极限的泰勒展开法'],
  },
  {
    category: 'limit', subcategory: 'squeeze-theorem',
    macroStrategy: '构造上下界不等式，分别求上下界极限，由夹逼定理得结论',
    steps: [
      { id: 'step1', description: '利用不等式性质和函数特性构造上下界', tool: 'llm', expectedOutput: 'g(x)≤f(x)≤h(x)的不等式链', microOperations: ['分析f(x)的振荡或特殊性质', '寻找简单可积的函数作为上下界', '确保构造的不等号方向正确'] },
      { id: 'step2', description: '分别计算上下界极限', tool: 'sympy', expectedOutput: 'lim g(x)=L, lim h(x)=L', microOperations: ['计算lim g(x)', '计算lim h(x)', '验证两极限相等'] },
      { id: 'step3', description: '应用夹逼定理得出结论', tool: 'llm', expectedOutput: 'lim f(x)=L', microOperations: ['确认夹逼定理条件满足', '得出lim f(x)=L的结论', '写出完整证明'] },
    ],
    alternativeApproaches: ['直接计算（特定函数）', '数列极限方法'],
    knowledgePoints: ['夹逼定理', '极限存在准则', '不等式放缩'],
  },
  {
    category: 'limit', subcategory: 'important-limit',
    macroStrategy: '通过变量代换或拼凑将表达式化为重要极限标准形，应用公式求结果',
    steps: [
      { id: 'step1', description: '分析表达式与重要极限的差异', tool: 'llm', expectedOutput: '确定需匹配的重要极限类型（sin或e型）', microOperations: ['比对sin(x)/x型或(1+1/x)^x型', '找出表达式与标准形的差异', '制定变量代换策略'] },
      { id: 'step2', description: '通过变量代换标准化', tool: 'llm', expectedOutput: '标准化后的极限表达式', microOperations: ['设计变量代换', '检查代换后自变量趋近方向', '处理系数的不匹配'] },
      { id: 'step3', description: '应用重要极限公式得结果', tool: 'sympy', expectedOutput: '极限值', microOperations: ['应用公式', '处理系数', '得出最终结果'] },
    ],
    alternativeApproaches: ['洛必达法则', '等价无穷小替换'],
    knowledgePoints: ['两个重要极限', '极限公式应用', '变量代换'],
  },

  // 导数 (10组)
  {
    category: 'derivative', subcategory: 'mean-value-theorem',
    macroStrategy: '构造辅助函数使其在某区间端点值相等，应用罗尔定理或拉格朗日中值定理',
    steps: [
      { id: 'step1', description: '分析题目需求，构造辅助函数φ(x)', tool: 'llm', expectedOutput: '辅助函数的表达式', microOperations: ['分析要证明的结论形式', '逆推构造满足条件的辅助函数', '确保φ(x)在指定区间满足定理条件'] },
      { id: 'step2', description: '验证辅助函数的连续性和可导性', tool: 'llm', expectedOutput: '确认连续且可导', microOperations: ['检查闭区间连续性', '检查开区间可导性', '确认端点值满足特定条件'] },
      { id: 'step3', description: '应用中值定理得出结论', tool: 'llm', expectedOutput: '存在某点满足导数条件', microOperations: ['应用定理得到φ\'(ξ)=0或相关', '解出f\'(ξ)的表达式', '得出结论并完成证明'] },
    ],
    alternativeApproaches: ['积分法构造辅助函数', '常数变易法'],
    knowledgePoints: ['罗尔定理', '拉格朗日中值定理', '柯西中值定理', '辅助函数构造法'],
  },
  {
    category: 'derivative', subcategory: 'extreme-values',
    macroStrategy: '求出导函数零点（驻点）和区间端点，计算各点函数值，比较确定最值',
    steps: [
      { id: 'step1', description: '求一阶导数并解f\'(x)=0', tool: 'sympy', expectedOutput: '所有驻点x坐标', microOperations: ['计算f\'(x)', '令f\'(x)=0解方程', '记录导数为0和不存在点'] },
      { id: 'step2', description: '计算各关键点的函数值', tool: 'sympy', expectedOutput: '各点对应的y值', microOperations: ['计算驻点函数值', '计算区间端点函数值', '计算不可导点函数值'] },
      { id: 'step3', description: '比较确定最值和极值', tool: 'llm', expectedOutput: '最值和极值结论', microOperations: ['在所有函数值中比较大小', '区分全局最值和局部极值', '输出最终结论'] },
    ],
    alternativeApproaches: ['二阶导数判别法', '单调性分析法'],
    knowledgePoints: ['函数的极值', '最值问题', '导数应用'],
  },

  // 积分 (10组)
  {
    category: 'integral', subcategory: 'definite',
    macroStrategy: '利用N-L公式先求原函数，再代入上下限计算定积分值',
    steps: [
      { id: 'step1', description: '分析被积函数并选择积分方法', tool: 'llm', expectedOutput: '选定的积分方法（换元/分部等）', microOperations: ['识别被积函数类型', '判断最适合的积分方法', '检查积分上下限'] },
      { id: 'step2', description: '求出原函数F(x)', tool: 'sympy', expectedOutput: '原函数F(x)的表达式', microOperations: ['应用选定的积分方法', '逐项积分', '检查积分结果'] },
      { id: 'step3', description: '代入N-L公式计算F(b)-F(a)', tool: 'sympy', expectedOutput: '定积分数值结果', microOperations: ['代入上限b', '代入下限a', '相减得结果'] },
    ],
    alternativeApproaches: ['几何意义求面积', '变量替换结合N-L公式'],
    knowledgePoints: ['牛顿-莱布尼茨公式', '定积分计算', '原函数法'],
  },
  {
    category: 'integral', subcategory: 'improper',
    macroStrategy: '将反常积分表为极限形式，计算定积分后判断极限是否存在',
    steps: [
      { id: 'step1', description: '将无穷限/瑕点以极限形式表达', tool: 'llm', expectedOutput: '∫f(x)dx = lim_{t→某值}∫_a^t f(x)dx', microOperations: ['识别无穷限或瑕点', '引入极限记号（b→∞或t→瑕点）', '写为极限形式'] },
      { id: 'step2', description: '先求正常定积分∫_a^t f(x)dx', tool: 'sympy', expectedOutput: '关于t的函数G(t)', microOperations: ['将被积函数在[a,t]上积分', '结果表达为t的函数', '化简G(t)'] },
      { id: 'step3', description: '计算极限lim G(t)', tool: 'sympy', expectedOutput: '收敛值/发散结论', microOperations: ['计算t→±∞或t→瑕点的极限', '若极限有限则收敛给出值', '若极限∞则发散'] },
    ],
    alternativeApproaches: ['p-积分判别法', '比较判别法'],
    knowledgePoints: ['反常积分', '瑕积分', '敛散性判别', 'p-积分'],
  },
  {
    category: 'integral', subcategory: 'substitution',
    macroStrategy: '选取合适代换消除复杂函数结构，同步更新积分限/常数',
    steps: [
      { id: 'step1', description: '选定代换变量u=g(x)', tool: 'llm', expectedOutput: '换元：u = g(x)', microOperations: ['识别被积函数中的重复结构', '设计u代换消除复杂因子', '计算du = g\'(x)dx'] },
      { id: 'step2', description: '将被积式全部用u表达', tool: 'llm', expectedOutput: '∫...du的完整换元式', microOperations: ['将du替换dx', '将剩余x表达式用u表出', '确保被积式中不含x'] },
      { id: 'step3', description: '对新变量u积分并回代', tool: 'sympy', expectedOutput: '原函数（用x表达）+C', microOperations: ['对u的函数进行积分', '结果替换u=g(x)', '添加积分常数C'] },
    ],
    alternativeApproaches: ['凑微分法', '分部积分法'],
    knowledgePoints: ['换元积分法', '不定积分', '变量代换'],
  },

  // 级数 (8组)
  {
    category: 'series', subcategory: 'convergence-test',
    macroStrategy: '逐级应用判别法（从简单到复杂），完成级数敛散性判断',
    steps: [
      { id: 'step1', description: '检查通项极限lim a_n是否为零', tool: 'llm', expectedOutput: '通项极限（必要时检查）', microOperations: ['计算lim a_n', '若lim a_n≠0则立即发散（发散必要条件）', '若lim a_n=0则需进一步判别'] },
      { id: 'step2', description: '选取合适的判别法（比值/根值/比较/积分）', tool: 'llm', expectedOutput: '选定的判别方法和依据', microOperations: ['分析级数类型选择判别法', '正项级数→比值/根值/比较', '交错级数→莱布尼茨判别法'] },
      { id: 'step3', description: '执行判别计算得出敛散结论', tool: 'sympy', expectedOutput: '收敛/发散结论', microOperations: ['计算判别极限值', '根据判据得出结论', '必要时区分绝对收敛和条件收敛'] },
    ],
    alternativeApproaches: ['比较判别法', '极限比较法'],
    knowledgePoints: ['级数收敛判别', '正项级数判别法', '交错级数判别法'],
  },
  {
    category: 'series', subcategory: 'power-series',
    macroStrategy: '求幂级数的收敛半径R和收敛区间，验证端点收敛性得收敛域',
    steps: [
      { id: 'step1', description: '应用比值/根值法求收敛半径', tool: 'llm', expectedOutput: '收敛半径R', microOperations: ['计算 lim|a_{n+1}/a_n|', '确定 ρ = lim|a_{n+1}/a_n|', '得 R = 1/ρ'] },
      { id: 'step2', description: '验证端点x=a±R处的收敛性', tool: 'llm', expectedOutput: '端点收敛/发散结论', microOperations: ['代入 x = a + R', '代入 x = a - R', '分别用级数判别法验证'] },
      { id: 'step3', description: '给出完整收敛域', tool: 'llm', expectedOutput: '收敛区间 [开/闭]', microOperations: ['综合得出收敛区间', '根据端点情况确定开闭区间', '输出最终收敛域'] },
    ],
    alternativeApproaches: ['根值法求收敛半径', '柯西-阿达玛公式'],
    knowledgePoints: ['幂级数收敛半径', '收敛域', '级数端点判别'],
  },
  {
    category: 'series', subcategory: 'taylor',
    macroStrategy: '根据函数形式和展开点选择展开公式，利用已知展开式逐项处理',
    steps: [
      { id: 'step1', description: '识别函数并确定展开点a', tool: 'llm', expectedOutput: '在x=a处展开', microOperations: ['明确目标函数的类型', '确定展开点位置（a=0/Maclaurin？）', '查找或推导展开公式'] },
      { id: 'step2', description: '应用已知展开公式到所需阶数', tool: 'llm', expectedOutput: 'n阶泰勒展开式', microOperations: ['写出各阶导数f^{(k)}(a)', '按f(x)=Σf^{(k)}(a)/k!·(x-a)^k展开', '标记截断误差（拉格朗日余项）'] },
      { id: 'step3', description: '化简并验证收敛性', tool: 'sympy', expectedOutput: '完整展开式和收敛范围', microOperations: ['化简展开式', '确定收敛半径', '给出最终结果'] },
    ],
    alternativeApproaches: ['利用已知级数（如e^x, sin x等）', '待定系数法'],
    knowledgePoints: ['泰勒级数', '麦克劳林展开', '函数展开为幂级数'],
  },

  // 微分方程 (8组)
  {
    category: 'diff-equation', subcategory: 'separable',
    macroStrategy: '将dy/dx分离为f(x)dx=g(y)dy形式，两边同时积分求解',
    steps: [
      { id: 'step1', description: '分离变量：y项移到一边，x项移到另一边', tool: 'llm', expectedOutput: 'g(y)dy = f(x)dx', microOperations: ['移项将所有y相关项聚集', '将含dx和x的项移到等式另一边', '得到标准分离形式'] },
      { id: 'step2', description: '两边同时积分', tool: 'sympy', expectedOutput: 'G(y)=F(x)+C', microOperations: ['对左边∫g(y)dy积分', '对右边∫f(x)dx积分', '加积分常数C'] },
      { id: 'step3', description: '解得隐式解或显式解', tool: 'llm', expectedOutput: 'y=y(x,C)或F(x,y)=C', microOperations: ['若可能解出y=f(x,C)的显式解', '否则保留隐式解形式', '给出通解'] },
    ],
    alternativeApproaches: ['积分因子法', '常数变易法'],
    knowledgePoints: ['可分离变量方程', '一阶微分方程', '通解与特解'],
  },
  {
    category: 'diff-equation', subcategory: 'second-order-constant',
    macroStrategy: '由特征方程求特征根，根据根的类型写出通解形式',
    steps: [
      { id: 'step1', description: '写出特征方程并求特征根', tool: 'sympy', expectedOutput: 'r=α±βi（或两个实根rm,rn）', microOperations: ['代入 y\'\'→r², y\'→r', '得到：r²+pr+q=0', '解二次方程得特征根'] },
      { id: 'step2', description: '根据特征根类型写通解', tool: 'llm', expectedOutput: '齐次通解形式', microOperations: ['判别根型（实不等/实等重/共轭复）', '按对应公式写出通解：C₁e^{r₁x}+C₂e^{r₂x}/e^{αx}(C₁cosβx+C₂sinβx)/(C₁+C₂x)e^{rx}'] },
      { id: 'step3', description: '若有初值条件求特解', tool: 'sympy', expectedOutput: '满足初值的特解', microOperations: ['代入初值y(x₀)=y₀, y\'(x₀)=y\'₀', '建立方程组求C₁,C₂', '写出特解'] },
    ],
    alternativeApproaches: ['常数变易法', '拉普拉斯变换法'],
    knowledgePoints: ['二阶常系数线性微分方程', '特征方程', '特征根分类'],
  },
  {
    category: 'diff-equation', subcategory: 'first-order-linear',
    macroStrategy: '化为一阶线性标准形，使用常数变易法或通解公式求解',
    steps: [
      { id: 'step1', description: '化为标准形式y\'+P(x)y=Q(x)', tool: 'llm', expectedOutput: '标准形中的P(x)和Q(x)', microOperations: ['移项整理', '确保y\'系数为1', '确认P(x)和Q(x)'] },
      { id: 'step2', description: '求积分因子μ=e^{∫Pdx}', tool: 'sympy', expectedOutput: 'μ(x)=e^{∫Pdx}的表达式', microOperations: ['计算∫P(x)dx', '计算μ(x)=e^{∫Pdx}', '将方程两边同乘μ'] },
      { id: 'step3', description: '解出y的通解', tool: 'sympy', expectedOutput: 'y=通解表达式', microOperations: ['∫μQ dx求积分', '用通解公式y=(∫μQdx+C)/μ', '化简得最终结果'] },
    ],
    alternativeApproaches: ['常数变易法', '积分因子法'],
    knowledgePoints: ['一阶线性微分方程', '积分因子', '常数变易法'],
  },

  // 多元微积分 (8组)
  {
    category: 'multivariable', subcategory: 'partial-derivative',
    macroStrategy: '将其他变量视为常数，使用一元函数求导法则计算偏导数',
    steps: [
      { id: 'step1', description: '确定要求偏导的变量和阶数', tool: 'llm', expectedOutput: '求∂f/∂x或∂²f/∂x²等目标', microOperations: ['分析要求哪个变量的偏导数', '确认一阶还是高阶', '明确混合偏导的顺序'] },
      { id: 'step2', description: '将其他变量视为常数求导', tool: 'sympy', expectedOutput: '偏导数表达式', microOperations: ['锁定其他变量为常数', '用一元函数求导法计算', '保留中间变量符号'] },
      { id: 'step3', description: '验证混合偏导次序可交换性', tool: 'llm', expectedOutput: '∂²f/∂x∂y = ∂²f/∂y∂x确认', microOperations: ['计算两个混合偏导', '验证是否相等（若连续则可交换）', '输出结果'] },
    ],
    alternativeApproaches: ['全微分法', '隐函数求导法'],
    knowledgePoints: ['偏导数', '高阶偏导数', '混合偏导数', 'Schwarz定理'],
  },
  {
    category: 'multivariable', subcategory: 'double-integral',
    macroStrategy: '确定积分区域和积分顺序，化为累次积分逐层计算',
    steps: [
      { id: 'step1', description: '分析积分区域D的几何形状', tool: 'llm', expectedOutput: 'D的区域描述和边界方程', microOperations: ['画出或想象积分区域D', '写出区域的数学描述', '判断最适合的积分顺序'] },
      { id: 'step2', description: '建立累次积分表达式', tool: 'llm', expectedOutput: '∫_a^b[∫_{y₁(x)}^{y₂(x)}f(x,y)dy]dx', microOperations: ['确定外层积分限和变量', '确定内层积分限和变量', '检查积分顺序是否最优'] },
      { id: 'step3', description: '逐层积分得出结果', tool: 'sympy', expectedOutput: '二重积分值', microOperations: ['先积内层（含参考变量为参数）', '再积外层', '得最终结果'] },
    ],
    alternativeApproaches: ['极坐标变换', '换序积分法'],
    knowledgePoints: ['二重积分', '累次积分', '积分区域分析', '积分换序法'],
  },
  {
    category: 'multivariable', subcategory: 'lagrange',
    macroStrategy: '建立拉格朗日函数，求偏导并解驻点，比较得条件极值',
    steps: [
      { id: 'step1', description: '建立拉格朗日函数L=f+λg', tool: 'llm', expectedOutput: 'L(x,y,λ)=f(x,y)+λ·g(x,y)', microOperations: ['写出目标函数f(x,y)', '将约束条件写成g(x,y)=0', '构造L=f+λg'] },
      { id: 'step2', description: '求偏导并令其为0解驻点', tool: 'sympy', expectedOutput: '驻点坐标和λ值', microOperations: ['∂L/∂x=0, ∂L/∂y=0, ∂L/∂λ=0', '联立三个方程求解', '得所有驻点'] },
      { id: 'step3', description: '比较各驻点的目标函数值得条件极值', tool: 'sympy', expectedOutput: '条件极值和取得极值的点', microOperations: ['计算各驻点的f值', '比较判定极值', '给出最终结论'] },
    ],
    alternativeApproaches: ['消元法化为无条件极值', '几何直观法'],
    knowledgePoints: ['拉格朗日乘子法', '条件极值', '约束优化'],
  },
  {
    category: 'multivariable', subcategory: 'green-gauss-stokes',
    macroStrategy: '根据题目类型选择相应的积分定理，将曲线/曲面积分转化为更简单的形式',
    steps: [
      { id: 'step1', description: '识别积分类型并选择对应定理', tool: 'llm', expectedOutput: '格林/高斯/斯托克斯定理', microOperations: ['判定平面曲线积分→格林公式', '判定空间曲面积分→高斯（散度）定理', '判定空间曲线积分→斯托克斯定理'] },
      { id: 'step2', description: '计算被积表达式的旋度/散度', tool: 'sympy', expectedOutput: '∇×F或∇·F的表达式', microOperations: ['计算偏导数组合', '整理旋度或散度表达式'] },
      { id: 'step3', description: '转化并计算新积分', tool: 'sympy', expectedOutput: '积分结果', microOperations: ['根据定理将曲线/曲面积分转为二/三重积分', '在新的积分区域上计算'] },
    ],
    alternativeApproaches: ['直接参数化积分', '对称性技巧'],
    knowledgePoints: ['格林公式', '高斯（散度）定理', '斯托克斯定理'],
  },

  // 向量与空间解析几何 (6组)
  {
    category: 'vector-geometry', subcategory: 'general',
    macroStrategy: '利用向量方法将几何问题代数化，通过计算解决空间中的位置、距离、夹角等问题',
    steps: [
      { id: 'step1', description: '建立坐标系并将几何元素向量化', tool: 'llm', expectedOutput: '点坐标、方向向量、法向量', microOperations: ['选取合适的坐标原点和坐标轴', '将已知点写为坐标', '求方向向量/法向量'] },
      { id: 'step2', description: '根据问题类型选择向量运算', tool: 'llm', expectedOutput: '点积/叉积/混合积/投影', microOperations: ['夹角→点积', '面积/法向量→叉积', '体积/共面→混合积', '距离→投影'] },
      { id: 'step3', description: '执行向量运算并化简得结果', tool: 'sympy', expectedOutput: '最终几何量', microOperations: ['代入向量运算公式', '化简计算', '输出结果并检查合理性'] },
    ],
    alternativeApproaches: ['纯几何方法', '坐标法'],
    knowledgePoints: ['向量代数', '空间解析几何', '向量运算法则'],
  },
  {
    category: 'vector-geometry', subcategory: 'line-plane',
    macroStrategy: '利用方向向量和法向量求解直线与平面的方程、交点、位置关系',
    steps: [
      { id: 'step1', description: '确定直线方向向量和平面法向量', tool: 'llm', expectedOutput: '⃗s(直线方向)和⃗n(平面法向量)', microOperations: ['直线：由两点差或方向角确定⃗s', '平面：由点法式或三点确定⃗n'] },
      { id: 'step2', description: '建立直线/平面方程', tool: 'llm', expectedOutput: '标准方程', microOperations: ['代入点向式或点法式', '化为一般式以便后续计算'] },
      { id: 'step3', description: '求解相关问题（交点/角/距离等）', tool: 'sympy', expectedOutput: '要求的几何量', microOperations: ['联立方程求交点', '用夹角公式求线线/线面/面面角', '用距离公式求距离'] },
    ],
    alternativeApproaches: ['平面束方法', '投影法'],
    knowledgePoints: ['直线方程', '平面方程', '线面位置关系'],
  },
  {
    category: 'vector-geometry', subcategory: 'quadric-surfaces',
    macroStrategy: '识别二次曲面的类型，用截痕法和方程特征判断曲面形状和性质',
    steps: [
      { id: 'step1', description: '将曲面方程化为标准形', tool: 'llm', expectedOutput: '标准形式', microOperations: ['配方完成平方', '识别二次项系数特征', '确定曲面类型'] },
      { id: 'step2', description: '分析曲面特征', tool: 'llm', expectedOutput: '对称性/范围/截痕', microOperations: ['用平行于坐标面的平面截曲面', '分析截面曲线形状', '确定曲面的开口方向和中心'] },
      { id: 'step3', description: '给出曲面完整描述', tool: 'llm', expectedOutput: '曲面名称、图形特征', microOperations: ['椭圆抛物面/双曲抛物面/椭球面等', '说明主要半轴长度', '给出特殊点（顶点/中心）'] },
    ],
    alternativeApproaches: ['特征值法', '正交变换法'],
    knowledgePoints: ['二次曲面', '椭球面', '抛物面', '双曲面', '截痕法'],
  },

  // 线性代数 (6组)
  {
    category: 'linear-algebra', subcategory: 'system-solve',
    macroStrategy: '利用高斯消元法将增广矩阵化为行阶梯形，由秩判断解的情况并求解',
    steps: [
      { id: 'step1', description: '写增广矩阵[A|b]', tool: 'llm', expectedOutput: '增广矩阵', microOperations: ['提取系数矩阵A', '提取常数向量b', '合并为增广矩阵'] },
      { id: 'step2', description: '高斯消元化为行阶梯形', tool: 'llm', expectedOutput: '行阶梯形矩阵', microOperations: ['选取主元', '消元使主元下方元素为0', '重复直到所有列处理完毕'] },
      { id: 'step3', description: '回代求解或给出解的结构', tool: 'sympy', expectedOutput: '唯一解/通解/无解结论', microOperations: ['若r(A)=r([A|b])=n则唯一解', '若r<n则自由变量+基础解系', '若不等秩则无解'] },
    ],
    alternativeApproaches: ['Cramer法则（小型方程组）', '矩阵求逆法'],
    knowledgePoints: ['高斯消元法', '线性方程组理论', '秩判据'],
  },
  {
    category: 'linear-algebra', subcategory: 'eigen-decomposition',
    macroStrategy: '求特征值→求特征向量→判断对角化→构造对角化形式',
    steps: [
      { id: 'step1', description: '解特征方程|A-λI|=0求特征值', tool: 'sympy', expectedOutput: '所有特征值λᵢ', microOperations: ['计算特征多项式', '求特征多项式的根'] },
      { id: 'step2', description: '对每个λᵢ解(A-λᵢI)x=0求特征向量', tool: 'sympy', expectedOutput: '对应各特征值的特征向量', microOperations: ['代入λᵢ', '解齐次方程组', '提取基础解系'] },
      { id: 'step3', description: '构造P和Λ，验证P⁻¹AP=Λ', tool: 'sympy', expectedOutput: '对角化结果', microOperations: ['P=[特征向量]', 'Λ=diag(λᵢ)', '验证'] },
    ],
    alternativeApproaches: ['若不可对角化→Jordan形', '数值方法'],
    knowledgePoints: ['特征值与特征向量', '矩阵对角化', '相似变换'],
  },
  {
    category: 'linear-algebra', subcategory: 'quadratic-standard',
    macroStrategy: '将二次型写为矩阵形式，通过正交变换化为标准形',
    steps: [
      { id: 'step1', description: '写出二次型的对称矩阵A', tool: 'llm', expectedOutput: '对称矩阵A', microOperations: ['提取平方项系数为对角元素', '交叉项系数平分填入'] },
      { id: 'step2', description: '求特征值和特征向量', tool: 'sympy', expectedOutput: '特征值λᵢ和正交化的特征向量', microOperations: ['求特征值', '求特征向量', 'Gram-Schmidt正交化（如需）'] },
      { id: 'step3', description: '写出标准形和正交变换', tool: 'llm', expectedOutput: '标准形 = λ₁y₁²+λ₂y₂²+...', microOperations: ['标准形系数=特征值', '变换矩阵=正交特征向量矩阵', '若有要求判定正定性'] },
    ],
    alternativeApproaches: ['配方法', '合同变换法'],
    knowledgePoints: ['二次型标准形', '正交变换', '正定性', '惯性定律'],
  },

  // 曲线与曲面积分 (4组)
  {
    category: 'multivariable', subcategory: 'line-integral',
    macroStrategy: '参数化曲线，将曲线积分转化为定积分计算；或利用Green公式转化',
    steps: [
      { id: 'step1', description: '写出曲线参数方程', tool: 'llm', expectedOutput: 'x=x(t), y=y(t), t∈[a,b]', microOperations: ['分析曲线的几何形状', '建立参数方程', '确定参数范围'] },
      { id: 'step2', description: '计算弧微元ds或dx/dy转换', tool: 'sympy', expectedOutput: 'ds或dx,dy的参数表达式', microOperations: ['ds=√(x\'²+y\'²)dt', 'dx=x\'dt, dy=y\'dt'] },
      { id: 'step3', description: '代入定积分公式并计算', tool: 'sympy', expectedOutput: '积分值', microOperations: ['被积函数用t表示', '乘以弧微元', '在[a,b]上积分'] },
    ],
    alternativeApproaches: ['Green公式（闭曲线）', '与路径无关的简化法'],
    knowledgePoints: ['曲线积分', '弧长微元', '参数化'],
  },
  {
    category: 'multivariable', subcategory: 'surface-integral',
    macroStrategy: '确定曲面投影区域，将曲面积分化为二重积分；或利用Gauss公式转化',
    steps: [
      { id: 'step1', description: '写出曲面方程和投影区域', tool: 'llm', expectedOutput: 'z=f(x,y), D={(x,y)|条件}', microOperations: ['确定曲面表达式', '分析定义域和投影区域'] },
      { id: 'step2', description: '计算面积微元dS或法向量投影', tool: 'sympy', expectedOutput: 'dS=√(1+f_x²+f_y²)dxdy', microOperations: ['求偏导数f_x,f_y', '代入面积微元公式'] },
      { id: 'step3', description: '化为二重积分并计算', tool: 'sympy', expectedOutput: '积分值', microOperations: ['确定二重积分限', '逐层积分'] },
    ],
    alternativeApproaches: ['Gauss公式（闭曲面）', 'Stokes公式（关联曲线积分）'],
    knowledgePoints: ['曲面积分', 'Gauss散度定理', '曲面参数化', '法向量'],
  },
];

// ============================================
// 第四步：知识模板引擎 - 知识点->解题方法映射
// ============================================
export interface KnowledgeToMethod {
  knowledgePoint: string;
  applicableProblems: string[];
  methods: string[];
  commonMistakes: string[];
  relatedFormulas: string[];
}

export const KNOWLEDGE_METHOD_MAP: KnowledgeToMethod[] = [
  {
    knowledgePoint: '极限的定义',
    applicableProblems: ['判断极限是否存在', '验证函数连续性', 'ε-δ证明'],
    methods: ['ε-δ语言', '左右极限比较法', '数列极限的ε-N语言'],
    commonMistakes: ['混淆函数极限和数列极限', '忽略左右极限不等的情况', '用代入法代不可代入的点'],
    relatedFormulas: ['|f(x)-L|<ε', '∀ε>0, ∃δ>0', '0<|x-a|<δ'],
  },
  {
    knowledgePoint: '导数定义',
    applicableProblems: ['求某点导数', '判断可导性', '定义法求导'],
    methods: ['导数定义法lim_{h→0}[f(x+h)-f(x)]/h', '分段点需用定义验证左右导数', '利用定义证明不可导'],
    commonMistakes: ['用求导公式求分段点的导数（错误！必须用定义）', '未验证左右导数是否相等'],
    relatedFormulas: ['f\'(x)=\\lim_{h\\to 0}\\frac{f(x+h)-f(x)}{h}', '左导数=右导数⇒可导'],
  },
  {
    knowledgePoint: '洛必达法则',
    applicableProblems: ['0/0型不定式极限', '∞/∞型不定式极限', '转化为0/0或∞/∞的其他不定式'],
    methods: ['分子分母分别求导法', '多次迭代应用', '配合等价无穷小加速计算'],
    commonMistakes: ['对非不定式使用', '用商法则代替分别求导', '每次应用后不验证不定式条件'],
    relatedFormulas: ['\\lim\\frac{f(x)}{g(x)}=\\lim\\frac{f\'(x)}{g\'(x)}', '条件：0/0或∞/∞'],
  },
  {
    knowledgePoint: '链式法则',
    applicableProblems: ['复合函数求导', '隐函数求导', '参数方程求导'],
    methods: ['外导乘内导', '多层链式：逐层递推', '结合其他求导法则（乘积/商法则）'],
    commonMistakes: ['遗漏内部导数', '多层复合时漏层', '符号错误（内导符号未正确处理）'],
    relatedFormulas: ['(f(g(x)))\'=f\'(g(x))·g\'(x)', '(f(g(h(x))))\'=f\'(g)\'·g(h)\'(h)\'·h\'(x)'],
  },
  {
    knowledgePoint: '分部积分法',
    applicableProblems: ['x^n·e^x类积分', 'x^n·sin x/cos x类积分', 'ln x相关积分', 'arcsin/arctan类积分'],
    methods: ['LIPET口诀选择u', '分部积分+代数方程法求∫e^x·sin x dx型', '分部积分递推法求∫sin^n x dx型'],
    commonMistakes: ['u和dv选择不当导致积分更复杂', '忽略边界项uv', '符号错误'],
    relatedFormulas: ['\\int u dv = uv - \\int v du', 'LIPET：Log > InvTrig > Power > Exp > Trig'],
  },
  {
    knowledgePoint: '牛顿-莱布尼茨公式',
    applicableProblems: ['定积分计算', '变限积分求导', '积分上限函数'],
    methods: ['N-L公式：求原函数代入上下限', '对变限积分求导：d/dx ∫_a^x f(t)dt = f(x)'],
    commonMistakes: ['换元后忘记更新上下限', '原函数选择不当', '奇点未处理（反常积分误当定积分）'],
    relatedFormulas: ['\\int_a^b f(x)dx = F(b)-F(a)', '\\frac{d}{dx}\\int_a^x f(t)dt = f(x)'],
  },
];

// ============================================
// 第五步：模板计数器（id）
// ============================================
export function countTemplates(): {
  classificationPatterns: number;
  stepTemplateGroups: number;
  planTemplateGroups: number;
  knowledgeMethodEntries: number;
  total: number;
} {
  return {
    classificationPatterns: CLASSIFICATION_PATTERNS.length,
    stepTemplateGroups: RULE_STEP_TEMPLATES.reduce((sum, t) => sum + t.templates.length, 0),
    planTemplateGroups: PLAN_TEMPLATES.length,
    knowledgeMethodEntries: KNOWLEDGE_METHOD_MAP.length,
    total:
      CLASSIFICATION_PATTERNS.length +
      RULE_STEP_TEMPLATES.reduce((sum, t) => sum + t.templates.length, 0) +
      PLAN_TEMPLATES.length +
      KNOWLEDGE_METHOD_MAP.length,
  };
}
