<template>
  <view class="progress-container">
    <view class="progress-header">
      <text class="header-title">{{ $t('profile.learningStats') }}</text>
      <text class="header-subtitle">依据你的真实练习记录生成，薄弱环节一目了然</text>
    </view>

    <view v-if="loading" class="loading-overlay">
      <view class="loading-spinner"></view>
      <text class="loading-text">加载学习数据中...</text>
    </view>

    <view v-else-if="!hasData" class="empty-state">
      <text class="empty-icon">📈</text>
      <text class="empty-text">还没有练习数据</text>
      <text class="empty-subtext">完成几道专项练习后，这里会显示你的掌握度与薄弱知识点</text>
      <button class="practice-btn primary" @click="goPractice">开始练习</button>
    </view>

    <template v-else>
      <view class="stats-overview">
        <view class="stat-card">
          <text class="stat-value">{{ stats.totalAttempts }}</text>
          <text class="stat-label">累计练习</text>
        </view>
        <view class="stat-card">
          <text class="stat-value">{{ stats.correctRate }}%</text>
          <text class="stat-label">{{ $t('home.correctRate') }}</text>
        </view>
        <view class="stat-card">
          <text class="stat-value">{{ stats.studyHours }}</text>
          <text class="stat-label">{{ $t('profile.hours') }}</text>
        </view>
        <view class="stat-card">
          <text class="stat-value">{{ stats.streakDays }}</text>
          <text class="stat-label">{{ $t('home.days') }}</text>
        </view>
      </view>

      <view class="progress-section" v-if="weakPoints.length > 0">
        <text class="section-title">🎯 薄弱环节（优先攻坚）</text>
        <text class="section-desc">掌握度越低越需要重点突破，点击可立即练习同类题</text>

        <view class="progress-item" v-for="item in weakPoints" :key="item.conceptId">
          <view class="progress-header-row">
            <text class="progress-name">{{ item.conceptId }}</text>
            <text class="progress-percent">{{ item.progress }}%</text>
          </view>
          <view class="progress-bar">
            <view class="progress-fill weak" :style="{ width: item.progress + '%' }"></view>
          </view>
          <view class="progress-footer">
            <text class="progress-status">
              练习 {{ item.attemptsCount }} 次 · 错 {{ item.incorrectCount }} 次 · {{ getMasteryText(item.masteryLevel) }}
            </text>
            <button class="practice-btn" @click="practiceKnowledgePoint(item.conceptId)">去练习</button>
          </view>
        </view>
      </view>

      <view class="progress-section" v-if="strongPoints.length > 0">
        <text class="section-title">✅ 已掌握知识点</text>
        <view class="tag-list">
          <text class="tag strong" v-for="item in strongPoints" :key="item.conceptId">
            {{ item.conceptId }} · {{ item.progress }}%
          </text>
        </view>
      </view>

      <view class="progress-section">
        <text class="section-title">{{ $t('profile.knowledgePoints') }}</text>

        <view class="knowledge-progress">
          <view
            v-for="item in knowledgeProgress"
            :key="item.conceptId"
            class="progress-item"
          >
            <view class="progress-header-row">
              <text class="progress-name">{{ item.conceptId }}</text>
              <text class="progress-percent">{{ item.progress }}%</text>
            </view>
            <view class="progress-bar">
              <view class="progress-fill" :style="{ width: item.progress + '%' }"></view>
            </view>
            <text class="progress-status">{{ getMasteryText(item.masteryLevel) }}</text>
          </view>
        </view>
      </view>

      <view class="progress-section" v-if="recentActivities.length > 0">
        <text class="section-title">{{ $t('profile.recentActivity') }}</text>

        <view class="activity-list">
          <view
            v-for="activity in recentActivities"
            :key="activity.id"
            class="activity-item"
          >
            <view class="activity-icon" :class="{ correct: activity.correct }">
              {{ activity.correct ? '✓' : '✗' }}
            </view>
            <view class="activity-info">
              <text class="activity-title">{{ activity.title }}</text>
              <text class="activity-time">{{ activity.time }}</text>
            </view>
            <view class="activity-result" :class="{ 'correct': activity.correct }">
              {{ activity.correct ? $t('history.correct') : $t('history.incorrect') }}
            </view>
          </view>
        </view>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import request from '@/utils/request';
import { useUserStore } from '@/stores/user';

