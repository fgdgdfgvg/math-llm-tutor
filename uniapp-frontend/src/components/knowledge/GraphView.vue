<template>
  <view class="graph-view">
    <view class="graph-toolbar">
      <button class="toolbar-btn" @click="zoomIn">放大</button>
      <button class="toolbar-btn" @click="zoomOut">缩小</button>
      <button class="toolbar-btn" @click="resetView">重置</button>
      <button class="toolbar-btn" :class="{ 'path-toggle': pathMode }" @click="togglePathMode">
        {{ pathMode ? '退出路径' : '路径探索' }}
      </button>
      <button class="toolbar-btn" @click="toggleLayout">
        {{ layoutMode === 'force' ? '环形布局' : '力导布局' }}
      </button>
    </view>

    <view class="area-filter">
      <view
        class="area-chip"
        :class="{ active: !areaFilter }"
        @click="setAreaFilter(null)"
      >
        <text>全部</text>
        <text class="chip-count">{{ nodes.length }}</text>
      </view>
      <view
        v-for="(area, key) in AREA_MAP"
        :key="key"
        class="area-chip"
        :class="{ active: areaFilter === key }"
        :style="{ borderColor: area.color }"
        @click="setAreaFilter(key as string)"
      >
        <text :style="{ color: areaFilter === key ? area.color : 'var(--text-secondary)' }">{{ area.label }}</text>
        <text class="chip-count" :style="{ color: areaFilter === key ? area.color : 'var(--text-secondary)' }">
          {{ getAreaNodeCount(key) }}
        </text>
      </view>
    </view>

    <view v-if="pathMode" class="path-panel">
      <text class="path-title">学习路径探索</text>
      <view class="path-selectors">
        <view class="path-selector">
          <text class="path-label">起点:</text>
          <picker :range="nodeNames" @change="onPathStartChange">
            <text class="path-value">{{ pathStartName || '选择起点' }}</text>
          </picker>
        </view>
        <view class="path-selector">
          <text class="path-label">终点:</text>
          <picker :range="nodeNames" @change="onPathEndChange">
            <text class="path-value">{{ pathEndName || '选择终点' }}</text>
          </picker>
        </view>
      </view>
      <button class="path-find-btn" @click="findPath">查找最短路径</button>
      <view v-if="pathResult.length > 0" class="path-result">
        <text class="path-result-text">路径: {{ pathResultNames.join(' → ') }}</text>
        <text class="path-result-length">经过 {{ pathResult.length }} 个知识点</text>
      </view>
    </view>

    <view class="graph-container">
      <view class="graph-canvas-container">
        <view class="graph-stats-bar">
          <text class="stats-item">节点: {{ filteredNodes.length }}</text>
          <text class="stats-item">关系: {{ filteredEdges.length }}</text>
          <text class="stats-item">布局: {{ layoutMode === 'force' ? '力导向' : '环形' }}</text>
          <text v-if="selectedNode" class="stats-item stats-selected">已选: {{ selectedNode.name }}</text>
        </view>
        <view id="graphCanvas" class="graph-canvas"></view>
      </view>
    </view>

    <view v-if="slidePanelVisible && selectedNode" class="slide-panel-overlay" @click="closeSlidePanel">
      <view class="slide-panel" :class="{ 'slide-panel-open': slidePanelVisible }" @click.stop>
        <view class="slide-panel-header">
          <view class="slide-panel-title-row">
            <text class="slide-panel-icon">{{ getNodeIcon(selectedNode.type) }}</text>
            <text class="slide-panel-title">{{ selectedNode.name }}</text>
          </view>
          <button class="slide-panel-close" @click="closeSlidePanel">✕</button>
        </view>

        <view class="slide-panel-body">
          <view class="sp-meta-row">
            <view class="sp-meta-item">
              <text class="sp-meta-label">类型</text>
              <text class="sp-meta-value">{{ typeLabel(selectedNode.type) }}</text>
            </view>
            <view class="sp-meta-item">
              <text class="sp-meta-label">难度</text>
              <text class="sp-meta-value" :class="'diff-badge-' + selectedNode.difficulty">
                {{ difficultyLabel(selectedNode.difficulty) }}
              </text>
            </view>
            <view class="sp-meta-item">
              <text class="sp-meta-label">标签</text>
              <text class="sp-meta-value">{{ selectedNode.tags?.join(' · ') }}</text>
            </view>
          </view>

          <view class="sp-mastery-section">
            <text class="sp-section-title">掌握程度</text>
            <view class="sp-mastery-bar-wrapper">
              <view class="sp-mastery-bar">
                <view
                  class="sp-mastery-fill"
                  :style="{ width: toPercentMastery(selectedNode.mastery) + '%', backgroundColor: getMasteryColor(selectedNode.mastery) }"
                ></view>
              </view>
              <text class="sp-mastery-value" :style="{ color: getMasteryColor(selectedNode.mastery) }">
                {{ toPercentMastery(selectedNode.mastery).toFixed(0) }}%
              </text>
            </view>
          </view>

          <view class="sp-stats-grid">
            <view class="sp-stat-card">
              <text class="sp-stat-num">{{ selectedNode.practiceCount || 0 }}</text>
              <text class="sp-stat-label">练习次数</text>
            </view>
            <view class="sp-stat-card">
              <text class="sp-stat-num">{{ selectedNode.correctRate || 0 }}%</text>
              <text class="sp-stat-label">正确率</text>
            </view>
            <view class="sp-stat-card">
              <text class="sp-stat-num">{{ getMasteryLabel(selectedNode.mastery || 0) }}</text>
              <text class="sp-stat-label">掌握状态</text>
            </view>
          </view>

          <view class="sp-formula-section" v-if="selectedNode.latex || selectedNode.formula">
            <text class="sp-section-title">数学公式</text>
          <view class="sp-formula-display">
            <FormulaRenderer :latex="selectedNode.latex || selectedNode.formula || ''" />
          </view>
          </view>

          <view class="sp-desc-section">
            <text class="sp-section-title">描述</text>
            <text class="sp-desc-text">{{ selectedNode.description }}</text>
          </view>

          <view v-if="selectedNode.lastPractice" class="sp-last-practice">
            <text class="sp-last-label">最近练习: {{ selectedNode.lastPractice }}</text>
          </view>
        </view>

        <view class="slide-panel-footer">
          <button class="sp-action-btn primary" @click="goToScenario">进入场景学习</button>
          <button class="sp-action-btn secondary" @click="showLearningPath">查看学习路径</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import * as echarts from 'echarts'
