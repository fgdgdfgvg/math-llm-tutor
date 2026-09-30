<template>
  <view class="solution-steps">
    <view class="solution-header">
      <text class="solution-title">解题步骤</text>
      <text class="solution-method" v-if="solution?.method">方法: {{ methodLabel }}</text>
    </view>

    <view class="steps-container" v-if="solution?.steps && solution.steps.length > 0">
      <view 
        v-for="(step, index) in solution.steps" 
        :key="index"
        class="step-item"
        :class="{ 'step-current': currentStep === index }"
      >
        <view class="step-header" @click.stop="toggleStep(index)">
          <view class="step-number">{{ step.order || index + 1 }}</view>
          <text class="step-description">{{ step.description }}</text>
          <view class="step-toggle">
            <text>{{ expandedSteps.includes(index) ? '▼' : '▶' }}</text>
          </view>
        </view>

        <view v-if="expandedSteps.includes(index)" class="step-content">
          <view class="step-expression" v-if="step.expression">
            <FormulaRenderer :latex="step.expression" />
          </view>
          
          <view class="step-latex" v-if="step.latex">
            <FormulaRenderer :latex="step.latex" :displayMode="true" />
          </view>
          
          <view class="step-explanation" v-if="step.explanation">
            <text class="explanation-label">说明:</text>
            <text class="explanation-text">{{ step.explanation }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="empty-state" v-else>
      <text class="empty-text">暂无解题步骤</text>
    </view>

    <view class="final-answer" v-if="solution?.finalAnswer">
      <text class="answer-label">最终答案:</text>
      <view class="answer-content">
        <FormulaRenderer :latex="solution.finalAnswer" :displayMode="true" />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import FormulaRenderer from './FormulaRenderer.vue';

interface SolutionStep {
  order?: number;
  description: string;
  expression?: string;
  latex?: string;
  explanation?: string;
}

interface Solution {
  steps: SolutionStep[];
  finalAnswer: string;
  method?: string;
  latex?: string;
}

const props = defineProps<{
  solution: Solution | null;
  currentStep?: number;
}>();

const expandedSteps = ref<number[]>([0]);

const methodLabel = computed(() => {
  const methods: Record<string, string> = {
    'symbolic': '符号计算',
    'ai': 'AI求解',
    'hybrid': '混合求解',
  };
  return methods[props.solution?.method || ''] || props.solution?.method || '未知';
});

const toggleStep = (index: number) => {
  const idx = expandedSteps.value.indexOf(index);
  if (idx > -1) {
    expandedSteps.value.splice(idx, 1);
  } else {
    expandedSteps.value.push(index);
  }
};
</script>

<style scoped>
.solution-steps {
  background: var(--bg-card);
  border-radius: 12px;
  padding: 16px;
  margin: 10px 0;
}

.solution-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
}

.solution-title {
  font-size: 18px;
  font-weight: bold;
  color: var(--text-primary);
}

.solution-method {
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  padding: 4px 8px;
  border-radius: 4px;
}

.steps-container {
  margin-bottom: 16px;
}

.step-item {
  margin-bottom: 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.3s;
}

.step-item.step-current {
  border-color: var(--accent-color);
  box-shadow: 0 2px 8px var(--shadow-color);
}

.step-header {
  display: flex;
  align-items: center;
  padding: 12px;
  background: var(--bg-secondary);
  cursor: pointer;
}

.step-number {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--accent-gradient);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: bold;
  margin-right: 12px;
  flex-shrink: 0;
}

.step-description {
  flex: 1;
  font-size: 15px;
  color: var(--text-primary);
}

.step-toggle {
  color: var(--text-muted);
  font-size: 12px;
}

.step-content {
  padding: 16px;
  background: var(--bg-card);
  border-top: 1px solid var(--border-color);
}

.step-expression {
  padding: 12px;
  background: var(--math-bg);
  border-radius: 6px;
  margin-bottom: 12px;
}

.step-latex {
  padding: 12px;
  background: #fff3e0;
  border-radius: 6px;
  margin-bottom: 12px;
  text-align: center;
}

.step-explanation {
  padding: 10px;
  background: #e3f2fd;
  border-radius: 6px;
  border-left: 3px solid var(--accent-color);
}

.explanation-label {
  font-size: 12px;
  color: var(--accent-color);
  font-weight: bold;
  margin-right: 8px;
}

.explanation-text {
  font-size: 14px;
  color: var(--text-primary);
}

.empty-state {
  padding: 30px;
  text-align: center;
}

.empty-text {
  color: var(--text-muted);
  font-size: 14px;
}

.final-answer {
  padding: 16px;
  background: var(--accent-gradient);
  border-radius: 8px;
  color: white;
}

.answer-label {
  font-size: 14px;
  opacity: 0.9;
  margin-bottom: 8px;
  display: block;
}

.answer-content {
  padding: 12px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 6px;
}
</style>
