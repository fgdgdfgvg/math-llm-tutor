import { useState, useEffect, useCallback, useRef } from 'react';
import { useResponsive } from '../hooks/useResponsive';

interface CollaborationUser {
  id: string;
  name: string;
  role: 'owner' | 'editor' | 'viewer';
  joinedAt: string;
  lastActiveAt: string;
}

interface SolutionStep {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  type: 'reasoning' | 'calculation' | 'result' | 'comment';
  status: 'draft' | 'confirmed' | 'rejected';
  reactions: { userId: string; emoji: string }[];
}

interface CollaborationSession {
  id: string;
  problem: string;
  category: string;
  status: 'active' | 'paused' | 'completed';
  users: CollaborationUser[];
  steps: SolutionStep[];
}

const API_BASE = 'http://localhost:3001/api/collaboration';

const EMOJI_REACTIONS = ['👍', '❤️', '💡', '✅', '❓', '🎯', '⚠️', '✨'];

const STEP_TYPES = [
  { value: 'reasoning', label: '推理', color: '#818cf8' },
  { value: 'calculation', label: '计算', color: '#34d399' },
  { value: 'result', label: '结果', color: '#fbbf24' },
  { value: 'comment', label: '评论', color: '#94a3b8' },
] as const;

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  owner: { label: '创建者', color: '#f59e0b' },
  editor: { label: '编辑者', color: '#3b82f6' },
  viewer: { label: '观察者', color: '#6b7280' },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}秒前`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}小时前`;
  return `${Math.floor(hr / 24)}天前`;
}