const { t } = useI18n();
const userStore = useUserStore();

interface PracticeHistoryEntry {
  date: string;
  problemId: string;
  isCorrect: boolean;
  timeSpent: number;
}

interface KnowledgeRecord {
  conceptId: string;
  status?: string;
  masteryLevel: number;
  attemptsCount: number;
  correctCount: number;
  incorrectCount: number;
  totalPracticeTime: number;
  streakDays: number;
  lastPracticed?: string;
  practiceHistory?: PracticeHistoryEntry[];
}

interface ProgressItem {
  conceptId: string;
  masteryLevel: number;
  progress: number;
  attemptsCount: number;
  incorrectCount: number;
}

const loading = ref(true);
const records = ref<KnowledgeRecord[]>([]);

const practiced = computed(() => records.value.filter(r => (r.attemptsCount || 0) > 0));

const stats = computed(() => {
  const list = practiced.value;
  const attempts = list.reduce((sum, r) => sum + (r.attemptsCount || 0), 0);
  const correct = list.reduce((sum, r) => sum + (r.correctCount || 0), 0);
  const seconds = list.reduce((sum, r) => sum + (r.totalPracticeTime || 0), 0);
  return {
    totalAttempts: attempts,
    correctRate: attempts > 0 ? Math.round((correct / attempts) * 100) : 0,
    studyHours: (seconds / 3600).toFixed(1),
    streakDays: list.reduce((max, r) => Math.max(max, r.streakDays || 0), 0),
  };
});

const toProgressItem = (record: KnowledgeRecord): ProgressItem => ({
  conceptId: record.conceptId,
  masteryLevel: record.masteryLevel || 0,
  progress: Math.round((record.masteryLevel || 0) * 100),
  attemptsCount: record.attemptsCount || 0,
  incorrectCount: record.incorrectCount || 0,
});

/** 掌握度低于 70% 视为薄弱环节，优先攻坚 */
const weakPoints = computed(() =>
  practiced.value
    .filter(r => (r.masteryLevel || 0) < 0.7)
    .sort((a, b) => (a.masteryLevel || 0) - (b.masteryLevel || 0))
    .slice(0, 5)
    .map(toProgressItem),
);

const strongPoints = computed(() =>
  practiced.value
    .filter(r => (r.masteryLevel || 0) >= 0.7)
    .sort((a, b) => (b.masteryLevel || 0) - (a.masteryLevel || 0))
    .slice(0, 8)
    .map(toProgressItem),
);

const knowledgeProgress = computed(() =>
  practiced.value
    .slice()
    .sort((a, b) => (a.masteryLevel || 0) - (b.masteryLevel || 0))
    .map(toProgressItem),
);

const recentActivities = computed(() => {
  const all: { entry: PracticeHistoryEntry; conceptId: string }[] = [];
  for (const record of practiced.value) {
    for (const entry of record.practiceHistory || []) {
      all.push({ entry, conceptId: record.conceptId });
    }
  }
  return all
    .sort((a, b) => new Date(b.entry.date).getTime() - new Date(a.entry.date).getTime())
    .slice(0, 10)
    .map(({ entry, conceptId }, index) => ({
      id: `${entry.problemId || 'q'}-${index}`,
      title: entry.problemId ? `${conceptId} · ${entry.problemId}` : conceptId,
      time: formatRelativeTime(entry.date),
      correct: !!entry.isCorrect,
    }));
});

const hasData = computed(() => practiced.value.length > 0);

const formatRelativeTime = (date: string): string => {
  const time = new Date(date).getTime();
  if (!time || Number.isNaN(time)) return '';
  const diffMinutes = Math.floor((Date.now() - time) / 60000);
  if (diffMinutes < 1) return '刚刚';
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} 小时前`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} 天前`;
  return new Date(date).toLocaleDateString();
};

const getMasteryText = (masteryLevel: number) => {
  if (masteryLevel >= 0.8) return t('knowledge.mastered');
  if (masteryLevel >= 0.5) return t('knowledge.inProgress');
  // 已经练过但掌握度偏低 → 待加强（而不是“未学习”）
  return masteryLevel > 0 ? t('knowledge.needsWork') : t('knowledge.notStarted');
};

