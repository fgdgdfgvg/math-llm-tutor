<template>
  <view class="practice-container">
    <view class="practice-info" v-if="conceptName">
      <text class="concept-name">{{ conceptName }}</text>
      <text class="info-hint">专项练习</text>
    </view>

    <view v-if="loading" class="loading-overlay">
      <view class="loading-spinner"></view>
      <text class="loading-text">加载题目中...</text>
    </view>

    <view v-else-if="!question.content" class="empty-state">
      <text class="empty-icon">📝</text>
      <text class="empty-text">暂无相关练习题目</text>
      <button class="retry-btn" @click="loadRandomQuestion">重新加载</button>
    </view>

    <view v-else class="question-container">
      <view class="question-header">
        <text class="question-title">题目</text>
        <view class="question-meta">
          <text v-if="question.questionType" class="meta-chip">{{ question.questionType }}</text>
          <text v-if="question.difficulty" class="meta-chip">{{ getDifficultyLabel(question.difficulty) }}</text>
          <!-- 题库该知识点题量不足时会退回相近知识点，这里如实标明实际知识点 -->
          <text v-if="isTopicMismatch" class="meta-chip warn">{{ question.knowledgePoint }}</text>
        </view>
      </view>

      <!-- 与教材/试卷一致：题源、分值、建议用时 -->
      <view class="question-source" v-if="sourceLine">{{ sourceLine }}</view>
      
      <view class="question-content">
        <MathRenderer :content="question.content" />
        <view class="question-image" v-if="question.imageUrl">
          <image :src="question.imageUrl" mode="aspectFit"></image>
        </view>
      </view>

      <view class="options-section" v-if="question.options && question.options.length > 0">
        <text class="section-title">选项</text>
        <view class="options-list">
          <view 
            v-for="(option, index) in question.options" 
            :key="index"
            class="option-item"
            :class="{ 'selected': selectedOption === index }"
            @click="selectOption(index)"
          >
            <text class="option-label">{{ String.fromCharCode(65 + index) }}.</text>
            <MathRenderer :content="option" />
          </view>
        </view>
      </view>

      <view class="answer-section">
        <text class="section-title">我的答案</text>
        <textarea
          v-if="!question.options || question.options.length === 0"
          class="answer-input"
          v-model="userAnswer"
          placeholder="请输入你的答案，例如 1/3 或 -2"
          spellcheck="false"
        />
        <view v-else class="selected-option" v-if="selectedOption !== null">
          <text class="option-label">{{ String.fromCharCode(65 + selectedOption) }}.</text>
          <MathRenderer :content="question.options[selectedOption]" />
        </view>
        <button class="submit-btn" @click="submitAnswer" :disabled="!canSubmit">
          提交答案
        </button>
      </view>

      <!-- 答案解析 -->
      <view class="analysis-container" v-if="showAnalysis">
        <!-- 未登录时明确告知作答不会被归档，而不是默默丢掉记录 -->
        <view class="login-notice" v-if="recordSkipped">
          <text class="login-notice-text">🔒 {{ $t('problem.loginNotice') }}</text>
          <text class="login-notice-action" @click="goToLogin">{{ $t('problem.goLogin') }}</text>
        </view>

        <view class="analysis-header">
          <text class="analysis-title">{{ referenceOnly ? '参考答案' : '答案解析' }}</text>
          <text class="result-icon" :class="referenceOnly ? 'neutral' : (isCorrect ? 'correct' : 'incorrect')">
            {{ referenceOnly ? '📝' : (isCorrect ? '✅' : '❌') }}
          </text>
        </view>

        <view class="reference-notice" v-if="referenceOnly">
          <text class="reference-notice-text">本题为概念/文字题，不作自动判分，也不记入错题本，请对照参考答案自评。</text>
        </view>
        
        <view class="analysis-content">
          <view class="correct-answer" v-if="question.answer !== undefined && question.answer !== null && question.answer !== ''">
            <text class="answer-label">{{ referenceOnly ? '参考答案' : '正确答案' }}</text>
            <view class="answer-value">
              <MathRenderer :content="formatAnswerText(question.answer)" />
            </view>
          </view>

          <view class="user-answer-display" v-if="!question.options || question.options.length === 0">
            <text class="answer-label">你的答案</text>
            <view class="answer-value" :class="isCorrect ? 'ok' : 'bad'">
              <MathRenderer :content="formatAnswerText(userAnswer)" />
            </view>
          </view>
          
          <view class="solution-steps" v-if="solutionSteps.length > 0">
            <text class="steps-title">解题步骤</text>
            <view v-for="(step, index) in solutionSteps" :key="index" class="step-item">
              <view class="step-index">{{ step.index }}</view>
              <view class="step-body">
                <text v-if="step.title" class="step-title">{{ step.title }}</text>
                <MathRenderer :content="step.body" />
              </view>
            </view>
          </view>
          
          <view class="knowledge-points" v-if="knowledgeTags.length > 0">
            <text class="knowledge-title">涉及知识点</text>
            <view class="knowledge-list">
              <text v-for="(point, index) in knowledgeTags" :key="index" class="knowledge-tag">
                {{ point }}
              </text>
            </view>
          </view>
        </view>
      </view>

      <view class="action-buttons" v-if="showAnalysis">
        <button class="action-btn next" @click="loadRandomQuestion">下一题</button>
        <button class="action-btn ai" @click="goToAiSolver">AI 解题</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import MathRenderer from '../../components/MathRenderer.vue';
