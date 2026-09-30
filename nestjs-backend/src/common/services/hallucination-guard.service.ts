import { Injectable, Logger } from '@nestjs/common';

export enum HallucinationType {
  FALSE_THEOREM = 'false_theorem',
  INCORRECT_FORMULA = 'incorrect_formula',
  MISAPPLIED_CONDITION = 'misapplied_condition',
  FABRICATED_RESULT = 'fabricated_result',
  UNIT_ERROR = 'unit_error',
  DOMAIN_ERROR = 'domain_error',
}

export interface HallucinationIssue {
  type: HallucinationType;
  description: string;
  location: string;
  severity: 'critical' | 'warning';
  suggestedCorrection: string;
  confidence: number;
}

export interface TheoremRecord {
  name: string;
  aliases: string[];
  statement: string;
  conditions: string[];
  conclusion: string;
  category: string;
  commonMisuses: string[];
}

export interface VerificationResult {
  stepContent: string;
  isVerified: boolean;
  theoremIssues: HallucinationIssue[];
  sympyResult?: SymPyVerification;
  overallConfidence: number;
}

export interface SymPyVerification {
  computedResult: string;
  matchesExpectation: boolean;
  discrepancy?: string;
  precision: number;
}

const THEOREM_DATABASE: TheoremRecord[] = [
  {
    name: '罗尔定理 (Rolle\'s Theorem)',
    aliases: ['rolle', '罗尔'],
    statement: '若f(x)∈C[a,b]∩D(a,b)且f(a)=f(b)，则∃ξ∈(a,b): f\'(ξ)=0',
    conditions: [
      'f在[a,b]上连续',
      'f在(a,b)内可导',
      'f(a)=f(b)（端点值相等）',
    ],
    conclusion: '∃ξ∈(a,b), f\'(ξ)=0',
    category: 'differential_mean_value',
    commonMisuses: [
      '未验证f(a)=f(b)条件',
      '错误地认为ξ=(a+b)/2',
      '在开区间(a,b)内ξ不唯一时认为定理失效',
    ],
  },
  {
    name: '拉格朗日中值定理 (Lagrange Mean Value Theorem)',
    aliases: ['lagrange', '拉格朗日', '中值定理'],
    statement: '若f∈C[a,b]∩D(a,b)，则∃ξ∈(a,b): f\'(ξ)=[f(b)-f(a)]/(b-a)',
    conditions: [
      'f在[a,b]上连续',
      'f在(a,b)内可导',
    ],
    conclusion: '∃ξ∈(a,b), f\'(ξ)=[f(b)-f(a)]/(b-a)',
    category: 'differential_mean_value',
    commonMisuses: [
      '将定理运用于不可导的函数',
      '忘记ξ是存在于开区间而非闭区间',
      '错误地认为f\'(ξ)恒为零（混淆罗尔定理）',
    ],
  },
  {
    name: '柯西中值定理 (Cauchy Mean Value Theorem)',
    aliases: ['cauchy', '柯西'],
    statement: '若f,g∈C[a,b]∩D(a,b)且g\'(x)≠0，则∃ξ∈(a,b): [f(b)-f(a)]/[g(b)-g(a)]=f\'(ξ)/g\'(ξ)',
    conditions: [
      'f,g在[a,b]上连续',
      'f,g在(a,b)内可导',
      'g\'(x)≠0, ∀x∈(a,b)',
      'g(b)≠g(a)',
    ],
    conclusion: '∃ξ∈(a,b), [f(b)-f(a)]/[g(b)-g(a)]=f\'(ξ)/g\'(ξ)',
    category: 'differential_mean_value',
    commonMisuses: [
      '忘记g\'(x)≠0的条件',
      '将柯西中值定理与洛必达法则混淆',
      '消去g时忘记验证g\'(ξ)≠0',
    ],
  },
  {
    name: '洛必达法则 (L\'Hôpital\'s Rule)',
    aliases: ['lhopital', 'l\'hôpital', '洛必达'],
    statement: '若lim f(x)/g(x)为0/0或∞/∞型，且f,g可导，lim f\'(x)/g\'(x)存在，则原极限等于此极限',
    conditions: [
      '极限为0/0或∞/∞型不定式',
      'f,g在去心邻域内可导',
      'g\'(x)≠0在邻域内',
      'lim f\'(x)/g\'(x)存在或为∞',
    ],
    conclusion: 'lim f(x)/g(x)=lim f\'(x)/g\'(x)',
    category: 'limit',
    commonMisuses: [
      '不验证不定式条件直接使用',
      '多次使用时未每次都重新验证条件',
      '将洛必达法则与商的求导法则混淆',
      '0·∞、∞-∞、0^0等型未先转化就直接用',
    ],
  },
  {
    name: '牛顿-莱布尼茨公式 (Newton-Leibniz Formula)',
    aliases: ['牛顿莱布尼茨', '微积分基本定理', 'NL formula'],
    statement: '若f∈C[a,b]且F是f在[a,b]上的一个原函数，则∫_a^b f(x)dx=F(b)-F(a)',
    conditions: [
      'f在[a,b]上可积/连续',
      'F是f在[a,b]上的原函数',
    ],
    conclusion: '∫_a^b f(x)dx=F(b)-F(a)',
    category: 'integral',
    commonMisuses: [
      '将含有瑕点的反常积分当作普通定积分使用',
      '原函数分段表达式忘记统一常数',
      '对含参变量积分误用',
    ],
  },
  {
    name: '泰勒定理 (Taylor\'s Theorem)',
    aliases: ['taylor', '泰勒'],
    statement: '若f^{(n+1)}在含x₀区间内连续，则f(x)=T_n(x)+R_n(x)',
    conditions: [
      'f在展开区间内n+1阶可导',
      '余项形式与函数的性质对应',
    ],
    conclusion: 'f(x)=Σ[f^{(k)}(x₀)/k!](x-x₀)^k+R_n(x)',
    category: 'series',
    commonMisuses: [
      '忘记余项/忽略余项的量阶估计',
      '展开阶数不够就截断',
      '展开点选择不当导致收敛慢或无意义',
      '拉格朗日余项和皮亚诺余项混淆使用',
    ],
  },
  {
    name: '隐函数定理 (Implicit Function Theorem)',
    aliases: ['隐函数存在定理', 'implicit function theorem'],
    statement: '若F∈C¹且F_y≠0，则F(x,y)=0在局部确定y=f(x)且f\'(x)=-F_x/F_y',
    conditions: [
      'F(x₀,y₀)=0',
      'F具有连续偏导数',
      'F_y(x₀,y₀)≠0',
    ],
    conclusion: '∃局部隐函数y=φ(x)，且dy/dx=-F_x/F_y',
    category: 'multivariable',
    commonMisuses: [
      '忘记F_y≠0的条件',
      '求导公式负号遗漏',
      '分子分母颠倒(写成-F_y/F_x)',
    ],
  },
  {
    name: '格林公式 (Green\'s Theorem)',
    aliases: ['green', '格林'],
    statement: '∮_∂D Pdx+Qdy=∬_D(∂Q/∂x-∂P/∂y)dxdy',
    conditions: [
      'P,Q∈C¹',
      '区域D是正向简单闭曲线围成的',
      '∂D分段光滑',
    ],
    conclusion: '∮_∂D Pdx+Qdy=∬_D(Q_x-P_y)dxdy',
    category: 'multivariable',
    commonMisuses: [
      '方向搞反（忘记正向是指左侧为内部的逆时针方向）',
      '偏导数相减次序搞反',
      '在非单连通区域使用',
    ],
  },
  {
    name: '积分中值定理 (Mean Value Theorem for Integrals)',
    aliases: ['积分中值', 'mean value theorem integral'],
    statement: '若f∈C[a,b]，则∃ξ∈[a,b]: ∫_a^b f(x)dx=f(ξ)(b-a)',
    conditions: [
      'f在[a,b]上连续',
    ],
    conclusion: '∃ξ∈[a,b], ∫_a^b f(x)dx=f(ξ)(b-a)',
    category: 'integral',
    commonMisuses: [
      '在推广的积分中值定理中忘记了g(x)不变号的条件',
      'ξ误认为一定在(a,b)内而非[a,b]',
      '符号不等式推导时用错',
    ],
  },
  {
    name: '线性微分方程解的结构 (Structure of Linear ODE Solutions)',
    aliases: ['线性DE结构', '解的结构', 'superposition principle'],
    statement: 'n阶线性ODE：y^{(n)}+P_1y^{(n-1)}+...+P_ny=Q(x)的通解=齐次通解+非齐次特解',
    conditions: [
      'P_i(x), Q(x)在区间I上连续',
    ],
    conclusion: 'y=y_h+y_p（叠加原理）',
    category: 'differential_equations',
    commonMisuses: [
      '齐次解基底选取不当（非基本解组）',
      '特解设为错误形式',
      '叠加原理仅适用于线性方程，非线性方程不能叠加',
    ],
  },

  // ========== 新增定理 (70+) ==========

  // --- 极限理论 (8) ---
  { name: '夹逼定理 (Squeeze Theorem)', aliases: ['夹逼', 'squeeze', '迫敛定理'], statement: '若g(x)≤f(x)≤h(x)且lim g(x)=lim h(x)=L，则lim f(x)=L', conditions: ['g(x)≤f(x)≤h(x)邻域内成立', 'lim g,lim h存在且相等'], conclusion: 'lim f(x)=L', category: 'limit', commonMisuses: ['未验证不等式', '上下界极限不等时误用'] },
  { name: '单调有界定理', aliases: ['单调有界', '单调收敛'], statement: '单调有界数列必有极限', conditions: ['数列单调', '数列有界'], conclusion: '数列收敛', category: 'limit', commonMisuses: ['忽略单调性验证', '对非单调数列使用'] },
  { name: '零点定理 (IVT)', aliases: ['零点定理', '根的存在定理', 'Bolzano'], statement: '若f∈C[a,b]且f(a)f(b)<0，则∃c∈(a,b):f(c)=0', conditions: ['f连续', 'f(a)与f(b)异号'], conclusion: '区间内存在至少一个零点', category: 'limit', commonMisuses: ['不验证连续性', '同号时仍断言有零点'] },
  { name: '海涅定理 (Heine)', aliases: ['海涅', '归结原则'], statement: 'lim f(x)=L ⟺ 任意x_n→a且x_n≠a有lim f(x_n)=L', conditions: ['函数极限存在'], conclusion: '函数极限与数列极限等价', category: 'limit', commonMisuses: ['仅用一个数列断言函数极限', '忽略x_n≠a'] },
  { name: '保号性定理', aliases: ['保号性', '保持符号'], statement: '若lim f=A≠0，则附近f保持A的符号', conditions: ['极限存在且非零'], conclusion: '局部保号', category: 'limit', commonMisuses: ['极限为零时误用', '局部与整体混淆'] },
  { name: 'Stolz定理', aliases: ['stolz', '施笃兹', '数列洛必达'], statement: '{b_n}严格单调→∞且lim Δa/Δb存在，则lim a_n/b_n=该极限', conditions: ['{b_n}严格单调→∞', '极限存在'], conclusion: 'lim a_n/b_n=lim Δa/Δb', category: 'limit', commonMisuses: ['忘记严格单调', '当成洛必达乱用'] },
  { name: '极限四则运算法则', aliases: ['四则运算', '极限四则'], statement: 'lim[f±g]=lim f±lim g, lim[fg]=lim f·lim g, lim[f/g]=lim f/lim g(g≠0)', conditions: ['各极限存在有限'], conclusion: '分别求极限后再运算', category: 'limit', commonMisuses: ['分母极限0时误用', '∞-∞乱直接用'] },
  { name: '等价无穷小替换定理', aliases: ['等价无穷小', '无穷小替换'], statement: '若α~β(x→0)且在乘除因子中，可将α替换为β', conditions: ['同阶无穷小', '仅在乘除中使用'], conclusion: 'lim(αf)=lim(βf)', category: 'limit', commonMisuses: ['加减中直接替换', '不同阶混用'] },

  // --- 导数与微分 (8) ---
  { name: '费马引理', aliases: ['Fermat', '极值必要条件'], statement: '若f有极值且可导，则f\'=0', conditions: ['极值', '可导'], conclusion: 'f\'=0', category: 'differential_mean_value', commonMisuses: ['逆定理不成立', '不可导点也可以是极值'] },
  { name: '达布定理 (Darboux)', aliases: ['Darboux', '导函数介值性'], statement: '可导函数的导函数具有介值性', conditions: ['f可导'], conclusion: 'f\'具有介值性', category: 'differential_mean_value', commonMisuses: ['混淆导函数与原函数的介值性'] },
  { name: '链式法则', aliases: ['chain rule', '复合求导'], statement: '(f(g(x)))\'=f\'(g(x))·g\'(x)', conditions: ['f,g可导'], conclusion: '外导×内导', category: 'derivative', commonMisuses: ['漏乘内导', '多层漏层'] },
  { name: '乘积法则', aliases: ['product rule', '积的导数'], statement: '(uv)\'=u\'v+uv\'', conditions: ['u,v可导'], conclusion: '两项之和(不是积)', category: 'derivative', commonMisuses: ['写成u\'v\'', '多因子遗忘多次使用'] },
  { name: '商法则', aliases: ['quotient rule', '商的导数'], statement: '(u/v)\'=(u\'v-uv\')/v²', conditions: ['u,v可导,v≠0'], conclusion: '分子u\'v-uv\'/分母v²', category: 'derivative', commonMisuses: ['分子次序搞反', '分母写成v非v²'] },
  { name: '隐函数求导法则', aliases: ['隐函数求导', 'implicit differentiation'], statement: '对F(x,y)=0求x导得F_x+F_yy\'=0→y\'=-F_x/F_y', conditions: ['F有连续偏导', 'F_y≠0'], conclusion: 'y\'=-F_x/F_y', category: 'derivative', commonMisuses: ['忘乘y\'', '负号遗漏'] },
  { name: '对数求导法', aliases: ['对数求导', 'logarithmic differentiation'], statement: '对y=f(x)取ln后求导：y\'/y=d(ln y)/dx', conditions: ['f(x)>0'], conclusion: 'y\'=y·(ln y)\'', category: 'derivative', commonMisuses: ['忽略f>0条件', '绝对值求导忘1/x法则'] },
  { name: '基本求导公式', aliases: ['求导公式', 'derivative formulas'], statement: '(x^n)\'=nx^{n-1},(sin x)\'=cos x,(e^x)\'=e^x,(ln x)\'=1/x', conditions: ['定义域内可导'], conclusion: '基本初等函数导数表', category: 'derivative', commonMisuses: ['幂法则忘减1', 'cos导忘负号'] },

  // --- 积分学 (10) ---
  { name: '不定积分基本公式', aliases: ['积分公式', 'integral formulas'], statement: '∫x^ndx=x^{n+1}/(n+1)+C(n≠-1),∫sin xdx=-cos x+C,∫e^xdx=e^x+C', conditions: ['可积'], conclusion: '基本函数积分表', category: 'integral', commonMisuses: ['n=-1误用幂法则', '三角符号搞反', '忘+C'] },
  { name: '换元积分法', aliases: ['换元法', 'substitution', '凑微分'], statement: '∫f(g(x))g\'(x)dx=∫f(u)du', conditions: ['f连续', 'g可导'], conclusion: '换元简化积分', category: 'integral', commonMisuses: ['忘换回原变量', '定积分上限不变'] },
  { name: '分部积分法', aliases: ['分部积分', 'integration by parts'], statement: '∫udv=uv-∫vdu', conditions: ['u,v可导'], conclusion: '转化积分类型', category: 'integral', commonMisuses: ['u,dv选择不当', '忘uv项', '符号搞乱'] },
  { name: '有理函数积分', aliases: ['部分分式', 'partial fraction'], statement: '有理函数→多项式+真分式→部分分式→逐项积分', conditions: ['被积函数为有理式'], conclusion: '分解后积分', category: 'integral', commonMisuses: ['忘先除多项式', '重因式设错型'] },
  { name: '三角换元法', aliases: ['trig substitution', '三角代换'], statement: '√(a²-x²)→a sinθ;√(a²+x²)→a tanθ;√(x²-a²)→a secθ', conditions: ['含特定根式'], conclusion: '消去根号', category: 'integral', commonMisuses: ['类型选错', '回代用错反三角'] },
  { name: 'N-L公式', aliases: ['牛莱公式', '牛顿莱布尼茨', 'FTC'], statement: '∫_a^b f(x)dx=F(b)-F(a)', conditions: ['f在[a,b]可积', 'F是原函数'], conclusion: '定积分=原函数值差', category: 'integral', commonMisuses: ['瑕积分当定积分', '分段原函数忘统一常数'] },
  { name: 'p-积分判别', aliases: ['p积分', 'p-test'], statement: '∫_1^∞ dx/x^p: p>1收敛p≤1发散;∫_0^1: p<1收敛p≥1发散', conditions: ['比较基准1/x^p'], conclusion: 'p积分判敛散', category: 'integral', commonMisuses: ['混淆∞与瑕点两种p条件'] },
  { name: '奇偶函数积分性质', aliases: ['奇偶积分', '对称区间'], statement: '∫_{-a}^a f=2∫_0^a f(f偶),=0(f奇)', conditions: ['对称区间', '奇偶性成立'], conclusion: '利用对称简化', category: 'integral', commonMisuses: ['区间不对称仍用', '奇偶性不严格'] },
  { name: '积分中值定理', aliases: ['积分中值', 'mean value theorem integral'], statement: '若f∈C[a,b]则∃ξ∈[a,b]:∫_a^b f=f(ξ)(b-a)', conditions: ['f连续'], conclusion: 'ξ处函数值=平均值', category: 'integral', commonMisuses: ['推广中忘g不变号', 'ξ误认为必在(a,b)'] },
  { name: '广义积分敛散性', aliases: ['反常积分', 'improper integral'], statement: '反常积分收敛⟺极限形式的定积分存在有限', conditions: ['极限存在有限'], conclusion: '判定收敛或发散', category: 'integral', commonMisuses: ['无界当作有界处理', '比较判别法基准选错'] },

  // --- 无穷级数 (10) ---
  { name: '级数收敛必要条件', aliases: ['通项趋零', 'necessary condition'], statement: 'Σa_n收敛⇒lim a_n=0(逆不成立)', conditions: ['级数收敛'], conclusion: 'lim a_n=0', category: 'series', commonMisuses: ['逆命题不成立', '调和级数是反例'] },
  { name: 'p-级数判敛', aliases: ['p级数', 'p-series'], statement: 'Σ1/n^p: p>1收敛,p≤1发散', conditions: ['p>0'], conclusion: 'p>1收敛', category: 'series', commonMisuses: ['调和级数(p=1)发散'] },
  { name: '等比级数', aliases: ['几何级数', 'geometric series'], statement: 'Σar^n:|r|<1收敛,r≥1发散', conditions: ['公比r'], conclusion: '|r|<1:和为a/(1-r)', category: 'series', commonMisuses: ['|r|=1发散', '收敛区间不含端点'] },
  { name: '比值判别法', aliases: ['d\'alembert', 'ratio test', '达朗贝尔'], statement: 'ρ=lim|a_{n+1}/a_n|:ρ<1收敛,ρ>1发散,ρ=1失效', conditions: ['极限ρ存在'], conclusion: 'ρ判敛散', category: 'series', commonMisuses: ['ρ=1时强行判定', '忘取绝对值'] },
  { name: '根值判别法', aliases: ['cauchy root', 'root test', '柯西根值'], statement: 'ρ=lim(n√|a_n|):判法同比值法', conditions: ['极限存在'], conclusion: 'ρ<1收敛;ρ>1发散', category: 'series', commonMisuses: ['ρ=1时强行判定'] },
  { name: '莱布尼茨判别法', aliases: ['leibniz', '交错级数法', 'alternating'], statement: '欠值数列单调递减趋零→交错级数收敛', conditions: ['a_n单调递减', 'lim a_n=0'], conclusion: '交错级数收敛', category: 'series', commonMisuses: ['忘验证单调', '非交错用此'] },
  { name: '阿贝尔定理', aliases: ['Abel', '幂级数端点'], statement: '若幂级数在R+a收敛则[0,R]内一致收敛', conditions: ['收敛半径R', '端点收敛'], conclusion: '内闭一致收敛', category: 'series', commonMisuses: ['与Dirichlet混淆'] },
  { name: '绝对收敛定理', aliases: ['absolute convergence', '绝对收敛'], statement: 'Σ|a_n|收敛⇒Σa_n收敛(逆不真)', conditions: ['Σ|a_n|收敛'], conclusion: '级数收敛', category: 'series', commonMisuses: ['条件收敛去绝对值后发散≠原级数发散'] },
  { name: 'Weierstrass M判别法', aliases: ['M-判别法', '优级数'], statement: '|f_n|≤M_n且ΣM_n收敛⇒Σf_n一致收敛', conditions: ['M_n常数级数收敛', '|f_n|≤M_n'], conclusion: '一致收敛', category: 'series', commonMisuses: ['M_n不够大', '逆不成立'] },
  { name: '逐项微分/积分定理', aliases: ['逐项求导', 'termwise'], statement: '幂级数在收敛区间内可逐项求导和积分，半径不变', conditions: ['|z|<R内收敛'], conclusion: '可交换Σ与∂/∂x', category: 'series', commonMisuses: ['收敛半径误认为改变', '端点处仍用'] },

  // --- 微分方程 (8) ---
  { name: '一阶线性通解公式', aliases: ['linear first order', '积分因子'], statement: 'y\'+Py=Q的解:y=e^{-∫Pdx}[∫Qe^{∫Pdx}dx+C]', conditions: ['P,Q连续'], conclusion: '通解包含所有解', category: 'differential_equations', commonMisuses: ['e^{-∫P}符号', '积分顺序'] },
  { name: '特征方程法(二阶常系数齐次)', aliases: ['characteristic equation', '二阶齐次'], statement: 'y\'\'+py\'+qy=0→r²+pr+q=0', conditions: ['p,q为常数'], conclusion: '按特征根类型写通解', category: 'differential_equations', commonMisuses: ['重根漏(C₁+C₂x)e^{rx}', '复根忘sin/cos'] },
  { name: '可分离变量法', aliases: ['separable', '分离变量'], statement: 'dy/dx=g(x)h(y)→∫dy/h=∫gdx+C', conditions: ['h(y)≠0'], conclusion: '隐式/显式解', category: 'differential_equations', commonMisuses: ['忘h=0常解', '分离符号错'] },
  { name: '齐次方程法', aliases: ['homogeneous ODE', '齐次法'], statement: 'dy/dx=f(y/x)→u=y/x化为分离方程', conditions: ['方程形如右'], conclusion: '换元后可分离积分', category: 'differential_equations', commonMisuses: ['非标准形强行换', 'u\'推导时链式漏'] },
  { name: 'Bernoulli方程', aliases: ['Bernoulli', '伯努利'], statement: 'y\'+Py=Qy^n→z=y^{1-n}化为线性', conditions: ['n≠0,1'], conclusion: '幂替代→一阶线性', category: 'differential_equations', commonMisuses: ['n=0/1时乱用'] },
  { name: 'Laplace变换', aliases: ['拉普拉斯', 's域'], statement: 'ℒ{f(t)}=∫_0^∞ e^{-st}f(t)dt', conditions: ['f分段连续', '指数增长限制'], conclusion: '时域→频域', category: 'differential_equations', commonMisuses: ['ℒ{f\'}=sF(s)-f(0)符号错', '忘逆变换'] },
  { name: 'Euler方程', aliases: ['欧拉方程', 'Euler ODE'], statement: 'x²y\'\'+axy\'+by=0→x=e^t转为常系数', conditions: ['x>0'], conclusion: '化常系数→特征方程', category: 'differential_equations', commonMisuses: ['忘x>0', '代换链式'] },
  { name: '常数变易法', aliases: ['variation of parameters', '变易法'], statement: '将齐次通解中的常数C换为函数u(x)求特解', conditions: ['已知齐次通解'], conclusion: '求非齐次特解', category: 'differential_equations', commonMisuses: ['混淆齐次基底', 'u\'解积分忘常数'] },

  // --- 多元微积分 (12) ---
  { name: 'Schwarz定理', aliases: ['Schwarz', '混合偏导交换'], statement: '若∂²f/∂x∂y与∂²f/∂y∂x连续,则它们相等', conditions: ['二阶混合偏导连续'], conclusion: '混合偏导可交换', category: 'multivariable', commonMisuses: ['不连续处仍交换'] },
  { name: '方向导数=', aliases: ['directional derivative', '梯度方向'], statement: '∂f/∂u=∇f·û(方向取单位)', conditions: ['f可微', 'u单位向量'], conclusion: '方向导数=梯度投影', category: 'multivariable', commonMisuses: ['方向忘单位化', '投影公式雜'] },
  { name: '全微分条件', aliases: ['total differential', '可微'], statement: 'dz=(∂f/∂x)dx+(∂f/∂y)dy', conditions: ['f可微(偏导连续)'], conclusion: '增量=偏导线性组合', category: 'multivariable', commonMisuses: ['偏导存在≠可微', '忘交叉项'] },
  { name: 'Hessian二阶判极值', aliases: ['Hessian', '黑塞判别', '多元极值'], statement: '驻点:H=|f_xx f_xy;f_xy f_yy|>0∧f_xx>0极小, f_xx<0极大,<0鞍点', conditions: ['梯度=0', '二阶偏导连续'], conclusion: '判极值类型', category: 'multivariable', commonMisuses: ['忘梯度=0前提', 'H=0强行判定'] },
  { name: '拉格朗日乘数法', aliases: ['Lagrange multiplier', '条件极值'], statement: 'min f s.t.g=0→L=f+λg,解∇L=0', conditions: ['f,g可微', '∇g≠0'], conclusion: '条件驻点满足∇f=-λ∇g', category: 'multivariable', commonMisuses: ['忘∇g≠0', '解后不验证'] },
  { name: 'Jacobian变换', aliases: ['Jacobian', '坐标变换', '雅可比'], statement: 'dxdy=|∂(x,y)/∂(u,v)|dudv;极坐标:rdrdθ', conditions: ['变换一一映射'], conclusion: '面积微元乘雅可比', category: 'multivariable', commonMisuses: ['松忘乘雅可比', '极坐标忘记r'] },
  { name: '格林公式', aliases: ['Green', '格林定理'], statement: '∮Pdx+Qdy=∬(Q_x-P_y)dxdy', conditions: ['P,Q∈C¹', 'D简单闭曲线正向'], conclusion: '曲线→二重积分', category: 'multivariable', commonMisuses: ['方向反', '减法次序'] },
  { name: '高斯散度定理', aliases: ['Gauss', 'divergence theorem'], statement: '∯F·n̂dS=∭∇·F dV', conditions: ['F∈C¹', '外侧'], conclusion: '曲面→体积积分', category: 'multivariable', commonMisuses: ['法向内外符号', 'div公式'] },
  { name: '斯托克斯定理', aliases: ['Stokes', '旋度定理', 'STOKES'], statement: '∮F·dr=∬(∇×F)·n̂dS', conditions: ['F∈C¹', '右手系'], conclusion: '空间曲线→曲面积分', category: 'multivariable', commonMisuses: ['旋度方向', '叉积分量'] },
  { name: '路径无关条件', aliases: ['conservative', '保守场', '势函数'], statement: 'Py=Qx在单连通区⇒∫Pdx+Qdy路径无关', conditions: ['单连通', 'Py=Qx'], conclusion: 'F=∇φ', category: 'multivariable', commonMisuses: ['非单连通仍用', '势函数求法错'] },
  { name: 'Fubini换序', aliases: ['Fubini', '交换积分顺序'], statement: '∬f dxdy=∬f dydx(连续或绝对可积)', conditions: ['f在D上连续/绝对可积'], conclusion: '积分顺序可调', category: 'multivariable', commonMisuses: ['换序后区域描述错'] },

  // --- 向量几何 (6) ---
  { name: '向量的点积', aliases: ['dot product', '内积', '数量积'], statement: 'a·b=a_xb_x+a_yb_y+a_zb_z=|a||b|cosθ', conditions: ['a,b向量'], conclusion: '点积=0⇔a⊥b', category: 'vector_geometry', commonMisuses: ['结果当成向量(应为标量)', '夹角公式±错'] },
  { name: '向量的叉积', aliases: ['cross product', '外积', '向量积'], statement: 'a×b=|a||b|sinθ·n(右手定则)', conditions: ['a,b两向量'], conclusion: '叉积⊥于a,b张成的平面', category: 'vector_geometry', commonMisuses: ['结果当标量(应为向量)', '右手定则反'] },
  { name: '混合积', aliases: ['混合积', 'scalar triple', '(a×b)·c'], statement: '(a×b)·c=行列式[a b c]=±平行六面体体积', conditions: ['三向量'], conclusion: '共面⇔混合积=0', category: 'vector_geometry', commonMisuses: ['行列式排列次序影响符号'] },
  { name: '直线方程(点向式)', aliases: ['点向式', '对称式', '直线方程'], statement: '(x-x₀)/m=(y-y₀)/n=(z-z₀)/p', conditions: ['方向(m,n,p)≠0'], conclusion: '空间直线的标准方程', category: 'vector_geometry', commonMisuses: ['某分母=0时特例处理'] },
  { name: '平面方程(点法式)', aliases: ['点法式', 'plane equation'], statement: 'A(x-x₀)+B(y-y₀)+C(z-z₀)=0', conditions: ['法向量(A,B,C)≠0'], conclusion: '过点且⊥于法向量的平面', category: 'vector_geometry', commonMisuses: ['法向量与方程系数对应'] },
  { name: '二次曲面', aliases: ['quadric surface', '二次曲面', '椭球面'], statement: 'Ax²+By²+Cz²+Dxy+Exz+Fyz+...=0(标准:椭球/抛物/双曲面)', conditions: ['二阶多项式方程'], conclusion: '六大类二次曲面', category: 'vector_geometry', commonMisuses: ['配方错误', '类型识别差错'] },

  // --- 线性代数 (12) ---
  { name: '行列式基本性质', aliases: ['det性质', 'determinant', '行列式'], statement: '|A^T|=|A|;|AB|=|A||B|;|kA|=k^n|A|', conditions: ['A,B n阶方阵'], conclusion: '行列式乘法性/位等', category: 'linear_algebra', commonMisuses: ['|A+B|≠|A|+|B|', '互换行忘变号'] },
  { name: '逆矩阵存在条件', aliases: ['可逆', '逆矩阵', '矩阵逆'], statement: 'A⁻¹存在⇔|A|≠0⇔rank(A)=n', conditions: ['A为方阵'], conclusion: 'A⁻¹=(1/|A|)adj(A)', category: 'linear_algebra', commonMisuses: ['非方阵求逆', '|A|=0仍写'] },
  { name: '线性方程组解大定理', aliases: ['解结构', '秩判据', '方程组'], statement: 'r(A)=r([A|b])=n→唯一解;<n→无穷多解;不等→无解', conditions: ['A系数矩阵'], conclusion: '秩唯一决定解数量', category: 'linear_algebra', commonMisuses: ['自由变量个数=N-r'] },
  { name: '特征值问题', aliases: ['eigenvalue', '特征向量', '特征分'], statement: '|A-λI|=0→λᵢ;(A-λᵢI)x=0→eigenvector', conditions: ['A方阵'], conclusion: '能对角化需n个LIN特征向量', category: 'linear_algebra', commonMisuses: ['重根对应特征空间'] },
  { name: 'Cayley-Hamilton定理', aliases: ['Cayley-Hamilton', '凯莱-哈密顿'], statement: '方阵满足自身特征多项式:P(A)=0', conditions: ['A为方阵'], conclusion: '可降幂/求幂', category: 'linear_algebra', commonMisuses: ['特征多项式符号搞反'] },
  { name: '实对称矩阵对角化', aliases: ['实对称', '谱定理', '正交对'], statement: '实对称矩阵→正交矩阵Q:Q^{-1}=Q^T,Q^TAQ=Λ', conditions: ['A^T=A实数'], conclusion: '不同特征向量自动正交', category: 'linear_algebra', commonMisuses: ['非对称强求正交对角化'] },
  { name: '相似矩阵', aliases: ['similarity', 'similar matrices', 'A~B'], statement: 'A=P⁻¹BP⇒|A|=|B|,tr(A)=tr(B),rank相等,特征多项式同', conditions: ['∃P可逆使关系成立'], conclusion: '行列式/迹/秩/特征值不变', category: 'linear_algebra', commonMisuses: ['相似≠合同'] },
  { name: '分块矩阵定理', aliases: ['分块', 'block matrix', '分块'], statement: '|A B;0 D|=|A||D|;可求分块逆', conditions: ['分块大小相容'], conclusion: '子行列式运算分块求', category: 'linear_algebra', commonMisuses: ['左上角零块的混淆'] },
  { name: '秩不等式', aliases: ['秩不等式', 'Sylvester', 'rank'], statement: 'rank(AB)≤min(rank(A),rank(B));rank(A+B)≤rank(A)+rank(B)', conditions: ['A,B兼容'], conclusion: '秩小于等于', category: 'linear_algebra', commonMisuses: ['AB秩充≤min非max'] },
  { name: 'Vandermonde行列式', aliases: ['Vandermonde', '范德蒙'], statement: '|1 x₁ x₁²...;1 x₂ x₂²...|=Π_{i<j}(x_j-x_i)', conditions: ['各行xᵢ', '方阵'], conclusion: '所有差之积', category: 'linear_algebra', commonMisuses: ['没零约式奇性检查'] },
  { name: 'Cramer法则', aliases: ['Cramer', '克拉默法则'], statement: 'Ax=b,|A|≠0: x_i=|A_i|/|A|', conditions: ['|A|≠0'], conclusion: '分量=比行列式', category: 'linear_algebra', commonMisuses: ['不切实际的用法为大n', '假|A|=0'] },
  { name: '迹的性质', aliases: ['trace', '迹'], statement: 'tr(A)=Σa_{ii}=Σλ_i', conditions: ['n阶方阵'], conclusion: '迹=特征值之和', category: 'linear_algebra', commonMisuses: ['tr(AB)≠tr(A)tr(B)', '可交换绕tr'] },
];

