<template>
  <view class="knowledge-page">
    <view class="page-header">
      <text class="page-title">知识图谱</text>
      <text class="page-subtitle">高等数学知识体系可视化</text>
    </view>

    <view class="search-bar">
      <input 
        class="search-input"
        v-model="searchQuery"
        placeholder="搜索知识点..."
        @confirm="handleSearch"
      />
      <button class="search-btn" @click="handleSearch">搜索</button>
    </view>

    <view class="tabs">
      <view 
        v-for="tab in tabs" 
        :key="tab.key"
        class="tab-item"
        :class="{ 'tab-active': activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </view>
    </view>

    <!-- 缓存标签页内容 -->
    <view>
      <!-- 图谱视图 -->
      <GraphView 
        v-show="activeTab === 'graph'"
        :nodes="nodes"
        :edges="edges"
        :learningPaths="learningPaths"
        :showPathPanel="showPathPanel"
        :selectedNode="selectedNode"
        :prerequisites="prerequisites"
        :dependents="dependents"
        :highlightedNodes="highlightedNodes"
        @selectNode="selectNode"
        @selectNodeById="selectNodeById"
        @showLearningPath="showLearningPath"
        @togglePathPanel="togglePathPanel"
        @selectPath="selectPath"
        @showCustomPathDialog="showCustomPathDialog = true"
      />

      <!-- 列表视图 -->
      <ListView 
        v-show="activeTab === 'list'"
        :nodes="nodes"
        :progressMap="progressMap"
        :searchQuery="searchQuery"
        @selectNode="selectNode"
      />

      <!-- 历史轨迹视图 -->
      <HistoryView v-show="activeTab === 'history'" />

      <!-- 学习评估视图 -->
      <AssessmentView v-show="activeTab === 'assessment'" />
    </view>

    <view v-if="loading" class="loading-overlay">
      <view class="loading-spinner"></view>
      <text class="loading-text">加载中...</text>
    </view>

    <view v-else-if="graphError" class="graph-error-state">
      <text class="error-icon">⚠️</text>
      <text class="error-title">知识图谱暂时不可用</text>
      <text class="error-message">{{ graphError }}</text>
      <button class="retry-graph-btn" @click="fetchGraphData">重新加载</button>
    </view>

    <!-- 自定义路径对话框 -->
    <view v-if="showCustomPathDialog" class="dialog-overlay">
      <view class="dialog-content">
        <view class="dialog-header">
          <text class="dialog-title">创建自定义学习路径</text>
          <button class="close-btn" @click="showCustomPathDialog = false">✕</button>
        </view>
        <view class="dialog-body">
          <input 
            class="dialog-input"
            v-model="customPathName"
            placeholder="路径名称"
          />
          <input 
            class="dialog-input"
            v-model="customPathDescription"
            placeholder="路径描述"
          />
          <view class="node-selector">
            <text class="selector-title">选择知识点</text>
            <view class="node-list">
              <view 
                v-for="node in nodes" 
                :key="node.id"
                class="node-item"
                :class="{ 'selected': selectedCustomNodes.includes(node.id) }"
                @click="toggleCustomNode(node.id)"
              >
                {{ node.name }}
              </view>
            </view>
          </view>
        </view>
        <view class="dialog-footer">
          <button class="dialog-btn cancel" @click="showCustomPathDialog = false">取消</button>
          <button class="dialog-btn confirm" @click="createCustomPath">创建</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue';
import request from '@/utils/request';
import GraphView from '@/components/knowledge/GraphView.vue';
import ListView from '@/components/knowledge/ListView.vue';
import HistoryView from '@/components/knowledge/HistoryView.vue';
import AssessmentView from '@/components/knowledge/AssessmentView.vue';
import type {
  KnowledgeNode,
  GraphEdge,
  LearningPath,
  LearningProgress
} from '@/mock/knowledge';

const tabs = [
  { key: 'graph', label: '图谱视图' },
  { key: 'list', label: '列表视图' },
  { key: 'history', label: '历史轨迹' },
  { key: 'assessment', label: '学习评估' },
];

