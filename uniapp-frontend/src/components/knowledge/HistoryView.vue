<template>
  <view class="history-view">
    <view class="page-header">
      <text class="page-title">学习历史轨迹</text>
      <text class="page-subtitle">基于你的真实练习记录生成</text>
    </view>

    <view class="history-filters">
      <picker mode="selector" :range="timeFilters" @change="onTimeFilterChange">
        <view class="picker-btn">时间范围: {{ currentTimeFilter }}</view>
      </picker>
      <picker mode="selector" :range="conceptFilterOptions" @change="onConceptFilterChange">
        <view class="picker-btn">知识点: {{ currentConceptFilter }}</view>
      </picker>
    </view>

    <view v-if="loading" class="state-block">
      <text class="state-text">加载练习记录中...</text>
    </view>

    <view v-else-if="totalRecords === 0" class="state-block empty">
      <text class="empty-icon">📉</text>
      <text class="state-text">还没有任何练习记录</text>
      <text class="state-subtext">完成专项练习后，这里会按时间展示你的掌握度变化</text>
      <button class="state-btn" @click="goPractice">去练习</button>
    </view>

    <template v-else>
      <view class="summary-grid">
        <view class="summary-card">
          <text class="summary-value">{{ summary.practiceCount }}</text>
          <text class="summary-label">练习次数</text>
        </view>
        <view class="summary-card">
          <text class="summary-value">{{ summary.correctRate }}%</text>
          <text class="summary-label">正确率</text>
        </view>
        <view class="summary-card">
          <text class="summary-value">{{ summary.minutes }}</text>
          <text class="summary-label">练习时长(分钟)</text>
        </view>
        <view class="summary-card">
          <text class="summary-value">{{ summary.streakDays }}</text>
          <text class="summary-label">连续天数</text>
        </view>
      </view>

      <view v-if="filteredRecords.length === 0" class="state-block small">
        <text class="state-text">当前筛选条件下没有练习记录</text>
      </view>

      <view v-else class="history-chart-container">
        <text class="section-title">练习趋势</text>
        <view id="historyChart" class="history-chart"></view>
      </view>

      <view class="history-steps">
        <text class="section-title">学习里程碑</text>
        <view v-if="milestones.length === 0" class="state-text">暂无里程碑</view>
        <view class="milestone-list">
          <view v-for="(milestone, index) in milestones" :key="index" class="milestone-item">
            <view class="milestone-icon">{{ milestone.icon }}</view>
            <view class="milestone-content">
              <text class="milestone-title">{{ milestone.title }}</text>
              <text class="milestone-date">{{ milestone.date }}</text>
              <text class="milestone-desc">{{ milestone.description }}</text>
            </view>
          </view>
        </view>
      </view>

      <view class="history-steps">
        <text class="section-title">最近练习记录</text>
        <view class="record-list">
          <view v-for="(record, index) in recentRecords" :key="index" class="record-item">
            <view class="record-badge" :class="record.isCorrect ? 'correct' : 'wrong'">
              {{ record.isCorrect ? '✓' : '✗' }}
            </view>
            <view class="record-info">
              <text class="record-title">{{ record.conceptName || record.conceptId }}</text>
              <text class="record-meta">
                {{ formatDate(record.createdAt) }} · 用时 {{ record.timeSpent || 0 }} 秒 ·
                掌握度 {{ Math.round((record.masteryLevel || 0) * 100) }}%
              </text>
            </view>
          </view>
        </view>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import * as echarts from 'echarts';
import request from '@/utils/request';

interface PracticeRecord {
  conceptId: string;
  conceptName?: string;
  action?: string;
  masteryLevel?: number;
  timeSpent?: number;
  isCorrect?: boolean;
  problemText?: string;
  createdAt: string;
}

interface LearningStats {
  totalConcepts: number;
  masteredConcepts: number;
  totalPracticeTime: number;
  averageMastery: number;
  streakDays: number;
}

interface LearningMilestone {
  icon: string;
  title: string;
  date: string;
  description: string;
}

const timeFilters = ['近7天', '近30天', '近90天', '全部'];
const currentTimeFilter = ref('近30天');
const currentConceptFilter = ref('全部知识点');
const conceptFilters = ref<string[]>(['全部知识点']);