@Injectable()
export class HallucinationGuardService {
  private readonly logger = new Logger(HallucinationGuardService.name);
  private readonly theoremMap: Map<string, TheoremRecord>;

  constructor() {
    this.theoremMap = new Map();
    for (const theorem of THEOREM_DATABASE) {
      for (const alias of [theorem.name, ...theorem.aliases]) {
        this.theoremMap.set(alias.toLowerCase(), theorem);
      }
    }
    this.logger.log(`定理知识库初始化完成: ${THEOREM_DATABASE.length}条定理, ${this.theoremMap.size}个索引别名`);
  }

  verifyTheoremUsage(stepContent: string): HallucinationIssue[] {
    const issues: HallucinationIssue[] = [];
    const lowerContent = stepContent.toLowerCase();

    for (const [, theorem] of this.theoremMap) {
      const invoked = theorem.aliases.some(alias =>
        lowerContent.includes(alias.toLowerCase()),
      );

      if (!invoked) continue;

      // 检查定理使用的条件是否被验证
      for (const condition of theorem.conditions) {
        const conditionKeywords = this.extractConditionKeywords(condition);
        const conditionMet = conditionKeywords.some(kw =>
          lowerContent.includes(kw.toLowerCase()),
        );

        if (!conditionMet) {
          issues.push({
            type: HallucinationType.MISAPPLIED_CONDITION,
            description: `定理【${theorem.name}】使用前未验证条件: ${condition}`,
            location: `定理引用处: ${theorem.name}`,
            severity: 'critical',
            suggestedCorrection: `在使用${theorem.name}前，必须先验证: ${condition}`,
            confidence: 0.85,
          });
        }
      }

      // 检查常见误用
      for (const misuse of theorem.commonMisuses) {
        const misuseKeywords: string[] = (misuse.match(/[\u4e00-\u9fa5]{3,}/g) || []) as string[];
        const potentialMisuse = misuseKeywords.some((kw: string) =>
          lowerContent.includes(kw.toLowerCase()),
        );

        if (potentialMisuse) {
          issues.push({
            type: HallucinationType.MISAPPLIED_CONDITION,
            description: `可能误用定理【${theorem.name}】: ${misuse}`,
            location: `定理应用处: ${theorem.name}`,
            severity: 'warning',
            suggestedCorrection: `注意${theorem.name}的正确应用方式，特别检查: ${misuse}`,
            confidence: 0.5,
          });
        }
      }
    }

    // 检测"虚构定理"——引用了不存在的定理名
    const theoremPattern = /(?:根据|由|利用|应用|使用)\s*([^\s，。,\.]{2,10}(?:定理|法则|公式|定律|原理|方法))/g;
    let match;
    while ((match = theoremPattern.exec(stepContent)) !== null) {
      const claimedTheorem = match[1];
      const lowerClaimed = claimedTheorem.toLowerCase();

      const exists = [...this.theoremMap.values()].some(t =>
        t.name.includes(claimedTheorem) ||
        t.aliases.some(a => a.includes(claimedTheorem) || lowerClaimed.includes(a)),
      );

      if (!exists && this.isLikelyFakeTheoremName(claimedTheorem)) {
        issues.push({
          type: HallucinationType.FALSE_THEOREM,
          description: `可能引用了不存在的定理: "${claimedTheorem}"`,
          location: `定理引用处: "${claimedTheorem}"`,
          severity: 'critical',
          suggestedCorrection: '请使用标准高等数学教材中确认存在的定理名称',
          confidence: 0.8,
        });
      }
    }

    return issues;
  }

