import { useState, useEffect, useRef, useCallback } from 'react';
import FormulaRenderer from '../components/FormulaRenderer';
import { useResponsive } from '../hooks/useResponsive';

interface AgentMessage {
  id: string;
  agentId: string;
  agentName: string;
  agentIcon: string;
  agentColor: string;
  type: 'thinking' | 'output' | 'handoff' | 'complete';
  content: string;
  formulas?: string[];
  timestamp: number;
}

const AGENTS = [
  {
    id: 'agent-analyzer',
    name: '问题分析智能体',
    shortName: '分析Agent',
    icon: '🔍',
    color: '#6366f1',
    role: '负责问题分类与方程类型识别',
  },
  {
    id: 'agent-characteristic',
    name: '特征方程智能体',
    shortName: '特征Agent',
    icon: '⚙️',
    color: '#f59e0b',
    role: '负责特征方程构建与求解',
  },
  {
    id: 'agent-solver',
    name: '通解推导智能体',
    shortName: '求解Agent',
    icon: '🧮',
    color: '#10b981',
    role: '负责通解形式推导与验证',
  },
  {
    id: 'agent-presenter',
    name: '结果呈现智能体',
    shortName: '呈现Agent',
    icon: '📋',
    color: '#ec4899',
    role: '负责最终结果整理与呈现',
  },
] as const;