import request from '../../utils/request';
import { parseSolutionStep, formatAnswerText } from '../../utils/math-format';
import { useUserStore } from '@/stores/user';

const userStore = useUserStore();

interface Question {
  _id?: string;
  questionId?: string;
  content: string;
  questionType?: string;
  chapterSource?: string;
  score?: number;
  estimatedTime?: string;
  knowledgePoint: string;
  difficulty: string;
  options?: string[];
  answer?: string | number;
  correctAnswer?: string | number;
  solutionSteps?: string[];
  subConcepts?: string[];
  knowledgePoints?: string[];
  imageUrl?: string;
}


const question = ref<Question>({
  content: '',
  knowledgePoint: '',
  difficulty: ''
});

const loading = ref(false);
const conceptId = ref('');
const conceptName = ref('');
// 知识图谱节点 id → 中文名称，用于把题目的 subConcepts 编号翻译成可读知识点
const conceptNameMap = ref<Record<string, string>>({});
const userAnswer = ref('');
const selectedOption = ref<number | null>(null);
const showAnalysis = ref(false);
const isCorrect = ref(false);
// 未登录导致错题/练习记录未能归档时置为 true，用于在解析卡片里提示去登录
const recordSkipped = ref(false);
// 概念/文字题：只给参考答案，不做字符串自动判分（否则必然判错、污染错题本）
const referenceOnly = ref(false);

/** 长中文说明型答案（概念题/证明题的文字结论）不适合按字符串比对判分 */
const isProseAnswer = (answer: unknown): boolean => {
  const text = (answer ?? '').toString().trim();
  if (!text) return false;
  const cjkCount = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  return cjkCount >= 8 && text.length >= 20;
};

const goToLogin = () => {
  uni.navigateTo({ url: '/pages/login/index' });
};
// 本题开始作答的时间戳，用于把练习时长上报到学习进度
let practiceStartedAt = Date.now();
const resetPracticeTimer = () => {
  practiceStartedAt = Date.now();
};

const canSubmit = computed(() => {
  if (question.value.options && question.value.options.length > 0) {
    return selectedOption.value !== null;
  }
  return userAnswer.value.trim() !== '';
});

const getDifficultyLabel = (difficulty: string) => {
  const labels: Record<string, string> = {
    '基础': '基础',
    '中等': '中等',
    '较难': '较难',
    '困难': '困难'
  };
  return labels[difficulty] || difficulty;
};

const selectOption = (index: number) => {
  selectedOption.value = index;
};

// 题源 / 分值 / 建议用时（题库里有就展示，沿用试卷习惯）
const sourceLine = computed(() => {
  const parts: string[] = [];
  if (question.value.chapterSource) parts.push(`来源：${question.value.chapterSource}`);
  if (question.value.score) parts.push(`${question.value.score} 分`);
  if (question.value.estimatedTime) parts.push(`建议 ${question.value.estimatedTime}`);
  return parts.join(' · ');
});

/**
 * 判断两个知识点名称是否同源。
 * 图谱节点名（“极限的计算方法”）与题库知识点名（“极限计算”）不会完全相等，
 * 所以用中文 2-gram 重叠来判断，真的一题不相关时才提示。
 */