export default function CollaborationPage() {
  const { isMobile } = useResponsive();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<CollaborationSession | null>(null);
  const [userName, setUserName] = useState('');
  const [userId] = useState(() => `user_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`);
  const [problemInput, setProblemInput] = useState('');
  const [newStepContent, setNewStepContent] = useState('');
  const [stepType, setStepType] = useState<SolutionStep['type']>('reasoning');
  const [joinSessionId, setJoinSessionId] = useState('');
  const [message, setMessage] = useState('');
  const [activeSessions, setActiveSessions] = useState<CollaborationSession[]>([]);
  const [showSessionList, setShowSessionList] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  const pollSession = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`${API_BASE}/sessions/${sessionId}`);
      const data = await res.json();
      if (data.success) {
        setSession(data.session);
      }
    } catch {
      // silent poll failure
    }
  }, [sessionId]);

  useEffect(() => {
    if (sessionId) {
      pollRef.current = setInterval(pollSession, 2000);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }
  }, [sessionId, pollSession]);

  const createSession = async () => {
    if (!problemInput.trim() || !userName.trim()) {
      setMessage('请输入题目和用户名');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problem: problemInput,
          category: 'general',
          ownerId: userId,
          ownerName: userName,
          maxUsers: 5,
          allowLateJoin: true,
          requireApproval: false,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSessionId(data.session.id);
        setSession(data.session);
        setMessage('会话创建成功！');
      }
    } catch {
      setMessage('创建失败，请检查后端是否启动');
    }
  };

  const joinSession = async () => {
    if (!joinSessionId.trim() || !userName.trim()) {
      setMessage('请输入会话ID和用户名');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/sessions/${joinSessionId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, userName }),
      });
      const data = await res.json();
      if (data.success) {
        setSessionId(joinSessionId);
        const sessionRes = await fetch(`${API_BASE}/sessions/${joinSessionId}`);
        const sessionData = await sessionRes.json();
        if (sessionData.success) {
          setSession(sessionData.session);
        }
        setMessage('加入成功！');
      } else {
        setMessage(data.message);
      }
    } catch {
      setMessage('加入失败');
    }
  };

  const addStep = async () => {
    if (!sessionId || !newStepContent.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/sessions/${sessionId}/steps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, content: newStepContent, type: stepType }),
      });
      const data = await res.json();
      if (data.success) {
        setNewStepContent('');
      } else {
        setMessage(data.message);
      }
    } catch {
      setMessage('发送失败');
    }
  };

  const confirmStep = async (stepId: string) => {
    if (!sessionId) return;
    await fetch(`${API_BASE}/sessions/${sessionId}/steps/${stepId}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
  };

  const addReaction = async (stepId: string, emoji: string) => {
    if (!sessionId) return;
    await fetch(`${API_BASE}/sessions/${sessionId}/steps/${stepId}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, emoji }),
    });
  };

  const loadActiveSessions = async () => {
    try {
      const res = await fetch(`${API_BASE}/sessions`);
      const data = await res.json();
      if (data.success) {
        setActiveSessions(data.sessions);
        setShowSessionList(true);
      }
    } catch {
      setMessage('获取活跃会话失败');
    }
  };

  const quickJoin = async (sId: string) => {
    setJoinSessionId(sId);
    try {
      const res = await fetch(`${API_BASE}/sessions/${sId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, userName: userName || `匿名${userId.slice(-4)}` }),
      });
      const data = await res.json();
      if (data.success) {
        setSessionId(sId);
        setShowSessionList(false);
      }
    } catch {
      // ignore
    }
  };

  const leave = async () => {
    if (!sessionId) return;
    await fetch(`${API_BASE}/sessions/${sessionId}/leave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    setSessionId(null);
    setSession(null);
  };

  const myRole = session?.users.find((u) => u.id === userId)?.role;

  if (isMobile) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#1e293b', overflow: 'hidden' }}>
        <MobileCollaborationView
          sessionId={sessionId}
          session={session}
          userId={userId}
          userName={userName}
          setUserName={setUserName}
          problemInput={problemInput}
          setProblemInput={setProblemInput}
          newStepContent={newStepContent}
          setNewStepContent={setNewStepContent}
          stepType={stepType}
          setStepType={setStepType}
          joinSessionId={joinSessionId}
          setJoinSessionId={setJoinSessionId}
          message={message}
          activeSessions={activeSessions}
          showSessionList={showSessionList}
          setShowSessionList={setShowSessionList}
          createSession={createSession}
          joinSession={joinSession}
          addStep={addStep}
          confirmStep={confirmStep}
          addReaction={addReaction}
          loadActiveSessions={loadActiveSessions}
          quickJoin={quickJoin}
          leave={leave}
          myRole={myRole}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        background: '#1e293b',
        overflow: 'hidden',
      }}
    >
      {!sessionId ? (
        <JoinCreatePanel
          userName={userName}
          setUserName={setUserName}
          problemInput={problemInput}
          setProblemInput={setProblemInput}
          joinSessionId={joinSessionId}
          setJoinSessionId={setJoinSessionId}
          message={message}
          activeSessions={activeSessions}
          showSessionList={showSessionList}
          setShowSessionList={setShowSessionList}
          createSession={createSession}
          joinSession={joinSession}
          loadActiveSessions={loadActiveSessions}
          quickJoin={quickJoin}
        />
      ) : (
        <SessionWorkspace
          session={session}
          userId={userId}
          myRole={myRole}
          newStepContent={newStepContent}
          setNewStepContent={setNewStepContent}
          stepType={stepType}
          setStepType={setStepType}
          message={message}
          addStep={addStep}
          confirmStep={confirmStep}
          addReaction={addReaction}
          leave={leave}
        />
      )}
    </div>
  );
}