import { findShortestPath, AREA_MAP, getMasteryColor, getMasteryLabel, toPercentMastery } from '@/utils/math/graph'
import FormulaRenderer from '@/components/FormulaRenderer.vue'

interface KnowledgeNode {
  id: string
  name: string
  type: string
  description: string
  formula?: string
  latex?: string
  difficulty: string
  tags: string[]
  mastery?: number
  practiceCount?: number
  correctRate?: number
  lastPractice?: string
}

interface GraphEdge {
  source: string
  target: string
  type: string
}

const props = defineProps<{
  nodes: KnowledgeNode[]
  edges: GraphEdge[]
  learningPaths?: any[]
}>()

const emit = defineEmits<{
  (e: 'selectNode', node: KnowledgeNode): void
  (e: 'showLearningPath', node: KnowledgeNode): void
}>()

const selectedNode = ref<KnowledgeNode | null>(null)
const slidePanelVisible = ref(false)
const layoutMode = ref<'force' | 'circular'>('force')
const areaFilter = ref<string | null>(null)
const pathMode = ref(false)
const pathStartId = ref<string | null>(null)
const pathEndId = ref<string | null>(null)
const pathResult = ref<string[]>([])
const highlightedNodes = ref<string[]>([])

let chartInstance: echarts.ECharts | null = null
const zoomLevel = ref(1)
const isZooming = ref(false)

