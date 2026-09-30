<template>
  <view class="scenario-container">
    <view class="scenario-header">
      <text class="header-title">交互式学习场景</text>
      <text class="header-desc">通过可视化交互深入理解数学概念 · AI 智能诊断</text>
    </view>

    <view class="scenario-tabs">
      <view
        v-for="tab in tabs"
        :key="tab.id"
        class="tab-item"
        :class="{ 'active': activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        <text class="tab-icon">{{ tab.icon }}</text>
        <text class="tab-label">{{ tab.name }}</text>
      </view>
    </view>

    <view class="scenario-content">
      <EpsilonDelta v-if="activeTab === 'limit'" @param-change="onParamChange" />
      <DerivativeExplorer v-if="activeTab === 'derivative'" @param-change="onParamChange" />
      <IntegralExplorer v-if="activeTab === 'integral'" @param-change="onParamChange" />
      <SeriesExplorer v-if="activeTab === 'series'" @param-change="onParamChange" />
    </view>

    <view class="scenario-footer">
      <text class="footer-text">💡 每个场景都支持 AI 智能诊断，点击"🤖 AI 智能诊断"获取个性化学习建议</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import EpsilonDelta from '@/components/scenarios/EpsilonDelta.vue'
import DerivativeExplorer from '@/components/scenarios/DerivativeExplorer.vue'
import IntegralExplorer from '@/components/scenarios/IntegralExplorer.vue'
import SeriesExplorer from '@/components/scenarios/SeriesExplorer.vue'
import { useScenarioStore } from '@/stores/scenario'

const scenarioStore = useScenarioStore()

const tabs = [
  { id: 'limit', name: 'ε-δ极限', icon: '📐' },
  { id: 'derivative', name: '导数', icon: '📈' },
  { id: 'integral', name: '积分', icon: '∫' },
  { id: 'series', name: '级数', icon: 'Σ' },
]

const activeTab = ref('limit')

const onParamChange = (key: string, value: number) => {
}

onMounted(() => {
  scenarioStore.loadProgress()
  scenarioStore.setActiveScenario(activeTab.value)
})
</script>

<style scoped>
.scenario-container {
  min-height: 100vh;
  background: var(--bg-secondary);
  padding: 20px;
}

.scenario-header {
  text-align: center;
  padding: 20px 0;
  background: var(--accent-gradient);
  color: white;
  border-radius: 16px;
  margin-bottom: 20px;
}

/* uni-app H5 下 <text> 默认行内，标题与说明会挤在同一行 */
.header-title {
  display: block;
  font-size: 24px;
  font-weight: bold;
}

.header-desc {
  display: block;
  font-size: 14px;
  opacity: 0.8;
  margin-top: 8px;
  line-height: 1.5;
}

.scenario-tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  overflow-x: auto;
  /* 隐藏 H5 原生横向滚动条，否则卡片下方会多出一条灰条 */
  scrollbar-width: none;
}

.scenario-tabs::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

.tab-item {
  flex: 1 0 auto;
  min-width: 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 15px 10px;
  background: var(--bg-card);
  border-radius: 12px;
  transition: all 0.3s ease;
}

.tab-item.active {
  background: var(--accent-gradient);
  color: white;
}

.tab-icon {
  font-size: 24px;
  margin-bottom: 5px;
}

.tab-label {
  font-size: 12px;
}

.scenario-content {
  min-height: 400px;
}

.scenario-footer {
  margin-top: 20px;
  padding: 15px;
  background: var(--bg-card);
  border-radius: 12px;
  text-align: center;
}

.footer-text {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
}
</style>
