import { useState } from 'react';
import FormulaRenderer, { MultiFormulaRenderer } from '../components/FormulaRenderer';

const TEST_FORMULAS = {
  basicAlgebra: [
    'a^2 + b^2 = c^2',
    'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}',
    '(a + b)^2 = a^2 + 2ab + b^2',
    '(a - b)^3 = a^3 - 3a^2b + 3ab^2 - b^3',
    '\\frac{x^2}{a^2} + \\frac{y^2}{b^2} = 1',
    '\\sqrt[n]{a^m} = a^{m/n}',
    '\\log_a(MN) = \\log_a M + \\log_a N',
    'e^{i\\pi} + 1 = 0',
  ],
  limits: [
    '\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1',
    '\\lim_{x \\to \\infty} \\left(1 + \\frac{1}{x}\\right)^x = e',
    '\\lim_{x \\to 0} \\frac{e^x - 1}{x} = 1',
    '\\lim_{n \\to \\infty} \\sqrt[n]{n} = 1',
    '\\lim_{x \\to 0} \\frac{\\ln(1+x)}{x} = 1',
    '\\lim_{x \\to \\infty} \\frac{\\ln x}{x} = 0',
    '\\lim_{x \\to 0^+} x^x = 1',
    '\\lim_{x \\to 0} \\frac{\\tan x - \\sin x}{x^3} = \\frac{1}{2}',
    '\\lim_{x \\to \\infty} \\frac{x^n}{e^x} = 0',
    '\\lim_{x \\to 0} \\frac{a^x - 1}{x} = \\ln a',
  ],
  derivatives: [
    '\\frac{d}{dx}(x^n) = nx^{n-1}',
    '\\frac{d}{dx}(\\sin x) = \\cos x',
    '\\frac{d}{dx}(\\cos x) = -\\sin x',
    '\\frac{d}{dx}(\\tan x) = \\sec^2 x',
    '\\frac{d}{dx}(e^x) = e^x',
    '\\frac{d}{dx}(\\ln x) = \\frac{1}{x}',
    '\\frac{d}{dx}(\\arcsin x) = \\frac{1}{\\sqrt{1-x^2}}',
    '\\frac{d}{dx}(\\arctan x) = \\frac{1}{1+x^2}',
    '(f \\cdot g)\' = f\'g + fg\'',
    '\\left(\\frac{f}{g}\\right)\' = \\frac{f\'g - fg\'}{g^2}',
    '(f \\circ g)\'(x) = f\'(g(x)) \\cdot g\'(x)',
    '\\frac{d^2y}{dx^2} + p(x)\\frac{dy}{dx} + q(x)y = 0',
  ],
  integrals: [
    '\\int x^n dx = \\frac{x^{n+1}}{n+1} + C',
    '\\int \\frac{1}{x} dx = \\ln|x| + C',
    '\\int e^x dx = e^x + C',
    '\\int \\sin x dx = -\\cos x + C',
    '\\int \\cos x dx = \\sin x + C',
    '\\int \\tan x dx = -\\ln|\\cos x| + C',
    '\\int \\sec^2 x dx = \\tan x + C',
    '\\int \\frac{1}{1+x^2} dx = \\arctan x + C',
    '\\int \\frac{1}{\\sqrt{1-x^2}} dx = \\arcsin x + C',
    '\\int u dv = uv - \\int v du',
    '\\int_a^b f(x) dx = F(b) - F(a)',
    '\\int_0^\\pi \\sin x dx = 2',
    '\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}',
    '\\iint_D f(x,y) dxdy',
    '\\iiint_V f(x,y,z) dxdydz',
  ],
  series: [
    '\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}',
    '\\sum_{n=0}^{\\infty} \\frac{x^n}{n!} = e^x',
    '\\sum_{n=0}^{\\infty} \\frac{(-1)^n x^{2n}}{(2n)!} = \\cos x',
    '\\sum_{n=0}^{\\infty} \\frac{(-1)^n x^{2n+1}}{(2n+1)!} = \\sin x',
    '\\sum_{n=1}^{\\infty} \\frac{1}{n} = \\infty',
    '\\sum_{k=0}^n \\binom{n}{k} = 2^n',
    'f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(a)}{n!}(x-a)^n',
    '\\sum_{n=1}^{\\infty} \\frac{(-1)^{n-1}}{n} = \\ln 2',
    '\\sum_{n=0}^{\\infty} \\frac{x^n}{(n+1)!}',
    '\\sum_{k=1}^n k = \\frac{n(n+1)}{2}',
  ],
  differentialEquations: [
    '\\frac{dy}{dx} = ky',
    'y\' + p(x)y = q(x)',
    'y\'\' + \\omega^2 y = 0',
    '\\frac{\\partial u}{\\partial t} = \\alpha \\frac{\\partial^2 u}{\\partial x^2}',
    '\\frac{\\partial^2 u}{\\partial t^2} = c^2 \\nabla^2 u',
    '\\mathcal{L}\\{f(t)\\} = \\int_0^{\\infty} e^{-st} f(t) dt',
    '\\mathcal{L}\\{e^{at}\\} = \\frac{1}{s-a}',
    '\\frac{d^2y}{dx^2} + 2\\zeta\\omega_n\\frac{dy}{dx} + \\omega_n^2 y = 0',
  ],
  multivariableCalculus: [
    '\\frac{\\partial f}{\\partial x} = \\lim_{\\Delta x \\to 0} \\frac{f(x+\\Delta x, y) - f(x,y)}{\\Delta x}',
    '\\nabla f = \\left(\\frac{\\partial f}{\\partial x}, \\frac{\\partial f}{\\partial y}, \\frac{\\partial f}{\\partial z}\\right)',
    '\\frac{\\partial^2 f}{\\partial x^2} + \\frac{\\partial^2 f}{\\partial y^2} = 0',
    '\\oint_C \\mathbf{F} \\cdot d\\mathbf{r}',
    '\\iint_S \\mathbf{F} \\cdot d\\mathbf{S}',
    '\\oint_C P dx + Q dy = \\iint_D \\left(\\frac{\\partial Q}{\\partial x} - \\frac{\\partial P}{\\partial y}\\right) dxdy',
    '\\iint_S \\mathbf{F} \\cdot d\\mathbf{S} = \\iiint_V \\nabla \\cdot \\mathbf{F} dV',
    '\\oint_C \\mathbf{F} \\cdot d\\mathbf{r} = \\iint_S (\\nabla \\times \\mathbf{F}) \\cdot d\\mathbf{S}',
  ],
  vectorAndSpace: [
    '\\vec{a} \\cdot \\vec{b} = |\\vec{a}||\\vec{b}|\\cos\\theta',
    '\\vec{a} \\times \\vec{b} = |\\vec{a}||\\vec{b}|\\sin\\theta \\,\\hat{n}',
    '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}',
    '\\begin{bmatrix} 1 & 0 & 0 \\\\ 0 & \\cos\\theta & -\\sin\\theta \\\\ 0 & \\sin\\theta & \\cos\\theta \\end{bmatrix}',
    '\\det(A) = \\sum_{j=1}^n (-1)^{i+j} a_{ij} \\det(A_{ij})',
    '\\frac{x-x_0}{l} = \\frac{y-y_0}{m} = \\frac{z-z_0}{n}',
    'Ax + By + Cz + D = 0',
    '\\rho = \\sqrt{x^2 + y^2 + z^2}',
  ],
  probability: [
    'P(A|B) = \\frac{P(A \\cap B)}{P(B)}',
    'E[X] = \\int_{-\\infty}^{\\infty} x f(x) dx',
    '\\mathrm{Var}(X) = E[(X - E[X])^2]',
    'f(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}} e^{-\\frac{(x-\\mu)^2}{2\\sigma^2}}',
    '\\mathrm{Cov}(X,Y) = E[(X-E[X])(Y-E[Y])]',
    '\\rho_{XY} = \\frac{\\mathrm{Cov}(X,Y)}{\\sigma_X \\sigma_Y}',
  ],
  matricesAndLinearAlgebra: [
    '\\begin{pmatrix} a_{11} & a_{12} & a_{13} \\\\ a_{21} & a_{22} & a_{23} \\\\ a_{31} & a_{32} & a_{33} \\end{pmatrix}',
    '\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix} = ad - bc',
    'A\\mathbf{x} = \\lambda \\mathbf{x}',
    'A = PDP^{-1}',
    '\\mathrm{rank}(A) + \\dim(\\ker(A)) = n',
    'A^{-1} = \\frac{1}{\\det(A)} \\mathrm{adj}(A)',
    '\\|\\mathbf{x}\\|_p = \\left(\\sum_i |x_i|^p\\right)^{1/p}',
  ],
  trigonometry: [
    '\\sin^2\\theta + \\cos^2\\theta = 1',
    '\\sin(\\alpha \\pm \\beta) = \\sin\\alpha\\cos\\beta \\pm \\cos\\alpha\\sin\\beta',
    '\\cos(\\alpha \\pm \\beta) = \\cos\\alpha\\cos\\beta \\mp \\sin\\alpha\\sin\\beta',
    '\\tan(\\alpha \\pm \\beta) = \\frac{\\tan\\alpha \\pm \\tan\\beta}{1 \\mp \\tan\\alpha\\tan\\beta}',
    '\\sin 2\\theta = 2\\sin\\theta\\cos\\theta',
    '\\cos 2\\theta = \\cos^2\\theta - \\sin^2\\theta = 2\\cos^2\\theta - 1 = 1 - 2\\sin^2\\theta',
    '\\tan 2\\theta = \\frac{2\\tan\\theta}{1-\\tan^2\\theta}',
    '\\sin\\frac{\\theta}{2} = \\pm\\sqrt{\\frac{1-\\cos\\theta}{2}}',
    '\\cos\\frac{\\theta}{2} = \\pm\\sqrt{\\frac{1+\\cos\\theta}{2}}',
  ],
  specialFunctions: [
    '\\Gamma(n) = (n-1)!',
    '\\Gamma(z) = \\int_0^{\\infty} t^{z-1} e^{-t} dt',
    'B(x,y) = \\int_0^1 t^{x-1}(1-t)^{y-1} dt',
    'J_n(x) = \\frac{1}{\\pi} \\int_0^{\\pi} \\cos(x\\sin\\theta - n\\theta) d\\theta',
    '\\zeta(s) = \\sum_{n=1}^{\\infty} \\frac{1}{n^s}',
    '\\mathrm{erf}(x) = \\frac{2}{\\sqrt{\\pi}} \\int_0^x e^{-t^2} dt',
  ],
  complexFormulas: [
    '\\int_0^{\\infty} \\frac{\\sin x}{x} dx = \\frac{\\pi}{2}',
    '\\frac{d}{dx} \\left( \\int_{a(x)}^{b(x)} f(t) dt \\right) = f(b(x)) b\'(x) - f(a(x)) a\'(x)',
    '\\frac{\\partial^2 z}{\\partial x \\partial y} = \\frac{\\partial^2 z}{\\partial y \\partial x}',
    '\\lim_{n \\to \\infty} \\left( \\sum_{k=1}^n \\frac{1}{k} - \\ln n \\right) = \\gamma',
    '\\int_0^{\\frac{\\pi}{2}} \\ln(\\sin x) dx = -\\frac{\\pi}{2} \\ln 2',
    '\\prod_{n=1}^{\\infty} \\left( 1 - \\frac{x^2}{n^2\\pi^2} \\right) = \\frac{\\sin x}{x}',
    '\\int_{-\\infty}^{\\infty} \\frac{\\cos x}{x^2 + a^2} dx = \\frac{\\pi}{a} e^{-a}',
    '\\sum_{n=1}^{\\infty} \\frac{1}{n^{2k}} = \\frac{(-1)^{k-1} B_{2k} (2\\pi)^{2k}}{2(2k)!}',
    'f(x) = \\frac{1}{\\sqrt{2\\pi}} \\int_{-\\infty}^{\\infty} \\hat{f}(\\xi) e^{i\\xi x} d\\xi',
    '\\mathcal{F}[f](\\xi) = \\int_{-\\infty}^{\\infty} f(x) e^{-2\\pi i x \\xi} dx',
  ],
};