const nodeNames = computed(() => props.nodes.map((n) => n.name))

const pathStartName = computed(() => {
  if (!pathStartId.value) return ''
  return props.nodes.find((n) => n.id === pathStartId.value)?.name || ''
})

const pathEndName = computed(() => {
  if (!pathEndId.value) return ''
  return props.nodes.find((n) => n.id === pathEndId.value)?.name || ''
})

const pathResultNames = computed(() =>
  pathResult.value.map((id) => props.nodes.find((n) => n.id === id)?.name || id),
)

const filteredNodes = computed(() => {
  if (!areaFilter.value) return props.nodes
  const area = AREA_MAP[areaFilter.value]
  if (!area) return props.nodes
  return props.nodes.filter((n) => area.nodeIds.includes(n.id))
})

const filteredEdges = computed(() => {
  if (!areaFilter.value) return props.edges
  const area = AREA_MAP[areaFilter.value]
  if (!area) return props.edges
  const nodeIds = new Set(area.nodeIds)
  return props.edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
})

const getAreaNodeCount = (areaKey: string): number => {
  const area = AREA_MAP[areaKey]
  if (!area) return 0
  return props.nodes.filter((n) => area.nodeIds.includes(n.id)).length
}

const getNodeIcon = (type: string) => {
  const icons: Record<string, string> = {
    Concept: '💡',
    Theorem: '📐',
    Formula: '📝',
    Method: '🔧',
    Example: '📖',
  }
  return icons[type] || '📌'
}

const typeLabel = (type: string) => {
  const labels: Record<string, string> = {
    Concept: '概念',
    Theorem: '定理',
    Formula: '公式',
    Method: '方法',
    Example: '示例',
  }
  return labels[type] || type
}

const difficultyLabel = (difficulty: string) => {
  const labels: Record<string, string> = { easy: '简单', medium: '中等', hard: '困难' }
  return labels[difficulty] || difficulty
}

const getNodeColor = (type: string, mastery?: number) => {
  if (mastery !== undefined) {
    return getMasteryColor(mastery)
  }
  const colors: Record<string, string> = {
    Concept: '#4CAF50',
    Theorem: '#2196F3',
    Formula: '#FF9800',
    Method: '#9C27B0',
  }
  return colors[type] || '#607D8B'
}

const setAreaFilter = (area: string | null) => {
  areaFilter.value = area
  highlightedNodes.value = []
  pathResult.value = []
  nextTick(() => drawGraph())
}

const closeSlidePanel = () => {
  slidePanelVisible.value = false
  setTimeout(() => {
    if (!slidePanelVisible.value) {
      selectedNode.value = null
    }
  }, 300)
}

const togglePathMode = () => {
  pathMode.value = !pathMode.value
  if (!pathMode.value) {
    pathResult.value = []
    highlightedNodes.value = []
    nextTick(() => drawGraph())
  }
}

const onPathStartChange = (e: any) => {
  const idx = e.detail.value
  pathStartId.value = props.nodes[idx]?.id || null
}

const onPathEndChange = (e: any) => {
  const idx = e.detail.value
  pathEndId.value = props.nodes[idx]?.id || null
}

const findPath = () => {
  if (!pathStartId.value || !pathEndId.value) {
    uni.showToast({ title: '请选择起点和终点', icon: 'none' })
    return
  }
  // 前置关系现在按有向图处理（先修 → 后继），无路径时返回 null，
  // 不再与“起点即终点”的 [] 混为一谈。
  const path = findShortestPath(props.edges, pathStartId.value, pathEndId.value)
  if (!path) {
    pathResult.value = []
    highlightedNodes.value = []
    uni.showToast({ title: '两点之间没有可达路径（前置关系是有向的）', icon: 'none' })
    nextTick(() => drawGraph())
    return
  }
  pathResult.value = path
  highlightedNodes.value = path
  nextTick(() => drawGraph())
}