const isSameTopic = (a: string, b: string): boolean => {
  if (a.includes(b) || b.includes(a)) return true;
  const grams = (text: string): string[] =>
    text.replace(/[^\u4e00-\u9fff]/g, '').match(/.{1,2}/g) || [];
  const right = grams(b);
  return grams(a).some((gram) => right.includes(gram));
};

// 请求的知识点与题目实际知识点不一致（题库没这个知识点的题时会退回随机题）
const isTopicMismatch = computed(() => {
  const requested = (conceptName.value || '').trim();
  const actual = (question.value.knowledgePoint || '').trim();
  if (!requested || !actual) return false;
  return !isSameTopic(requested, actual);
});

// 解题步骤：把题库里的“步骤1：……”文本拆成序号 + 小标题 + 正文，避免重复编号
const solutionSteps = computed(() =>
  (question.value.solutionSteps || [])
    .filter((step) => !!step && String(step).trim() !== '')
    .map((step, index) => parseSolutionStep(String(step), index + 1)),
);

// 知识点标签：中文主知识点优先，附带图谱里能查到名字的子概念
const knowledgeTags = computed<string[]>(() => {
  const tags: string[] = [];
  const push = (value?: string) => {
    const text = (value || '').trim();
    if (text && !tags.includes(text)) tags.push(text);
  };

  push(question.value.knowledgePoint);
  (question.value.subConcepts || []).forEach((raw) => {
    const id = String(raw || '').trim();
    if (!id) return;
    push(conceptNameMap.value[id] || (isInternalCode(id) ? '' : id));
  });
  (question.value.knowledgePoints || []).forEach(push);

  return tags;
});

// 形如 limit_basic / theorem_rolle 的内部编号对学习者没有意义，查不到中文名就不展示
const isInternalCode = (value: string) => /^[a-z][a-z0-9_]*$/i.test(value);

/**
 * 答案归一化：统一成可直接比较的形式。
 * 学习者可能写 1/3、\frac{1}{3}、0.5、x=-2、-2，都应能正确判定。
 */
const normalizeAnswer = (answer: unknown): string => {
  let text = (answer ?? '').toString().trim();
  if (!text) return '';

  // 去空白、去结尾标点、去 \( \) / $ 包裹
  text = text.replace(/[\s\u3000]+/g, '').replace(/[。；;，,]$/g, '');
  text = text.replace(/^\\?[（(]|\\?[）)]$/g, '');
  text = text.replace(/\$+/g, '');
  text = text.replace(/\\left|\\right/g, '');

  // LaTeX 分数 / 根号 → 普通写法
  text = text.replace(/\\d?frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)');
  text = text.replace(/\\sqrt\{([^{}]*)\}/g, 'sqrt($1)');

  // 去掉“x =”“y =”“答案是”这类前缀
  text = text.replace(/^[a-zA-Z]\s*=\s*/, '');
  text = text.replace(/^(答案|结果|值为)[:：是为]*/g, '');

  // 统一乘号与幂次写法：3*x**2 / 3×x^2 / 3x²
  text = text.replace(/[×⋅·]/g, '*').replace(/\*\*/g, '^');
  text = text.replace(/\^\{([^{}]*)\}/g, '^$1');
  text = text.replace(/\s*\*\s*/g, '*');
  text = text.replace(/^\*|\*$/g, '');

  // 分数约简：4/8 → 1/2
  const frac = text.match(/^([+-]?\d+)\/([+-]?\d+)$/);
  if (frac) {
    const num = Number(frac[1]);
    const den = Number(frac[2]);
    if (den !== 0 && Number.isInteger(num) && Number.isInteger(den)) {
      const g = (a: number, b: number): number => (b === 0 ? Math.abs(a) : g(b, a % b));
      const div = g(num, den) || 1;
      return `${num / div}/${den / div}`;
    }
  }

  return text.toLowerCase();
};

/** 数值等价判断：0.5 与 1/2、-2 与 -2.0 都算对 */
const toNumber = (value: string): number | null => {
  const text = value.replace(/\s/g, '');
  if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(text)) return Number(text);
  const frac = text.match(/^([+-]?\d+(?:\.\d+)?)\/([+-]?\d+(?:\.\d+)?)$/);
  if (frac) {
    const den = Number(frac[2]);
    if (den !== 0) return Number(frac[1]) / den;
  }
  return null;
};

