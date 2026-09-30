<template>
  <view class="home-page">
    <!-- 登录态入口：未登录时给出明确的登录/注册按钮，作答记录才会归档到错题本与学习进度 -->
    <view class="account-bar">
      <view class="account-info" v-if="isLoggedIn">
        <text class="account-icon">👤</text>
        <view class="account-text">
          <text class="account-name">{{ userStore.userInfo?.username }}</text>
          <text class="account-hint">{{ $t('home.accountSignedIn') }}</text>
        </view>
      </view>
      <view class="account-info" v-else>
        <text class="account-icon">👤</text>
        <view class="account-text">
          <text class="account-name">{{ $t('home.accountGuest') }}</text>
          <text class="account-hint">{{ $t('home.accountGuestHint') }}</text>
        </view>
      </view>
      <text v-if="isLoggedIn" class="account-action" @click="handleLogout">
        {{ $t('home.logout') }}
      </text>
      <text v-else class="account-action" @click="navigateTo('/pages/login/index')">
        {{ $t('home.loginOrRegister') }}
      </text>
    </view>

    <view class="header">
      <view class="logo-container">
        <text class="logo-icon">📐</text>
      </view>
      <text class="app-name">{{ $t('common.appName') }}</text>
      <text class="app-desc">{{ $t('home.welcome') }}</text>
    </view>

    <view class="main-features">
      <view class="main-feature-card" @click="navigateTo('/pages/solver/index')">
        <view class="main-feature-icon">🧮</view>
        <text class="main-feature-title">{{ $t('home.aiSolver') }}</text>
        <text class="main-feature-desc">{{ $t('home.aiSolverDesc') }}</text>
        <view class="mode-tags">
          <text class="mode-tag sympy">SymPy</text>
          <text class="mode-tag ai">AI</text>
        </view>
      </view>
    </view>

    <view class="features">
      <view class="feature-card" @click="navigateTo('/pages/knowledge/index')">
        <view class="feature-icon">🕸️</view>
        <view class="feature-info">
          <text class="feature-title">{{ $t('home.knowledgeGraph') }}</text>
          <text class="feature-desc">{{ $t('home.knowledgeGraphDesc') }}</text>
        </view>
        <text class="feature-arrow">→</text>
      </view>

      <view class="feature-card" @click="navigateTo('/pages/progress/index')">
        <view class="feature-icon">📊</view>
        <view class="feature-info">
          <text class="feature-title">{{ $t('home.learningProgress') }}</text>
          <text class="feature-desc">{{ $t('home.learningProgressDesc') }}</text>
        </view>
        <text class="feature-arrow">→</text>
      </view>

      <view class="feature-card" @click="navigateTo('/pages/scenario/index')">
        <view class="feature-icon">🎯</view>
        <view class="feature-info">
          <text class="feature-title">{{ $t('home.scenarioDemo') }}</text>
          <text class="feature-desc">{{ $t('home.scenarioDemoDesc') }}</text>
        </view>
        <text class="feature-arrow">→</text>
      </view>

      <view class="feature-card" @click="navigateTo('/pages/settings/index')">
        <view class="feature-icon">⚙️</view>
        <view class="feature-info">
          <text class="feature-title">{{ $t('home.settings') }}</text>
          <text class="feature-desc">{{ $t('home.settingsDesc') }}</text>
        </view>
        <text class="feature-arrow">→</text>
      </view>
    </view>

    <view class="quick-stats" v-if="stats.totalConcepts > 0">
      <text class="stats-title">{{ $t('home.todayProgress') }}</text>
      <view class="stats-grid">
        <view class="stat-item">
          <text class="stat-value">{{ stats.totalConcepts }}</text>
          <text class="stat-label">{{ $t('profile.knowledgePoints') }}</text>
        </view>
        <view class="stat-item">
          <text class="stat-value mastered">{{ stats.masteredConcepts }}</text>
          <text class="stat-label">{{ $t('knowledge.mastered') }}</text>
        </view>
        <view class="stat-item">
          <text class="stat-value">{{ Math.round(stats.averageMastery * 100) }}%</text>
          <text class="stat-label">{{ $t('knowledge.mastery') }}</text>
        </view>
      </view>
    </view>

    <view class="daily-tip">
      <text class="tip-title">💡 {{ $t('home.dailyTip') }}</text>
      <text class="tip-content">{{ dailyTip }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useUserStore } from '@/stores/user';
import request from '@/utils/request';

const { t } = useI18n();
const userStore = useUserStore();
const isLoggedIn = computed(() => userStore.isLoggedIn);

const handleLogout = () => {
  uni.showModal({
    title: t('home.logout'),
    content: t('home.logoutConfirm'),
    success: (res) => {
      if (res.confirm) userStore.logout();
    },
  });
};

const stats = ref({
  totalConcepts: 0,
  masteredConcepts: 0,
  learningConcepts: 0,
  averageMastery: 0,
});

