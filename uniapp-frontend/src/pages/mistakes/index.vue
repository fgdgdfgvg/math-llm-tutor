<template>
  <view class="mistakes-page">
    <view class="page-header">
      <text class="page-title">错题记录</text>
      <text class="page-subtitle">按知识点归纳，举一反三攻坚薄弱环节</text>
    </view>

    <view v-if="categories.length > 1" class="category-selector">
      <view 
        v-for="category in categories" 
        :key="category.id"
        :class="['category-item', { active: selectedCategory === category.id }]"
        @click="selectCategory(category.id)"
      >
        <text class="category-name">{{ category.name }}</text>
      </view>
    </view>

    <view v-if="loading" class="loading-overlay">
      <view class="loading-spinner"></view>
      <text class="loading-text">加载中...</text>
    </view>

    <view v-else-if="loadError" class="empty-state">
      <text class="empty-icon">⚠️</text>
      <text class="empty-text">{{ loadError }}</text>
      <button class="reload-btn" @click="fetchMistakes">重新加载</button>
    </view>

    <view v-else-if="mistakes.length === 0" class="empty-state">
      <text class="empty-icon">📝</text>
      <text class="empty-text">暂无错题记录</text>
      <text class="empty-subtext">在专项练习中答错的题目会自动收录到这里</text>
      <button class="reload-btn" @click="goPractice">去做题</button>
    </view>

    <view v-else class="mistakes-list">
      <view 
        v-for="(mistake, index) in mistakes" 
        :key="mistake.id"
        class="mistake-card"
      >
        <view class="mistake-header">
          <text class="mistake-number">第 {{ index + 1 }} 题</text>
          <view class="mistake-meta">
            <text v-if="mistake.knowledgePoint" class="knowledge-tag">{{ mistake.knowledgePoint }}</text>
            <text class="mistake-time">{{ mistake.createdAt }}</text>
          </view>
        </view>
        
        <view class="mistake-content">
          <!-- 题面/答案/解析都走 MathRenderer：题库里是 $...$ 或裸 LaTeX，
               直接当文本输出会看到源码而不是公式 -->
          <view class="mistake-question">
            <MathRenderer :content="mistake.question" />
          </view>
          
          <view class="answer-section">
            <text class="answer-label">你的答案</text>
            <view class="mistake-answer">
              <MathRenderer :content="formatAnswerText(mistake.userAnswer)" />
            </view>
          </view>
          
          <view class="answer-section">
            <text class="answer-label">正确答案</text>
            <view class="correct-answer">
              <MathRenderer :content="formatAnswerText(mistake.correctAnswer)" />
            </view>
          </view>
          
          <view v-if="mistake.explanation" class="explanation-section">
            <text class="explanation-label">解析</text>
            <view v-if="mistake.steps.length > 0" class="explanation-steps">
              <view
                v-for="(step, stepIndex) in parseSteps(mistake.steps)"
                :key="stepIndex"
                class="explanation-step"
              >
                <view class="step-index">{{ step.index }}</view>
                <view class="step-body">
                  <text v-if="step.title" class="step-title">{{ step.title }}</text>
                  <MathRenderer :content="step.body" />
                </view>
              </view>
            </view>
            <view v-else class="explanation-text">
              <MathRenderer :content="mistake.explanation" />
            </view>
          </view>
        </view>
        
        <view class="mistake-actions">
          <button class="retry-btn" @click="retryQuestion(mistake)">举一反三</button>
          <button 
            class="review-btn" 
            :class="{ 'reviewed': mistake.reviewed }" 
            @click="markReviewed(mistake)"
          >
            {{ mistake.reviewed ? '已掌握' : '标记已掌握' }}
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import MathRenderer from '../../components/MathRenderer.vue';
import { formatAnswerText, parseSolutionStep } from '../../utils/math-format';
import request from '@/utils/request';
import { useUserStore } from '@/stores/user';

const userStore = useUserStore();

