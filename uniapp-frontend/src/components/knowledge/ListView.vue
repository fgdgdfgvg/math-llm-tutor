<template>
  <view class="list-view">
    <view class="list-filter">
      <picker mode="selector" :range="typeFilters" @change="onTypeFilterChange">
        <view class="picker-btn">类型: {{ currentTypeFilter }}</view>
      </picker>
      <picker mode="selector" :range="difficultyFilters" @change="onDifficultyFilterChange">
        <view class="picker-btn">难度: {{ currentDifficultyFilter }}</view>
      </picker>
      <picker mode="selector" :range="masteryFilters" @change="onMasteryFilterChange">
        <view class="picker-btn">掌握度: {{ currentMasteryFilter }}</view>
      </picker>
    </view>

    <view class="concept-list">
      <view 
        v-for="node in filteredNodes" 
        :key="node.id"
        class="concept-card"
        @click="selectNode(node)"
      >
        <view class="card-header">
          <view class="card-icon">{{ getNodeIcon(node.type) }}</view>
          <view class="card-info">
            <text class="card-name">{{ node.name }}</text>
            <view class="card-tags">
              <text class="card-type">{{ typeLabel(node.type) }}</text>
              <text class="card-difficulty" :class="'diff-' + node.difficulty">
                {{ difficultyLabel(node.difficulty) }}
              </text>
            </view>
          </view>
        </view>
        <text class="card-desc">{{ node.description }}</text>
        <view v-if="node.latex || node.formula" class="card-formula">
          <FormulaRenderer :latex="node.latex || node.formula || ''" />
        </view>
        <view class="card-stats">
          <view class="stat-row">
            <text class="stat-label">掌握度:</text>
            <view class="progress-bar small">
              <view class="progress-fill" :style="{ width: node.mastery + '%' }"></view>
            </view>
            <text class="stat-value">{{ node.mastery }}%</text>
          </view>
          <view class="stat-row">
            <text class="stat-label">练习:</text>
            <text class="stat-value">{{ node.practiceCount || 0 }}次</text>
            <text class="stat-label">正确率:</text>
            <text class="stat-value">{{ node.correctRate || 0 }}%</text>
          </view>
          <view v-if="node.lastPractice" class="stat-row">
            <text class="stat-label">最后练习:</text>
            <text class="stat-value">{{ node.lastPractice }}</text>
          </view>
        </view>
        <view class="card-actions">
          <button class="action-btn practice" @click.stop="goPractice(node.id, node.name)">专项练习</button>
          <button class="action-btn review" @click.stop="goMistakes(node.id, node.name)">查看错题</button>
          <button v-if="getScenarioForNode(node.id)" class="action-btn scenario" @click.stop="goScenario(node.id)">进入场景</button>
        </view>
        <view v-if="shouldRecommend(node)" class="recommendation-badge">
          <text class="badge-text">🎯 建议加强</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import request from '@/utils/request';
import FormulaRenderer from '@/components/FormulaRenderer.vue';

interface KnowledgeNode {
  id: string;
  name: string;
  type: string;
  description: string;
  formula?: string;
  latex?: string;
  difficulty: string;
  tags: string[];
  x?: number;
  y?: number;
  mastery?: number; // 掌握度
  practiceCount?: number; // 练习次数
  correctRate?: number; // 正确率
  lastPractice?: string; // 最后练习时间
  accuracy?: number; // 兼容旧字段
}

interface LearningProgress {
  conceptId: string;
  mastery: number;
  practiceCount: number;
  correctRate: number;
  lastPracticeDate: string;
}

// Props
const props = defineProps<{
  nodes: KnowledgeNode[];
  progressMap: Map<string, LearningProgress>;
  searchQuery: string;
}>();

// Emits
const emit = defineEmits<{
  (e: 'selectNode', node: KnowledgeNode): void;
}>();

