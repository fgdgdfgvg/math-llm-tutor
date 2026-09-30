import { useState, useMemo } from 'react';
import FormulaRenderer from '../components/FormulaRenderer';
import { useResponsive } from '../hooks/useResponsive';

interface KnowledgeNodeData {
  id: string;
  name: string;
  type: 'Concept' | 'Theorem' | 'Formula' | 'Method';
  mastery: number;
  tags: string[];
  formula?: string;
  description: string;
  area: string;
}

const TYPE_COLORS: Record<string, string> = {
  Concept: '#6366f1',
  Theorem: '#8b5cf6',
  Formula: '#a855f7',
  Method: '#ec4899',
};

const TYPE_LABELS: Record<string, string> = {
  Concept: '概念',
  Theorem: '定理',
  Formula: '公式',
  Method: '方法',
};

const ALL_NODES: KnowledgeNodeData[] = [
  {
    id: 'ode_definition',
    name: '微分方程基本概念',
    type: 'Concept',
    mastery: 0.85,
    tags: ['ODE', '基础'],
    formula: "F(x, y, y', y'') = 0",
    description: '包含未知函数及其导数的方程，是描述自然现象的重要数学工具',
    area: '基础',
  },
  {
    id: 'ode_order',
    name: '微分方程的阶',
    type: 'Concept',
    mastery: 0.80,
    tags: ['ODE', '基础'],
    description: '方程中出现的最高阶导数的阶数，决定了通解中独立常数的个数',
    area: '基础',
  },
  {
    id: 'ode_linear',
    name: '线性与齐次',
    type: 'Concept',
    mastery: 0.70,
    tags: ['ODE', '分类'],
    formula: "y'' + p(x)y' + q(x)y = g(x)",
    description: '线性ODE中未知函数及其导数均为一次幂，g(x)=0时为齐次，否则为非齐次',
    area: '分类',
  },
  {
    id: 'separable_ode',
    name: '可分离变量方程',
    type: 'Method',
    mastery: 0.60,
    tags: ['ODE', '一阶'],
    formula: '\\frac{dy}{dx} = f(x)g(y)',
    description: '将含有x和y的项分别移到等号两侧，然后两边同时积分求解',
    area: '一阶ODE',
  },
  {
    id: 'char_eq_build',
    name: '特征方程构建',
    type: 'Method',
    mastery: 0.45,
    tags: ['ODE', '解法'],
    formula: 'r^2 + pr + q = 0',
    description: '对于常系数齐次线性ODE，设y=e^{rx}代入得到关于r的代数方程',
    area: '解法',
  },
  {
    id: 'char_root_solve',
    name: '特征根求解',
    type: 'Method',
    mastery: 0.40,
    tags: ['ODE', '解法'],
    formula: 'r = \\frac{-p \\pm \\sqrt{p^2 - 4q}}{2}',
    description: '使用一元二次方程求根公式，解得特征方程的根r1和r2',
    area: '解法',
  },
  {
    id: 'root_discriminant',
    name: '特征根判别',
    type: 'Theorem',
    mastery: 0.35,
    tags: ['ODE', '判别'],
    formula: '\\Delta = p^2 - 4q',
    description: '根据判别式Δ的符号确定通解形式：Δ>0两实根，Δ=0重根，Δ<0共轭复根',
    area: '解法',
  },
  {
    id: 'two_real_roots',
    name: '两不等实根通解',
    type: 'Formula',
    mastery: 0.30,
    tags: ['ODE', '通解'],
    formula: 'y = C_1 e^{r_1 x} + C_2 e^{r_2 x}',
    description: '当Δ>0时，通解为两个指数函数的线性组合，C1和C2为任意常数',
    area: '通解',
  },
  {
    id: 'double_root',
    name: '重根通解',
    type: 'Formula',
    mastery: 0.25,
    tags: ['ODE', '通解'],
    formula: 'y = (C_1 + C_2 x) e^{r x}',
    description: '当Δ=0时，通解为指数函数乘以一次多项式，第二个解通过降阶法得到',
    area: '通解',
  },
  {
    id: 'complex_roots',
    name: '共轭复根通解',
    type: 'Formula',
    mastery: 0.20,
    tags: ['ODE', '通解'],
    formula: 'y = e^{\\alpha x}(C_1 \\cos \\beta x + C_2 \\sin \\beta x)',
    description: '当Δ<0时，通解为指数衰减/增长与三角函数的乘积，α为实部，β为虚部',
    area: '通解',
  },
  {
    id: 'ode_verification',
    name: '通解验证方法',
    type: 'Method',
    mastery: 0.20,
    tags: ['ODE', '验证'],
    description: '将求得的通解代回原方程，检查是否恒成立，确保解的准确性',
    area: '解法',
  },
  {
    id: 'initial_condition',
    name: '初值条件应用',
    type: 'Method',
    mastery: 0.15,
    tags: ['ODE', '应用'],
    description: '利用给定的初始条件确定通解中的任意常数，得到唯一的特解',
    area: '应用',
  },
];

const AREA_OPTIONS = ['全部', '基础', '一阶ODE', '分类', '解法', '通解', '应用'];
const TYPE_OPTIONS = ['全部', 'Concept', 'Theorem', 'Formula', 'Method'];

function getMasteryColor(mastery: number): string {
  if (mastery >= 0.8) return '#22c55e';
  if (mastery >= 0.6) return '#f59e0b';
  if (mastery >= 0.4) return '#f97316';
  return '#ef4444';
}

function getMasteryLabel(mastery: number): string {
  if (mastery >= 0.8) return '已掌握';
  if (mastery >= 0.6) return '学习中';
  if (mastery >= 0.4) return '初接触';
  return '未学习';
}