const goToScenario = () => {
  if (!selectedNode.value) return
  const nodeToScenario: Record<string, string> = {
    limit: '/pages/scenario/index',
    limit_definition: '/pages/scenario/index',
    derivative: '/pages/scenario/index',
    derivative_definition: '/pages/scenario/index',
    integral: '/pages/scenario/index',
    integral_definition: '/pages/scenario/index',
    series: '/pages/scenario/index',
    series_convergence: '/pages/scenario/index',
  }
  const url = nodeToScenario[selectedNode.value.id]
  if (url) {
    uni.navigateTo({ url })
  } else {
    uni.navigateTo({ url: '/pages/scenario/index' })
  }
}

const formatTooltipHtml = (node: KnowledgeNode): string => {
  // 掌握度字段可能是 0~1 或 0~100 两种量纲，统一换算后再用
  const masteryPercent = toPercentMastery(node.mastery)
  const masteryColor = getMasteryColor(node.mastery)
  const formulaText = node.latex || node.formula || ''
  let formulaHtml = ''
  if (formulaText) {
    formulaHtml = `<div style="margin-top:6px;padding:6px 8px;background:rgba(0,0,0,0.04);border-radius:4px;font-family:'Times New Roman',serif;font-size:13px;color:#333;letter-spacing:0.5px;">
      ${escapeHtml(formulaText)}
    </div>`
  }
  return `<div style="max-width:280px;">
    <div style="font-weight:bold;font-size:15px;margin-bottom:6px;color:#1a1a2e;">${escapeHtml(node.name)}</div>
    <div style="display:flex;gap:12px;margin-bottom:6px;font-size:12px;">
      <span style="color:#666;">类型: <b>${typeLabel(node.type)}</b></span>
      <span style="color:#666;">难度: <b>${difficultyLabel(node.difficulty)}</b></span>
    </div>
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
      <span style="font-size:12px;color:#666;">掌握度:</span>
      <div style="flex:1;height:6px;background:#eee;border-radius:3px;overflow:hidden;">
        <div style="height:100%;width:${masteryPercent}%;background:${masteryColor};border-radius:3px;"></div>
      </div>
      <span style="font-size:12px;font-weight:bold;color:${masteryColor};">${masteryPercent.toFixed(0)}%</span>
    </div>
    <div style="display:flex;gap:10px;font-size:11px;color:#888;margin-bottom:6px;">
      <span>练习: ${node.practiceCount || 0}次</span>
      <span>正确率: ${node.correctRate || 0}%</span>
      <span>状态: ${getMasteryLabel(node.mastery || 0)}</span>
    </div>
    ${formulaHtml}
    <div style="margin-top:6px;font-size:12px;color:#555;line-height:1.5;">${escapeHtml(node.description)}</div>
    <div style="margin-top:4px;font-size:11px;color:#999;">点击查看详情</div>
  </div>`
}