const HARDCODED_CONVERSATION: AgentMessage[] = [
  {
    id: 'msg-1',
    agentId: 'agent-analyzer',
    agentName: '问题分析智能体',
    agentIcon: '🔍',
    agentColor: '#6366f1',
    type: 'thinking',
    content: '正在接收用户输入...',
    formulas: [],
    timestamp: 1000,
  },
  {
    id: 'msg-2',
    agentId: 'agent-analyzer',
    agentName: '问题分析智能体',
    agentIcon: '🔍',
    agentColor: '#6366f1',
    type: 'output',
    content: '【问题分类结果】\n\n已识别方程为：二阶常系数齐次线性微分方程\n\n标准形式：y\'\' + p·y\' + q·y = 0\n\n提取参数：p = -3, q = 2\n\n方程类型特征：\n• 阶数：2阶（最高导数阶数为2）\n• 系数：常系数（p、q为常数）\n• 齐次性：齐次（右端为0）\n\n→ 将分析结果传递给特征方程智能体...',
    formulas: ["y'' - 3y' + 2y = 0", "y'' + p \\cdot y' + q \\cdot y = 0", "p = -3,\\quad q = 2"],
    timestamp: 2000,
  },
  {
    id: 'msg-3',
    agentId: 'agent-analyzer',
    agentName: '问题分析智能体',
    agentIcon: '🔍',
    agentColor: '#6366f1',
    type: 'handoff',
    content: '🔄 已将问题分析结果移交至 "特征方程智能体"',
    formulas: [],
    timestamp: 3000,
  },
  {
    id: 'msg-4',
    agentId: 'agent-characteristic',
    agentName: '特征方程智能体',
    agentIcon: '⚙️',
    agentColor: '#f59e0b',
    type: 'thinking',
    content: '正在接收分析数据，构建特征方程...',
    formulas: [],
    timestamp: 4000,
  },
  {
    id: 'msg-5',
    agentId: 'agent-characteristic',
    agentName: '特征方程智能体',
    agentIcon: '⚙️',
    agentColor: '#f59e0b',
    type: 'output',
    content: '【特征方程构建】\n\n步骤1：设 y = e^{rx}，代入原方程\n• y\' = r·e^{rx}\n• y\'\' = r²·e^{rx}\n\n步骤2：代入 y\'\' - 3y\' + 2y = 0\n→ r²·e^{rx} - 3r·e^{rx} + 2·e^{rx} = 0\n→ e^{rx}(r² - 3r + 2) = 0\n\n步骤3：由于 e^{rx} ≠ 0，得特征方程：',
    formulas: ["y = e^{rx}", "y' = r \\cdot e^{rx}", "y'' = r^2 \\cdot e^{rx}", "r^2 - 3r + 2 = 0"],
    timestamp: 5000,
  },
  {
    id: 'msg-6',
    agentId: 'agent-characteristic',
    agentName: '特征方程智能体',
    agentIcon: '⚙️',
    agentColor: '#f59e0b',
    type: 'output',
    content: '【特征根求解】\n\n求解特征方程：r² - 3r + 2 = 0\n\n因式分解：(r - 1)(r - 2) = 0\n\n得到两个不相等的实根：\n• r₁ = 1\n• r₂ = 2\n\n判别式 Δ = (-3)² - 4×1×2 = 9 - 8 = 1 > 0\n→ 两个不相等实根，适用通解形式：y = C₁·e^(r₁·x) + C₂·e^(r₂·x)\n\n→ 将特征根结果传递给通解推导智能体...',
    formulas: ["r^2 - 3r + 2 = 0", "(r - 1)(r - 2) = 0", "r_1 = 1,\\quad r_2 = 2", "\\Delta = (-3)^2 - 4 \\times 1 \\times 2 = 1 > 0"],
    timestamp: 6000,
  },
  {
    id: 'msg-7',
    agentId: 'agent-characteristic',
    agentName: '特征方程智能体',
    agentIcon: '⚙️',
    agentColor: '#f59e0b',
    type: 'handoff',
    content: '🔄 已将特征根 r₁=1, r₂=2 移交至 "通解推导智能体"',
    formulas: [],
    timestamp: 7000,
  },
  {
    id: 'msg-8',
    agentId: 'agent-solver',
    agentName: '通解推导智能体',
    agentIcon: '🧮',
    agentColor: '#10b981',
    type: 'thinking',
    content: '正在接收特征根数据，推导通解表达式...',
    formulas: [],
    timestamp: 8000,
  },
  {
    id: 'msg-9',
    agentId: 'agent-solver',
    agentName: '通解推导智能体',
    agentIcon: '🧮',
    agentColor: '#10b981',
    type: 'output',
    content: '【通解推导】\n\n根据二阶常系数齐次线性微分方程理论：\n\n当特征方程有两个不相等的实根 r₁, r₂ 时，\n通解形式为：y = C₁·e^(r₁·x) + C₂·e^(r₂·x)\n\n代入 r₁ = 1, r₂ = 2：\n\ny = C₁·e^(1·x) + C₂·e^(2·x)',
    formulas: ["y = C_1 \\cdot e^{r_1 x} + C_2 \\cdot e^{r_2 x}", "y = C_1 \\cdot e^{x} + C_2 \\cdot e^{2x}"],
    timestamp: 9000,
  },
  {
    id: 'msg-10',
    agentId: 'agent-solver',
    agentName: '通解推导智能体',
    agentIcon: '🧮',
    agentColor: '#10b981',
    type: 'output',
    content: '【验证推导结果】\n\n将 y = C₁·e^x + C₂·e^(2x) 代入原方程验证：\n\ny\' = C₁·e^x + 2C₂·e^(2x)\ny\'\' = C₁·e^x + 4C₂·e^(2x)\n\n代入 y\'\' - 3y\' + 2y：\n= (C₁·e^x + 4C₂·e^(2x)) - 3(C₁·e^x + 2C₂·e^(2x)) + 2(C₁·e^x + C₂·e^(2x))\n= C₁·e^x + 4C₂·e^(2x) - 3C₁·e^x - 6C₂·e^(2x) + 2C₁·e^x + 2C₂·e^(2x)\n= (C₁ - 3C₁ + 2C₁)·e^x + (4C₂ - 6C₂ + 2C₂)·e^(2x)\n= 0·e^x + 0·e^(2x)\n= 0 ✓\n\n验证通过！通解正确。\n\n→ 将完整结果传递给结果呈现智能体...',
    formulas: ["y = C_1 e^{x} + C_2 e^{2x}", "y' = C_1 e^{x} + 2C_2 e^{2x}", "y'' = C_1 e^{x} + 4C_2 e^{2x}", "y'' - 3y' + 2y = 0 \\quad \\checkmark"],
    timestamp: 10000,
  },
  {
    id: 'msg-11',
    agentId: 'agent-solver',
    agentName: '通解推导智能体',
    agentIcon: '🧮',
    agentColor: '#10b981',
    type: 'handoff',
    content: '🔄 已将完整推导结果移交至 "结果呈现智能体"',
    formulas: [],
    timestamp: 11000,
  },
  {
    id: 'msg-12',
    agentId: 'agent-presenter',
    agentName: '结果呈现智能体',
    agentIcon: '📋',
    agentColor: '#ec4899',
    type: 'thinking',
    content: '正在整理最终解题报告...',
    formulas: [],
    timestamp: 12000,
  },
  {
    id: 'msg-13',
    agentId: 'agent-presenter',
    agentName: '结果呈现智能体',
    agentIcon: '📋',
    agentColor: '#ec4899',
    type: 'output',
    content: '═══════════════════════════════════\n      📐 最终解题报告\n═══════════════════════════════════\n\n📌 原题：求解 y\'\' - 3y\' + 2y = 0\n\n📌 方程类型：二阶常系数齐次线性微分方程\n\n📌 完整解题流程：\n\n  ① 建立特征方程：r² - 3r + 2 = 0\n  ② 因式分解：(r - 1)(r - 2) = 0\n  ③ 求解特征根：r₁ = 1, r₂ = 2\n  ④ 判别类型：两个不相等实根\n  ⑤ 写出通解：',
    formulas: ["r^2 - 3r + 2 = 0", "r_1 = 1,\\quad r_2 = 2", "y = C_1 e^{x} + C_2 e^{2x}"],
    timestamp: 13000,
  },
  {
    id: 'msg-14',
    agentId: 'agent-presenter',
    agentName: '结果呈现智能体',
    agentIcon: '📋',
    agentColor: '#ec4899',
    type: 'complete',
    content: '✅ 求解完成！\n\n📚 涉及知识点：\n• 二阶常系数齐次线性微分方程标准形式\n• 特征方程的建立方法（欧拉待定系数法）\n• 一元二次方程的因式分解\n• 特征根类型判别（Δ > 0: 两不等实根）\n• 通解结构定理\n\n💡 举一反三提示：\n当特征根 r₁, r₂ 为复数 α±βi 时，\n通解形式为 y = e^(αx)[C₁·cos(βx) + C₂·sin(βx)]',
    formulas: ["y = C_1 e^{x} + C_2 e^{2x}", "y = e^{\\alpha x}[C_1 \\cos(\\beta x) + C_2 \\sin(\\beta x)]"],
    timestamp: 14000,
  },
];