interface Mistake {
  id: string;
  questionId: string;
  question: string;
  userAnswer: string;
  correctAnswer: string;
  explanation: string;
  /** 原始解题步骤（逐条展示成编号列表，而不是一大段文字） */
  steps: string[];
  createdAt: string;
  knowledgePoint: string;
  reviewed: boolean;
}

interface Category {
  id: string;
  name: string;
}

const selectedCategory = ref('all');
const loading = ref(false);
const loadError = ref('');
const rawMistakes = ref<Mistake[]>([]);

/** 分类完全来自该用户真实错题的知识点，保证每个分类都有匹配题目 */
const categories = computed<Category[]>(() => {
  const counts = new Map<string, number>();
  for (const mistake of rawMistakes.value) {
    const key = mistake.knowledgePoint || '未分类';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const list: Category[] = [{ id: 'all', name: `全部 (${rawMistakes.value.length})` }];
  counts.forEach((count, key) => {
    list.push({ id: key, name: `${key} (${count})` });
  });
  return list;
});

const mistakes = computed<Mistake[]>(() => {
  if (selectedCategory.value === 'all') return rawMistakes.value;
  return rawMistakes.value.filter(m => (m.knowledgePoint || '未分类') === selectedCategory.value);
});

onMounted(() => {
  fetchMistakes();
});

const selectCategory = (categoryId: string) => {
  selectedCategory.value = categoryId;
};

/** 步骤文本 → “序号 + 小标题 + 正文”，与专项练习页保持一致 */
const parseSteps = (steps: string[]) =>
  steps
    .filter((step) => !!step && String(step).trim() !== '')
    .map((step, index) => parseSolutionStep(String(step), index + 1));

const mapMistake = (m: any): Mistake => ({
  id: String(m._id || m.id || ''),
  questionId: m.questionId || '',
  question: m.questionContent || m.question || '',
  userAnswer: m.userAnswer ?? '',
  correctAnswer: m.correctAnswer ?? '',
  explanation: Array.isArray(m.solutionSteps) ? m.solutionSteps.join('\n') : (m.solutionSteps || ''),
  steps: Array.isArray(m.solutionSteps) ? m.solutionSteps : [],
  createdAt: m.createdAt ? new Date(m.createdAt).toLocaleDateString() : '',
  knowledgePoint: m.knowledgePoint || '',
  reviewed: !!m.reviewed,
});

const fetchMistakes = async () => {
  loading.value = true;
  loadError.value = '';
  try {
    // 先确保拿到登录用户（刷新页面后 userInfo 可能还没恢复）
    const user = await userStore.ensureUser();
    if (!user?.username) {
      rawMistakes.value = [];
      loadError.value = '登录状态已失效，请重新登录后再查看错题本';
      return;
    }

    const response = await request<any>({
      url: '/questions/mistakes',
      method: 'GET',
      params: { page: 1, limit: 100 },
    });

    const list: any[] = Array.isArray(response)
      ? response
      : (Array.isArray(response?.mistakes) ? response.mistakes : []);

    rawMistakes.value = list.map(mapMistake);

    // 当前分类在刷新后可能已不存在，回退到“全部”
    if (selectedCategory.value !== 'all' && !categories.value.some(c => c.id === selectedCategory.value)) {
      selectedCategory.value = 'all';
    }
  } catch (error: any) {
    console.error('❌ [Mistakes] 获取错题失败:', error);
    rawMistakes.value = [];
    loadError.value = error?.message || '获取错题记录失败';
  } finally {
    loading.value = false;
  }
};

const retryQuestion = (mistake: Mistake) => {
  // 按知识点出同类题；若题库缺少该知识点则退回到原错题
  const category = encodeURIComponent(mistake.knowledgePoint || '');
  const questionId = mistake.questionId ? `&questionId=${encodeURIComponent(mistake.questionId)}` : '';
  uni.navigateTo({
    url: `/pages/practice/index?mode=retry&category=${category}${questionId}`,
  });
};

const goPractice = () => {
  uni.navigateTo({ url: '/pages/practice/index' });
};

const markReviewed = async (mistake: Mistake) => {
  if (!mistake.id) return;
  try {
    await request({
      url: `/questions/mistakes/${mistake.id}/review`,
      method: 'POST',
    });
    mistake.reviewed = true;
    uni.showToast({ title: '已标记为掌握', icon: 'success' });
    await fetchMistakes();
  } catch (error) {
    console.error('❌ [Mistakes] 标记失败:', error);
    uni.showToast({ title: '标记失败，请稍后重试', icon: 'none' });
  }
};
</script>

<style scoped>
.mistakes-page {
  min-height: 100vh;
  background: var(--bg-secondary);
  color: var(--text-primary);
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
  display: block;
  margin-top: 6px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
}

.category-selector {
  display: flex;
  overflow-x: auto;
  padding: 15px;
  gap: 10px;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);
}