function JoinCreatePanel({
  userName, setUserName, problemInput, setProblemInput,
  joinSessionId, setJoinSessionId, message,
  activeSessions, showSessionList, setShowSessionList,
  createSession, joinSession, loadActiveSessions, quickJoin,
}: any) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        gap: 20,
      }}
    >
      <div style={{ fontSize: 28, fontWeight: 700, color: '#818cf8' }}>
        协作解题
      </div>
      <div style={{ fontSize: 13, color: '#64748b', textAlign: 'center', maxWidth: 400 }}>
        与同学协同解决高数问题，实时共享思路，共同完成复杂证明和计算
      </div>

      <input
        placeholder="你的名字"
        value={userName}
        onChange={(e) => setUserName(e.target.value)}
        style={inputStyle}
      />

      <div style={{ width: '100%', maxWidth: 400, borderTop: '1px solid #334155', paddingTop: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 12 }}>
          创建新会话
        </div>
        <textarea
          placeholder="输入数学题目..."
          value={problemInput}
          onChange={(e) => setProblemInput(e.target.value)}
          style={{ ...inputStyle, height: 80, resize: 'vertical' } as React.CSSProperties}
        />
        <button onClick={createSession} style={primaryBtnStyle}>
          创建协作会话
        </button>
      </div>

      <div style={{ width: '100%', maxWidth: 400, borderTop: '1px solid #334155', paddingTop: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 12 }}>
          加入已有会话
        </div>
        <input
          placeholder="会话ID"
          value={joinSessionId}
          onChange={(e) => setJoinSessionId(e.target.value)}
          style={inputStyle}
        />
        <button onClick={joinSession} style={secondaryBtnStyle}>
          加入会话
        </button>
        <button onClick={loadActiveSessions} style={{ ...secondaryBtnStyle, marginTop: 8 }}>
          查看活跃会话
        </button>
      </div>

      {message && (
        <div style={{ color: '#fbbf24', fontSize: 12 }}>{message}</div>
      )}

      {showSessionList && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
        >
          <div
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 12,
              padding: 24,
              maxWidth: 480,
              width: '90%',
              maxHeight: '70vh',
              overflow: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0' }}>
                活跃会话 ({activeSessions.length})
              </span>
              <button
                onClick={() => setShowSessionList(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 16, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            {activeSessions.length === 0 ? (
              <div style={{ color: '#64748b', fontSize: 13 }}>暂无活跃会话</div>
            ) : (
              activeSessions.map((s: CollaborationSession) => (
                <div
                  key={s.id}
                  onClick={() => quickJoin(s.id)}
                  style={{
                    padding: '12px',
                    border: '1px solid #334155',
                    borderRadius: 8,
                    marginBottom: 8,
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#0f172a')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ fontSize: 13, color: '#e2e8f0', marginBottom: 4 }}>
                    {s.problem.slice(0, 60)}{s.problem.length > 60 ? '...' : ''}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    {s.users.length}人 在线 · {s.steps.length}步解题 · 创建者: {s.users[0]?.name}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SessionWorkspace({
  session, userId, myRole,
  newStepContent, setNewStepContent, stepType, setStepType,
  message, addStep, confirmStep, addReaction, leave,
}: any) {
  const stepsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (stepsRef.current) {
      stepsRef.current.scrollTop = stepsRef.current.scrollHeight;
    }
  }, [session?.steps?.length]);

  const canEdit = myRole === 'owner' || myRole === 'editor';

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '12px 20px',
          background: '#0f172a',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>
            {session?.problem?.slice(0, 80)}{(session?.problem?.length ?? 0) > 80 ? '...' : ''}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            {session?.status === 'active' ? '🟢 进行中' : session?.status === 'paused' ? '⏸️ 已暂停' : '✅ 已完成'}
            {' · '}{session?.users?.length}人协作 · {session?.steps?.length}个步骤
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {session?.users?.map((u: CollaborationUser) => (
              <div
                key={u.id}
                title={`${u.name} (${ROLE_LABELS[u.role]?.label})`}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: ROLE_LABELS[u.role]?.color || '#6b7280',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  color: '#fff',
                  fontWeight: 600,
                  border: u.id === userId ? '2px solid #fff' : 'none',
                }}
              >
                {u.name[0]}
              </div>
            ))}
          </div>
          <button onClick={leave} style={{ ...secondaryBtnStyle, padding: '6px 12px', fontSize: 12 }}>
            离开
          </button>
        </div>
      </div>

      <div
        ref={stepsRef}
        style={{
          flex: 1,
          overflow: 'auto',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {(!session?.steps || session.steps.length === 0) ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
              fontSize: 13,
            }}
          >
            还没有解题步骤，开始协作吧！
          </div>
        ) : (
          session.steps.map((step: SolutionStep) => (
            <StepCard
              key={step.id}
              step={step}
              userId={userId}
              myRole={myRole}
              onConfirm={confirmStep}
              onReact={addReaction}
            />
          ))
        )}
      </div>

      {canEdit && session?.status === 'active' && (
        <div
          style={{
            padding: '12px 16px',
            background: '#0f172a',
            borderTop: '1px solid #1e293b',
            display: 'flex',
            gap: 8,
            alignItems: 'flex-end',
          }}
        >
          <select
            value={stepType}
            onChange={(e) => setStepType(e.target.value)}
            style={{
              ...inputStyle,
              width: 80,
              height: 36,
              background: '#0f172a',
              border: '1px solid #334155',
              color: '#e2e8f0',
              borderRadius: 6,
              padding: '0 8px',
              fontSize: 12,
            }}
          >
            {STEP_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <input
            placeholder="输入解题步骤..."
            value={newStepContent}
            onChange={(e) => setNewStepContent(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addStep()}
            style={{ ...inputStyle, flex: 1, height: 36 }}
          />
          <button onClick={addStep} style={primaryBtnStyle}>
            添加
          </button>
        </div>
      )}

      {message && (
        <div style={{ padding: '4px 16px', color: '#fbbf24', fontSize: 11 }}>{message}</div>
      )}
    </div>
  );
}

function StepCard({
  step, userId, myRole,
  onConfirm, onReact,
}: {
  step: SolutionStep;
  userId: string;
  myRole?: string;
  onConfirm: (id: string) => void;
  onReact: (id: string, emoji: string) => void;
}) {
  const typeConfig = STEP_TYPES.find((t) => t.value === step.type) || STEP_TYPES[0];
  const isMine = step.authorId === userId;
  const canEdit = myRole === 'owner' || myRole === 'editor';

  return (
    <div
      style={{
        padding: 12,
        background: isMine ? 'rgba(99,102,241,0.08)' : '#0f172a',
        border: '1px solid #1e293b',
        borderRadius: 10,
        maxWidth: '90%',
        alignSelf: isMine ? 'flex-end' : 'flex-start',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span
            style={{
              fontSize: 10,
              padding: '1px 6px',
              borderRadius: 4,
              background: typeConfig.color + '20',
              color: typeConfig.color,
              fontWeight: 600,
            }}
          >
            {typeConfig.label}
          </span>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>{step.authorName}</span>
          {step.status === 'confirmed' && <span style={{ fontSize: 10, color: '#34d399' }}>✓</span>}
          {step.status === 'draft' && <span style={{ fontSize: 10, color: '#fbbf24' }}>草稿</span>}
        </div>
        <span style={{ fontSize: 10, color: '#64748b' }}>{timeAgo(step.createdAt)}</span>
      </div>

      <div style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.5, wordBreak: 'break-word' }}>
        {step.content}
      </div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8 }}>
        {EMOJI_REACTIONS.map((emoji) => {
          const count = step.reactions.filter((r) => r.emoji === emoji).length;
          const hasMyReaction = step.reactions.some((r) => r.userId === userId && r.emoji === emoji);
          return (
            <button
              key={emoji}
              onClick={() => onReact(step.id, emoji)}
              style={{
                background: hasMyReaction ? 'rgba(99,102,241,0.2)' : 'transparent',
                border: hasMyReaction ? '1px solid #6366f1' : '1px solid transparent',
                borderRadius: 12,
                padding: '2px 6px',
                cursor: 'pointer',
                fontSize: 12,
                display: 'flex',
                gap: 2,
                alignItems: 'center',
                transition: 'all 0.15s',
              }}
            >
              <span>{emoji}</span>
              {count > 0 && <span style={{ fontSize: 10, color: '#94a3b8' }}>{count}</span>}
            </button>
          );
        })}
        {canEdit && step.status !== 'confirmed' && (
          <button
            onClick={() => onConfirm(step.id)}
            style={{
              marginLeft: 'auto',
              background: 'rgba(52,211,153,0.15)',
              border: '1px solid rgba(52,211,153,0.3)',
              color: '#34d399',
              borderRadius: 6,
              padding: '2px 8px',
              cursor: 'pointer',
              fontSize: 11,
            }}
          >
            确认
          </button>
        )}
      </div>
    </div>
  );
}

function MobileCollaborationView({
  sessionId, session, userId, userName, setUserName,
  problemInput, setProblemInput, newStepContent, setNewStepContent,
  stepType, setStepType, joinSessionId, setJoinSessionId, message,
  activeSessions, showSessionList, setShowSessionList,
  createSession, joinSession, addStep, confirmStep, addReaction,
  loadActiveSessions, quickJoin, leave, myRole,
}: any) {
  const stepsRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'steps' | 'users'>('steps');

  useEffect(() => {
    if (stepsRef.current) {
      stepsRef.current.scrollTop = stepsRef.current.scrollHeight;
    }
  }, [session?.steps?.length]);

  if (!sessionId) {
    return (
      <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#818cf8', textAlign: 'center', marginTop: 20 }}>
          协作解题
        </div>
        <input
          placeholder="你的名字"
          value={userName}
          onChange={(e: any) => setUserName(e.target.value)}
          style={inputStyle}
        />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 8 }}>创建新会话</div>
          <textarea
            placeholder="输入数学题目..."
            value={problemInput}
            onChange={(e: any) => setProblemInput(e.target.value)}
            style={{ ...inputStyle, height: 72, resize: 'vertical' } as React.CSSProperties}
          />
          <button onClick={createSession} style={{ ...primaryBtnStyle, width: '100%', marginTop: 8 }}>
            创建
          </button>
        </div>
        <div style={{ borderTop: '1px solid #334155', paddingTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 8 }}>加入会话</div>
          <input
            placeholder="会话ID"
            value={joinSessionId}
            onChange={(e: any) => setJoinSessionId(e.target.value)}
            style={inputStyle}
          />
          <button onClick={joinSession} style={{ ...secondaryBtnStyle, width: '100%', marginTop: 8 }}>
            加入
          </button>
          <button onClick={loadActiveSessions} style={{ ...secondaryBtnStyle, width: '100%', marginTop: 4 }}>
            活跃会话
          </button>
        </div>
        {message && <div style={{ color: '#fbbf24', fontSize: 12 }}>{message}</div>}

        {showSessionList && (
          <div style={{ position: 'fixed', inset: 0, background: '#0f172a', zIndex: 50, padding: 16, overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ color: '#e2e8f0', fontWeight: 600 }}>活跃会话</span>
              <button onClick={() => setShowSessionList(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 18 }}>✕</button>
            </div>
            {activeSessions.map((s: CollaborationSession) => (
              <div key={s.id} onClick={() => quickJoin(s.id)} style={{ padding: 12, border: '1px solid #334155', borderRadius: 8, marginBottom: 8 }}>
                <div style={{ fontSize: 13, color: '#e2e8f0' }}>{s.problem.slice(0, 50)}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{s.users.length}人在线</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const canEdit = myRole === 'owner' || myRole === 'editor';

  return (
    <>
      <div style={{ padding: '8px 12px', background: '#0f172a', borderBottom: '1px solid #1e293b' }}>
        <div style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 500 }}>
          {session?.problem?.slice(0, 60)}{' '}
          <span style={{ fontSize: 10, color: '#64748b' }}>
            {session?.status === 'active' ? '🟢' : session?.status === 'paused' ? '⏸️' : '✅'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {session?.users?.map((u: CollaborationUser) => (
              <div
                key={u.id}
                title={u.name}
                style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: ROLE_LABELS[u.role]?.color, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, color: '#fff', fontWeight: 600,
                  border: u.id === userId ? '1.5px solid #fff' : 'none',
                }}
              >
                {u.name[0]}
              </div>
            ))}
          </div>
          <button onClick={leave} style={{ color: '#f87171', background: 'none', border: 'none', fontSize: 11 }}>
            离开
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid #1e293b' }}>
        <button
          onClick={() => setActiveTab('steps')}
          style={{
            flex: 1, padding: '8px 0', background: activeTab === 'steps' ? '#1e293b' : 'transparent',
            border: 'none', color: activeTab === 'steps' ? '#e2e8f0' : '#64748b', fontSize: 12, fontWeight: 600,
          }}
        >
          解题步骤 ({session?.steps?.length})
        </button>
        <button
          onClick={() => setActiveTab('users')}
          style={{
            flex: 1, padding: '8px 0', background: activeTab === 'users' ? '#1e293b' : 'transparent',
            border: 'none', color: activeTab === 'users' ? '#e2e8f0' : '#64748b', fontSize: 12, fontWeight: 600,
          }}
        >
          协作者 ({session?.users?.length})
        </button>
      </div>

      {activeTab === 'users' ? (
        <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
          {session?.users?.map((u: CollaborationUser) => (
            <div
              key={u.id}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 0', borderBottom: '1px solid #1e293b',
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', background: ROLE_LABELS[u.role]?.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 600, fontSize: 13,
                }}>
                  {u.name[0]}
                </div>
                <div>
                  <div style={{ fontSize: 13, color: '#e2e8f0' }}>{u.name}</div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>加入于 {timeAgo(u.joinedAt)}</div>
                </div>
              </div>
              <span style={{ fontSize: 10, color: ROLE_LABELS[u.role]?.color }}>
                {ROLE_LABELS[u.role]?.label}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div ref={stepsRef} style={{ flex: 1, overflow: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(!session?.steps || session.steps.length === 0) ? (
            <div style={{ textAlign: 'center', color: '#64748b', fontSize: 12, marginTop: 40 }}>
              还没有解题步骤
            </div>
          ) : (
            session.steps.map((step: SolutionStep) => (
              <StepCard key={step.id} step={step} userId={userId} myRole={myRole} onConfirm={confirmStep} onReact={addReaction} />
            ))
          )}
        </div>
      )}

      {canEdit && session?.status === 'active' && (
        <div style={{ padding: '8px 12px', background: '#0f172a', borderTop: '1px solid #1e293b', display: 'flex', gap: 6, alignItems: 'center' }}>
          <select
            value={stepType}
            onChange={(e: any) => setStepType(e.target.value)}
            style={{ background: '#0f172a', border: '1px solid #334155', color: '#e2e8f0', borderRadius: 6, padding: '4px 6px', fontSize: 11, width: 56 }}
          >
            {STEP_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <input
            placeholder="输入步骤..."
            value={newStepContent}
            onChange={(e: any) => setNewStepContent(e.target.value)}
            style={{ flex: 1, ...inputStyle, height: 32, fontSize: 12 }}
          />
          <button onClick={addStep} style={{ ...primaryBtnStyle, padding: '4px 10px', fontSize: 11 }}>
            添加
          </button>
        </div>
      )}
    </>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 400,
  padding: '8px 12px',
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: 8,
  color: '#e2e8f0',
  fontSize: 13,
  outline: 'none',
};

const primaryBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: '#6366f1',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  marginTop: 8,
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: 'transparent',
  color: '#94a3b8',
  border: '1px solid #334155',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  marginTop: 8,
};