const SIMILARITY_PROBLEMS = [
  {
    id: 'sim-1',
    title: 'y\'\' - 5y\' + 6y = 0',
    latex: 'y\'\' - 5y\' + 6y = 0',
    hint: '特征方程 r² - 5r + 6 = (r-2)(r-3) = 0',
    answer: 'y = C_1 e^{2x} + C_2 e^{3x}',
  },
  {
    id: 'sim-2',
    title: 'y\'\' - 4y\' + 4y = 0',
    latex: 'y\'\' - 4y\' + 4y = 0',
    hint: '特征方程 r² - 4r + 4 = (r-2)² = 0, 重根情况',
    answer: 'y = (C_1 + C_2 x) e^{2x}',
  },
  {
    id: 'sim-3',
    title: 'y\'\' + y = 0',
    latex: 'y\'\' + y = 0',
    hint: '特征方程 r² + 1 = 0, r = ±i, 共轭复根',
    answer: 'y = C_1 \\cos x + C_2 \\sin x',
  },
];

export default function MultiAgentPage() {
  const { isMobile } = useResponsive();
  const [visibleMessages, setVisibleMessages] = useState<AgentMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, []);

  const startSimulation = useCallback(() => {
    setIsRunning(true);
    setIsComplete(false);
    setVisibleMessages([]);

    let index = 0;
    const revealNext = () => {
      if (index >= HARDCODED_CONVERSATION.length) {
        setIsRunning(false);
        setIsComplete(true);
        setActiveAgentId(null);
        return;
      }
      const msg = HARDCODED_CONVERSATION[index];
      setVisibleMessages((prev) => [...prev, msg]);
      setActiveAgentId(msg.agentId);
      scrollToBottom();
      index++;
      timerRef.current = setTimeout(revealNext, 1500 + Math.random() * 500);
    };

    timerRef.current = setTimeout(revealNext, 800);
  }, [scrollToBottom]);

  useEffect(() => {
    startSimulation();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [startSimulation]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0f172a', overflow: 'hidden' }}>
      <HeaderBar
        isMobile={isMobile}
        isRunning={isRunning}
        isComplete={isComplete}
        visibleMessages={visibleMessages}
        onRestart={startSimulation}
      />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              padding: isMobile ? 12 : 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {visibleMessages.length === 0 && (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#64748b',
                  fontSize: 14,
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🤖</div>
                  <div>正在启动多智能体协作系统...</div>
                  <div style={{ fontSize: 11, marginTop: 4 }}>4个智能体将协作完成微分方程求解</div>
                </div>
              </div>
            )}

            {visibleMessages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {isRunning && activeAgentId && (
              <TypingIndicator agentId={activeAgentId} agents={AGENTS} />
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {!isMobile && (
          <AgentSidebar agents={AGENTS} activeAgentId={activeAgentId} visibleMessages={visibleMessages} />
        )}
      </div>

      {isComplete && (
        <SimilarityPanel problems={SIMILARITY_PROBLEMS} />
      )}
    </div>
  );
}

function HeaderBar({
  isMobile, isRunning, isComplete, visibleMessages, onRestart,
}: {
  isMobile: boolean;
  isRunning: boolean;
  isComplete: boolean;
  visibleMessages: AgentMessage[];
  onRestart: () => void;
}) {
  return (
    <div
      style={{
        padding: isMobile ? '10px 14px' : '14px 24px',
        background: '#1e293b',
        borderBottom: '1px solid #334155',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <div>
        <div style={{ fontSize: isMobile ? 15 : 17, fontWeight: 700, color: '#e2e8f0' }}>
          🤝 多智能体协作解题
        </div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
          原题：y\'\' - 3y\' + 2y = 0
          {isComplete && <span style={{ color: '#34d399', marginLeft: 8 }}>✅ 求解完成</span>}
          {isRunning && <span style={{ color: '#fbbf24', marginLeft: 8 }}>🔄 协作中 ({visibleMessages.length}/{HARDCODED_CONVERSATION.length})</span>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span
          style={{
            fontSize: 10,
            padding: '2px 8px',
            borderRadius: 10,
            background: isRunning ? 'rgba(251,191,36,0.15)' : isComplete ? 'rgba(52,211,153,0.15)' : 'rgba(100,116,139,0.15)',
            color: isRunning ? '#fbbf24' : isComplete ? '#34d399' : '#64748b',
            fontWeight: 600,
          }}
        >
          {isRunning ? '协作进行中' : isComplete ? '协作完成' : '准备就绪'}
        </span>
        <button
          onClick={onRestart}
          style={{
            padding: '4px 12px',
            background: 'rgba(99,102,241,0.15)',
            border: '1px solid rgba(99,102,241,0.3)',
            borderRadius: 6,
            color: '#a5b4fc',
            cursor: 'pointer',
            fontSize: 11,
          }}
        >
          重新演示
        </button>
      </div>
    </div>
  );
}

function AgentSidebar({
  agents, activeAgentId, visibleMessages,
}: {
  agents: typeof AGENTS;
  activeAgentId: string | null;
  visibleMessages: AgentMessage[];
}) {
  const agentMsgCounts = agents.map((a) => ({
    ...a,
    count: visibleMessages.filter((m) => m.agentId === a.id).length,
  }));

  return (
    <div
      style={{
        width: 240,
        background: '#1e293b',
        borderLeft: '1px solid #334155',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        overflowY: 'auto',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>
        🧠 智能体状态面板
      </div>

      {agentMsgCounts.map((agent) => {
        const isActive = activeAgentId === agent.id;
        const hasOutput = agent.count > 0;
        return (
          <div
            key={agent.id}
            style={{
              padding: 10,
              borderRadius: 8,
              background: isActive ? `${agent.color}15` : '#0f172a',
              border: `1px solid ${isActive ? agent.color + '40' : '#1e293b'}`,
              transition: 'all 0.3s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 18 }}>{agent.icon}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: isActive ? agent.color : '#e2e8f0' }}>
                  {agent.shortName}
                </div>
                <div style={{ fontSize: 9, color: '#64748b' }}>{agent.role}</div>
              </div>
              {isActive && (
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: agent.color,
                    marginLeft: 'auto',
                    animation: 'pulse 1s infinite',
                  }}
                />
              )}
              {hasOutput && !isActive && (
                <span style={{ marginLeft: 'auto', fontSize: 11, color: '#34d399' }}>✓</span>
              )}
            </div>
            {agent.count > 0 && (
              <div style={{ fontSize: 10, color: '#64748b' }}>
                已产出 {agent.count} 条消息
              </div>
            )}
          </div>
        );
      })}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.5); }
        }
      `}</style>
    </div>
  );
}

function MessageBubble({ message }: { message: AgentMessage }) {
  const agent = AGENTS.find((a) => a.id === message.agentId);
  const color = agent?.color || '#6366f1';

  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        opacity: 1,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: color + '20',
          border: `2px solid ${color}40`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          flexShrink: 0,
          marginTop: 4,
        }}
      >
        {agent?.icon || '🤖'}
      </div>

      <div style={{ flex: 1, maxWidth: '92%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color }}>{message.agentName}</span>
          <span
            style={{
              fontSize: 9,
              padding: '2px 6px',
              borderRadius: 4,
              background:
                message.type === 'thinking' ? 'rgba(100,116,139,0.2)' :
                message.type === 'handoff' ? 'rgba(139,92,246,0.2)' :
                message.type === 'complete' ? 'rgba(52,211,153,0.2)' :
                'rgba(99,102,241,0.2)',
              color:
                message.type === 'thinking' ? '#94a3b8' :
                message.type === 'handoff' ? '#a78bfa' :
                message.type === 'complete' ? '#34d399' :
                '#a5b4fc',
            }}
          >
            {message.type === 'thinking' ? '思考中...' :
             message.type === 'handoff' ? '移交' :
             message.type === 'complete' ? '完成' : '输出'}
          </span>
        </div>

        {(message.type === 'output' || message.type === 'complete') && (
          <div
            style={{
              background: '#1e293b',
              border: `1px solid ${color}20`,
              borderRadius: 10,
              padding: '12px 16px',
            }}
          >
            <div style={{ fontSize: 13, color: '#cbd5e1', whiteSpace: 'pre-wrap', lineHeight: 1.65, wordBreak: 'break-word' }}>
              {message.content}
            </div>

            {message.formulas && message.formulas.length > 0 && (
              <div
                style={{
                  marginTop: 10,
                  padding: '10px 12px',
                  background: '#0f172a',
                  borderRadius: 8,
                  border: '1px solid #1e293b',
                }}
              >
                {message.formulas.map((formula, idx) => (
                  <div key={idx} style={idx > 0 ? { marginTop: 4 } : {}}>
                    <FormulaRenderer
                      formula={formula}
                      displayMode={false}
                      style={{ margin: 0 }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {(message.type === 'thinking') && (
          <div
            style={{
              background: '#1e293b',
              border: `1px solid ${color}15`,
              borderRadius: 10,
              padding: '10px 16px',
            }}
          >
            <div style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic' }}>
              💭 {message.content}
            </div>
          </div>
        )}

        {(message.type === 'handoff') && (
          <div
            style={{
              background: 'rgba(139,92,246,0.08)',
              border: '1px solid rgba(139,92,246,0.2)',
              borderRadius: 8,
              padding: '8px 14px',
              fontSize: 12,
              color: '#a78bfa',
              textAlign: 'center',
            }}
          >
            {message.content}
          </div>
        )}
      </div>
    </div>
  );
}

function TypingIndicator({ agentId, agents }: { agentId: string; agents: typeof AGENTS }) {
  const agent = agents.find((a) => a.id === agentId);

  return (
    <div style={{ display: 'flex', gap: 10, paddingLeft: 46 }}>
      <div
        style={{
          display: 'flex',
          gap: 4,
          padding: '6px 12px',
          background: '#1e293b',
          borderRadius: 8,
          border: `1px solid ${agent?.color || '#64748b'}20`,
        }}
      >
        <span style={{ fontSize: 11, color: '#64748b' }}>
          {agent?.icon} {agent?.name} 正在处理
        </span>
        <span style={{ color: agent?.color, fontSize: 14 }}>...</span>
      </div>
    </div>
  );
}

function SimilarityPanel({ problems }: { problems: typeof SIMILARITY_PROBLEMS }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        borderTop: '1px solid #334155',
        background: '#1e293b',
        maxHeight: expanded ? 320 : 64,
        overflow: 'hidden',
        transition: 'max-height 0.3s',
        padding: '8px 20px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>💡</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>
            举一反三 · 拓展练习
          </span>
          <span style={{ fontSize: 10, color: '#64748b' }}>
            ({problems.length}道同类题)
          </span>
        </div>
        <span style={{ fontSize: 12, color: '#64748b' }}>
          {expanded ? '收起 ▲' : '展开 ▼'}
        </span>
      </div>

      {expanded && (
        <div style={{ display: 'flex', gap: 12, marginTop: 10, overflowX: 'auto', paddingBottom: 8 }}>
          {problems.map((p) => (
            <div
              key={p.id}
              style={{
                minWidth: 240,
                flex: 1,
                padding: 12,
                background: '#0f172a',
                borderRadius: 8,
                border: '1px solid #334155',
              }}
            >
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>
                拓展题 {p.id.split('-')[1]}
              </div>
              <div style={{ marginBottom: 8 }}>
                <FormulaRenderer formula={p.latex} displayMode={false} style={{ margin: 0 }} />
              </div>
              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6 }}>
                💡 {p.hint}
              </div>
              <div style={{ fontSize: 11, color: '#34d399', marginTop: 4 }}>
                通解：
                <FormulaRenderer formula={p.answer} displayMode={false} style={{ margin: 0 }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}