const escapeHtml = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const drawGraph = () => {
  const chartDom = document.getElementById('graphCanvas')
  if (!chartDom) return

  if (chartInstance) chartInstance.dispose()
  chartInstance = echarts.init(chartDom)

  const nodesToUse = filteredNodes.value
  const edgesToUse = filteredEdges.value

  const option = {
    tooltip: {
      show: true,
      backgroundColor: '#ffffff',
      borderColor: '#e0e0e0',
      borderWidth: 1,
      padding: 0,
      textStyle: { color: '#333' },
      formatter: (params: any) => {
        if (params.dataType === 'node') {
          const node = nodesToUse.find((n) => n.id === params.data.id)
          if (node) {
            return formatTooltipHtml(node)
          }
        }
        return ''
      },
    },
    series: [{
      type: 'graph',
      layout: layoutMode.value === 'force' ? 'force' : 'circular',
      force: { repulsion: 350, edgeLength: [100, 250], gravity: 0.08, friction: 0.6 },
      roam: true,
      draggable: true,
      scaleLimit: { min: 0.3, max: 5 },
      data: nodesToUse.map((n) => {
        const isHighlighted = highlightedNodes.value.includes(n.id)
        const areaColor = getAreaColor(n.id)
        const baseColor = areaColor || getNodeColor(n.type, n.mastery)
        return {
          name: n.name,
          id: n.id,
          symbolSize: isHighlighted ? 56 : 34 + toPercentMastery(n.mastery) / 4,
          itemStyle: {
            color: isHighlighted ? '#FFD700' : baseColor,
            borderColor: isHighlighted ? '#FFA000' : (toPercentMastery(n.mastery) > 90 ? '#2E7D32' : 'rgba(0,0,0,0.15)'),
            borderWidth: isHighlighted ? 3 : (toPercentMastery(n.mastery) > 90 ? 2 : 1),
            opacity: isHighlighted ? 1 : 0.9,
            shadowBlur: isHighlighted ? 20 : (toPercentMastery(n.mastery) > 80 ? 12 : 4),
            shadowColor: isHighlighted ? 'rgba(255,215,0,0.7)' : 'rgba(0,0,0,0.2)',
          },
          label: {
            show: true,
            position: 'bottom',
            distance: 6,
            fontSize: isHighlighted ? 15 : 13,
            fontWeight: isHighlighted || toPercentMastery(n.mastery) > 80 ? 'bold' : 'normal',
            color: isHighlighted ? '#FF8C00' : '#1a1a2e',
            formatter: (params: any) => {
              const node = nodesToUse.find((nn) => nn.name === params.name)
              const mastery = toPercentMastery(node?.mastery)
              if (isHighlighted || mastery > 80) {
                return `${params.name} (${mastery.toFixed(0)}%)`
              }
              return params.name
            },
          },
        }
      }),
      links: edgesToUse.map((e) => {
        const isHighlighted = highlightedNodes.value.includes(e.source) && highlightedNodes.value.includes(e.target)
        const edgeTypeLabel = e.type === 'prerequisite' ? '前置依赖' : e.type
        return {
          source: e.source,
          target: e.target,
          label: {
            show: isHighlighted || layoutMode.value === 'circular',
            formatter: edgeTypeLabel,
            fontSize: 9,
            color: isHighlighted ? '#FF8C00' : '#999',
            distance: 5,
          },
          lineStyle: {
            color: isHighlighted ? '#FFB300' : '#c0c0c0',
            curveness: 0.15,
            width: isHighlighted ? 3 : 1.2,
            opacity: isHighlighted ? 1 : 0.5,
          },
          symbol: ['none', 'arrow'],
          symbolSize: [0, isHighlighted ? 12 : 8],
        }
      }),
      emphasis: {
        focus: 'adjacency',
        lineStyle: { width: 5, opacity: 1 },
        itemStyle: { shadowBlur: 16, shadowColor: 'rgba(0,0,0,0.3)', borderWidth: 3 },
        label: { fontSize: 16, fontWeight: 'bold' },
      },
      categories: Object.entries(AREA_MAP).map(([key, area]) => ({
        name: area.label,
      })),
    }],
  }

  chartInstance.setOption(option)

  chartInstance.on('click', { seriesIndex: 0 }, (params: any) => {
    if (params.dataType === 'node') {
      const node = nodesToUse.find((n) => n.id === params.data.id)
      if (node) {
        selectedNode.value = node
        slidePanelVisible.value = true
        emit('selectNode', node)
      }
    }
  })

  window.addEventListener('resize', () => { chartInstance?.resize() })
}

const getAreaColor = (nodeId: string): string | null => {
  for (const [, area] of Object.entries(AREA_MAP)) {
    if (area.nodeIds.includes(nodeId)) return area.color
  }
  return null
}

const showLearningPath = () => {
  if (selectedNode.value) {
    emit('showLearningPath', selectedNode.value)
  }
}