const activeTab = ref('graph');
const searchQuery = ref('');
const loading = ref(false);
const graphError = ref('');
const nodes = ref<KnowledgeNode[]>([]);
const edges = ref<GraphEdge[]>([]);
const selectedNode = ref<KnowledgeNode | null>(null);
const prerequisites = ref<KnowledgeNode[]>([]);
const dependents = ref<KnowledgeNode[]>([]);
const progressMap = ref<Map<string, LearningProgress>>(new Map());
const highlightedNodes = ref<string[]>([]);
const showPathPanel = ref(false);
const showCustomPathDialog = ref(false);
const customPathName = ref('');
const customPathDescription = ref('');
const selectedCustomNodes = ref<string[]>([]);

const learningPaths = ref<LearningPath[]>([]);

const fetchGraphData = async () => {
  console.log('开始加载图谱数据');
  loading.value = true;
  graphError.value = '';
  try {
    const graphData = await request({ url: '/knowledge/graph', method: 'GET' });
    if (graphData && graphData.nodes && graphData.nodes.length > 0) {
      console.log('从API加载图谱数据成功，节点数:', graphData.nodes.length);
      nodes.value = graphData.nodes.map((n: any) => ({
        ...n,
        source: n.source || 'api',
      }));
      edges.value = (graphData.edges || []).map((e: any) => ({
        source: e.fromId || e.source,
        target: e.toId || e.target,
        type: e.type,
      }));
      await fetchDynamicMastery();
    } else {
      throw new Error('服务未返回知识图谱节点');
    }
  } catch (error: any) {
    console.error('知识图谱请求失败:', error);
    nodes.value = [];
    edges.value = [];
    graphError.value = error?.message || '请确认后端知识图谱服务已启动';
  } finally {
    loading.value = false;
    console.log('数据加载完成');
  }
};

const fetchDynamicMastery = async () => {
  try {
    const dynamicData = await request({ url: '/interactive-learning/graph/dynamic', method: 'GET' });
    if (dynamicData && dynamicData.nodes) {
      const masteryMap = new Map<string, number>();
      (dynamicData.nodes as any[]).forEach((n: any) => {
        masteryMap.set(n.id, n.masteryLevel ?? 0);
      });
      nodes.value = nodes.value.map((n: KnowledgeNode) => ({
        ...n,
        mastery: masteryMap.has(n.id) ? Math.round((masteryMap.get(n.id)!) * 100) : n.mastery,
        source: 'api',
      }));
    }
  } catch (error) {
    console.log('动态掌握度获取失败，使用静态数据:', error);
  }
};

const formatProgressDate = (value?: string | Date): string => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const fetchUserProgress = async () => {
  try {
    const progress = await request({ url: '/learning/progress', method: 'GET' });
    if (Array.isArray(progress)) {
      // 后端记录按题库知识点归档（如“极限计算”），并附带它映射到的图谱概念 id
      // （如 limit_definition）。把两种 key 都写进 Map，节点才能查到自己的掌握度。
      const map = new Map<string, LearningProgress>();
      progress.forEach((item: any) => {
        const entry: LearningProgress = {
          conceptId: item.conceptId,
          mastery: Math.round((item.masteryLevel || 0) * 100),
          practiceCount: item.attemptsCount || 0,
          correctRate: item.correctRate ?? 0,
          lastPracticeDate: formatProgressDate(item.lastPracticeDate),
        };
        const keys: string[] = [item.conceptId, ...(item.conceptIds || [])].filter(Boolean);
        keys.forEach((key) => {
          if (!map.has(key)) map.set(key, entry);
        });
      });
      progressMap.value = map;
    }
  } catch (e) {
    console.error('获取学习进度失败', e);
    // 没有真实数据时保持空白，绝不填充臆造的掌握度
    progressMap.value = new Map();
  }
};

