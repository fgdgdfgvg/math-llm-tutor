import { useState, useCallback, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import KnowledgeGraphPage from './pages/KnowledgeGraphPage';
import KnowledgeListPage from './pages/KnowledgeListPage';
import EpsilonDeltaPage from './pages/EpsilonDeltaPage';
import DerivativePage from './pages/DerivativePage';
import IntegralPage from './pages/IntegralPage';
import SeriesPage from './pages/SeriesPage';
import CognitiveDashboard from './pages/CognitiveDashboard';
import FormulaTestPage from './pages/FormulaTestPage';
import CollaborationPage from './pages/CollaborationPage';
import MultiAgentPage from './pages/MultiAgentPage';
import ErrorBookPage from './pages/ErrorBookPage';
import SpecialPracticePage from './pages/SpecialPracticePage';
import DemoModePage from './pages/DemoModePage';

import { useResponsive } from './hooks/useResponsive';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 2 * 60 * 1000,
    },
  },
});

const NAV_SECTIONS = [
  {
    label: '毕设演示',
    items: [
      { path: '/', label: '演示主页', icon: '🎓' },
    ],
  },
  {
    label: '知识图谱',
    items: [
      { path: '/knowledge-graph', label: '图谱探索', icon: '🕸️' },
      { path: '/knowledge-list', label: '列表视图', icon: '📋' },
    ],
  },
  {
    label: '智能体协作',
    items: [
      { path: '/multi-agent', label: '多智能体解题', icon: '🤖' },
    ],
  },
  {
    label: '练习与复习',
    items: [
      { path: '/special-practice', label: '专项练习', icon: '📝' },
      { path: '/error-book', label: '错题本', icon: '📕' },
    ],
  },
  {
    label: '交互场景',
    items: [
      { path: '/epsilon-delta', label: 'ε-δ 极限', icon: '📐' },
      { path: '/derivative', label: '导数几何', icon: '📈' },
      { path: '/integral', label: '黎曼积分', icon: '📊' },
      { path: '/series', label: '级数收敛', icon: '🔢' },
    ],
  },
  {
    label: '学习分析',
    items: [
      { path: '/cognitive', label: '认知仪表盘', icon: '🧠' },
    ],
  },
  {
    label: '工具与测试',
    items: [
      { path: '/formula-test', label: '公式渲染测试', icon: '🔬' },
      { path: '/collaboration', label: '协作解题', icon: '🤝' },
    ],
  },
];

const MOBILE_BOTTOM_NAV = [
  { path: '/', label: '演示', icon: '🎓' },
  { path: '/multi-agent', label: '智能体', icon: '🤖' },
  { path: '/special-practice', label: '练习', icon: '📝' },
  { path: '/error-book', label: '错题', icon: '📕' },
  { path: '/knowledge-graph', label: '图谱', icon: '🕸️' },
];

function Sidebar() {
  const location = useLocation();

  return (
    <aside
      className="sidebar-desktop"
      style={{
        width: 220,
        background: '#0f172a',
        borderRight: '1px solid #1e293b',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          padding: '20px 16px 16px',
          borderBottom: '1px solid #1e293b',
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 800, color: '#818cf8', letterSpacing: '-0.5px' }}>
          MathCognitive
        </div>
        <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>
          数学认知交互平台
        </div>
      </div>

      <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: '#475569',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                padding: '0 8px',
                marginBottom: 6,
              }}
            >
              {section.label}
            </div>
            {section.items.map(({ path, label, icon }) => {
              const isActive =
                location.pathname === path || (path === '/' && location.pathname === '');
              return (
                <NavLink
                  key={path}
                  to={path}
                  end={path === '/'}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 10px',
                    borderRadius: 8,
                    textDecoration: 'none',
                    background: isActive ? 'rgba(99,102,241,0.15)' : 'transparent',
                    color: isActive ? '#a5b4fc' : '#94a3b8',
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 400,
                    marginBottom: 2,
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: 14 }}>{icon}</span>
                  <span>{label}</span>
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid #1e293b',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
        <span style={{ fontSize: 10, color: '#475569' }}>React + G6 + Plotly + ECharts</span>
      </div>
    </aside>
  );
}