// 筛选器
const typeFilters = ['全部', '概念', '定理', '公式', '方法'];
const difficultyFilters = ['全部', '简单', '中等', '困难'];
const masteryFilters = ['全部', '未掌握', '一般', '良好', '掌握'];
const currentTypeFilter = ref('全部');
const currentDifficultyFilter = ref('全部');
const currentMasteryFilter = ref('全部');

// 计算属性：过滤后的节点
const filteredNodes = computed(() => {
  let result = props.nodes;
  
  if (props.searchQuery) {
    const query = props.searchQuery.toLowerCase();
    result = result.filter(node => 
      node.name.toLowerCase().includes(query) ||
      node.description.toLowerCase().includes(query) ||
      node.tags?.some(tag => tag.toLowerCase().includes(query))
    );
  }
  
  if (currentTypeFilter.value !== '全部') {
    const typeMap: Record<string, string> = {
      '概念': 'Concept',
      '定理': 'Theorem',
      '公式': 'Formula',
      '方法': 'Method',
    };
    result = result.filter(node => node.type === typeMap[currentTypeFilter.value]);
  }
  
  if (currentDifficultyFilter.value !== '全部') {
    const diffMap: Record<string, string> = {
      '简单': 'easy',
      '中等': 'medium',
      '困难': 'hard',
    };
    result = result.filter(node => node.difficulty === diffMap[currentDifficultyFilter.value]);
  }
  
  // 合并学习进度数据
  result = result.map(node => {
    const progress = props.progressMap.get(node.id);
    return {
      ...node,
      mastery: progress?.mastery || node.mastery || 0,
      practiceCount: progress?.practiceCount || node.practiceCount || 0,
      correctRate: progress?.correctRate || node.accuracy || 0,
      lastPractice: progress?.lastPracticeDate || node.lastPractice || undefined,
    };
  });
  
  if (currentMasteryFilter.value !== '全部') {
    const masteryMap: Record<string, (m: number) => boolean> = {
      '未掌握': (m) => m < 60,
      '一般': (m) => m >= 60 && m < 80,
      '良好': (m) => m >= 80 && m < 90,
      '掌握': (m) => m >= 90,
    };
    result = result.filter(node => masteryMap[currentMasteryFilter.value]?.(node.mastery || 0));
  }
  
  return result;
});

// 辅助函数
const getNodeIcon = (type: string) => {
  const icons: Record<string, string> = {
    'Concept': '💡',
    'Theorem': '📐',
    'Formula': '📝',
    'Method': '🔧',
    'Example': '📖',
  };
  return icons[type] || '📌';
};

const difficultyLabel = (difficulty: string) => {
  const labels: Record<string, string> = {
    'easy': '简单',
    'medium': '中等',
    'hard': '困难',
  };
  return labels[difficulty] || difficulty;
};

const typeLabel = (type: string) => {
  const labels: Record<string, string> = {
    'Concept': '概念',
    'Theorem': '定理',
    'Formula': '公式',
    'Method': '方法',
    'Example': '示例',
  };
  return labels[type] || type;
};

// 事件处理
const selectNode = (node: KnowledgeNode) => {
  emit('selectNode', node);
};

const onTypeFilterChange = (e: any) => {
  currentTypeFilter.value = typeFilters[e.detail.value];
};

const onDifficultyFilterChange = (e: any) => {
  currentDifficultyFilter.value = difficultyFilters[e.detail.value];
};

const onMasteryFilterChange = (e: any) => {
  currentMasteryFilter.value = masteryFilters[e.detail.value];
};

const goPractice = (conceptId: string, conceptName: string) => {
  uni.navigateTo({
    url: `/pages/practice/index?conceptId=${conceptId}&conceptName=${encodeURIComponent(conceptName)}`
  });
};

const goMistakes = (conceptId: string, conceptName: string) => {
  uni.navigateTo({
    url: `/pages/mistakes/index?conceptId=${conceptId}&conceptName=${encodeURIComponent(conceptName)}`
  });
};