const selectNode = async (node: KnowledgeNode) => {
  selectedNode.value = node;
  
  try {
    const [prereqRes, depRes] = await Promise.all([
      request({ url: `/knowledge/concepts/${node.id}/prerequisites`, method: 'GET' }),
      request({ url: `/knowledge/concepts/${node.id}/dependents`, method: 'GET' }),
    ]);
    prerequisites.value = Array.isArray(prereqRes) ? prereqRes : [];
    dependents.value = Array.isArray(depRes) ? depRes : [];
  } catch (error) {
    console.error('Failed to fetch relations:', error);
    // API 暂时不可用时，仅使用当前已加载的真实边关系，不生成演示关系。
    prerequisites.value = edges.value
      .filter(e => e.target === node.id)
      .map(e => nodes.value.find(n => n.id === e.source))
      .filter((n): n is KnowledgeNode => n !== undefined);
    dependents.value = edges.value
      .filter(e => e.source === node.id)
      .map(e => nodes.value.find(n => n.id === e.target))
      .filter((n): n is KnowledgeNode => n !== undefined);
  }
};

const selectNodeById = (id: string) => {
  const node = nodes.value.find(n => n.id === id);
  if (node) {
    selectNode(node);
  }
};

const handleSearch = () => {
  if (activeTab.value !== 'list') {
    activeTab.value = 'list';
  }
};

const showLearningPath = async () => {
  if (!selectedNode.value) return;
  
  try {
    const response = await request({
      url: `/knowledge/concepts/${selectedNode.value.id}/learning-path`,
      method: 'GET',
    });
    
    const pathData = response as { path?: KnowledgeNode[] };
    uni.showModal({
      title: '学习路径',
      content: pathData.path?.map((n: KnowledgeNode) => n.name).join(' → ') || '暂无学习路径',
      showCancel: false,
    });
  } catch (error) {
    console.error('Failed to fetch learning path:', error);
    // 模拟学习路径
    const path = findLearningPath(selectedNode.value.id);
    uni.showModal({
      title: '学习路径',
      content: path.map(n => n.name).join(' → '),
      showCancel: false,
    });
  }
};

const findLearningPath = (targetId: string): KnowledgeNode[] => {
  const path: KnowledgeNode[] = [];
  const visited = new Set<string>();
  
  const dfs = (nodeId: string) => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    
    const prereqs = edges.value
      .filter(e => e.target === nodeId)
      .map(e => e.source);
    
    for (const prereqId of prereqs) {
      dfs(prereqId);
    }
    
    const node = nodes.value.find(n => n.id === nodeId);
    if (node) {
      path.push(node);
    }
  };
  
  dfs(targetId);
  return path;
};

const togglePathPanel = () => {
  showPathPanel.value = !showPathPanel.value;
};

const selectPath = (path: LearningPath) => {
  // 高亮路径相关节点
  highlightedNodes.value = path.nodes;
};

const toggleCustomNode = (nodeId: string) => {
  const index = selectedCustomNodes.value.indexOf(nodeId);
  if (index > -1) {
    selectedCustomNodes.value.splice(index, 1);
  } else {
    selectedCustomNodes.value.push(nodeId);
  }
};

const createCustomPath = () => {
  if (!customPathName.value || selectedCustomNodes.value.length === 0) {
    uni.showToast({ title: '请输入路径名称并选择知识点', icon: 'none' });
    return;
  }
  
  const newPath: LearningPath = {
    name: customPathName.value,
    description: customPathDescription.value || '自定义学习路径',
    icon: '🎯',
    nodes: selectedCustomNodes.value,
    isCustom: true
  };
  
  learningPaths.value.push(newPath);
  showCustomPathDialog.value = false;
  
  // 重置表单
  customPathName.value = '';
  customPathDescription.value = '';
  selectedCustomNodes.value = [];
  
  uni.showToast({ title: '自定义路径创建成功', icon: 'success' });
};

watch(activeTab, () => {
  if (activeTab.value === 'list') {
    // 切换到列表视图时获取学习进度
    fetchUserProgress();
  }
});

onMounted(async () => {
  await fetchGraphData();
  // 初始加载学习进度
  await fetchUserProgress();
});
</script>