const zoomIn = () => {
  if (isZooming.value) return
  isZooming.value = true
  zoomLevel.value = Math.min(zoomLevel.value * 1.2, 3)
  chartInstance?.dispatchAction({ type: 'dataZoom', start: 0, end: 100 / zoomLevel.value })
  setTimeout(() => { isZooming.value = false }, 300)
}

const zoomOut = () => {
  if (isZooming.value) return
  isZooming.value = true
  zoomLevel.value = Math.max(zoomLevel.value / 1.2, 1)
  chartInstance?.dispatchAction({ type: 'dataZoom', start: 0, end: 100 / zoomLevel.value })
  setTimeout(() => { isZooming.value = false }, 300)
}

const resetView = () => {
  if (isZooming.value) return
  isZooming.value = true
  zoomLevel.value = 1
  chartInstance?.dispatchAction({ type: 'restore' })
  setTimeout(() => { isZooming.value = false }, 300)
}

const toggleLayout = () => {
  layoutMode.value = layoutMode.value === 'force' ? 'circular' : 'force'
  drawGraph()
}

watch(() => props.nodes, () => { nextTick(() => drawGraph()) }, { deep: true })
watch(() => props.edges, () => { nextTick(() => drawGraph()) }, { deep: true })

onMounted(() => {
  nextTick(() => drawGraph())
})
</script>

<style scoped>
.graph-view {
  padding: 15px;
}

.graph-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.toolbar-btn {
  flex: 1;
  min-width: 70px;
  height: 34px;
  line-height: 34px;
  font-size: 12px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-primary);
  transition: all 0.2s ease;
}

.toolbar-btn:active {
  transform: scale(0.95);
  background: var(--bg-secondary);
}

.toolbar-btn.path-toggle {
  background: var(--accent-gradient);
  color: white;
  border: none;
}

.area-filter {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.area-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 14px;
  border-radius: 16px;
  background: var(--bg-card);
  border: 1.5px solid var(--border-color);
  font-size: 12px;
  transition: all 0.2s;
}

.area-chip.active {
  background: var(--bg-secondary);
  border-width: 2px;
}

.chip-count {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  background: var(--bg-primary);
  font-weight: bold;
}

.path-panel {
  background: var(--bg-card);
  border-radius: 12px;
  padding: 15px;
  margin-bottom: 10px;
  border: 1px solid var(--accent-color);
}

.path-title {
  font-size: 14px;
  font-weight: bold;
  color: var(--text-primary);
  margin-bottom: 10px;
  display: block;
}

.path-selectors {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}

.path-selector {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
}

.path-label {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.path-value {
  font-size: 12px;
  color: var(--accent-color);
  padding: 4px 8px;
  background: var(--bg-secondary);
  border-radius: 6px;
}

.path-find-btn {
  width: 100%;
  height: 36px;
  line-height: 36px;
  background: var(--accent-gradient);
  color: white;
  border-radius: 8px;
  font-size: 13px;
  border: none;
  margin-bottom: 8px;
}

.path-result {
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 10px;
}

.path-result-text {
  font-size: 13px;
  color: var(--accent-color);
  display: block;
  margin-bottom: 4px;
}

.path-result-length {
  font-size: 12px;
  color: var(--text-secondary);
}

.graph-container {
  margin-bottom: 0;
}

.graph-canvas-container {
  height: 520px;
  background: var(--bg-card);
  border-radius: 12px;
  overflow: hidden;
  position: relative;
}

.graph-stats-bar {
  position: absolute;
  top: 8px;
  right: 12px;
  display: flex;
  gap: 10px;
  background: rgba(255, 255, 255, 0.92);
  padding: 4px 12px;
  border-radius: 10px;
  z-index: 10;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  font-size: 11px;
  color: #888;
}

.graph-stats-bar .stats-item {
  white-space: nowrap;
}

.graph-stats-bar .stats-selected {
  color: var(--accent-color);
  font-weight: bold;
}

.theme-dark .graph-stats-bar {
  background: rgba(26, 26, 46, 0.92);
  color: #aaa;
}

.graph-canvas {
  width: 100%;
  height: 100%;
}

.slide-panel-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 1000;
  display: flex;
  animation: fadeIn 0.25s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.slide-panel {
  width: 85vw;
  max-width: 380px;
  height: 100%;
  background: var(--bg-card);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  transform: translateX(-100%);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 4px 0 20px rgba(0, 0, 0, 0.15);
}

.slide-panel-open {
  transform: translateX(0);
}

.slide-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 20px 18px 14px;
  background: var(--accent-gradient);
  color: white;
  flex-shrink: 0;
}

