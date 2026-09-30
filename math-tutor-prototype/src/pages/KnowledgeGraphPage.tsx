import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import G6, { type Graph, type INode, type IEdge } from '@antv/g6';
import { useKnowledgeGraph, useDynamicGraph, usePrerequisites, useDependents, useRecordInteraction } from '../hooks/useQueries';
import { useGraphStore, useCognitiveStore } from '../stores';
import { MOCK_NODES, MOCK_EDGES, MOCK_MASTERY, getMasteryColor, getMasteryLabel } from '../services/mockData';
import type { KnowledgeNode, KnowledgeRelation, DynamicGraphNode } from '../types';

interface NodeDetail {
  node: KnowledgeNode;
  mastery: number;
  prerequisites: KnowledgeNode[];
  dependents: KnowledgeNode[];
}

const RELATION_LABELS: Record<string, string> = {
  PREREQUISITE: '前置', RELATED_TO: '关联', APPLIES_TO: '应用',
  DERIVES_FROM: '推导', EXAMPLE_OF: '示例', USES_METHOD: '方法', CONTAINS: '包含',
};

const TYPE_COLORS: Record<string, string> = {
  Concept: '#6366f1', Theorem: '#8b5cf6', Formula: '#a855f7',
  Method: '#ec4899', Example: '#14b8a6', Prerequisite: '#f59e0b',
};

const TYPE_LABELS: Record<string, string> = {
  Concept: '概念', Theorem: '定理', Formula: '公式',
  Method: '方法', Example: '示例', Prerequisite: '前置',
};

const AREA_MAP: Record<string, string[]> = {
  '全部': [],
  '极限': ['limit_definition', 'limit_properties', 'limit_computation', 'infinity_concept', 'infinitesimal'],
  '导数': ['derivative_definition', 'derivative_rules', 'chain_rule', 'product_rule', 'quotient_rule', 'implicit_diff', 'higher_derivatives', 'mean_value_theorem', 'lhopital', 'extrema', 'concavity'],
  '积分': ['integral_definition', 'indefinite_integral', 'definite_integral', 'ftc', 'substitution', 'integration_by_parts', 'partial_fractions', 'improper_integrals'],
  '级数': ['taylor_series', 'power_series', 'convergence_tests'],
  '微分方程': ['ode_definition', 'separable_ode', 'first_order_linear'],
};