  verifyFormulaCorrectness(stepContent: string): HallucinationIssue[] {
    const issues: HallucinationIssue[] = [];

    // 检查LaTeX公式中是否包含错误的结构
    const formulaPatterns = [
      {
        pattern: /\\frac\{d\}\{dx\}\s*\\frac\{/,
        message: '导数连写可能需要检查：d/dx的嵌套使用应规范',
        severity: 'warning' as const,
      },
      {
        pattern: /\\lim\s*\\frac\{[^}]*\}\{[^}]*\}\s*=\s*\\frac\{/,
        message: '极限表达式=分式，需验证极限运算和分式是否等值',
        severity: 'warning' as const,
      },
      {
        pattern: /\\int.*\\int.*dx\s*dx/,
        message: '重积分微分符号可能重复，应写为∬f(x,y)dxdy',
        severity: 'warning' as const,
      },
      {
        pattern: /\be\^\{[^}]*\}\s*=|\bln\s*\([^)]*\)\s*=/,
        message: '自然对数/指数中的等式依赖关系需要验证',
        severity: 'warning' as const,
      },
      {
        pattern: /\\pi\s*=\s*[0-9]/,
        message: 'π的数值近似需注明精确度，标准写法应用\\pi保留符号',
        severity: 'warning' as const,
      },
    ];

    for (const { pattern, message, severity } of formulaPatterns) {
      if (pattern.test(stepContent)) {
        pattern.lastIndex = 0;
        issues.push({
          type: HallucinationType.INCORRECT_FORMULA,
          description: message,
          location: '公式推导部分',
          severity: severity,
          suggestedCorrection: '请核实公式的正确性和推导步骤的完整性',
          confidence: 0.5,
        });
      }
    }

    return issues;
  }

  verifyResultReasonableness(
    finalAnswer: string,
    problem: string,
    sympyResult?: SymPyVerification,
  ): HallucinationIssue[] {
    const issues: HallucinationIssue[] = [];

    // 基本合理性检查
    if (/极限.*\d+$/.test(problem)) {
      const value = parseFloat(finalAnswer);
      if (!isNaN(value) && !isFinite(value)) {
        issues.push({
          type: HallucinationType.FABRICATED_RESULT,
          description: '极限结果出现了NaN或Infinity，数值计算异常',
          location: '最终答案',
          severity: 'critical',
          suggestedCorrection: '检查洛必达法则或其他极限方法的运用是否正确',
          confidence: 0.9,
        });
      }
    }

    if (/不定积分|∫/.test(problem) && !/定|_\{/.test(problem)) {
      if (!finalAnswer.includes('+ C') && !finalAnswer.includes('+C')) {
        issues.push({
          type: HallucinationType.MISAPPLIED_CONDITION,
          description: '不定积分答案缺少积分常数C',
          location: '最终答案',
          severity: 'critical',
          suggestedCorrection: '不定积分结果必须加积分常数+C',
          confidence: 0.95,
        });
      }
    }

    // SymPy交叉验证结果
    if (sympyResult && !sympyResult.matchesExpectation) {
      issues.push({
        type: HallucinationType.FABRICATED_RESULT,
        description: `计算结果与SymPy验证不一致: ${sympyResult.discrepancy || '结果偏差'}`,
        location: '最终答案',
        severity: 'critical',
        suggestedCorrection: `SymPy计算结果: ${sympyResult.computedResult}。请检查LLM的推导过程`,
        confidence: 0.9,
      });
    }

    return issues;
  }

  crossValidateWithSymPy(
    llmAnswer: string,
    expectedComputation: string,
  ): SymPyVerification {
    const normalizedLLM = this.normalizeExpression(llmAnswer);
    const normalizedSymPy = this.normalizeExpression(expectedComputation);

    const matches = normalizedLLM === normalizedSymPy ||
      normalizedLLM.includes(normalizedSymPy) ||
      normalizedSymPy.includes(normalizedLLM);

    let discrepancy: string | undefined;
    let precision = 0.0;

    if (!matches) {
      discrepancy = `LLM答案: "${llmAnswer.substring(0, 50)}" vs SymPy: "${expectedComputation.substring(0, 50)}"`;
      precision = this.calculateSimilarity(normalizedLLM, normalizedSymPy);
    } else {
      precision = 1.0;
    }

    return {
      computedResult: expectedComputation,
      matchesExpectation: matches,
      discrepancy,
      precision,
    };
  }

  fullVerification(
    solutionSteps: string[],
    finalAnswer: string,
    problem: string,
    sympyResult?: SymPyVerification,
  ): VerificationResult[] {
    this.logger.log(`启动全链路幻觉防控验证: ${solutionSteps.length}步骤`);

    const results: VerificationResult[] = [];

    for (const step of solutionSteps) {
      const theoremIssues = this.verifyTheoremUsage(step);
      const formulaIssues = this.verifyFormulaCorrectness(step);
      const issues = [...theoremIssues, ...formulaIssues];

      const criticalCount = issues.filter(i => i.severity === 'critical').length;

      results.push({
        stepContent: step.substring(0, 200),
        isVerified: criticalCount === 0,
        theoremIssues: issues,
        overallConfidence: Math.max(0, 1.0 - criticalCount * 0.3 - issues.length * 0.05),
      });
    }

    // 最终答案的合理性验证
    if (results.length > 0) {
      const lastResult = results[results.length - 1];
      lastResult.sympyResult = sympyResult;

      const answerIssues = this.verifyResultReasonableness(finalAnswer, problem, sympyResult);
      lastResult.theoremIssues.push(...answerIssues);

      if (answerIssues.some(i => i.severity === 'critical')) {
        lastResult.isVerified = false;
        lastResult.overallConfidence = Math.min(lastResult.overallConfidence, 0.3);
      }
    }

    const verifiedCount = results.filter(r => r.isVerified).length;
    this.logger.log(`幻觉防控验证完成: ${verifiedCount}/${results.length}步骤通过`);

    return results;
  }

  checkTheorem(stepContent: string): {
    theoremsReferenced: string[];
    conditionsMet: boolean;
    issues: string[];
  } {
    const theoremsReferenced: string[] = [];
    const conditionsMet: boolean[] = [];
    const issues: string[] = [];

    for (const [key, theorem] of this.theoremMap) {
      if (stepContent.toLowerCase().includes(key)) {
        theoremsReferenced.push(theorem.name);

        for (const condition of theorem.conditions) {
          const conditionKeywords = this.extractConditionKeywords(condition);
          const met = conditionKeywords.some(kw =>
            stepContent.toLowerCase().includes(kw.toLowerCase()),
          );
          conditionsMet.push(met);
          if (!met) {
            issues.push(`未验证条件: ${condition}`);
          }
        }
      }
    }

    return {
      theoremsReferenced: [...new Set(theoremsReferenced)],
      conditionsMet: conditionsMet.length > 0 && conditionsMet.every(m => m),
      issues,
    };
  }

  getAllTheorems(): Array<{ name: string; category: string }> {
    return THEOREM_DATABASE.map(t => ({
      name: t.name,
      category: t.category,
    }));
  }

  private extractConditionKeywords(condition: string): string[] {
    return condition
      .replace(/[^\u4e00-\u9fa5a-zA-Z]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 2);
  }

  private isLikelyFakeTheoremName(name: string): boolean {
    const realTheorems = [
      '罗尔定理', '拉格朗日定理', '柯西中值定理', '泰勒定理',
      '洛必达法则', '牛顿-莱布尼茨公式', '格林公式', '隐函数定理',
      '积分中值定理', '夹逼定理', '单调有界定理', '零点定理',
      '极值定理', '费马引理', '达布定理', '海涅定理', '保号性',
    ];
    return !realTheorems.some(r => name.includes(r) || r.includes(name));
  }

  private normalizeExpression(expr: string): string {
    return expr
      .replace(/\s+/g, '')
      .replace(/\\/g, '')
      .replace(/[{}]/g, '')
      .replace(/\\cdot/g, '*')
      .replace(/\-\-/g, '+')
      .toLowerCase();
  }

  private calculateSimilarity(a: string, b: string): number {
    if (!a || !b) return 0;
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    if (longer.length === 0) return 1.0;

    // 简单的Jaccard相似度
    const aSet = new Set(a.split(/(?=[+\-*/=()])/));
    const bSet = new Set(b.split(/(?=[+\-*/=()])/));
    const intersection = [...aSet].filter(x => bSet.has(x)).length;
    const union = aSet.size + bSet.size - intersection;
    return union > 0 ? intersection / union : 0;
  }
}