const dailyTips = [
  '极限是微积分的基础，理解极限概念对后续学习至关重要。',
  '导数表示函数的变化率，在物理中有广泛的应用。',
  '积分是导数的逆运算，可以用来计算面积和体积。',
  '泰勒展开可以将复杂函数用多项式近似表示。',
  '洛必达法则是处理未定式极限的有力工具。',
  '链式法则是复合函数求导的核心方法。',
  '连续性是函数的重要性质，与极限密切相关。',
];

/** 按自然日取提示：同一天内保持稳定，跨天自动轮换（避免每次刷新都变） */
const getDailyTip = (): string => {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / 86400000);
  return dailyTips[dayOfYear % dailyTips.length];
};

const dailyTip = ref(getDailyTip());

const navigateTo = (url: string) => {
  uni.navigateTo({ url });
};

const fetchStats = async () => {
  try {
    const response = await request({
      url: '/student/knowledge/summary',
      method: 'GET',
    });
    if (response) {
      stats.value = response;
    }
  } catch (error) {
    console.log('Stats not available yet');
  }
};

onMounted(() => {
  fetchStats();
});
</script>

<style scoped>
.home-page {
  min-height: 100vh;
  background: var(--bg-secondary);
  padding: 20px;
}

.account-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-card);
  border-radius: 14px;
  padding: 14px 16px;
  box-shadow: 0 4px 12px var(--shadow-color);
}

.account-info {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.account-icon {
  font-size: 22px;
  margin-right: 10px;
}

.account-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.account-name {
  display: block;
  font-size: 15px;
  font-weight: bold;
  color: var(--text-primary);
}

.account-hint {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

.account-action {
  flex-shrink: 0;
  font-size: 13px;
  color: var(--primary-color, #667eea);
  padding: 6px 12px;
  border: 1px solid var(--primary-color, #667eea);
  border-radius: 16px;
}

.header {
  text-align: center;
  padding: 30px 0;
}

.logo-container {
  width: 80px;
  height: 80px;
  background: var(--accent-gradient);
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 15px;
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4);
}

.logo-icon {
  font-size: 40px;
}

/* uni-app H5 下 <text> 默认是行内元素，相邻的标题/副标题会挤在同一行，
   所以标题类文本统一改成块级，各自占一行 */
.app-name {
  display: block;
  font-size: 24px;
  font-weight: bold;
  color: var(--text-primary);
  margin-top: 12px;
}

.app-desc {
  display: block;
  font-size: 14px;
  color: var(--text-muted);
  margin-top: 6px;
}

.features {
  margin-top: 20px;
}

.feature-card {
  display: flex;
  align-items: center;
  background: var(--bg-card);
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 15px;
  box-shadow: 0 4px 12px var(--shadow-color);
}

.feature-icon {
  font-size: 36px;
  margin-right: 15px;
}

.feature-info {
  flex: 1;
}

.feature-title {
  display: block;
  font-size: 17px;
  font-weight: bold;
  color: var(--text-primary);
}

.feature-desc {
  display: block;
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 4px;
}

.feature-arrow {
  color: var(--text-muted);
  font-size: 20px;
}

.main-features {
  margin-top: 20px;
}

.main-feature-card {
  background: var(--accent-gradient);
  border-radius: 20px;
  padding: 25px;
  text-align: center;
  color: white;
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4);
}

.main-feature-icon {
  font-size: 48px;
  margin-bottom: 10px;
}

.main-feature-title {
  display: block;
  font-size: 20px;
  font-weight: bold;
  margin-bottom: 8px;
}

.main-feature-desc {
  display: block;
  font-size: 14px;
  opacity: 0.9;
  margin-bottom: 15px;
}

.mode-tags {
  display: flex;
  justify-content: center;
  gap: 10px;
}

.mode-tag {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  background: rgba(255, 255, 255, 0.2);
}

.mode-tag.sympy {
  background: rgba(76, 175, 80, 0.3);
}

.mode-tag.ai {
  background: rgba(33, 150, 243, 0.3);
}

.quick-stats {
  background: var(--bg-card);
  border-radius: 16px;
  padding: 20px;
  margin-top: 20px;
  box-shadow: 0 4px 12px var(--shadow-color);
}

.stats-title {
  display: block;
  font-size: 16px;
  font-weight: bold;
  color: var(--text-primary);
  margin-bottom: 15px;
}

.stats-grid {
  display: flex;
}

.stat-item {
  flex: 1;
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 28px;
  font-weight: bold;
  color: var(--text-primary);
}

.stat-value.mastered {
  color: var(--success-color);
}

.stat-label {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 5px;
}

.daily-tip {
  background: var(--accent-gradient);
  border-radius: 16px;
  padding: 20px;
  margin-top: 20px;
  color: white;
}

.tip-title {
  display: block;
  font-size: 14px;
  opacity: 0.9;
  margin-bottom: 10px;
}

.tip-content {
  display: block;
  font-size: 15px;
  line-height: 1.6;
}
</style>