const loading = ref(true);
const records = ref<PracticeRecord[]>([]);
const stats = ref<LearningStats | null>(null);

const conceptFilterOptions = computed(() => conceptFilters.value);

const parseDate = (value: string | Date): Date => (value instanceof Date ? value : new Date(value));

const dayKey = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatDate = (value: string | Date): string => {
  const date = parseDate(value);
  if (Number.isNaN(date.getTime())) return '--';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const rangeStart = computed<Date | null>(() => {
  const days: Record<string, number> = { 近7天: 7, 近30天: 30, 近90天: 90 };
  const span = days[currentTimeFilter.value];
  if (!span) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (span - 1));
  return start;
});

const filteredRecords = computed(() => {
  const start = rangeStart.value;
  return records.value.filter((record) => {
    if (currentConceptFilter.value !== '全部知识点') {
      const name = record.conceptName || record.conceptId;
      if (name !== currentConceptFilter.value) return false;
    }
    if (start) {
      const date = parseDate(record.createdAt);
      if (Number.isNaN(date.getTime()) || date < start) return false;
    }
    return true;
  });
});

const totalRecords = computed(() => records.value.length);

const summary = computed(() => {
  const list = filteredRecords.value;
  const correct = list.filter((r) => r.isCorrect).length;
  const seconds = list.reduce((sum, r) => sum + (r.timeSpent || 0), 0);
  return {
    practiceCount: list.length,
    correctRate: list.length > 0 ? Math.round((correct / list.length) * 100) : 0,
    minutes: Math.round(seconds / 60),
    streakDays: stats.value?.streakDays || 0,
  };
});

const recentRecords = computed(() => filteredRecords.value.slice(0, 10));

/** 每日聚合：练习次数 + 正确率，全部来自真实记录 */
const dailySeries = computed(() => {
  const buckets = new Map<string, { count: number; correct: number }>();
  for (const record of filteredRecords.value) {
    const date = parseDate(record.createdAt);
    if (Number.isNaN(date.getTime())) continue;
    const key = dayKey(date);
    const bucket = buckets.get(key) || { count: 0, correct: 0 };
    bucket.count += 1;
    if (record.isCorrect) bucket.correct += 1;
    buckets.set(key, bucket);
  }

  return Array.from(buckets.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-30)
    .map(([date, bucket]) => ({
      date,
      label: date.slice(5),
      count: bucket.count,
      correctRate: Math.round((bucket.correct / bucket.count) * 100),
    }));
});