const isAnswerCorrect = (userRaw: unknown, correctRaw: unknown): boolean => {
  const user = normalizeAnswer(userRaw);
  const correct = normalizeAnswer(correctRaw);
  if (!correct) return false;
  if (user === correct) return true;

  const userNum = toNumber(user);
  const correctNum = toNumber(correct);
  if (userNum !== null && correctNum !== null) {
    return Math.abs(userNum - correctNum) < 1e-9;
  }

  // 集合型答案（如“0,1”）顺序无关
  const splitSet = (value: string) =>
    value.split(/[,;]/).map((part) => part.replace(/[{}]/g, '').trim()).filter(Boolean).sort();
  if (/[,;]/.test(correct)) {
    const a = splitSet(user);
    const b = splitSet(correct);
    if (a.length > 0 && a.length === b.length && a.every((v, i) => v === b[i])) return true;
  }

  // 表达式型答案：x^2+2x 与 2x+x^2 之类的项序差异
  const terms = (value: string) => value.split('+').map((t) => t.trim()).filter(Boolean).sort();
  if (correct.includes('+')) {
    const a = terms(user);
    const b = terms(correct);
    if (a.length > 1 && a.length === b.length && a.every((v, i) => v === b[i])) return true;
  }

  return false;
};

const submitAnswer = async () => {
  if (!canSubmit.value) return;
  
  let userAnswerText = '';
  const options = question.value.options;

  if (options && options.length > 0) {
    isCorrect.value = selectedOption.value === question.value.correctAnswer;
    userAnswerText = options[selectedOption.value!] || '';
  } else {
    // 主观题：归一化后比较，兼容分数、小数、带等号等各种常见写法
    userAnswerText = userAnswer.value;
    referenceOnly.value = isProseAnswer(question.value.answer);
    isCorrect.value = referenceOnly.value
      ? false
      : isAnswerCorrect(userAnswer.value, question.value.answer);
  }

  recordSkipped.value = false;

  // 概念/文字题不自动判分，自然也不写入错题本、不上报对错
  if (referenceOnly.value) {
    showAnalysis.value = true;
    return;
  }

  // 答错则写入错题本（带 JWT，按知识点归档，供“举一反三”精准出题）
  if (!isCorrect.value) {
    try {
      const currentUser = await userStore.ensureUser();
      if (!currentUser?.username) {
        recordSkipped.value = true;
        uni.showToast({ title: '登录后可自动记录错题', icon: 'none' });
      } else {
        console.log('📝 [Mistake] 创建错题记录，用户:', currentUser.username);
        // 注意：不要传 userId。后端开启了 forbidNonWhitelisted 校验，
        // 多余字段会直接 400，导致错题被静默丢弃；用户身份一律由 JWT 决定。
        await request({
          url: '/questions/mistakes',
          method: 'POST',
          data: {
            questionId: question.value.questionId || question.value._id || '',
            questionContent: question.value.content,
            userAnswer: userAnswerText,
            correctAnswer: question.value.answer?.toString() || '',
            solutionSteps: question.value.solutionSteps || [],
            knowledgePoint: question.value.knowledgePoint || '',
            subConcepts: question.value.subConcepts || [],
            difficulty: question.value.difficulty || ''
          }
        });
        console.log('✅ [Mistake] 错题记录创建成功');
      }
    } catch (error) {
      console.error('❌ [Mistake] 创建错题记录失败:', error);
    }
  }
  
  // 记录练习结果，驱动“学习进度/薄弱环节”分析
  try {
    const currentUser = await userStore.ensureUser();
    if (!currentUser?.username) {
      recordSkipped.value = true;
    }
    if (currentUser?.username && question.value.knowledgePoint) {
      await request({
        url: '/student/knowledge/practice',
        method: 'POST',
        data: {
          conceptId: question.value.knowledgePoint,
          isCorrect: isCorrect.value,
          problemId: question.value.questionId || question.value._id || '',
          timeSpent: Math.max(1, Math.round((Date.now() - practiceStartedAt) / 1000)),
        },
      });
      console.log('📊 [Practice] 练习记录已上报:', question.value.knowledgePoint, isCorrect.value ? '正确' : '错误');
    }
  } catch (error) {
    console.warn('⚠️ [Practice] 上报练习记录失败:', error);
  }

  showAnalysis.value = true;
};