function MobileDrawer({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const location = useLocation();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleNavClick = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 90,
        }}
      />
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: 280,
          maxWidth: '85vw',
          background: '#0f172a',
          borderRight: '1px solid #1e293b',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          paddingTop: 'env(safe-area-inset-top, 0px)',
          animation: 'slideInLeft 0.25s ease-out',
        }}
      >
        <div
          style={{
            padding: '20px 16px 16px',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#818cf8' }}>
              MathCognitive
            </div>
            <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>
              数学认知交互平台
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              fontSize: 20,
              cursor: 'pointer',
              padding: 8,
              lineHeight: 1,
            }}
            aria-label="关闭菜单"
          >
            ✕
          </button>
        </div>

        <nav
          style={{
            flex: 1,
            padding: '12px 8px',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#475569',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  padding: '0 8px',
                  marginBottom: 6,
                }}
              >
                {section.label}
              </div>
              {section.items.map(({ path, label, icon }) => {
                const isActive =
                  location.pathname === path || (path === '/' && location.pathname === '');
                return (
                  <NavLink
                    key={path}
                    to={path}
                    end={path === '/'}
                    onClick={handleNavClick}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 10px',
                      borderRadius: 8,
                      textDecoration: 'none',
                      background: isActive ? 'rgba(99,102,241,0.15)' : 'transparent',
                      color: isActive ? '#a5b4fc' : '#94a3b8',
                      fontSize: 14,
                      fontWeight: isActive ? 600 : 400,
                      marginBottom: 2,
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{icon}</span>
                    <span>{label}</span>
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      <style>{`
        @keyframes slideInLeft {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}

function MobileHeader({
  onMenuOpen,
  title,
}: {
  onMenuOpen: () => void;
  title: string;
}) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        height: 48,
        background: '#0f172a',
        borderBottom: '1px solid #1e293b',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}
    >
      <button
        onClick={onMenuOpen}
        style={{
          background: 'none',
          border: 'none',
          color: '#94a3b8',
          fontSize: 20,
          cursor: 'pointer',
          padding: 8,
          marginRight: 8,
          lineHeight: 1,
        }}
        aria-label="打开菜单"
      >
        ☰
      </button>
      <span
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: '#e2e8f0',
          flex: 1,
          textAlign: 'center',
        }}
      >
        {title}
      </span>
      <div style={{ width: 36 }} />
    </header>
  );
}

function MobileBottomNav() {
  const location = useLocation();

  return (
    <nav
      style={{
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        padding: '8px 4px env(safe-area-inset-bottom, 8px) 4px',
        background: '#0f172a',
        borderTop: '1px solid #1e293b',
        height: 56,
        flexShrink: 0,
      }}
    >
      {MOBILE_BOTTOM_NAV.map(({ path, label, icon }) => {
        const isActive =
          location.pathname === path || (path === '/' && location.pathname === '');
        return (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              textDecoration: 'none',
              color: isActive ? '#a5b4fc' : '#64748b',
              fontSize: 10,
              fontWeight: isActive ? 600 : 400,
              padding: '4px 8px',
              minWidth: 56,
              transition: 'color 0.15s',
            }}
          >
            <span style={{ fontSize: 18 }}>{icon}</span>
            <span>{label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

function AppLayout() {
  const { isMobile } = useResponsive();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  const getPageTitle = (): string => {
    for (const section of NAV_SECTIONS) {
      for (const item of section.items) {
        if (item.path === location.pathname || (item.path === '/' && location.pathname === '')) {
          return item.label;
        }
      }
    }
    return '数学认知平台';
  };

  const handleMenuOpen = useCallback(() => {
    setDrawerOpen(true);
  }, []);

  const handleMenuClose = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  if (isMobile) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          width: '100vw',
          background: '#1e293b',
        }}
      >
        <MobileHeader onMenuOpen={handleMenuOpen} title={getPageTitle()} />
        <MobileDrawer isOpen={drawerOpen} onClose={handleMenuClose} />
        <main
          style={{
            flex: 1,
            overflow: 'hidden',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <Routes>
            <Route path="/" element={<DemoModePage />} />
            <Route path="/knowledge-graph" element={<KnowledgeGraphPage />} />
            <Route path="/knowledge-list" element={<KnowledgeListPage />} />
            <Route path="/multi-agent" element={<MultiAgentPage />} />
            <Route path="/special-practice" element={<SpecialPracticePage />} />
            <Route path="/error-book" element={<ErrorBookPage />} />
            <Route path="/epsilon-delta" element={<EpsilonDeltaPage />} />
            <Route path="/derivative" element={<DerivativePage />} />
            <Route path="/integral" element={<IntegralPage />} />
            <Route path="/series" element={<SeriesPage />} />
            <Route path="/cognitive" element={<CognitiveDashboard />} />
            <Route path="/formula-test" element={<FormulaTestPage />} />
            <Route path="/collaboration" element={<CollaborationPage />} />
          </Routes>
        </main>
        <MobileBottomNav />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#1e293b' }}>
      <Sidebar />
      <main style={{ flex: 1, overflow: 'hidden' }}>
        <Routes>
          <Route path="/" element={<DemoModePage />} />
            <Route path="/knowledge-graph" element={<KnowledgeGraphPage />} />
            <Route path="/knowledge-list" element={<KnowledgeListPage />} />
            <Route path="/multi-agent" element={<MultiAgentPage />} />
            <Route path="/special-practice" element={<SpecialPracticePage />} />
            <Route path="/error-book" element={<ErrorBookPage />} />
            <Route path="/epsilon-delta" element={<EpsilonDeltaPage />} />
            <Route path="/derivative" element={<DerivativePage />} />
            <Route path="/integral" element={<IntegralPage />} />
            <Route path="/series" element={<SeriesPage />} />
            <Route path="/cognitive" element={<CognitiveDashboard />} />
            <Route path="/formula-test" element={<FormulaTestPage />} />
            <Route path="/collaboration" element={<CollaborationPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