/** 里程碑全部由真实记录推导，不再使用预置文案 */
const milestones = computed<LearningMilestone[]>(() => {
  const list = filteredRecords.value;
  if (list.length === 0) return [];

  const sorted = [...list].sort(
    (a, b) => parseDate(a.createdAt).getTime() - parseDate(b.createdAt).getTime(),
  );
  const result: LearningMilestone[] = [];
  const seen = new Set<string>();

  const push = (milestone: LearningMilestone) => {
    if (seen.has(milestone.title)) return;
    seen.add(milestone.title);
    result.push(milestone);
  };

  const first = sorted[0];
  push({
    icon: '🚀',
    title: '开始学习',
    date: formatDate(first.createdAt),
    description: `第一次练习「${first.conceptName || first.conceptId}」${first.isCorrect ? '并答对了' : ''}`,
  });

  const firstByConcept = new Map<string, PracticeRecord>();
  for (const record of sorted) {
    const name = record.conceptName || record.conceptId;
    if (!firstByConcept.has(name)) firstByConcept.set(name, record);
  }
  Array.from(firstByConcept.entries())
    .slice(0, 5)
    .forEach(([name, record]) => {
      push({
        icon: '📚',
        title: `首次练习「${name}」`,
        date: formatDate(record.createdAt),
        description: record.isCorrect ? '首题即答对' : '首题答错，已记入错题本',
      });
    });

  const busiest = dailySeries.value.reduce(
    (max, item) => (item.count > max.count ? item : max),
    { date: '', label: '', count: 0, correctRate: 0 },
  );
  if (busiest.count >= 3) {
    push({
      icon: '🔥',
      title: `单日最多练习 ${busiest.count} 题`,
      date: busiest.date,
      description: `当天正确率 ${busiest.correctRate}%`,
    });
  }

  const last = sorted[sorted.length - 1];
  push({
    icon: '🕒',
    title: '最近一次练习',
    date: formatDate(last.createdAt),
    description: `「${last.conceptName || last.conceptId}」${last.isCorrect ? '答对' : '答错'}`,
  });

  return result.sort(
    (a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime(),
  );
});

let historyChartInstance: echarts.ECharts | null = null;
let historyResizeObserver: ResizeObserver | null = null;
let lastDrawnWidth = 0;

/** 该视图在两个 v-show 隐藏容器内，隐藏时容器宽高为 0，
 *  ECharts 会画成空白；等容器真正可见（宽度 > 0）时再补画一次。 */
const drawHistoryChartWhenVisible = () => {
  const chartDom = document.getElementById('historyChart');
  if (!chartDom) return;
  const width = chartDom.clientWidth;
  if (width <= 0 || width === lastDrawnWidth) return;
  lastDrawnWidth = width;
  drawHistoryChart();
};

const observeChartVisibility = () => {
  const chartDom = document.getElementById('historyChart');
  if (!chartDom || typeof ResizeObserver === 'undefined') return;
  historyResizeObserver?.disconnect();
  historyResizeObserver = new ResizeObserver(() => drawHistoryChartWhenVisible());
  historyResizeObserver.observe(chartDom);
  drawHistoryChartWhenVisible();
};

const drawHistoryChart = () => {
  const chartDom = document.getElementById('historyChart');
  if (!chartDom) return;

  if (historyChartInstance) historyChartInstance.dispose();
  historyChartInstance = echarts.init(chartDom);

  const series = dailySeries.value;
  historyChartInstance.setOption({
    animation: false,
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
    legend: { data: ['练习次数', '正确率'], top: 0, textStyle: { color: '#94a3b8' } },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: series.map((item) => item.label),
      axisLabel: { color: '#94a3b8' },
      axisLine: { lineStyle: { color: '#475569' } },
    },
    yAxis: [
      {
        type: 'value',
        name: '练习次数',
        minInterval: 1,
        axisLabel: { color: '#94a3b8' },
        splitLine: { lineStyle: { color: 'rgba(148,163,184,0.2)' } },
      },
      {
        type: 'value',
        name: '正确率(%)',
        min: 0,
        max: 100,
        axisLabel: { color: '#94a3b8' },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: '练习次数',
        type: 'bar',
        data: series.map((item) => item.count),
        barMaxWidth: 28,
        itemStyle: { color: '#6366f1', borderRadius: [4, 4, 0, 0] },
      },
      {
        name: '正确率',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        data: series.map((item) => item.correctRate),
        lineStyle: { color: '#22c55e', width: 3 },
        itemStyle: { color: '#22c55e' },
      },
    ],
  });
  historyChartInstance.resize();
};

const handleResize = () => {
  historyChartInstance?.resize();
  drawHistoryChartWhenVisible();
};

const loadData = async () => {
  loading.value = true;
  try {
    const [history, statsData] = await Promise.all([
      request<any>({ url: '/learning/history', method: 'GET', params: { page: 1, limit: 500 } })
        .catch(() => ({ records: [] })),
      request<any>({ url: '/learning/stats', method: 'GET' }).catch(() => null),
    ]);

    const list: PracticeRecord[] = Array.isArray(history?.records)
      ? history.records
      : Array.isArray(history)
        ? history
        : [];
    records.value = list;
    stats.value = statsData || null;

    const names = new Set<string>();
    list.forEach((record) => names.add(record.conceptName || record.conceptId));
    conceptFilters.value = ['全部知识点', ...Array.from(names).sort()];
    if (!conceptFilters.value.includes(currentConceptFilter.value)) {
      currentConceptFilter.value = '全部知识点';
    }
  } catch (error) {
    console.error('加载学习历史失败:', error);
    records.value = [];
    stats.value = null;
  } finally {
    loading.value = false;
    nextTick(() => observeChartVisibility());
  }
};