<style scoped>
.knowledge-page {
  min-height: 100vh;
  background: var(--bg-secondary);
  color: var(--text-primary);
  transition: background 0.3s ease, color 0.3s ease;
}

.page-header {
  background: var(--accent-gradient);
  padding: 30px 20px;
  color: white;
}

.page-title {
  font-size: 24px;
  font-weight: bold;
  display: block;
}

.page-subtitle {
  font-size: 14px;
  opacity: 0.8;
  margin-top: 5px;
  display: block;
}

.search-bar {
  display: flex;
  padding: 15px;
  background: var(--bg-card);
  gap: 10px;
}

.search-input {
  flex: 1;
  height: 40px;
  border: 1px solid var(--border-color);
  border-radius: 20px;
  padding: 0 15px;
  font-size: 14px;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.search-btn {
  height: 40px;
  line-height: 40px;
  padding: 0 20px;
  background: var(--accent-color);
  color: white;
  border-radius: 20px;
  font-size: 14px;
}

.tabs {
  display: flex;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-color);
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 15px 0;
  font-size: 15px;
  color: var(--text-secondary);
  position: relative;
}

.tab-item.tab-active {
  color: var(--accent-color);
  font-weight: bold;
}

.tab-item.tab-active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 30px;
  height: 3px;
  background: var(--accent-color);
  border-radius: 2px;
}

.graph-error-state {
  margin: 20px;
  padding: 40px 20px;
  text-align: center;
  border-radius: 12px;
  background: var(--bg-card);
  color: var(--text-primary);
  box-shadow: 0 2px 8px var(--shadow-color);
}

.error-icon {
  display: block;
  font-size: 42px;
  margin-bottom: 12px;
}

.error-title,
.error-message {
  display: block;
}

.error-title {
  font-size: 17px;
  font-weight: bold;
}

.error-message {
  margin-top: 8px;
  color: var(--text-secondary);
  font-size: 13px;
}

.retry-graph-btn {
  margin-top: 20px;
  padding: 0 24px;
  height: 38px;
  line-height: 38px;
  border-radius: 19px;
  background: var(--accent-color);
  color: #fff;
  font-size: 14px;
}

.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid var(--accent-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-text {
  margin-top: 15px;
  color: var(--text-secondary);
  font-size: 14px;
}

.theme-dark .loading-overlay {
  background: rgba(26, 26, 46, 0.9);
}

.theme-dark .loading-spinner {
  border: 3px solid rgba(255, 255, 255, 0.2);
  border-top: 3px solid var(--accent-color);
}

/* 对话框样式 */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.dialog-content {
  background: var(--bg-card);
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow-y: auto;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid var(--border-color);
}

.dialog-title {
  font-size: 18px;
  font-weight: bold;
  color: var(--text-primary);
}

.dialog-body {
  padding: 20px;
}

.dialog-input {
  width: 100%;
  height: 40px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 0 15px;
  font-size: 14px;
  background: var(--bg-primary);
  color: var(--text-primary);
  margin-bottom: 15px;
  box-sizing: border-box;
}

.node-selector {
  margin-top: 20px;
}

.selector-title {
  font-size: 14px;
  font-weight: bold;
  color: var(--text-primary);
  margin-bottom: 10px;
  display: block;
}

.node-list {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 10px;
  background: var(--bg-primary);
}

.node-item {
  padding: 8px 12px;
  border-radius: 6px;
  margin-bottom: 5px;
  font-size: 13px;
  color: var(--text-primary);
  transition: background 0.2s ease;
}

.node-item:hover {
  background: var(--bg-secondary);
}

.node-item.selected {
  background: rgba(102, 126, 234, 0.1);
  color: var(--accent-color);
}

.dialog-footer {
  display: flex;
  gap: 10px;
  padding: 20px;
  border-top: 1px solid var(--border-color);
}

.dialog-btn {
  flex: 1;
  height: 40px;
  line-height: 40px;
  font-size: 14px;
  border-radius: 8px;
}

.dialog-btn.cancel {
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.dialog-btn.confirm {
  background: var(--accent-color);
  color: white;
  border: none;
}
</style>