const NODE_TO_SCENARIO: Record<string, string> = {
  limit: '/pages/scenario/index',
  limit_definition: '/pages/scenario/index',
  limit_properties: '/pages/scenario/index',
  limit_computation: '/pages/scenario/index',
  derivative: '/pages/scenario/index',
  derivative_definition: '/pages/scenario/index',
  derivative_rules: '/pages/scenario/index',
  integral: '/pages/scenario/index',
  integral_definition: '/pages/scenario/index',
  integral_techniques: '/pages/scenario/index',
  series: '/pages/scenario/index',
  series_convergence: '/pages/scenario/index',
  taylor_series: '/pages/scenario/index',
  power_series: '/pages/scenario/index',
};

const getScenarioForNode = (nodeId: string): string | null => {
  return NODE_TO_SCENARIO[nodeId] || null;
};

const goScenario = (nodeId: string) => {
  const url = getScenarioForNode(nodeId)
  if (url) {
    uni.navigateTo({ url })
  }
};

const shouldRecommend = (node: KnowledgeNode): boolean => {
  return (node.mastery || 0) < 50 && (node.practiceCount || 0) > 0;
};
</script>

<style scoped>
.list-view {
  padding: 15px;
}

.list-filter {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
  flex-wrap: wrap;
}

.picker-btn {
  flex: 1;
  min-width: 100px;
  height: 36px;
  line-height: 36px;
  text-align: center;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 18px;
  font-size: 13px;
  color: var(--text-primary);
}

.concept-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.concept-card {
  background: var(--bg-card);
  border-radius: 12px;
  padding: 15px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.concept-card:active {
  transform: translateY(2px);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

.card-header {
  display: flex;
  align-items: flex-start;
  margin-bottom: 10px;
}

.card-icon {
  font-size: 24px;
  margin-right: 12px;
}

.card-info {
  flex: 1;
}

.card-name {
  font-size: 16px;
  font-weight: bold;
  color: var(--text-primary);
  display: block;
  margin-bottom: 5px;
}

.card-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.card-type {
  font-size: 11px;
  color: var(--accent-color);
  background: rgba(102, 126, 234, 0.1);
  padding: 2px 8px;
  border-radius: 10px;
}

.card-difficulty {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
}

.card-difficulty.diff-easy {
  color: var(--success-color);
  background: rgba(76, 175, 80, 0.1);
}

.card-difficulty.diff-medium {
  color: var(--warning-color);
  background: rgba(255, 193, 7, 0.1);
}

.card-difficulty.diff-hard {
  color: var(--error-color);
  background: rgba(244, 67, 54, 0.1);
}

.card-desc {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-bottom: 10px;
  display: block;
}

.card-formula {
  background: var(--math-bg);
  padding: 8px 12px;
  border-radius: 8px;
  margin-bottom: 10px;
  overflow-x: auto;
}

.card-stats {
  margin-bottom: 15px;
}

.stat-row {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  gap: 8px;
}

.stat-label {
  font-size: 12px;
  color: var(--text-secondary);
  min-width: 50px;
}

.progress-bar {
  flex: 1;
  height: 8px;
  background: var(--bg-primary);
  border-radius: 4px;
  overflow: hidden;
}

.progress-bar.small {
  height: 6px;
}

.progress-fill {
  height: 100%;
  background: var(--accent-gradient);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.stat-value {
  font-size: 12px;
  color: var(--text-primary);
  font-weight: bold;
  min-width: 40px;
  text-align: right;
}

.card-actions {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}

.action-btn {
  flex: 1;
  height: 36px;
  line-height: 36px;
  font-size: 13px;
  border-radius: 18px;
  transition: all 0.2s ease;
}

.action-btn.practice {
  background: var(--accent-color);
  color: white;
  border: none;
}

.action-btn.review {
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.action-btn:active {
  transform: scale(0.95);
}

.action-btn.scenario {
  background: linear-gradient(135deg, #6366f1, #a855f7);
  color: white;
  border: none;
}

.recommendation-badge {
  margin-top: 8px;
  padding: 4px 10px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 6px;
  display: inline-block;
}

.badge-text {
  font-size: 11px;
  color: #f97316;
  font-weight: bold;
}
</style>