.slide-panel-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.slide-panel-icon {
  font-size: 28px;
}

.slide-panel-title {
  font-size: 20px;
  font-weight: bold;
}

.slide-panel-close {
  width: 32px;
  height: 32px;
  line-height: 32px;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 50%;
  color: white;
  font-size: 16px;
  text-align: center;
  flex-shrink: 0;
}

.slide-panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 18px;
}

.sp-meta-row {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.sp-meta-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sp-meta-label {
  font-size: 11px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.sp-meta-value {
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 500;
}

.diff-badge-easy {
  color: var(--success-color);
  background: rgba(76, 175, 80, 0.1);
  padding: 2px 10px;
  border-radius: 10px;
  align-self: flex-start;
}

.diff-badge-medium {
  color: var(--warning-color);
  background: rgba(255, 193, 7, 0.1);
  padding: 2px 10px;
  border-radius: 10px;
  align-self: flex-start;
}

.diff-badge-hard {
  color: var(--error-color);
  background: rgba(244, 67, 54, 0.1);
  padding: 2px 10px;
  border-radius: 10px;
  align-self: flex-start;
}

.sp-section-title {
  font-size: 12px;
  font-weight: bold;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 1px;
  display: block;
  margin-bottom: 8px;
}

.sp-mastery-section {
  margin-bottom: 16px;
}

.sp-mastery-bar-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
}

.sp-mastery-bar {
  flex: 1;
  height: 10px;
  background: var(--bg-primary);
  border-radius: 5px;
  overflow: hidden;
}

.sp-mastery-fill {
  height: 100%;
  border-radius: 5px;
  transition: width 0.6s ease;
}

.sp-mastery-value {
  font-size: 16px;
  font-weight: bold;
  min-width: 40px;
  text-align: right;
}

.sp-stats-grid {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.sp-stat-card {
  flex: 1;
  background: var(--bg-primary);
  border-radius: 8px;
  padding: 10px 8px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sp-stat-num {
  font-size: 18px;
  font-weight: bold;
  color: var(--text-primary);
}

.sp-stat-label {
  font-size: 10px;
  color: var(--text-secondary);
}

.sp-formula-section {
  margin-bottom: 16px;
}

.sp-formula-display {
  background: var(--math-bg);
  padding: 14px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.sp-formula-text {
  font-family: 'Times New Roman', 'STIX Two Math', serif;
  font-size: 15px;
  color: var(--text-primary);
  line-height: 1.6;
  word-break: break-all;
}

.sp-desc-section {
  margin-bottom: 12px;
}

.sp-desc-text {
  font-size: 14px;
  color: var(--text-primary);
  line-height: 1.6;
}

.sp-last-practice {
  padding: 8px 0;
  border-top: 1px solid var(--border-color);
}

.sp-last-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.slide-panel-footer {
  padding: 14px 18px;
  border-top: 1px solid var(--border-color);
  display: flex;
  gap: 10px;
  flex-shrink: 0;
}

.sp-action-btn {
  flex: 1;
  height: 42px;
  line-height: 42px;
  font-size: 14px;
  border-radius: 10px;
  border: none;
}

.sp-action-btn.primary {
  background: var(--accent-gradient);
  color: white;
}

.sp-action-btn.secondary {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.sp-action-btn:active {
  transform: scale(0.96);
  opacity: 0.9;
}
</style>