const loadRandomQuestion = async () => {
  loading.value = true;
  showAnalysis.value = false;
  referenceOnly.value = false;
  userAnswer.value = '';
  selectedOption.value = null;
  resetPracticeTimer();

  try {
    // 后端支持 knowledgePointId / knowledgePoint / conceptId / conceptName 多种写法。
    // 优先传知识图谱节点 id（可被映射到题库知识点），名称仅作为兜底，
    // 否则“图谱节点名”与“题库知识点名”对不上时会退化成全库随机出题。
    const params: Record<string, string> = {};
    const hasConceptId =
      !!conceptId.value && conceptId.value !== 'undefined' && conceptId.value !== 'null';
    if (hasConceptId) {
      params.knowledgePointId = conceptId.value;
    }
    if (conceptName.value) {
      params.conceptName = conceptName.value;
      if (!hasConceptId) params.knowledgePoint = conceptName.value;
    }
    const response = await request<any>({ url: '/questions/random', method: 'GET', params });
    if (!response || !response.content) throw new Error('题库暂无可用题目');
    question.value = response;
  } catch (error: any) {
    console.error('❌ [Practice] 加载题目失败:', error);
    question.value = { content: '', knowledgePoint: '', difficulty: '' };
    uni.showToast({ title: error?.message || '加载题目失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
};

const goToAiSolver = () => {
  uni.navigateTo({
    url: `/pages/solver/index?mode=ai&question=${encodeURIComponent(question.value.content)}&conceptId=${conceptId.value}&conceptName=${encodeURIComponent(conceptName.value)}`
  });
};

const loadSimilarQuestion = async (category: string) => {
  loading.value = true;
  showAnalysis.value = false;
  userAnswer.value = '';
  selectedOption.value = null;
  resetPracticeTimer();

  try {
    const pickRandom = (list: any[]): any => list[Math.floor(Math.random() * list.length)];

    // 1) 优先按知识点找同类题
    if (category) {
      const similar = await request<any>({
        url: '/questions/similar',
        method: 'GET',
        params: { category, limit: 20 },
      });
      const list = Array.isArray(similar) ? similar : [];
      if (list.length > 0) {
        question.value = pickRandom(list);
        return;
      }

      // 2) 退一步：按知识点精确随机取题
      const random = await request<any>({
        url: '/questions/random',
        method: 'GET',
        params: { knowledgePoint: category },
      });
      if (random && random.content) {
        question.value = random;
        return;
      }
    }

    // 3) 题库确实没有该知识点的题：明确提示，而不是跨知识点乱出题
    console.warn('⚠️ [Practice] 题库中没有该知识点的题目:', category);
    question.value = { content: '', knowledgePoint: category || '', difficulty: '' };
    uni.showToast({
      title: category ? `题库暂无「${category}」的题目` : '暂无相似题目',
      icon: 'none',
      duration: 2500,
    });
  } catch (error: any) {
    console.error('❌ [Practice] 加载相似题失败:', error);
    question.value = { content: '', knowledgePoint: '', difficulty: '' };
    uni.showToast({ title: error?.message || '加载相似题失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
};

const loadOriginalQuestion = async (questionId: string) => {
  loading.value = true;
  resetPracticeTimer();
  try {
    const found = await request<any>({ url: `/questions/${questionId}`, method: 'GET' });
    if (found && found.content) {
      question.value = found;
      return;
    }
    throw new Error('题目不存在');
  } catch (error: any) {
    console.error('❌ [Original Question] 加载原错题失败:', error);
    uni.showToast({ title: '加载题目失败', icon: 'none' });
    await loadRandomQuestion();
  } finally {
    loading.value = false;
  }
};

let currentPage: any;

/**
 * 拉取知识图谱节点表（id ↔ 中文名），只在首次进入时请求一次。
 * 题库里的 subConcepts 存的是内部编号，直接展示给学习者没有意义。
 */
const loadConceptNames = async () => {
  if (Object.keys(conceptNameMap.value).length > 0) return;
  try {
    const list = await request<any[]>({ url: '/knowledge/concepts', method: 'GET' });
    const map: Record<string, string> = {};
    (Array.isArray(list) ? list : []).forEach((node: any) => {
      const id = node?.id || node?._id;
      const name = node?.name || '';
      if (!id || !name) return;
      map[id] = name;
      if (!map[name]) map[name] = name;
    });
    conceptNameMap.value = map;
  } catch (error) {
    console.warn('⚠️ [Practice] 加载知识点名称失败:', error);
  }
};

onMounted(async () => {
  const pages = getCurrentPages();
  currentPage = pages[pages.length - 1];
  const options = currentPage.options;
  
  console.log('📥 [Route Debug] 路由参数:', options);
  
  if (options.conceptId) {
    conceptId.value = options.conceptId;
  } else if (options.id) {
    conceptId.value = options.id;
  }
  
  if (options.conceptName) {
    conceptName.value = decodeURIComponent(options.conceptName);
  } else if (options.name) {
    conceptName.value = decodeURIComponent(options.name);
  }
  
  console.log('🎯 [Route Debug] 最终 conceptId:', conceptId.value);
  console.log('🎯 [Route Debug] 最终 conceptName:', conceptName.value);

  // 只带节点 id 进入时，从图谱里补出中文名（同时用于展示知识点标签）
  loadConceptNames().then(() => {
    if (!conceptName.value && conceptId.value) {
      conceptName.value = conceptNameMap.value[conceptId.value] || '';
    }
  });
  
  const retryCategory = options.category ? decodeURIComponent(options.category) : '';

  // “举一反三”优先按知识点出同类题；没有知识点时退回原错题
  if (options.mode === 'retry' && retryCategory) {
    await loadSimilarQuestion(retryCategory);
  } else if (options.mode === 'retry' && options.questionId) {
    await loadOriginalQuestion(decodeURIComponent(options.questionId));
  } else if (options.questionId) {
    await loadOriginalQuestion(options.questionId);
  } else {
    await loadRandomQuestion();
  }
});
</script>

<style scoped>
.practice-container {
  padding: 20px;
  min-height: 100vh;
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.title {
  font-size: 24px;
  font-weight: bold;
  text-align: center;
  margin-bottom: 20px;
  color: var(--text-primary);
}

.practice-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bg-card);
  padding: 15px;
  border-radius: 10px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px var(--shadow-color);
}

.concept-name {
  font-size: 16px;
  font-weight: bold;
  color: var(--accent-color);
}

.difficulty {
  font-size: 14px;
  padding: 4px 12px;
  border-radius: 12px;
  background: rgba(102, 126, 234, 0.18);
  color: var(--accent-color);
}

.info-hint {
  font-size: 12px;
  color: var(--text-secondary);
}

.question-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.question-source {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 6px 0 12px;
}

.meta-chip {
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 10px;
  background: rgba(102, 126, 234, 0.15);
  color: var(--accent-color);
}

.meta-chip.warn {
  background: rgba(255, 152, 0, 0.18);
  color: #ff9800;
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
  text-align: center;
  padding: 60px 20px;
  background: var(--bg-card);
  border-radius: 10px;
  box-shadow: 0 2px 8px var(--shadow-color);
}

.empty-icon {
  font-size: 48px;
  display: block;
  margin-bottom: 15px;
}

.empty-text {
  font-size: 16px;
  color: var(--text-muted);
  display: block;
  margin-bottom: 20px;
}

.retry-btn {
  background: var(--accent-color);
  color: white;
  border-radius: 20px;
  padding: 10px 20px;
  font-size: 14px;
}

.question-container {
  background: var(--bg-card);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px var(--shadow-color);
}

.question-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-color);
}

.question-title {
  font-size: 16px;
  font-weight: bold;
  color: var(--text-primary);
}

.question-id {
  font-size: 12px;
  color: var(--text-muted);
}

.question-content {
  margin-bottom: 20px;
}

.content-text {
  font-size: 15px;
  line-height: 1.6;
  color: var(--text-primary);
  white-space: pre-line;
}

.question-image {
  margin-top: 15px;
  border-radius: 8px;
  overflow: hidden;
}

.question-image image {
  width: 100%;
  height: auto;
}

.options-section {
  margin-bottom: 20px;
}

.section-title {
  font-size: 14px;
  font-weight: bold;
  color: var(--text-primary);
  margin-bottom: 10px;
  display: block;
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.option-item {
  display: flex;
  align-items: flex-start;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.option-item:hover {
  border-color: var(--accent-color);
  background: var(--bg-secondary);
}

.option-item.selected {
  border-color: var(--accent-color);
  background: rgba(102, 126, 234, 0.18);
}

.option-label {
  font-size: 14px;
  font-weight: bold;
  color: var(--accent-color);
  margin-right: 10px;
  min-width: 20px;
}

.option-text {
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-primary);
  flex: 1;
}

.answer-section {
  margin-bottom: 20px;
}

.answer-input {
  width: 100%;
  height: 120px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px;
  box-sizing: border-box;
  font-size: 14px;
  margin-bottom: 15px;
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.selected-option {
  display: flex;
  align-items: flex-start;
  padding: 12px;
  border: 1px solid var(--accent-color);
  border-radius: 8px;
  background: rgba(102, 126, 234, 0.18);
  margin-bottom: 15px;
}

.submit-btn {
  width: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 25px;
  height: 45px;
  line-height: 45px;
  font-size: 16px;
}

.submit-btn[disabled] {
  opacity: 0.6;
}

.reference-notice {
  background: rgba(102, 126, 234, 0.12);
  border: 1px solid rgba(102, 126, 234, 0.35);
  border-radius: 10px;
  padding: 10px 12px;
  margin-top: 10px;
}

.reference-notice-text {
  font-size: 13px;
  color: var(--text-primary);
}

.result-icon.neutral {
  opacity: 0.8;
}

.login-notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255, 193, 7, 0.16);
  border: 1px solid rgba(255, 193, 7, 0.45);
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 12px;
}

.login-notice-text {
  flex: 1;
  font-size: 13px;
  color: var(--text-primary);
  margin-right: 10px;
}

.login-notice-action {
  flex-shrink: 0;
  font-size: 13px;
  color: #b8860b;
  text-decoration: underline;
}

.analysis-container {
  margin-top: 20px;
  padding: 20px;
  background: var(--math-bg);
  border-radius: 10px;
  border-left: 4px solid var(--accent-color);
}

.analysis-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.analysis-title {
  font-size: 16px;
  font-weight: bold;
  color: var(--text-primary);
}

.result-icon {
  font-size: 24px;
}

.result-icon.correct {
  color: #4caf50;
}

.result-icon.incorrect {
  color: #f44336;
}

.analysis-content {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.correct-answer {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.user-answer-display {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.answer-label {
  font-size: 12px;
  font-weight: bold;
  letter-spacing: 0.5px;
  color: var(--text-secondary);
}

.answer-value {
  font-size: 15px;
  line-height: 1.6;
  color: var(--text-primary);
  padding: 10px 14px;
  border-radius: 8px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  overflow-x: auto;
}

.answer-value.ok {
  border-color: #4caf50;
}

.answer-value.bad {
  border-color: #f44336;
}
.answer-label {
  font-size: 14px;
  font-weight: bold;
  color: var(--text-primary);
  min-width: 80px;
}

.answer-value {
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-primary);
  flex: 1;
}

.solution-steps {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.steps-title {
  font-size: 14px;
  font-weight: bold;
  color: var(--text-primary);
}

.step-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.step-index {
  flex: 0 0 22px;
  width: 22px;
  height: 22px;
  line-height: 22px;
  text-align: center;
  border-radius: 50%;
  font-size: 12px;
  font-weight: bold;
  color: #fff;
  background: var(--accent-color);
  margin-top: 1px;
}

.step-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.step-title {
  font-size: 13px;
  font-weight: bold;
  color: var(--text-primary);
}

.knowledge-points {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.knowledge-title {
  font-size: 14px;
  font-weight: bold;
  color: var(--text-primary);
}

.knowledge-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.knowledge-tag {
  font-size: 12px;
  padding: 4px 12px;
  border-radius: 12px;
  background: rgba(102, 126, 234, 0.18);
  color: var(--accent-color);
}

.action-buttons {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.action-btn {
  flex: 1;
  height: 40px;
  line-height: 40px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: bold;
}

.action-btn.next {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.action-btn.ai {
  background: var(--bg-card);
  color: var(--accent-color);
  border: 1px solid var(--accent-color);
}
</style>