export default function KnowledgeGraphPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);
  const [selectedNode, setSelectedNode] = useState<NodeDetail | null>(null);
  const [useRealApi, setUseRealApi] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [areaFilter, setAreaFilter] = useState('全部');
  const [pathMode, setPathMode] = useState(false);
  const [pathStart, setPathStart] = useState<string | null>(null);
  const [pathEnd, setPathEnd] = useState<string | null>(null);
  const [highlightedPath, setHighlightedPath] = useState<string[]>([]);
  const [layoutType, setLayoutType] = useState<'force' | 'circular' | 'dagre'>('force');

  const { data: graphData } = useKnowledgeGraph();
  const { data: dynamicData } = useDynamicGraph();
  const recordInteraction = useRecordInteraction();
  const { selectedDimension } = useCognitiveStore();

  const nodes = useMemo(() => {
    if (useRealApi && graphData) return graphData.nodes;
    return MOCK_NODES;
  }, [useRealApi, graphData]);

  const edges = useMemo(() => {
    if (useRealApi && graphData) return graphData.edges;
    return MOCK_EDGES;
  }, [useRealApi, graphData]);

  const mastery = useMemo(() => {
    if (useRealApi && dynamicData) {
      const m: Record<string, number> = {};
      dynamicData.nodes.forEach((n) => { m[n.id] = n.masteryLevel; });
      return m;
    }
    return MOCK_MASTERY;
  }, [useRealApi, dynamicData]);

  const dynamicNodes = useMemo(() => {
    if (useRealApi && dynamicData) return dynamicData.nodes;
    return [];
  }, [useRealApi, dynamicData]);

  const getDynamicData = useCallback((id: string): DynamicGraphNode | undefined => {
    return dynamicNodes.find((n) => n.id === id);
  }, [dynamicNodes]);

  const filteredNodes = useMemo(() => {
    if (areaFilter === '全部') return nodes;
    const areaIds = AREA_MAP[areaFilter] || [];
    return nodes.filter((n) => areaIds.includes(n.id));
  }, [nodes, areaFilter]);

  const filteredEdges = useMemo(() => {
    const nodeIds = new Set(filteredNodes.map((n) => n.id));
    return edges.filter((e) => nodeIds.has(e.fromId) && nodeIds.has(e.toId));
  }, [edges, filteredNodes]);

  const findShortestPath = useCallback((startId: string, endId: string): string[] => {
    const adj: Record<string, string[]> = {};
    edges.forEach((e) => {
      if (!adj[e.fromId]) adj[e.fromId] = [];
      adj[e.fromId].push(e.toId);
      if (!adj[e.toId]) adj[e.toId] = [];
      adj[e.toId].push(e.fromId);
    });
    const visited = new Set<string>();
    const queue: { id: string; path: string[] }[] = [{ id: startId, path: [startId] }];
    visited.add(startId);
    while (queue.length > 0) {
      const { id, path } = queue.shift()!;
      if (id === endId) return path;
      for (const neighbor of (adj[id] || [])) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push({ id: neighbor, path: [...path, neighbor] });
        }
      }
    }
    return [];
  }, [edges]);

  const buildGraph = useCallback(async () => {
    if (!containerRef.current) return;
    setLoading(true);
    setError(null);

    const g6Nodes = filteredNodes.map((n) => {
      const m = mastery[n.id] ?? 0;
      const dyn = getDynamicData(n.id);
      const activationLevel = dyn?.activationLevel ?? m;
      const baseSize = 30;
      const size = baseSize + activationLevel * 40;
      const typeColor = TYPE_COLORS[n.type] || '#6366f1';
      const masteryOpacity = 0.4 + m * 0.6;

      return {
        id: n.id,
        label: n.name,
        type: 'circle',
        size,
        style: {
          fill: typeColor,
          fillOpacity: masteryOpacity,
          stroke: getMasteryColor(m),
          lineWidth: 2 + m * 3,
          cursor: 'pointer',
          shadowColor: m >= 0.6 ? getMasteryColor(m) : 'transparent',
          shadowBlur: m >= 0.6 ? 12 : 0,
        },
        labelCfg: {
          style: { fill: '#e2e8f0', fontSize: 11, fontWeight: 500 },
          position: 'bottom' as const,
          offset: 8,
        },
        mastery: m,
        activationLevel,
        nodeData: n,
      };
    });

    const g6Edges = filteredEdges.map((e, i) => {
      const isPrereq = e.type === 'PREREQUISITE';
      const weight = e.weight ?? 0.5;
      return {
        id: `edge-${i}`,
        source: e.fromId,
        target: e.toId,
        label: RELATION_LABELS[e.type] || e.type,
        style: {
          stroke: isPrereq ? '#6366f1' : '#475569',
          lineWidth: Math.max(1, weight * 4),
          endArrow: isPrereq,
          lineDash: !isPrereq ? [4, 4] : undefined,
          opacity: 0.3 + weight * 0.7,
        },
        labelCfg: {
          style: { fill: '#94a3b8', fontSize: 9 },
          autoRotate: true,
        },
      };
    });

    if (graphRef.current) {
      graphRef.current.destroy();
    }

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const layoutConfig: Record<string, any> = {
      force: {
        type: 'force',
        preventOverlap: true,
        nodeSize: 60,
        linkDistance: 180,
        nodeStrength: -300,
        edgeStrength: 0.1,
        collideStrength: 0.8,
      },
      circular: {
        type: 'circular',
        radius: Math.min(width, height) * 0.35,
      },
      dagre: {
        type: 'dagre',
        rankdir: 'TB',
        nodesep: 50,
        ranksep: 70,
      },
    };

    const graph = new G6.Graph({
      container: containerRef.current,
      width,
      height,
      modes: {
        default: ['drag-canvas', 'zoom-canvas', 'drag-node'],
      },
      layout: layoutConfig[layoutType],
      defaultNode: { type: 'circle', size: 50 },
      defaultEdge: { type: 'quadratic' },
      animate: true,
    });

    graph.data({ nodes: g6Nodes, edges: g6Edges });
    graph.render();

    graph.on('node:click', async (evt) => {
      const nodeModel = evt.item?.getModel();
      if (!nodeModel) return;
      const nodeData = nodeModel.nodeData as KnowledgeNode;
      const m = mastery[nodeData.id] ?? 0;

      if (pathMode) {
        if (!pathStart) {
          setPathStart(nodeData.id);
          graph.setItemState(evt.item!, 'selected', true);
        } else if (!pathEnd) {
          setPathEnd(nodeData.id);
          const path = findShortestPath(pathStart, nodeData.id);
          setHighlightedPath(path);
          path.forEach((pid) => {
            const node = graph.findById(pid);
            if (node) graph.setItemState(node, 'highlight', true);
          });
          for (let i = 0; i < path.length - 1; i++) {
            const edge = graph.findAll('edge', (e: any) => {
              const model = e.getModel();
              return (model.source === path[i] && model.target === path[i + 1]) ||
                     (model.source === path[i + 1] && model.target === path[i]);
            });
            edge.forEach((e: any) => graph.setItemState(e, 'highlight', true));
          }
        }
        return;
      }

      recordInteraction.mutate({ nodeId: nodeData.id, interactionType: 'view' });

      let prerequisites: KnowledgeNode[] = [];
      let dependents: KnowledgeNode[] = [];

      if (useRealApi) {
        try {
          const [prereq, dep] = await Promise.all([
            knowledgeApi.getPrerequisites(nodeData.id).catch(() => []),
            knowledgeApi.getDependents(nodeData.id).catch(() => []),
          ]);
          prerequisites = prereq;
          dependents = dep;
        } catch {
          prerequisites = filteredEdges.filter((e) => e.toId === nodeData.id && e.type === 'PREREQUISITE').map((e) => filteredNodes.find((n) => n.id === e.fromId)!).filter(Boolean);
          dependents = filteredEdges.filter((e) => e.fromId === nodeData.id && e.type === 'PREREQUISITE').map((e) => filteredNodes.find((n) => n.id === e.toId)!).filter(Boolean);
        }
      } else {
        prerequisites = filteredEdges.filter((e) => e.toId === nodeData.id && e.type === 'PREREQUISITE').map((e) => filteredNodes.find((n) => n.id === e.fromId)!).filter(Boolean);
        dependents = filteredEdges.filter((e) => e.fromId === nodeData.id && e.type === 'PREREQUISITE').map((e) => filteredNodes.find((n) => n.id === e.toId)!).filter(Boolean);
      }

      setSelectedNode({ node: nodeData, mastery: m, prerequisites, dependents });

      graph.getNodes().forEach((n: INode) => {
        const m2 = n.getModel();
        const isNeighbor = filteredEdges.some((e) =>
          (e.fromId === nodeData.id && e.toId === m2.id) || (e.toId === nodeData.id && e.fromId === m2.id)
        ) || m2.id === nodeData.id;
        graph.setItemState(n, 'selected', m2.id === nodeData.id);
        graph.setItemState(n, 'dimmed', !isNeighbor);
      });
      graph.getEdges().forEach((e: IEdge) => {
        const model = e.getModel();
        const isConnected = model.source === nodeData.id || model.target === nodeData.id;
        graph.setItemState(e, 'highlight', isConnected);
        graph.setItemState(e, 'dimmed', !isConnected);
      });
    });

    graph.on('node:dblclick', (evt) => {
      const nodeModel = evt.item?.getModel();
      if (!nodeModel) return;
      const nodeData = nodeModel.nodeData as KnowledgeNode;
      const neighborIds = new Set<string>();
      filteredEdges.forEach((e) => {
        if (e.fromId === nodeData.id) neighborIds.add(e.toId);
        if (e.toId === nodeData.id) neighborIds.add(e.fromId);
      });
      neighborIds.forEach((nid) => {
        const node = graph.findById(nid);
        if (node) {
          const model = node.getModel();
          graph.updateItem(node, {
            style: { ...model.style, fillOpacity: 1 },
          });
        }
      });
    });

    graph.on('canvas:click', () => {
      setSelectedNode(null);
      setPathStart(null);
      setPathEnd(null);
      setHighlightedPath([]);
      graph.getNodes().forEach((n: INode) => {
        graph.clearItemStates(n, ['selected', 'dimmed', 'highlight']);
      });
      graph.getEdges().forEach((e: IEdge) => {
        graph.clearItemStates(e, ['highlight', 'dimmed']);
      });
    });

    graphRef.current = graph;
    setLoading(false);
  }, [filteredNodes, filteredEdges, mastery, layoutType, useRealApi, pathMode, pathStart, pathEnd]);

  useEffect(() => {
    buildGraph();
    const handleResize = () => {
      if (graphRef.current && containerRef.current) {
        graphRef.current.changeSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      graphRef.current?.destroy();
    };
  }, [buildGraph]);

  return (
    <div style={{ display: 'flex', height: '100%', gap: 0 }}>
      <div style={{ flex: 1, position: 'relative' }}>
        <div style={{
          position: 'absolute', top: 12, left: 12, zIndex: 10,
          background: 'rgba(15,23,42,0.9)', borderRadius: 8, padding: '8px 16px',
          display: 'flex', alignItems: 'center', gap: 12, backdropFilter: 'blur(8px)',
        }}>
          <span style={{ fontSize: 13, color: '#94a3b8' }}>数据源:</span>
          <button onClick={() => setUseRealApi(false)} style={{ padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', background: !useRealApi ? '#6366f1' : '#334155', color: !useRealApi ? '#fff' : '#94a3b8', fontSize: 12, fontWeight: 600 }}>本地</button>
          <button onClick={() => setUseRealApi(true)} style={{ padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', background: useRealApi ? '#6366f1' : '#334155', color: useRealApi ? '#fff' : '#94a3b8', fontSize: 12, fontWeight: 600 }}>API</button>
          <div style={{ width: 1, height: 20, background: '#475569' }} />
          <span style={{ fontSize: 13, color: '#94a3b8' }}>布局:</span>
          {(['force', 'circular', 'dagre'] as const).map((lt) => (
            <button key={lt} onClick={() => setLayoutType(lt)} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', background: layoutType === lt ? '#6366f1' : '#334155', color: layoutType === lt ? '#fff' : '#94a3b8', fontSize: 11, fontWeight: 600 }}>
              {lt === 'force' ? '力导向' : lt === 'circular' ? '环形' : '层次'}
            </button>
          ))}
          {loading && <span style={{ color: '#6366f1', fontSize: 12 }}>加载中...</span>}
          {error && <span style={{ color: '#f97316', fontSize: 12 }}>{error}</span>}
        </div>

        <div style={{
          position: 'absolute', top: 12, right: 12, zIndex: 10,
          background: 'rgba(15,23,42,0.9)', borderRadius: 8, padding: '8px 16px',
          backdropFilter: 'blur(8px)',
        }}>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>掌握度图例</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {[
              { color: '#ef4444', label: '未学习' }, { color: '#f97316', label: '初接触' },
              { color: '#eab308', label: '学习中' }, { color: '#84cc16', label: '较熟悉' },
              { color: '#22c55e', label: '已掌握' },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
                <span style={{ fontSize: 10, color: '#94a3b8' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      </div>

      <div style={{ width: 340, background: '#1e293b', borderLeft: '1px solid #334155', padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <h3 style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>知识领域筛选</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {Object.keys(AREA_MAP).map((area) => (
              <button key={area} onClick={() => setAreaFilter(area)} style={{
                padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: areaFilter === area ? '#6366f1' : '#334155',
                color: areaFilter === area ? '#fff' : '#94a3b8', fontSize: 11, fontWeight: 600,
              }}>
                {area}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>路径探索</h3>
          <button onClick={() => { setPathMode(!pathMode); setPathStart(null); setPathEnd(null); setHighlightedPath([]); }} style={{
            width: '100%', padding: '8px 12px', borderRadius: 8, border: pathMode ? '1px solid #6366f1' : '1px solid #475569',
            background: pathMode ? 'rgba(99,102,241,0.1)' : 'transparent', color: pathMode ? '#a5b4fc' : '#94a3b8',
            cursor: 'pointer', fontSize: 12, fontWeight: 600,
          }}>
            {pathMode ? '🔍 路径模式已开启 (点击两个节点)' : '🛤️ 开启路径探索'}
          </button>
          {highlightedPath.length > 0 && (
            <div style={{ marginTop: 8, background: '#0f172a', borderRadius: 8, padding: 10, border: '1px solid #334155' }}>
              <span style={{ fontSize: 11, color: '#a5b4fc' }}>路径: {highlightedPath.map((id) => {
                const n = nodes.find((nn) => nn.id === id);
                return n?.name || id;
              }).join(' → ')}</span>
            </div>
          )}
        </div>

        <div>
          <h3 style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>节点类型</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {Object.entries(TYPE_COLORS).map(([type, color]) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
                <span style={{ fontSize: 10, color: '#94a3b8' }}>{TYPE_LABELS[type]}</span>
              </div>
            ))}
          </div>
        </div>

        {selectedNode && (
          <>
            <div style={{ borderTop: '1px solid #334155', paddingTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: TYPE_COLORS[selectedNode.node.type] || '#6366f1' }} />
                <span style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase' }}>{TYPE_LABELS[selectedNode.node.type] || selectedNode.node.type}</span>
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>{selectedNode.node.name}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#334155', overflow: 'hidden' }}>
                  <div style={{ width: `${selectedNode.mastery * 100}%`, height: '100%', background: getMasteryColor(selectedNode.mastery), borderRadius: 3, transition: 'width 0.3s' }} />
                </div>
                <span style={{ fontSize: 12, color: getMasteryColor(selectedNode.mastery), fontWeight: 600 }}>
                  {Math.round(selectedNode.mastery * 100)}% {getMasteryLabel(selectedNode.mastery)}
                </span>
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>描述</h3>
              <p style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.6 }}>{selectedNode.node.description}</p>
            </div>

            {selectedNode.node.formula && (
              <div style={{ background: '#0f172a', borderRadius: 8, padding: 10, border: '1px solid #334155' }}>
                <h3 style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>公式</h3>
                <code style={{ fontSize: 13, color: '#a5b4fc' }}>{selectedNode.node.formula}</code>
              </div>
            )}

            {selectedNode.prerequisites.length > 0 && (
              <div>
                <h3 style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>前置知识点</h3>
                {selectedNode.prerequisites.map((p) => (
                  <div key={p.id} style={{ background: '#0f172a', borderRadius: 6, padding: '6px 10px', marginBottom: 3, fontSize: 11, color: '#fbbf24', cursor: 'pointer' }}>
                    ← {p.name}
                  </div>
                ))}
              </div>
            )}

            {selectedNode.dependents.length > 0 && (
              <div>
                <h3 style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>后续知识点</h3>
                {selectedNode.dependents.map((d) => (
                  <div key={d.id} style={{ background: '#0f172a', borderRadius: 6, padding: '6px 10px', marginBottom: 3, fontSize: 11, color: '#34d399', cursor: 'pointer' }}>
                    → {d.name}
                  </div>
                ))}
              </div>
            )}

            {(() => {
              const dyn = getDynamicData(selectedNode.node.id);
              if (!dyn) return null;
              return (
                <div style={{ background: '#0f172a', borderRadius: 8, padding: 10, border: '1px solid #334155' }}>
                  <h3 style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>动态指标</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, color: '#64748b' }}>激活水平</span>
                      <span style={{ fontSize: 11, color: '#a5b4fc' }}>{(dyn.activationLevel * 100).toFixed(0)}%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, color: '#64748b' }}>相关性得分</span>
                      <span style={{ fontSize: 11, color: '#a5b4fc' }}>{(dyn.relevanceScore * 100).toFixed(0)}%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, color: '#64748b' }}>动态权重</span>
                      <span style={{ fontSize: 11, color: '#a5b4fc' }}>{(dyn.dynamicWeight * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div style={{ background: '#0f172a', borderRadius: 8, padding: 10, border: '1px solid #334155', marginTop: 'auto' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: selectedNode.node.difficulty === 'easy' ? '#22c55e' : selectedNode.node.difficulty === 'medium' ? '#eab308' : '#ef4444' }}>
                难度: {selectedNode.node.difficulty === 'easy' ? '基础' : selectedNode.node.difficulty === 'medium' ? '中等' : '困难'}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

import { knowledgeApi } from '../services/api';