const fetchProgress = async () => {
  loading.value = true;
  try {
    const user = await userStore.ensureUser();
    if (!user?.username) {
      records.value = [];
      return;
    }
    const response = await request<KnowledgeRecord[]>({
      url: '/student/knowledge/all',
      method: 'GET',
    });
    records.value = Array.isArray(response) ? response : [];
  } catch (error) {
    console.error('❌ [Progress] 加载学习数据失败:', error);
    records.value = [];
  } finally {
    loading.value = false;
  }
};

const practiceKnowledgePoint = (conceptId: string) => {
  uni.navigateTo({
    url: `/pages/practice/index?mode=retry&category=${encodeURIComponent(conceptId)}`,
  });
};

const goPractice = () => {
  uni.navigateTo({ url: '/pages/practice/index' });
};

onMounted(() => {
  fetchProgress();
});
</script>

<style scoped>
.progress-container {
  min-height: 100vh;
  background: var(--bg-secondary);
  padding: 20px;
  box-sizing: border-box;
  color: var(--text-primary);
}

.progress-header {
  text-align: center;
  padding: 20px 16px;
  background: var(--accent-gradient);
  color: white;
  border-radius: 16px;
  margin-bottom: 20px;
}

.header-title {
  font-size: 24px;
  font-weight: bold;
  display: block;
}

.header-subtitle {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
}

.loading-overlay {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border-color);
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
  font-size: 14px;
  color: var(--text-secondary);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 60px 20px;
  background: var(--bg-card);
  border-radius: 16px;
  box-shadow: 0 2px 8px var(--shadow-color);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-text {
  font-size: 18px;
  font-weight: bold;
  color: var(--text-primary);
}

.empty-subtext {
  margin-top: 10px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-secondary);
}

.stats-overview {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.stat-card {
  flex: 1;
  background: var(--bg-card);
  border-radius: 12px;
  padding: 15px 8px;
  text-align: center;
  box-shadow: 0 2px 8px var(--shadow-color);
}

/* uni-app H5 下 <text> 默认行内，数值与单位会挤成“1累计练习” */
.stat-value {
  display: block;
  font-size: 22px;
  font-weight: bold;
  color: var(--accent-color);
}

.stat-label {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 5px;
}

.progress-section {
  background: var(--bg-card);
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px var(--shadow-color);
}

.section-title {
  font-size: 18px;
  font-weight: bold;
  color: var(--text-primary);
  display: block;
  margin-bottom: 10px;
}

.section-desc {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 15px;
}

.progress-item {
  margin-bottom: 18px;
}

.progress-header-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.progress-name {
  display: block;
  font-size: 14px;
  color: var(--text-primary);
}

.progress-percent {
  font-size: 14px;
  font-weight: bold;
  color: var(--accent-color);
}

.progress-bar {
  height: 8px;
  background: var(--bg-secondary);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--accent-gradient);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-fill.weak {
  background: linear-gradient(90deg, var(--error-color) 0%, var(--warning-color) 100%);
}

.progress-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 8px;
}

.progress-status {
  font-size: 12px;
  color: var(--text-muted);
  flex: 1;
}

.practice-btn {
  min-width: 84px;
  height: 32px;
  line-height: 32px;
  padding: 0 16px;
  font-size: 13px;
  border-radius: 16px;
  border: none;
  background: var(--accent-color);
  color: #ffffff;
  margin: 0;
}

.practice-btn.primary {
  margin-top: 24px;
  width: 100%;
  height: 44px;
  line-height: 44px;
  border-radius: 22px;
  font-size: 15px;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag {
  font-size: 12px;
  padding: 5px 12px;
  border-radius: 12px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

.tag.strong {
  background: rgba(76, 175, 80, 0.15);
  color: var(--success-color);
}

.knowledge-progress {
  margin-top: 5px;
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.activity-item {
  display: flex;
  align-items: center;
  padding: 15px;
  background: var(--bg-secondary);
  border-radius: 12px;
}

.activity-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--error-color);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  margin-right: 15px;
  flex-shrink: 0;
}

.activity-icon.correct {
  background: var(--success-color);
}

.activity-info {
  flex: 1;
  min-width: 0;
}

.activity-title {
  display: block;
  font-size: 14px;
  color: var(--text-primary);
}

.activity-time {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
  display: block;
}

.activity-result {
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  background: rgba(244, 67, 54, 0.1);
  color: var(--error-color);
  flex-shrink: 0;
}

.activity-result.correct {
  background: rgba(76, 175, 80, 0.1);
  color: var(--success-color);
}
</style>