const CATEGORIES = Object.keys(TEST_FORMULAS) as (keyof typeof TEST_FORMULAS)[];

const CATEGORY_LABELS: Record<string, string> = {
  basicAlgebra: '基础代数与公式',
  limits: '极限计算',
  derivatives: '导数与微分',
  integrals: '积分计算',
  series: '无穷级数',
  differentialEquations: '微分方程',
  multivariableCalculus: '多元微积分',
  vectorAndSpace: '向量与空间解析几何',
  probability: '概率论基础',
  matricesAndLinearAlgebra: '矩阵与线性代数',
  trigonometry: '三角恒等式',
  specialFunctions: '特殊函数',
  complexFormulas: '复杂综合公式',
};

export default function FormulaTestPage() {
  const [errorMode, setErrorMode] = useState<'hide' | 'show'>('hide');
  const [displayMode, setDisplayMode] = useState<'block' | 'inline'>('block');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredCategories = selectedCategory
    ? CATEGORIES.filter((c) => c === selectedCategory)
    : CATEGORIES;

  const totalFormulas = filteredCategories.reduce(
    (sum, cat) => sum + TEST_FORMULAS[cat].length,
    0,
  );

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ textAlign: 'center', color: '#1a365d' }}>
        KaTeX 公式渲染组件测试
        <span style={{ fontSize: '0.6em', display: 'block', color: '#666', marginTop: '8px' }}>
          LaTeX Formula Rendering Test (100+ Formulas)
        </span>
      </h1>

      <div style={{
        display: 'flex', gap: '12px', flexWrap: 'wrap',
        justifyContent: 'center', margin: '20px 0', padding: '16px',
        background: '#f7fafc', borderRadius: '12px', border: '1px solid #e2e8f0',
      }}>
        <button
          onClick={() => setDisplayMode('block')}
          style={{
            padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            background: displayMode === 'block' ? '#3182ce' : '#e2e8f0',
            color: displayMode === 'block' ? '#fff' : '#333',
            fontWeight: 600,
          }}
        >
          块级渲染 (Block)
        </button>
        <button
          onClick={() => setDisplayMode('inline')}
          style={{
            padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            background: displayMode === 'inline' ? '#3182ce' : '#e2e8f0',
            color: displayMode === 'inline' ? '#fff' : '#333',
            fontWeight: 600,
          }}
        >
          行内渲染 (Inline)
        </button>
        <button
          onClick={() => setErrorMode(errorMode === 'show' ? 'hide' : 'show')}
          style={{
            padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            background: errorMode === 'show' ? '#e53e3e' : '#e2e8f0',
            color: errorMode === 'show' ? '#fff' : '#333',
            fontWeight: 600,
          }}
        >
          {errorMode === 'show' ? '隐藏错误' : '显示错误'}
        </button>
        <button
          onClick={() => setSelectedCategory(null)}
          style={{
            padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            background: selectedCategory === null ? '#38a169' : '#e2e8f0',
            color: selectedCategory === null ? '#fff' : '#333',
            fontWeight: 600,
          }}
        >
          全部显示 ({totalFormulas}个公式)
        </button>
      </div>

      <div style={{
        display: 'flex', gap: '8px', flexWrap: 'wrap',
        justifyContent: 'center', marginBottom: '20px',
      }}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            style={{
              padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer',
              background: selectedCategory === cat ? '#805ad5' : '#e2e8f0',
              color: selectedCategory === cat ? '#fff' : '#555',
              fontSize: '13px', fontWeight: selectedCategory === cat ? 600 : 400,
            }}
          >
            {CATEGORY_LABELS[cat]} ({TEST_FORMULAS[cat].length})
          </button>
        ))}
      </div>

      <div style={{
        background: '#ebf8ff', borderRadius: '10px', padding: '16px',
        marginBottom: '20px', textAlign: 'center',
        border: '1px solid #90cdf4',
      }}>
        <strong>统计：</strong>共 {totalFormulas} 个公式，覆盖 {filteredCategories.length} 个数学领域
        | 显示模式：{displayMode === 'block' ? '块级' : '行内'}
        | 错误模式：{errorMode === 'show' ? '显示' : '隐藏'}
      </div>

      {filteredCategories.map((cat) => (
        <div key={cat} style={{
          marginBottom: '32px', border: '1px solid #e2e8f0',
          borderRadius: '12px', overflow: 'hidden',
        }}>
          <div style={{
            background: '#2d3748', color: '#fff', padding: '12px 20px',
            fontSize: '16px', fontWeight: 700,
          }}>
            {CATEGORY_LABELS[cat]} ({TEST_FORMULAS[cat].length}个公式)
          </div>
          <div style={{ padding: '16px' }}>
            {TEST_FORMULAS[cat].map((formula, idx) => (
              <div
                key={`${cat}-${idx}`}
                style={{
                  padding: '10px 16px', marginBottom: '8px',
                  background: idx % 2 === 0 ? '#fff' : '#f7fafc',
                  borderRadius: '8px', border: '1px solid #edf2f7',
                }}
              >
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                }}>
                  <span style={{
                    minWidth: '28px', textAlign: 'center',
                    color: '#a0aec0', fontSize: '13px', fontWeight: 600,
                  }}>
                    #{idx + 1}
                  </span>
                  <code style={{
                    fontSize: '12px', color: '#718096',
                    background: '#edf2f7', padding: '2px 8px',
                    borderRadius: '4px', maxWidth: '300px',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    flex: 1,
                  }}>
                    {formula}
                  </code>
                </div>
                <div style={{ marginTop: '8px', marginLeft: '40px' }}>
                  <FormulaRenderer
                    formula={formula}
                    displayMode={displayMode === 'block'}
                    throwOnError={errorMode === 'show'}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div style={{
        marginTop: '40px', padding: '20px',
        background: '#f0fff4', borderRadius: '12px',
        border: '1px solid #9ae6b4', textAlign: 'center',
      }}>
        <h3 style={{ color: '#276749', margin: 0 }}>
          测试完成 - 共渲染 {totalFormulas} 个LaTeX公式
        </h3>
        <p style={{ color: '#718096', fontSize: '14px', margin: '8px 0 0 0' }}>
          覆盖高中数学、高等数学、线性代数、概率论等领域
        </p>
      </div>
    </div>
  );
}