.category-item {
  padding: 8px 16px;
  border-radius: 20px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 14px;
  white-space: nowrap;
  transition: all 0.3s ease;
}

.category-item.active {
  background: var(--accent-color);
  color: white;
  font-weight: bold;
}

.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--bg-secondary);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 1000;
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
  color: var(--text-secondary);
  font-size: 14px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 20px;
}

.empty-text {
  font-size: 18px;
  font-weight: bold;
  color: var(--text-primary);
  margin-bottom: 10px;
}

.empty-subtext {
  font-size: 14px;
  color: var(--text-secondary);
}

.reload-btn {
  margin-top: 24px;
  padding: 0 32px;
  height: 42px;
  line-height: 42px;
  border-radius: 21px;
  border: none;
  background: var(--accent-color);
  color: #ffffff;
  font-size: 15px;
}

.mistakes-list {
  padding: 15px;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.mistake-card {
  background: var(--bg-card);
  border-radius: 12px;
  padding: 15px;
  color: var(--text-primary);
  box-shadow: 0 2px 8px var(--shadow-color);
}

.mistake-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-color);
}

.mistake-number {
  font-size: 16px;
  font-weight: bold;
  color: var(--accent-color);
}

.mistake-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.knowledge-tag {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 10px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
}

.mistake-time {
  font-size: 12px;
  color: var(--text-muted);
}

.mistake-content {
  margin-bottom: 15px;
}

.mistake-question {
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-primary);
  margin-bottom: 15px;
  display: block;
}

.answer-section {
  margin-bottom: 12px;
}

.answer-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
  display: block;
}

.mistake-answer {
  font-size: 14px;
  color: var(--error-color);
  background: rgba(244, 67, 54, 0.1);
  padding: 8px 12px;
  border-radius: 6px;
  display: block;
}

.correct-answer {
  font-size: 14px;
  color: var(--success-color);
  background: rgba(76, 175, 80, 0.12);
  padding: 8px 12px;
  border-radius: 6px;
  display: block;
}

.explanation-section {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid var(--border-color);
}

.explanation-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
  display: block;
}

.explanation-text {
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-primary);
  background: var(--math-bg);
  padding: 10px 12px;
  border-radius: 6px;
  display: block;
}

.explanation-steps {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  background: var(--math-bg);
  border-radius: 6px;
}

.explanation-step {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.step-index {
  flex: 0 0 20px;
  width: 20px;
  height: 20px;
  line-height: 20px;
  text-align: center;
  border-radius: 50%;
  font-size: 11px;
  font-weight: bold;
  color: #fff;
  background: var(--accent-color);
  margin-top: 2px;
}

.step-body {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-primary);
}

.step-title {
  display: block;
  font-weight: bold;
  margin-bottom: 2px;
}

.mistake-actions {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid var(--border-color);
  display: flex;
  gap: 12px;
}

.retry-btn,
.review-btn {
  flex: 1;
  height: 40px;
  line-height: 40px;
  border-radius: 20px;
  font-size: 14px;
  border: none;
}

.retry-btn {
  background: var(--accent-color);
  color: white;
}

.review-btn {
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
}

.review-btn.reviewed {
  background: rgba(76, 175, 80, 0.15);
  color: var(--success-color);
  border-color: var(--success-color);
}
</style>
