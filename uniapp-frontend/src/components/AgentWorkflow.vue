<template>
  <view class="agent-workflow">
    <view class="workflow-header">
      <text class="workflow-title">🤖 智能体工作流</text>
      <text class="workflow-status" :class="getStatusClass(status)">
        {{ getStatusText(status) }}
      </text>
    </view>

    <view class="workflow-steps">
      <!-- 规划智能体 -->
      <view class="workflow-step" :class="getStepClass('planner')">
        <view class="step-icon">
          <text v-if="steps.planner.status === 'completed'">✅</text>
          <text v-else-if="steps.planner.status === 'in_progress'" class="spinning">🔄</text>
          <text v-else>📋</text>
        </view>
        <view class="step-content">
          <view class="step-header-row">
            <text class="step-title">规划智能体 (Planner)</text>
            <text v-if="steps.planner.duration" class="step-duration">{{ steps.planner.duration }}ms</text>
          </view>
          <text class="step-description">分析题目类型，提取关键条件，制定解题步骤</text>
          <view class="step-status-badge" :class="'badge-' + steps.planner.status">
            {{ getStepStatusText(steps.planner.status) }}
          </view>

          <!-- 详细结果展示 -->
          <view class="step-detail-card" v-if="steps.planner.result && steps.planner.status === 'completed'">
            <view class="detail-summary">
              <text class="detail-icon">📊</text>
              <text class="detail-text">{{ steps.planner.result.summary }}</text>
            </view>
            <view class="detail-row" v-if="steps.planner.result.problemType">
              <text class="detail-label">题目类型:</text>
              <text class="detail-value type-tag">{{ steps.planner.result.problemType }}</text>
            </view>
            <view class="detail-row" v-if="steps.planner.result.keyConditions?.length">
              <text class="detail-label">关键条件:</text>
              <view class="condition-tags">
                <text class="cond-tag" v-for="(cond, idx) in steps.planner.result.keyConditions.slice(0, 3)" :key="idx">{{ cond }}</text>
              </view>
            </view>
            <view class="detail-plan" v-if="steps.planner.result.planOverview">
              <text class="detail-label">执行计划:</text>
              <text class="plan-text">{{ steps.planner.result.planOverview }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 求解智能体 -->
      <view class="workflow-step" :class="getStepClass('solver')">
        <view class="step-icon">
          <text v-if="steps.solver.status === 'completed'">✅</text>
          <text v-else-if="steps.solver.status === 'in_progress'" class="spinning">🔄</text>
          <text v-else>🧮</text>
        </view>
        <view class="step-content">
          <view class="step-header-row">
            <text class="step-title">求解智能体 (Solver)</text>
            <text v-if="steps.solver.duration" class="step-duration">{{ steps.solver.duration }}ms</text>
          </view>
          <text class="step-description">执行解题步骤，调用SymPy或LLM生成解题过程</text>
          <view class="step-status-badge" :class="'badge-' + steps.solver.status">
            {{ getStepStatusText(steps.solver.status) }}
          </view>

          <view class="step-detail-card" v-if="steps.solver.result && steps.solver.status === 'completed'">
            <view class="detail-summary">
              <text class="detail-icon">🧮</text>
              <text class="detail-text">{{ steps.solver.result.summary }}</text>
            </view>
            <view class="detail-stats-inline">
              <view class="inline-stat">
                <text class="stat-num">{{ steps.solver.result.stepCount }}</text>
                <text class="stat-unit">个步骤</text>
              </view>
              <view class="inline-stat">
                <text class="stat-desc">{{ steps.solver.result.approach || 'AI推理求解' }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- 诊断智能体 -->
      <view class="workflow-step" :class="getStepClass('diagnostic')">
        <view class="step-icon">
          <text v-if="steps.diagnostic.status === 'completed'">✅</text>
          <text v-else-if="steps.diagnostic.status === 'in_progress'" class="spinning">🔄</text>
          <text v-else>🔍</text>
        </view>
        <view class="step-content">
          <view class="step-header-row">
            <text class="step-title">诊断智能体 (Diagnostic)</text>
            <text v-if="steps.diagnostic.duration" class="step-duration">{{ steps.diagnostic.duration }}ms</text>
          </view>
          <text class="step-description">验证解题步骤的正确性和完整性</text>
          <view class="step-status-badge" :class="'badge-' + steps.diagnostic.status">
            {{ getStepStatusText(steps.diagnostic.status) }}
          </view>

          <view class="step-detail-card" v-if="steps.diagnostic.result && steps.diagnostic.status === 'completed'">
            <view class="detail-summary">
              <text class="detail-icon">🔍</text>
              <text class="detail-text">{{ steps.diagnostic.result.summary }}</text>
            </view>
            <view class="verification-bar">
              <view class="verify-progress" :style="{ width: (steps.diagnostic.result.passedSteps / Math.max(steps.diagnostic.result.totalSteps, 1) * 100) + '%' }"></view>
              <text class="verify-text">{{ steps.diagnostic.result.passedSteps }}/{{ steps.diagnostic.result.totalSteps }} 项通过</text>
            </view>
            <view class="confidence-display">
              <text class="conf-label">置信度:</text>
              <text class="conf-value" :class="getConfidenceClass(steps.diagnostic.result.confidence)">
                {{ Math.round(steps.diagnostic.result.confidence * 100) }}%
              </text>
            </view>
          </view>
        </view>
      </view>

      <!-- 反馈智能体 -->
      <view class="workflow-step" :class="getStepClass('feedback')">
        <view class="step-icon">
          <text v-if="steps.feedback.status === 'completed'">✅</text>
          <text v-else-if="steps.feedback.status === 'in_progress'" class="spinning">🔄</text>
          <text v-else>📝</text>
        </view>
        <view class="step-content">
          <view class="step-header-row">
            <text class="step-title">反馈智能体 (Feedback)</text>
            <text v-if="steps.feedback.duration" class="step-duration">{{ steps.feedback.duration }}ms</text>
          </view>
          <text class="step-description">对解题结果进行评估和生成优化建议</text>
          <view class="step-status-badge" :class="'badge-' + steps.feedback.status">
            {{ getStepStatusText(steps.feedback.status) }}
          </view>

          <view class="step-detail-card" v-if="steps.feedback.result && steps.feedback.status === 'completed'">
            <view class="detail-summary">
              <text class="detail-icon">📝</text>
              <text class="detail-text">{{ steps.feedback.result.summary }}</text>
            </view>
            <view class="rating-badge" :class="'rating-' + steps.feedback.result.rating">
              {{ getRatingText(steps.feedback.result.rating) }}
            </view>
            <view class="suggestions-list" v-if="steps.feedback.result.keySuggestions?.length">
              <text class="suggest-label">💡 核心建议:</text>
              <text class="suggest-item" v-for="(sug, idx) in steps.feedback.result.keySuggestions" :key="idx">• {{ sug }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view class="workflow-summary" v-if="status === 'completed'">
      <text class="summary-title">📊 工作流总结</text>
      <view class="summary-stats">
        <view class="stat-item">
          <text class="stat-label">总耗时</text>
          <text class="stat-value">{{ formatDuration(totalDuration) }}</text>
        </view>
        <view class="stat-item">
          <text class="stat-label">智能体</text>
          <text class="stat-value">{{ completedCount }}/{{ totalCount }}</text>
        </view>
        <view class="stat-item">
          <text class="stat-label">状态</text>
          <text class="stat-value" :class="overallStatusClass">{{ overallStatusText }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface StepStatus {
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: {
    summary: string;
    problemType?: string;
    keyConditions?: string[];
    planOverview?: string;
    stepCount?: number;
    approach?: string;
    passedSteps?: number;
    totalSteps?: number;
    confidence?: number;
    rating?: string;
    keySuggestions?: string[];
    [key: string]: any;
  };
  duration?: number;
}

interface WorkflowSteps {
  planner: StepStatus;
  solver: StepStatus;
  diagnostic: StepStatus;
  feedback: StepStatus;
}

const props = defineProps({
  status: {
    type: String as () => 'idle' | 'running' | 'completed' | 'failed',
    default: 'idle',
  },
  steps: {
    type: Object as () => WorkflowSteps,
    default: () => ({
      planner: { status: 'pending' },
      solver: { status: 'pending' },
      diagnostic: { status: 'pending' },
      feedback: { status: 'pending' },
    }),
  },
  totalDuration: {
    type: Number,
    default: 0,
  },
});

const getStatusClass = (status: string) => {
  switch (status) {
    case 'running': return 'status-running';
    case 'completed': return 'status-completed';
    case 'failed': return 'status-failed';
    default: return 'status-idle';
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case 'running': return '运行中...';
    case 'completed': return '已完成 ✨';
    case 'failed': return '失败 ❌';
    default: return '就绪';
  }
};

const getStepClass = (step: string) => {
  const stepStatus = props.steps[step as keyof WorkflowSteps];
  return `step-${stepStatus.status}`;
};

const getStepStatusText = (status: string) => {
  switch (status) {
    case 'in_progress': return '⚡ 执行中';
    case 'completed': return '✅ 已完成';
    case 'failed': return '❌ 失败';
    default: return '⏳ 等待中';
  }
};

const getRatingText = (rating: string) => {
  const map: Record<string, string> = {
    excellent: '优秀 ⭐⭐⭐⭐⭐',
    good: '良好 ⭐⭐⭐⭐',
    average: '一般 ⭐⭐⭐',
    poor: '较差 ⭐⭐',
  };
  return map[rating] || '未评级';
};

const getConfidenceClass = (confidence: number) => {
  if (confidence >= 0.9) return 'conf-high';
  if (confidence >= 0.7) return 'conf-mid';
  return 'conf-low';
};

const formatDuration = (ms: number) => {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

const completedCount = computed(() => {
  return Object.values(props.steps).filter(s => s.status === 'completed').length;
});

const totalCount = computed(() => Object.values(props.steps).length);

const successRate = computed(() => {
  return Math.round((completedCount.value / totalCount.value) * 100);
});

const overallStatusClass = computed(() => {
  if (props.status === 'failed') return 'stat-failed';
  if (successRate.value === 100) return 'stat-success';
  return 'stat-partial';
});

const overallStatusText = computed(() => {
  if (props.status === 'failed') return '异常';
  if (successRate.value === 100) return '全部成功';
  return `${successRate.value}%`;
});
</script>

<style scoped>
/* 卡片底色与文字颜色跟随主题，否则深色模式下会出现一块白底卡片 */
.agent-workflow {
  background-color: var(--bg-card);
  color: var(--text-primary);
  border-radius: 12px;
  padding: 16px;
  margin: 16px 0;
  box-shadow: 0 2px 12px rgba(102, 126, 234, 0.08);
}

.workflow-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 2px solid var(--border-color);
}

.workflow-title {
  font-size: 17px;
  font-weight: bold;
  color: var(--text-primary);
}

.workflow-status {
  font-size: 13px;
  padding: 4px 14px;
  border-radius: 20px;
  font-weight: 600;
}

/* 状态标签用半透明底色，深浅模式下都保持可读 */
.status-idle { background: rgba(33, 150, 243, 0.16); color: #2196f3; }
.status-running { background: rgba(255, 152, 0, 0.18); color: #f57c00; animation: pulse 1.5s infinite; }
.status-completed { background: rgba(76, 175, 80, 0.16); color: #4caf50; }
.status-failed { background: rgba(244, 67, 54, 0.16); color: #f44336; }

.theme-dark .status-running { color: #ffb74d; }
.theme-dark .status-completed { color: #66bb6a; }
.theme-dark .status-failed { color: #ef5350; }
.theme-dark .status-idle { color: #64b5f6; }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.workflow-steps {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.workflow-step {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px;
  border-radius: 10px;
  background: var(--bg-secondary);
  transition: all 0.3s ease;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
}

.step-pending { border-left: 4px solid #bdbdbd; }
.step-in_progress {
  border-left: 4px solid #ff9800;
  background: linear-gradient(135deg, #fff8e1 0%, white 100%);
}
.step-completed {
  border-left: 4px solid #4caf50;
  background: linear-gradient(135deg, #f1f8e9 0%, white 100%);
}
.step-failed { border-left: 4px solid #f44336; background: #ffebee; }

.step-icon { font-size: 24px; margin-top: 1px; }

.spinning { display: inline-block; animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

.step-content { flex: 1; min-width: 0; }

.step-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2px;
}

.step-title {
  font-size: 15px;
  font-weight: bold;
  color: var(--text-primary);
}

.step-duration {
  font-size: 11px;
  color: var(--text-muted);
  background: var(--bg-card);
  padding: 2px 8px;
  border-radius: 10px;
}

.step-description {
  font-size: 12px;
  color: #888;
  margin-bottom: 8px;
  line-height: 1.4;
}

.step-status-badge {
  display: inline-block;
  font-size: 11px;
  padding: 2px 10px;
  border-radius: 10px;
  margin-bottom: 10px;
  font-weight: 500;
}

.badge-pending { background: #f5f5f5; color: #999; }
.badge-in_progress { background: #fff3e0; color: #f57c00; }
.badge-completed { background: #e8f5e9; color: #388e3c; }
.badge-failed { background: #ffebee; color: #d32f2f; }

/* 详细结果卡片 */
.step-detail-card {
  margin-top: 8px;
  padding: 12px;
  background: var(--bg-card);
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.detail-summary {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
}

.detail-icon { font-size: 16px; }

.detail-text {
  font-size: 13px;
  font-weight: 600;
  color: #444;
  line-height: 1.4;
}

.detail-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}

.detail-label {
  font-size: 12px;
  color: var(--text-muted);
  min-width: 56px;
}

.detail-value {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.type-tag {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 11px;
}

.condition-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.cond-tag {
  background: rgba(102, 126, 234, 0.16);
  color: #667eea;
  padding: 2px 8px;
  border-radius: 8px;
  font-size: 11px;
}

.detail-plan {
  margin-top: 6px;
  padding-top: 8px;
  border-top: 1px dashed #e0e0e0;
}

.plan-text {
  font-size: 12px;
  color: #555;
  line-height: 1.5;
  word-break: break-all;
}

/* 求解智能体内联统计 */
.detail-stats-inline {
  display: flex;
  gap: 16px;
  margin-top: 8px;
}

.inline-stat {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.stat-num {
  font-size: 22px;
  font-weight: bold;
  color: #667eea;
}

.stat-unit {
  font-size: 12px;
  color: var(--text-muted);
}

.stat-desc {
  display: block;
  font-size: 12px;
  color: var(--text-secondary);
  max-width: 180px;
}

/* 诊断智能体验证条 */
.verification-bar {
  position: relative;
  height: 24px;
  background: var(--bg-card);
  border-radius: 12px;
  overflow: hidden;
  margin-top: 8px;
}

.verify-progress {
  height: 100%;
  background: linear-gradient(90deg, #4caf50, #8bc34a);
  border-radius: 12px;
  transition: width 0.5s ease;
  min-width: 20%;
}

.verify-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 11px;
  font-weight: bold;
  color: white;
  text-shadow: 0 1px 2px rgba(0,0,0,0.3);
}

.confidence-display {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
}

.conf-label { font-size: 12px; color: #888; }

.conf-value {
  font-size: 15px;
  font-weight: bold;
}

.conf-high { color: #4caf50; }
.conf-mid { color: #ff9800; }
.conf-low { color: #f44336; }

/* 反馈评分 */
.rating-badge {
  display: inline-block;
  font-size: 12px;
  font-weight: bold;
  padding: 4px 12px;
  border-radius: 12px;
  margin-bottom: 8px;
}

.rating-excellent { background: #e8f5e9; color: #2e7d32; }
.rating-good { background: #fff8e1; color: #f57c00; }
.rating-average { background: #fce4ec; color: #c2185b; }
.rating-poor { background: #ffebee; color: #d32f2f; }

.suggestions-list { margin-top: 6px; }

.suggest-label {
  font-size: 12px;
  font-weight: 600;
  color: #667eea;
  display: block;
  margin-bottom: 4px;
}

.suggest-item {
  display: block;
  font-size: 12px;
  color: #555;
  line-height: 1.6;
  padding-left: 4px;
}

/* 总结区域 */
.workflow-summary {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 2px solid #e8eaff;
}

.summary-title {
  display: block;
  font-size: 15px;
  font-weight: bold;
  color: var(--text-primary);
  margin-bottom: 12px;
}

.summary-stats {
  display: flex;
  justify-content: space-around;
  flex-wrap: wrap;
  gap: 10px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 18px;
  background: var(--bg-secondary);
  border-radius: 10px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  min-width: 90px;
}

.stat-label { display: block; font-size: 12px; color: var(--text-muted); margin-bottom: 4px; }

.stat-value {
  display: block;
  font-size: 17px;
  font-weight: bold;
  color: var(--text-primary);
}

.stat-success { color: #4caf50; }
.stat-partial { color: #ff9800; }
.stat-failed { color: #f44336; }

@media (max-width: 768px) {
  .workflow-step { padding: 10px; }
  .step-title { font-size: 14px; }
  .step-description { font-size: 11px; }
  .detail-stats-inline { flex-direction: column; gap: 6px; }
}
</style>