export default function KnowledgeListPage() {
  const { isMobile } = useResponsive();
  const [areaFilter, setAreaFilter] = useState('全部');
  const [typeFilter, setTypeFilter] = useState('全部');

  const filteredNodes = useMemo(() => {
    let result = ALL_NODES;

    if (areaFilter !== '全部') {
      result = result.filter((n) => n.area === areaFilter);
    }

    if (typeFilter !== '全部') {
      result = result.filter((n) => n.type === typeFilter);
    }

    return result.sort((a, b) => a.mastery - b.mastery);
  }, [areaFilter, typeFilter]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      height: '100vh',
      background: '#0f172a',
      color: '#e2e8f0',
      overflow: 'hidden',
    }}>
      <div style={{
        width: isMobile ? '100%' : 280,
        minWidth: isMobile ? 'auto' : 280,
        padding: '20px 16px',
        background: '#1e293b',
        borderRight: isMobile ? 'none' : '1px solid #334155',
        borderBottom: isMobile ? '1px solid #334155' : 'none',
        overflowY: 'auto',
        flexShrink: 0,
      }}>
        <h2 style={{
          fontSize: 18,
          fontWeight: 700,
          color: '#f1f5f9',
          margin: '0 0 20px 0',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{
            display: 'inline-block',
            width: 8,
            height: 20,
            background: '#6366f1',
            borderRadius: 2,
          }} />
          知识筛选
        </h2>

        <div style={{ marginBottom: 24 }}>
          <h3 style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#94a3b8',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            margin: '0 0 10px 0',
          }}>
            领域筛选
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {AREA_OPTIONS.map((area) => (
              <button
                key={area}
                onClick={() => setAreaFilter(area)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: areaFilter === area ? 700 : 500,
                  background: areaFilter === area ? '#6366f1' : '#334155',
                  color: areaFilter === area ? '#fff' : '#94a3b8',
                  transition: 'all 0.15s ease',
                }}
              >
                {area}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <h3 style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#94a3b8',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            margin: '0 0 10px 0',
          }}>
            类型筛选
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {TYPE_OPTIONS.map((type) => (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: typeFilter === type ? 700 : 500,
                  background: typeFilter === type
                    ? (TYPE_COLORS[type] || '#6366f1')
                    : '#334155',
                  color: typeFilter === type ? '#fff' : '#94a3b8',
                  transition: 'all 0.15s ease',
                }}
              >
                {type === '全部' ? '全部' : TYPE_LABELS[type] || type}
              </button>
            ))}
          </div>
        </div>

        <div style={{
          padding: '10px 12px',
          borderRadius: 8,
          background: '#0f172a',
          border: '1px solid #334155',
        }}>
          <div style={{
            fontSize: 12,
            color: '#64748b',
            marginBottom: 4,
          }}>
            筛选结果
          </div>
          <div style={{
            fontSize: 24,
            fontWeight: 700,
            color: '#6366f1',
          }}>
            {filteredNodes.length}
          </div>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            个知识点
          </div>
        </div>
      </div>

      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px 24px',
      }}>
        <h1 style={{
          fontSize: 22,
          fontWeight: 700,
          color: '#f1f5f9',
          margin: '0 0 8px 0',
        }}>
          微分方程 (ODE) · 知识图谱列表视图
        </h1>
        <p style={{
          fontSize: 13,
          color: '#64748b',
          margin: '0 0 24px 0',
        }}>
          按掌握度升序排列，薄弱知识点排在最前，方便针对性复习
        </p>

        {filteredNodes.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: '#64748b',
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>没有匹配的知识点</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>请尝试调整筛选条件</div>
          </div>
        )}

        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: 16,
        }}>
          {filteredNodes.map((node) => {
            const masteryColor = getMasteryColor(node.mastery);
            const masteryLabel = getMasteryLabel(node.mastery);
            const typeColor = TYPE_COLORS[node.type] || '#6366f1';

            return (
              <div
                key={node.id}
                style={{
                  background: '#1e293b',
                  borderRadius: 12,
                  border: '1px solid #334155',
                  padding: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#475569';
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#334155';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '3px 10px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    background: `${typeColor}22`,
                    color: typeColor,
                    border: `1px solid ${typeColor}44`,
                  }}>
                    {TYPE_LABELS[node.type] || node.type}
                  </span>
                  {node.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      style={{
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 500,
                        background: '#334155',
                        color: '#94a3b8',
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div>
                  <h4 style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: '#f1f5f9',
                    margin: '0 0 6px 0',
                  }}>
                    {node.name}
                  </h4>
                  <p style={{
                    fontSize: 12,
                    color: '#94a3b8',
                    lineHeight: 1.5,
                    margin: 0,
                  }}>
                    {node.description}
                  </p>
                </div>

                {node.formula && (
                  <div style={{
                    background: '#0f172a',
                    borderRadius: 8,
                    padding: '10px 14px',
                    border: '1px solid #334155',
                  }}>
                    <FormulaRenderer
                      formula={node.formula}
                      displayMode={false}
                    />
                  </div>
                )}

                <div style={{ marginTop: 'auto' }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 6,
                  }}>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: masteryColor,
                    }}>
                      {masteryLabel}
                    </span>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#e2e8f0',
                    }}>
                      {(node.mastery * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div style={{
                    width: '100%',
                    height: 8,
                    borderRadius: 4,
                    background: '#334155',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${Math.round(node.mastery * 100)}%`,
                      height: '100%',
                      borderRadius: 4,
                      background: masteryColor,
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}