const onTimeFilterChange = (e: any) => {
  currentTimeFilter.value = timeFilters[e.detail.value];
  nextTick(() => drawHistoryChartWhenVisible());
};

const onConceptFilterChange = (e: any) => {
  currentConceptFilter.value = conceptFilterOptions.value[e.detail.value];
  nextTick(() => drawHistoryChartWhenVisible());
};

const goPractice = () => {
  uni.navigateTo({ url: '/pages/practice/index' });
};

watch(dailySeries, () => {
  nextTick(() => drawHistoryChartWhenVisible());
});

onMounted(() => {
  window.addEventListener('resize', handleResize);
  loadData();
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  historyResizeObserver?.disconnect();
  historyResizeObserver = null;
  if (historyChartInstance) {
    historyChartInstance.dispose();
    historyChartInstance = null;
  }
});
</script>

<style scoped>
.history-view {
  padding: 15px;
}

.page-header {
  background: var(--accent-gradient);
  padding: 30px 20px;
  color: white;
  border-radius: 12px;
  margin-bottom: 20px;
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

.history-filters {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
  flex-wrap: wrap;
}

.picker-btn {
  flex: 1;
  min-width: 150px;
  height: 36px;
  line-height: 36px;
  text-align: center;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 18px;
  font-size: 13px;
  color: var(--text-primary);
}

.state-block {
  background: var(--bg-card);
  border-radius: 12px;
  padding: 30px 20px;
  text-align: center;
  margin-bottom: 20px;
}

.state-block.small {
  padding: 18px;
}

.state-block.empty .empty-icon {
  font-size: 36px;
  display: block;
  margin-bottom: 10px;
}

.state-text {
  font-size: 14px;
  color: var(--text-secondary);
  display: block;
  margin-bottom: 6px;
}

.state-subtext {
  font-size: 12px;
  color: var(--text-muted);
  display: block;
  margin-bottom: 14px;
}

.state-btn {
  height: 36px;
  line-height: 36px;
  padding: 0 24px;
  border-radius: 18px;
  font-size: 13px;
  background: var(--accent-color);
  color: white;
  border: none;
}

.summary-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 20px;
}

.summary-card {
  flex: 1;
  min-width: 45%;
  background: var(--bg-card);
  border-radius: 12px;
  padding: 15px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.summary-value {
  font-size: 22px;
  font-weight: bold;
  color: var(--accent-color);
  display: block;
}

.summary-label {
  font-size: 12px;
  color: var(--text-secondary);
  display: block;
  margin-top: 4px;
}

.history-chart-container {
  background: var(--bg-card);
  border-radius: 12px;
  padding: 15px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.history-chart {
  width: 100%;
  height: 300px;
}

.history-steps {
  background: var(--bg-card);
  border-radius: 12px;
  padding: 15px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.section-title {
  font-size: 16px;
  font-weight: bold;
  color: var(--text-primary);
  margin-bottom: 15px;
  display: block;
}

.milestone-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.milestone-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  background: var(--bg-primary);
  border-radius: 8px;
}

.milestone-icon {
  font-size: 24px;
  margin-top: 2px;
}

.milestone-content {
  flex: 1;
}

.milestone-title {
  font-size: 14px;
  font-weight: bold;
  color: var(--text-primary);
  display: block;
  margin-bottom: 4px;
}

.milestone-date {
  font-size: 12px;
  color: var(--text-muted);
  display: block;
  margin-bottom: 4px;
}

.milestone-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.4;
  display: block;
}

.record-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.record-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--bg-primary);
  border-radius: 8px;
}

.record-badge {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  text-align: center;
  line-height: 28px;
  font-size: 14px;
  font-weight: bold;
  color: white;
  flex-shrink: 0;
}

.record-badge.correct {
  background: var(--success-color, #4caf50);
}

.record-badge.wrong {
  background: var(--error-color, #f44336);
}

.record-info {
  flex: 1;
}

.record-title {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
  display: block;
  margin-bottom: 4px;
}

.record-meta {
  font-size: 12px;
  color: var(--text-secondary);
  display: block;
}
</style>
