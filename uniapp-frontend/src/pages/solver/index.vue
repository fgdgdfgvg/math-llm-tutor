<template>
  <view class="solver-container">
    <view class="title">AI 数学解题</view>
    
    <textarea
      class="problem-input"
      v-model="prompt"
      placeholder="请在此输入您遇到的数学问题，例如：求 lim(x→0) sin(x)/x 的极限"
    />

    <view class="input-tools">
      <button class="tool-btn" @click="switchInputMode('text')" :class="{ 'active': inputMode === 'text' }">
        📝 文本输入
      </button>
      <button class="tool-btn" @click="switchInputMode('handwrite')" :class="{ 'active': inputMode === 'handwrite' }">
        ✏️ 手写输入
      </button>
      <button class="tool-btn" @click="switchInputMode('image')" :class="{ 'active': inputMode === 'image' }">
        📷 图片上传
      </button>
      <button class="tool-btn" @click="toggleVoiceInput" :class="{ 'recording': isRecording }">
        {{ isRecording ? '⏹️ 停止录音' : '🎤 语音输入' }}
      </button>
    </view>

    <view class="mode-selector">
      <text class="selector-label">解题模式：</text>
      <radio-group @change="modeChange">
        <label class="radio-label">
          <radio value="agent" checked="true" /> 智能体模式
        </label>
        <label class="radio-label">
          <radio value="ai" /> AI 模式
        </label>
      </radio-group>
    </view>

    <!-- 智能体工作流可视化 -->
    <AgentWorkflow
      v-if="solveMode === 'agent'"
      :status="workflowStatus"
      :steps="workflowSteps"
      :total-duration="workflowDuration"
    />


    <view class="mode-tips">
      <text class="tip-title">💡 模式说明：</text>
      <text class="tip-content" v-if="solveMode === 'agent'">
        【SymPy符号计算引擎】精确求解极限、导数、积分、方程等标准数学问题。特点：结果100%准确，支持符号运算，但仅适用于标准数学问题格式。
      </text>
      <text class="tip-content" v-else>
        【大语言模型】适用于复杂问题、证明题、应用题、几何问题等。特点：理解自然语言，解答详细，但可能存在计算误差。
      </text>
    </view>
    
    <view class="model-selector" v-if="solveMode === 'ai'">
      <text class="selector-label">AI 模型：</text>
      <radio-group @change="modelChange">
        <label class="radio-label">
          <radio value="DeepSeek" checked="true" /> DeepSeek
        </label>
        <label class="radio-label">
          <radio value="KatCoder" /> KatCoder
        </label>
      </radio-group>
    </view>
    
    <button class="submit-btn" @click="handleSubmit()" :disabled="loading">
      {{ loading ? '思考中...' : '提交问题' }}
    </button>

    <view class="service-status">
      <text class="status-item" :class="sympyStatus ? 'status-ok' : 'status-error'">
        SymPy: {{ sympyStatus ? '正常' : '离线' }}
      </text>
      <text class="status-item" :class="knowledgeStatus ? 'status-ok' : 'status-error'">
        知识图谱: {{ knowledgeStatus ? '正常' : '离线' }}
      </text>
    </view>

    <!-- 模块一：知识点分析 -->
    <view class="result-container" v-if="showModule1">
      <view class="result-header">
        <text class="result-title">📚 知识点分析</text>
        <text class="result-status" v-if="isThinking">分析中...</text>
      </view>
      
      <view v-if="visibleKnowledgePoints.length > 0" class="knowledge-section">
        <text class="section-title">📚 涉及知识点</text>
        <view class="knowledge-list">
          <view v-for="(kp, index) in visibleKnowledgePoints" :key="index" class="knowledge-item fade-in">
            <view class="knowledge-icon">{{ getKnowledgeIcon(kp.type) }}</view>
            <view class="knowledge-info">
              <text class="knowledge-name">{{ kp.name }}</text>
              <text class="knowledge-desc">{{ kp.description }}</text>
            </view>
          </view>
        </view>
      </view>
      
      <view v-if="visibleMistakes.length > 0" class="mistakes-section">
        <text class="section-title">⚠️ 常见易错点</text>
        <view class="mistakes-list">
          <view v-for="(mistake, index) in visibleMistakes" :key="index" class="mistake-item fade-in">
            <view class="mistake-icon">💡</view>
            <text class="mistake-text">{{ mistake.tip || mistake.mistake }}</text>
          </view>
        </view>
      </view>
      
      <view v-if="visibleKnowledgePoints.length === 0 && visibleMistakes.length === 0 && !isThinking" class="empty-section">
        <text class="empty-text">暂无相关知识点数据</text>
        <text class="empty-hint">提示：尝试输入"极限"、"导数"、"积分"等关键词</text>
      </view>
    </view>

    <!-- 模块二：AI回答 -->
    <view class="result-container" v-if="showModule2">
      <view class="result-header">
        <text class="result-title">🤖 {{ solveMode === 'agent' ? '智能体解答' : 'AI 回答' }}</text>
        <text class="result-status" v-if="isTyping">正在输出...</text>
      </view>
      
      <!-- 解题步骤 -->
      <view v-if="solutionSteps.length > 0" class="solution-section">
        <text class="section-title">📝 解题步骤</text>
        <view class="steps-container">
          <view v-for="(step, index) in visibleSteps" :key="index" class="step-item fade-in">
            <view class="step-header">
              <view class="step-number">{{ step.order }}</view>
              <text v-if="step.description" class="step-description">{{ step.description }}</text>
            </view>
            <view class="step-content">
              <!-- 步骤公式居中展示；说明文本也交给 MathRenderer，
                   否则 $...$ 会被当成普通字符直接显示出来 -->
              <view class="step-expression" v-if="step.expression && step.expression !== step.explanation">
                <MathRenderer :content="step.expression" :display="true" />
              </view>
              <view class="step-explanation" v-if="step.explanation">
                <MathRenderer :content="step.explanation" />
              </view>
            </view>
          </view>
        </view>
        
        <view v-if="visibleSteps.length < solutionSteps.length" class="loading-more">
          <text class="loading-dots">●●●</text>
          <text class="loading-text">正在分析中...</text>
        </view>
        
        <view v-if="visibleSteps.length === solutionSteps.length && finalAnswer" class="final-answer fade-in">
          <text class="answer-label">最终答案</text>
          <view class="final-answer-container">
            <MathRenderer :content="formatAnswerText(finalAnswer)" :display="true" class="answer-value" />
          </view>
        </view>
      </view>
      
      <!-- AI文本回答 -->
      <view v-if="aiTextContent || isTyping" class="ai-content">
        <view v-if="isTyping">{{ typingDisplayText }}</view>
        <MathRenderer v-else :content="aiTextContent" />
        <text v-if="isTyping" class="typing-cursor">|</text>
      </view>
    </view>

    <!-- 模块三：错误诊断 -->
    <view class="result-container" v-if="showDiagnosis">
      <view class="result-header">
        <text class="result-title">🔍 错误诊断</text>
      </view>
      
      <!-- 学生答案输入 -->
      <view class="diagnosis-input-section">
        <text class="section-title">请输入您的答案：</text>
        <textarea
          class="student-answer-input"
          v-model="studentAnswer"
          placeholder="请在此输入您的答案，系统将为您诊断错误..."
        />
        <button class="diagnosis-btn" @click="handleDiagnosis" :disabled="diagnosing">
          {{ diagnosing ? '诊断中...' : '开始诊断' }}
        </button>
      </view>
      
      <!-- 诊断结果 -->
      <view v-if="diagnosisResult" class="diagnosis-result-section">
        <view v-if="diagnosisResult.isCorrect" class="correct-result">
          <text class="correct-icon">✅</text>
          <text class="correct-text">回答正确！</text>
          <text class="encouragement">{{ diagnosisResult.encouragement || '继续保持！' }}</text>
        </view>
        
        <view v-else class="error-result">
          <view class="error-summary">
            <text class="error-icon">❌</text>
            <text class="error-type">{{ getErrorTypeLabel(diagnosisResult.errorType) }}</text>
            <text class="error-sub-type" v-if="diagnosisResult.errorSubType">
              {{ getErrorSubTypeLabel(diagnosisResult.errorSubType) }}
            </text>
          </view>
          
          <view class="error-description" v-if="diagnosisResult.errorDescription">
            <text class="desc-title">问题描述：</text>
            <text class="desc-content">{{ diagnosisResult.errorDescription }}</text>
          </view>
          
          <view class="knowledge-gaps" v-if="diagnosisResult.knowledgeGaps?.length > 0">
            <text class="gap-title">🎯 知识缺口：</text>
            <view class="gap-list">
              <text v-for="(gap, index) in diagnosisResult.knowledgeGaps" :key="index" class="gap-item">
                • {{ gap }}
              </text>
            </view>
          </view>
          
          <view class="suggestions" v-if="diagnosisResult.suggestions?.length > 0">
            <text class="suggestion-title">💡 改进建议：</text>
            <view class="suggestion-list">
              <text v-for="(suggestion, index) in diagnosisResult.suggestions" :key="index" class="suggestion-item">
                {{ index + 1 }}. {{ suggestion }}
              </text>
            </view>
          </view>
          
          <view class="metrics" v-if="diagnosisResult.metrics">
            <text class="metrics-title">📊 评估指标：</text>
            <view class="metrics-grid">
              <view class="metric-item">
                <text class="metric-label">准确度</text>
                <view class="metric-bar">
                  <view class="metric-fill" :style="{ width: (diagnosisResult.metrics.accuracy * 100) + '%' }"></view>
                </view>
                <text class="metric-value">{{ (diagnosisResult.metrics.accuracy * 100).toFixed(0) }}%</text>
              </view>
              <view class="metric-item">
                <text class="metric-label">完整度</text>
                <view class="metric-bar">
                  <view class="metric-fill" :style="{ width: (diagnosisResult.metrics.completeness * 100) + '%' }"></view>
                </view>
                <text class="metric-value">{{ (diagnosisResult.metrics.completeness * 100).toFixed(0) }}%</text>
              </view>
              <view class="metric-item">
                <text class="metric-label">概念理解</text>
                <view class="metric-bar">
                  <view class="metric-fill" :style="{ width: (diagnosisResult.metrics.conceptualUnderstanding * 100) + '%' }"></view>
                </view>
                <text class="metric-value">{{ (diagnosisResult.metrics.conceptualUnderstanding * 100).toFixed(0) }}%</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 模块四：教学反馈 -->
    <view class="result-container" v-if="showFeedback && feedback">
      <view class="result-header">
        <text class="result-title">📖 教学反馈</text>
      </view>
      
      <view class="feedback-section">
        <view class="feedback-summary">
          <text class="summary-text">{{ feedback.summary }}</text>
        </view>
        
        <view class="feedback-error-analysis" v-if="feedback.errorAnalysis">
          <text class="feedback-title">🔍 错误分析</text>
          <text class="feedback-content">{{ feedback.errorAnalysis }}</text>
        </view>
        
        <view class="feedback-concept-review" v-if="feedback.conceptReview">
          <text class="feedback-title">📚 知识点回顾</text>
          <text class="feedback-content">{{ feedback.conceptReview }}</text>
        </view>
        
        <view class="feedback-correct-approach" v-if="feedback.correctApproach">
          <text class="feedback-title">✅ 正确方法</text>
          <text class="feedback-content">{{ feedback.correctApproach }}</text>
        </view>
        
        <view class="feedback-practice" v-if="feedback.practiceSuggestions?.length > 0">
          <text class="feedback-title">🎯 练习建议</text>
          <view class="practice-list">
            <text v-for="(suggestion, index) in feedback.practiceSuggestions" :key="index" class="practice-item">
              • {{ suggestion }}
            </text>
          </view>
        </view>
        
        <view class="feedback-encouragement" v-if="feedback.encouragement">
          <text class="encouragement-text">💪 {{ feedback.encouragement }}</text>
        </view>
      </view>
    </view>
    <!-- 手写输入模态框 -->
    <HandwritingPad
      v-if="showHandwriting"
      :visible="showHandwriting"
      @update:visible="showHandwriting = $event"
      @recognized="handleRecognizedText"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
import request from '../../utils/request';
import MathRenderer from '../../components/MathRenderer.vue';
import { parseSolutionStep, formatAnswerText } from '../../utils/math-format';
import AgentWorkflow from '../../components/AgentWorkflow.vue';
import HandwritingPad from '../../components/HandwritingPad.vue';
import simpleTexService from '../../services/simpleTex.service';

interface KnowledgePoint {
  id: string;
  name: string;
  type: string;
  description: string;
  formula?: string;
}

interface CommonMistake {
  mistake: string;
  correction: string;
  tip: string;
}

interface SolutionStep {
  order: number;
  /** 步骤小标题，可能为空（为空时只显示序号徽标） */
  description: string;
  /** 该步对应的公式（可能为空） */
  expression: string;
  explanation?: string;
}

interface DiagnosisResult {
  isCorrect: boolean;
  errorType?: string;
  errorSubType?: string;
  errorDescription?: string;
  knowledgeGaps?: string[];
  suggestions?: string[];
  metrics?: {
    accuracy: number;
    completeness: number;
    efficiency: number;
    conceptualUnderstanding: number;
    proceduralFluency: number;
  };
}

interface Feedback {
  summary: string;
  errorAnalysis?: string;
  conceptReview?: string;
  correctApproach?: string;
  practiceSuggestions?: string[];
  encouragement?: string;
}

const prompt = ref('');
const solveMode = ref('agent');
const selectedModel = ref('DeepSeek');
const loading = ref(false);
const isThinking = ref(false);
const isTyping = ref(false);
const sympyStatus = ref(false);
const knowledgeStatus = ref(false);

const showModule1 = ref(false);
const showModule2 = ref(false);
const showDiagnosis = ref(false);
const showFeedback = ref(false);

const knowledgePoints = ref<KnowledgePoint[]>([]);
const commonMistakes = ref<CommonMistake[]>([]);
const visibleKnowledgePoints = ref<KnowledgePoint[]>([]);
const visibleMistakes = ref<CommonMistake[]>([]);

const solutionSteps = ref<SolutionStep[]>([]);
const visibleSteps = ref<SolutionStep[]>([]);
const finalAnswer = ref('');

const aiTextContent = ref('');
const fullAiText = ref('');        // AI返回的完整内容
const typingDisplayText = ref(''); // 打字过程中显示的纯文本
const displayedAiText = ref('');

const studentAnswer = ref('');
const diagnosing = ref(false);
const diagnosisResult = ref<DiagnosisResult | null>(null);
const feedback = ref<Feedback | null>(null);

const currentProblem = ref<any>(null);
const currentSolution = ref<any>(null);

// 智能体工作流相关
const workflowStatus = ref<'idle' | 'running' | 'completed' | 'failed'>('idle');
const workflowSteps = ref({
  planner: { status: 'pending' as const, result: null, duration: 0 },
  solver: { status: 'pending' as const, result: null, duration: 0 },
  diagnostic: { status: 'pending' as const, result: null, duration: 0 },
  feedback: { status: 'pending' as const, result: null, duration: 0 },
});
const workflowDuration = ref(0);

// 多模态输入相关
const showHandwriting = ref(false);
const isRecording = ref(false);
const inputMode = ref('text'); // 输入模式：text, handwrite, image



const getKnowledgeIcon = (type: string) => {
  const icons: Record<string, string> = {
    'Concept': '💡',
    'Theorem': '📐',
    'Formula': '📝',
    'Method': '🔧',
    'Example': '📖',
    'concept': '💡',
    'theorem': '📐',
    'formula': '📝',
    'method': '🔧',
    'example': '📖',
  };
  return icons[type] || '📌';
};

const getErrorTypeLabel = (type?: string) => {
  const labels: Record<string, string> = {
    'calculation': '计算错误',
    'conceptual': '概念理解错误',
    'procedural': '解题步骤错误',
    'notation': '符号书写错误',
    'logical': '逻辑推理错误',
    'unknown': '未知错误',
  };
  return type ? labels[type] || type : '错误';
};

const getErrorSubTypeLabel = (subType?: string) => {
  const labels: Record<string, string> = {
    'calculation_arithmetic': '算术运算错误',
    'calculation_sign': '符号错误',
    'calculation_algebraic': '代数运算错误',
    'calculation_fraction': '分数运算错误',
    'calculation_exponent': '指数运算错误',
    'conceptual_definition': '概念定义理解错误',
    'conceptual_theorem': '定理应用错误',
    'conceptual_formula': '公式应用错误',
    'conceptual_condition': '条件判断错误',
    'conceptual_scope': '适用范围理解错误',
    'procedural_step_missing': '遗漏关键步骤',
    'procedural_step_order': '步骤顺序错误',
    'procedural_method_wrong': '方法选择错误',
    'procedural_incomplete': '解题不完整',
    'notation_symbol': '数学符号使用错误',
    'notation_parenthesis': '括号使用错误',
    'notation_variable': '变量命名不一致',
    'notation_format': '格式书写不规范',
    'logical_premise': '前提条件错误',
    'logical_inference': '推理过程错误',
    'logical_conclusion': '结论推导错误',
    'logical_circular': '循环论证',
  };
  return subType ? labels[subType] || subType : '';
};

const modeChange = (e: any) => {
  solveMode.value = e.detail.value;
  resetAll();
};

const modelChange = (e: any) => {
  selectedModel.value = e.detail.value;
};

const resetAll = () => {
  showModule1.value = false;
  showModule2.value = false;
  showDiagnosis.value = false;
  showFeedback.value = false;
  knowledgePoints.value = [];
  commonMistakes.value = [];
  visibleKnowledgePoints.value = [];
  visibleMistakes.value = [];
  solutionSteps.value = [];
  visibleSteps.value = [];
  finalAnswer.value = '';
  aiTextContent.value = '';
  displayedAiText.value = '';
  studentAnswer.value = '';
  diagnosisResult.value = null;
  feedback.value = null;
  // 重置工作流状态
  workflowStatus.value = 'idle';
  workflowSteps.value = {
    planner: { status: 'pending', result: null, duration: 0 },
    solver: { status: 'pending', result: null, duration: 0 },
    diagnostic: { status: 'pending', result: null, duration: 0 },
    feedback: { status: 'pending', result: null, duration: 0 },
  };
  workflowDuration.value = 0;
};

const checkServices = async () => {
  try {
    const healthRes = await request({
      url: '/health',
      method: 'GET',
    });
    sympyStatus.value = healthRes?.services?.sympy?.status === 'healthy';
    knowledgeStatus.value = healthRes?.services?.neo4j?.status !== 'unhealthy';
  } catch (e) {
    sympyStatus.value = false;
    knowledgeStatus.value = false;
  }
};

const showKnowledgeGradually = async () => {
  showModule1.value = true;
  
  for (let i = 0; i < knowledgePoints.value.length; i++) {
    await new Promise(resolve => setTimeout(resolve, 300));
    visibleKnowledgePoints.value.push(knowledgePoints.value[i]);
  }
  
  for (let i = 0; i < commonMistakes.value.length; i++) {
    await new Promise(resolve => setTimeout(resolve, 200));
    visibleMistakes.value.push(commonMistakes.value[i]);
  }
};

const showStepsGradually = async () => {
  showModule2.value = true;
  
  for (let i = 0; i < solutionSteps.value.length; i++) {
    await new Promise(resolve => setTimeout(resolve, 600));
    visibleSteps.value.push(solutionSteps.value[i]);
  }
};

const typeAiText = async (fullText: string) => {
  showModule2.value = true;
  fullAiText.value = fullText;
  typingDisplayText.value = '';
  isTyping.value = true;
  
  let currentText = '';
  const chars = fullText.split('');
  
  for (let i = 0; i < chars.length; i++) {
    currentText += chars[i];
    
    // 检测公式闭合情况
    const hasOpenInlineFormula = (currentText.match(/\$/g) || []).length % 2 !== 0;
    const hasOpenBlockFormula = (currentText.match(/\$\$/g) || []).length % 2 !== 0;
    
    if (hasOpenInlineFormula || hasOpenBlockFormula) {
      // 有未闭合的公式，显示纯文本（包括LaTeX源码）
      typingDisplayText.value = currentText;
    } else {
      // 公式已闭合或没有公式，显示纯文本
      typingDisplayText.value = currentText;
    }
    
    await new Promise(resolve => setTimeout(resolve, 15));
  }
  
  isTyping.value = false;
  // 打字完成后，将完整内容赋值给最终渲染变量
  aiTextContent.value = fullText;
};

// 从API响应更新工作流状态（真实数据驱动）
const updateWorkflowFromResponse = async (response: any) => {
  const details = response.agentDetails;
  const history = response.executionHistory || [];

  // 按执行顺序依次更新每个智能体（带动画效果）
  for (const exec of history) {
    const agentName = exec.agentName as keyof typeof workflowSteps.value;
    if (!workflowSteps.value[agentName]) continue;

    workflowSteps.value[agentName].status = 'in_progress';
    await new Promise(resolve => setTimeout(resolve, 400));

    workflowSteps.value[agentName].status = 'completed';
    workflowSteps.value[agentName].duration = exec.duration || 0;
    workflowSteps.value[agentName].result = details?.[agentName] || null;
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  workflowStatus.value = 'completed';
};

// 解析结构化步骤（支持JSON格式和纯文本格式）
const parseStructuredSteps = (rawSteps: string[]): SolutionStep[] => {
  return rawSteps.map((step, index) => {
    // 默认：按“步骤1：标题。正文”拆出序号与标题，避免序号徽标旁边又出现一遍“步骤 1”
    const plain = parseSolutionStep(step, index + 1);
    let parsed: SolutionStep = {
      order: plain.index,
      description: plain.title,
      expression: '',
      explanation: plain.body || step,
    };

    try {
      if (step.trim().startsWith('{')) {
        const jsonMatch = step.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const structured = JSON.parse(jsonMatch[0]);
          // 后端步骤字段：step / description / formula / result / keyPoint / highlight / isValid
          const title = structured.stepTitle || structured.description || structured.title || `步骤 ${index + 1}`;
          const formula = structured.formula || '';
          const result = structured.result || '';
          const process = structured.process || structured.explanation || '';
          const keyPoint = structured.keyPoint ? `【${structured.keyPoint}】\n` : '';
          const resultLine = result ? `\n结果：${result}` : '';
          const highlight = structured.highlight ? `\n⚠️ ${structured.highlight}` : '';
          parsed = {
            order: index + 1,
            description: title,
            expression: formula && formula !== result ? formula : (result || formula),
            explanation: `${keyPoint}${process}${resultLine}${highlight}`.trim() || step,
          };
        }
      } else if (step.includes('：') || step.includes(':')) {
        // 形如“计算左极限：$\lim...$”的步骤：冒号前是标题，冒号后是正文
        const colonIndex = step.includes('：') ? step.indexOf('：') : step.indexOf(':');
        const title = step.substring(0, colonIndex).trim();
        const body = step.substring(colonIndex + 1).trim();
        if (title && body) {
          parsed = {
            order: plain.index,
            description: /^(第?\d+步|步骤\s*\d+)$/.test(title) ? plain.title : title,
            expression: '',
            explanation: body,
          };
        }
      }
    } catch (e) {
      console.warn('步骤解析失败，使用原始文本:', e);
    }

    return parsed;
  });
};

const extractKeywords = (problem: string): string[] => {
  const keywords: string[] = [];
  const keywordMap: Record<string, string> = {
    '极限': '极限',
    'lim': '极限',
    'limit': '极限',
    '导数': '导数',
    'derivative': '导数',
    '求导': '导数',
    '微分': '导数',
    '积分': '积分',
    'integral': '积分',
    '∫': '积分',
    '方程': '方程',
    'equation': '方程',
    '解': '方程',
    '级数': '级数',
    'series': '级数',
    '泰勒': '泰勒',
    'taylor': '泰勒',
    '洛必达': '洛必达',
    '连续': '连续性',
    '链式': '链式法则',
  };
  
  const lowerProblem = problem.toLowerCase();
  for (const [key, value] of Object.entries(keywordMap)) {
    if (lowerProblem.includes(key.toLowerCase())) {
      if (!keywords.includes(value)) {
        keywords.push(value);
      }
    }
  }
  
  return keywords.length > 0 ? keywords : [problem];
};

let aiFallbackTried = false;

const handleSubmit = async (isRetry = false) => {
  if (!prompt.value.trim()) {
    uni.showToast({ title: '问题不能为空', icon: 'none' });
    return;
  }
  if (!isRetry) aiFallbackTried = false;
  
  loading.value = true;
  isThinking.value = true;
  resetAll();
  
  try {
    const keywords = extractKeywords(prompt.value);
      
      showModule1.value = true;
      
      for (const kw of keywords) {
        try {
          const result = await request({
            url: '/knowledge/search',
            method: 'GET',
            params: { q: kw },
          });
          
          if (result && Array.isArray(result)) {
            for (const kp of result) {
              if (knowledgePoints.value.length < 5) {
                await new Promise(resolve => setTimeout(resolve, 300));
                visibleKnowledgePoints.value.push(kp);
                knowledgePoints.value.push(kp);
              }
            }
          }
        } catch (e) {
          console.log('知识点搜索失败:', e);
        }
      }
      
      for (const kw of keywords) {
        try {
          const result = await request({
            url: '/knowledge/common-mistakes',
            method: 'GET',
            params: { q: kw },
          });
          
          if (result && Array.isArray(result)) {
            for (const m of result) {
              if (commonMistakes.value.length < 3) {
                await new Promise(resolve => setTimeout(resolve, 200));
                visibleMistakes.value.push(m);
                commonMistakes.value.push(m);
              }
            }
          }
        } catch (e) {
          console.log('易错点搜索失败:', e);
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
      isThinking.value = false;
      
      if (solveMode.value === 'agent') {
        workflowStatus.value = 'running';
        workflowSteps.value = {
          planner: { status: 'pending' as const, result: null, duration: 0 },
          solver: { status: 'pending' as const, result: null, duration: 0 },
          diagnostic: { status: 'pending' as const, result: null, duration: 0 },
          feedback: { status: 'pending' as const, result: null, duration: 0 },
        };
        workflowDuration.value = 0;

        const apiStartTime = Date.now();

        const response = await request({
          url: '/agents/solve',
          method: 'POST',
          data: { problem: prompt.value },
        });

        workflowDuration.value = Date.now() - apiStartTime;

        if (response?.executionHistory && Array.isArray(response.executionHistory)) {
          await updateWorkflowFromResponse(response);
        }

        if (response?.solutionSteps?.length > 0) {
          solutionSteps.value = parseStructuredSteps(response.solutionSteps);
          finalAnswer.value = response.finalAnswer || '';
          currentProblem.value = { originalText: prompt.value };
          currentSolution.value = { steps: solutionSteps.value, finalAnswer: finalAnswer.value };
          await showStepsGradually();
          showDiagnosis.value = true;
        } else {
          uni.showToast({ title: '智能体无法求解，使用AI模式', icon: 'none' });
          await callAiModel();
        }
      } else {
        await callAiModel();
      }
  } catch (error: any) {
    console.error('请求失败:', error);
    const msg = String(error?.message || '');
    // AI 模式未配置大模型密钥时，自动降级到智能体模式（纯本地 SymPy 计算，无需 API Key），
    // 避免用户看到 500 后无从下手
    if (solveMode.value === 'ai' && !aiFallbackTried && /未配置|AI 模型|AI服务配置|503|Service Unavailable/i.test(msg)) {
      aiFallbackTried = true;
      solveMode.value = 'agent';
      uni.showToast({ title: 'AI 模型未配置，已切换智能体模式', icon: 'none' });
      loading.value = false;
      isThinking.value = false;
      await handleSubmit(true);
      return;
    }
    if (solveMode.value === 'agent') {
      workflowStatus.value = 'failed';
    }
    uni.showToast({
      title: msg || '请求失败',
      icon: 'none',
    });
  } finally {
    loading.value = false;
    isThinking.value = false;
  }
};

const callAiModel = async () => {
  const response = await request({
    url: '/ai-solver/solve',
    method: 'POST',
    data: {
      prompt: prompt.value,
      model: selectedModel.value,
    },
  });
  
  if (response?.structuredResult) {
    const { solutionSteps, knowledgeAnalysis, finalAnswer: answer } = response.structuredResult;
    
    if (knowledgeAnalysis) {
      const analysisLines = knowledgeAnalysis.split('\n').filter((line: string) => line.trim());
      for (const line of analysisLines) {
        if (line.includes('知识点') || line.includes('概念') || line.includes('定理')) {
          visibleKnowledgePoints.value.push({
            id: `ai_${Date.now()}`,
            name: line.replace(/^[-•*]\s*/, '').replace(/[:：].*$/, ''),
            type: 'concept',
            description: line,
          });
        }
      }
    }
    
    if (solutionSteps) {
      aiTextContent.value = solutionSteps;
      await typeAiText(solutionSteps);
    } else if (response?.choices?.[0]?.message?.content) {
      aiTextContent.value = response.choices[0].message.content;
      await typeAiText(aiTextContent.value);
    }
    
    if (answer) {
      finalAnswer.value = answer;
    }
    
    showDiagnosis.value = true;
  } else if (response?.choices?.[0]?.message?.content) {
    aiTextContent.value = response.choices[0].message.content;
    await typeAiText(aiTextContent.value);
    showDiagnosis.value = true;
  } else {
    throw new Error('AI未返回有效答案');
  }
};

const handleDiagnosis = async () => {
  if (!studentAnswer.value.trim()) {
    uni.showToast({ title: '请输入您的答案', icon: 'none' });
    return;
  }
  
  diagnosing.value = true;
  
  try {
    const response = await request({
      url: '/agents/diagnose',
      method: 'POST',
      data: {
        problem: currentProblem.value || { originalText: prompt.value },
        solution: currentSolution.value || { steps: [], finalAnswer: '' },
        studentAnswer: studentAnswer.value,
      },
    });
    
    diagnosisResult.value = response;
    
    if (!response.isCorrect) {
      await getFeedback();
    }
  } catch (error: any) {
    console.error('诊断失败:', error);
    uni.showToast({
      title: error.message || '诊断失败',
      icon: 'none',
    });
  } finally {
    diagnosing.value = false;
  }
};

const getFeedback = async () => {
  try {
    const response = await request({
      url: '/agents/feedback',
      method: 'POST',
      data: {
        problem: currentProblem.value || { originalText: prompt.value },
        diagnosis: diagnosisResult.value,
        studentAnswer: studentAnswer.value,
      },
    });
    
    feedback.value = response;
    showFeedback.value = true;
  } catch (error: any) {
    console.error('获取反馈失败:', error);
  }
};

// 初始化Canvas尺寸


onMounted(async () => {
  checkServices();
  // 处理路由参数
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  const options = currentPage.options;
  
  if (options.mode === 'practice' && options.questionId) {
    await loadQuestionById(options.questionId);
  } else if (options.mode === 'practice' && options.conceptName) {
    prompt.value = `请出一道关于「${decodeURIComponent(options.conceptName)}」的练习题，并给出解答步骤。`;
  } else if (options.mode === 'retry' && options.question) {
    prompt.value = decodeURIComponent(options.question);
  }
});

const loadQuestionById = async (questionId: string) => {
  loading.value = true;
  try {
    // 使用统一 request：自带 JWT、自动剥离 { code, data, message } 包装（否则 content 恒为 undefined）
    const question: any = await request({
      url: `/questions/${questionId}`,
      method: 'GET'
    });

    if (question && (question.content || question.question)) {
      prompt.value = question.content || question.question;
      // 可以在这里保存题目信息，用于后续的答案提交
      currentProblem.value = {
        originalText: question.content,
        knowledgePoint: question.knowledgePoint,
        difficulty: question.difficulty
      };
    } else {
      uni.showToast({ title: '加载题目失败', icon: 'none' });
    }
  } catch (error) {
    console.error('加载题目失败:', error);
    uni.showToast({ title: '加载题目失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
};

// 输入模式切换
const switchInputMode = (mode: string) => {
  inputMode.value = mode;
  if (mode === 'handwrite') {
    showHandwriting.value = true;
  } else if (mode === 'image') {
    // 触发图片选择
    uni.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        handleImageUpload(res.tempFilePaths[0]);
      },
      fail: (error) => {
        console.error('选择图片失败:', error);
        inputMode.value = 'text';
      }
    });
  }
};

// 图片上传处理
const handleImageUpload = async (imagePath: string) => {
  try {
    // 显示加载状态
    uni.showLoading({ title: '识别中...' });
    
    // 检查API密钥是否有效
    const apiKeyValid = await simpleTexService.checkApiKey();
    if (!apiKeyValid) {
      uni.hideLoading();
      uni.showToast({ title: 'SimpleTex API密钥无效', icon: 'none' });
      console.warn('SimpleTex API密钥无效，请检查配置');
      inputMode.value = 'text';
      return;
    }
    
    let imageBlob;
    
    // 在H5环境下直接使用File API
    if (typeof window !== 'undefined' && window.File) {
      const fetchResponse = await fetch(imagePath);
      imageBlob = await fetchResponse.blob();
    } else {
      // 兼容其他环境，这里需要根据具体环境处理
      // 暂时使用模拟数据
      uni.hideLoading();
      uni.showToast({ title: '当前环境不支持图片上传', icon: 'none' });
      inputMode.value = 'text';
      return;
    }
    
    // 使用SimpleTex API进行图片识别
    const result = await simpleTexService.recognizeImage(imageBlob);
    
    // 处理识别结果
    if (result.text) {
      prompt.value = result.text;
      inputMode.value = 'text';
      uni.hideLoading();
      uni.showToast({ title: '识别成功', icon: 'success' });
      console.log('SimpleTex图片识别成功:', result);
    } else {
      uni.hideLoading();
      uni.showToast({ title: '识别失败，未返回有效结果', icon: 'none' });
      console.warn('SimpleTex图片识别未返回有效结果');
      inputMode.value = 'text';
    }
  } catch (error) {
    console.error('图片识别失败:', error);
    uni.hideLoading();
    uni.showToast({ title: '识别失败，请重试', icon: 'none' });
    inputMode.value = 'text';
  }
};









// 语音输入相关方法
const toggleVoiceInput = async () => {
  if (isRecording.value) {
    // 停止录音
    uni.stopRecord({
      success: (res) => {
        isRecording.value = false;
        sendVoiceToServer(res.tempFilePath);
      },
      fail: (error) => {
        console.error('停止录音失败:', error);
        isRecording.value = false;
        uni.showToast({ title: '录音失败', icon: 'none' });
      }
    });
  } else {
    // 开始录音
    uni.startRecord({
      success: () => {
        isRecording.value = true;
        uni.showToast({ title: '开始录音', icon: 'success' });
      },
      fail: (error) => {
        console.error('开始录音失败:', error);
        uni.showToast({ title: '录音失败，请检查权限', icon: 'none' });
      }
    });
  }
};

const sendVoiceToServer = async (voicePath: string) => {
  try {
    const formData = new FormData();
    formData.append('audio', {
      uri: voicePath,
      type: 'audio/wav',
      name: 'voice.wav'
    } as any);
    
    const response = await request({
      url: '/multimodal/speech/recognize',
      method: 'POST',
      data: formData,
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    
    if (response?.text) {
      prompt.value = response.text;
      uni.showToast({ title: '识别成功', icon: 'success' });
    } else {
      uni.showToast({ title: '识别失败，请重试', icon: 'none' });
    }
  } catch (error) {
    console.error('语音识别失败:', error);
    uni.showToast({ title: '识别失败，请重试', icon: 'none' });
  }
};

// 处理手写识别结果
const handleRecognizedText = (text: string) => {
  prompt.value = text;
  inputMode.value = 'text';
};
</script>

<style scoped>
.solver-container {
  padding: 20px;
  min-height: 100vh;
  background: var(--bg-secondary);
}

.title {
  font-size: 24px;
  font-weight: bold;
  text-align: center;
  margin-bottom: 20px;
  color: var(--text-primary);
}

.problem-input {
  width: 100%;
  height: 120px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 15px;
  box-sizing: border-box;
  margin-bottom: 15px;
  font-size: 15px;
  background: var(--bg-card);
}

.input-tools {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
}

.tool-btn {
  flex: 1;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 20px;
  height: 40px;
  line-height: 40px;
  font-size: 14px;
  color: var(--text-primary);
  transition: all 0.3s ease;
}

.tool-btn.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-color: #667eea;
  color: white;
}

.tool-btn.recording {
  background: #ffebee;
  border-color: #f44336;
  color: #f44336;
}

.mode-selector, .model-selector {
  margin-bottom: 15px;
  padding: 15px;
  background: var(--bg-card);
  border-radius: 10px;
}

.selector-label {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 10px;
  display: block;
}

.radio-label {
  margin-right: 20px;
  font-size: 14px;
}

/* 深色模式下浅色底 + 浅色文字会看不清，改用随主题变化的半透明底色 */
.mode-tips {
  background: rgba(33, 150, 243, 0.14);
  border-radius: 10px;
  padding: 12px 15px;
  margin-bottom: 15px;
}

.tip-title {
  font-size: 13px;
  font-weight: bold;
  color: #1976d2;
  display: block;
  margin-bottom: 5px;
}

.tip-content {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.submit-btn {
  width: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 25px;
  height: 45px;
  line-height: 45px;
  font-size: 16px;
  margin-bottom: 15px;
}

.submit-btn[disabled] {
  opacity: 0.6;
}

.service-status {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-bottom: 15px;
}

.status-item {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 10px;
}

.status-ok {
  background: #e8f5e9;
  color: #4caf50;
}

.status-error {
  background: #ffebee;
  color: #f44336;
}

.result-container {
  margin-top: 15px;
  background: var(--bg-card);
  border-radius: 12px;
  overflow: hidden;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  background: var(--math-bg);
  border-bottom: 1px solid #eee;
}

.result-title {
  font-weight: bold;
  font-size: 16px;
  color: var(--text-primary);
}

.result-status {
  font-size: 12px;
  color: #fff;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 4px 10px;
  border-radius: 12px;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.fade-in {
  animation: fadeIn 0.5s ease-in;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.section-title {
  font-size: 15px;
  font-weight: bold;
  color: var(--text-primary);
  margin-bottom: 12px;
  display: block;
}

.knowledge-section {
  padding: 15px;
  background: rgba(76, 175, 80, 0.12);
}

.knowledge-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.knowledge-item {
  display: flex;
  align-items: center;
  padding: 12px;
  background: var(--bg-card);
  border-radius: 8px;
  box-shadow: 0 1px 6px var(--shadow-color);
}

.knowledge-icon {
  font-size: 24px;
  margin-right: 12px;
}

.knowledge-info {
  flex: 1;
}

.knowledge-name {
  font-size: 14px;
  font-weight: bold;
  color: var(--text-primary);
  display: block;
}

.knowledge-desc {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
  display: block;
}

.mistakes-section {
  padding: 15px;
  background: rgba(255, 152, 0, 0.12);
  border-top: 1px solid #e0e0e0;
}

.mistakes-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mistake-item {
  display: flex;
  align-items: flex-start;
  padding: 10px;
  background: var(--bg-card);
  border-radius: 6px;
  border-left: 3px solid #ff9800;
}

.mistake-icon {
  font-size: 16px;
  margin-right: 8px;
}

.mistake-text {
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.5;
}

.empty-section {
  padding: 30px;
  text-align: center;
}

.empty-text {
  color: var(--text-muted);
  font-size: 14px;
  display: block;
}

.empty-hint {
  color: #bbb;
  font-size: 12px;
  margin-top: 8px;
  display: block;
}

.solution-section {
  padding: 15px;
}

.step-item {
  margin-bottom: 15px;
  padding: 12px;
  background: var(--math-bg);
  border-radius: 8px;
  border-left: 3px solid #667eea;
}

.step-header {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.step-number {
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
  line-height: 22px;
  text-align: center;
  font-size: 12px;
  font-weight: bold;
  color: #fff;
  background: var(--accent-color);
  border-radius: 50%;
  margin-right: 10px;
}

.step-description {
  font-size: 14px;
  font-weight: bold;
  color: var(--text-primary);
}

.step-content {
  padding-left: 32px;
}

.step-expression {
  margin: 4px 0 8px;
  text-align: center;
}

.expression-value {
  font-size: 14px;
  color: var(--text-primary);
  font-family: 'Courier New', monospace;
  background: var(--bg-card);
  padding: 4px 8px;
  border-radius: 4px;
  display: inline-block;
  margin-left: 5px;
}

.step-explanation {
  font-size: 14px;
  color: var(--text-primary);
  line-height: 1.7;
}

.loading-more {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 15px;
  gap: 10px;
}

.loading-dots {
  color: var(--accent-color);
  animation: blink 1s infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.loading-text {
  font-size: 13px;
  color: var(--text-secondary);
}

.final-answer {
  margin-top: 15px;
  padding: 15px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  text-align: center;
}

.answer-label {
  font-size: 14px;
  color: rgba(255,255,255,0.8);
  display: block;
  margin-bottom: 5px;
}

.answer-value {
  font-size: 18px;
  font-weight: bold;
  color: white;
}

.ai-content {
  padding: 15px;
}

.ai-text {
  font-size: 14px;
  color: var(--text-primary);
  line-height: 1.8;
}

.ai-text :deep(.highlight) {
  font-weight: bold;
  color: var(--accent-color);
  background: #f0f0ff;
  padding: 0 4px;
  border-radius: 3px;
}

.ai-text :deep(.key-concept) {
  font-weight: bold;
  color: var(--accent-color);
  background: #f0f0ff;
  padding: 0 4px;
  border-radius: 3px;
}

.ai-text :deep(.answer-box) {
  margin-top: 15px;
  margin-bottom: 10px;
  padding: 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  color: white;
  font-weight: bold;
  text-align: center;
}

.ai-text :deep(.answer-highlight) {
  color: #ffeb3b;
  font-weight: bold;
  text-shadow: 0 0 2px rgba(0, 0, 0, 0.3);
}

.ai-text :deep(.step-marker) {
  display: inline-block;
  background: var(--accent-color);
  color: white;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
  margin: 8px 0 5px 0;
}

.ai-text :deep(p) {
  margin-bottom: 10px;
  line-height: 1.8;
}

.steps-container {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.final-answer-container {
  margin-top: 10px;
  padding: 15px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  text-align: center;
}

.typing-cursor {
  color: var(--accent-color);
  font-weight: bold;
  animation: cursorBlink 1s infinite;
  margin-left: 2px;
  vertical-align: middle;
}

@keyframes cursorBlink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

/* 诊断模块样式 */
.diagnosis-input-section {
  padding: 15px;
}

.student-answer-input {
  width: 100%;
  height: 100px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 10px;
  box-sizing: border-box;
  font-size: 14px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  margin-bottom: 10px;
}

.diagnosis-btn {
  width: 100%;
  background: #ff9800;
  color: white;
  border-radius: 20px;
  height: 40px;
  line-height: 40px;
  font-size: 14px;
}

.diagnosis-btn[disabled] {
  opacity: 0.6;
}

.diagnosis-result-section {
  padding: 15px;
  border-top: 1px solid var(--border-color);
}

.correct-result {
  text-align: center;
  padding: 20px;
  background: rgba(76, 175, 80, 0.14);
  border-radius: 10px;
}

.correct-icon {
  font-size: 48px;
  display: block;
  margin-bottom: 10px;
}

.correct-text {
  font-size: 18px;
  font-weight: bold;
  color: #4caf50;
  display: block;
  margin-bottom: 10px;
}

.encouragement {
  font-size: 14px;
  color: var(--text-secondary);
}

.error-result {
  background: rgba(255, 152, 0, 0.12);
  border-radius: 10px;
  padding: 15px;
}

.error-summary {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 15px;
}

.error-icon {
  font-size: 24px;
}

.error-type {
  font-size: 16px;
  font-weight: bold;
  color: #f44336;
}

.error-sub-type {
  font-size: 12px;
  color: #ff9800;
  background: var(--bg-card);
  padding: 2px 8px;
  border-radius: 10px;
}

.error-description {
  margin-bottom: 15px;
}

.desc-title {
  font-size: 14px;
  font-weight: bold;
  color: var(--text-primary);
  display: block;
  margin-bottom: 5px;
}

.desc-content {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.knowledge-gaps {
  margin-bottom: 15px;
  background: var(--bg-card);
  padding: 10px;
  border-radius: 8px;
}

.gap-title {
  font-size: 14px;
  font-weight: bold;
  color: var(--accent-color);
  display: block;
  margin-bottom: 8px;
}

.gap-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.gap-item {
  font-size: 13px;
  color: var(--text-primary);
}

.suggestions {
  margin-bottom: 15px;
}

.suggestion-title {
  font-size: 14px;
  font-weight: bold;
  color: #4caf50;
  display: block;
  margin-bottom: 8px;
}

.suggestion-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.suggestion-item {
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.5;
}

.metrics {
  background: var(--bg-card);
  padding: 10px;
  border-radius: 8px;
}

.metrics-title {
  font-size: 14px;
  font-weight: bold;
  color: var(--text-primary);
  display: block;
  margin-bottom: 10px;
}

.metrics-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.metric-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.metric-label {
  font-size: 12px;
  color: var(--text-secondary);
  width: 70px;
}

.metric-bar {
  flex: 1;
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
}

.metric-fill {
  height: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 4px;
}

.metric-value {
  font-size: 12px;
  color: var(--accent-color);
  width: 40px;
  text-align: right;
}

/* 反馈模块样式 */
.feedback-section {
  padding: 15px;
}

.feedback-summary {
  background: var(--bg-secondary);
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 15px;
}

.summary-text {
  font-size: 15px;
  font-weight: bold;
  color: var(--text-primary);
}

.feedback-title {
  font-size: 14px;
  font-weight: bold;
  color: var(--accent-color);
  display: block;
  margin-bottom: 8px;
}

.feedback-content {
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.6;
  white-space: pre-line;
}

.feedback-error-analysis,
.feedback-concept-review,
.feedback-correct-approach {
  margin-bottom: 15px;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 8px;
}

.feedback-practice {
  margin-bottom: 15px;
}

.practice-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.practice-item {
  font-size: 13px;
  color: var(--text-primary);
}

.feedback-encouragement {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 12px;
  border-radius: 8px;
  text-align: center;
}

.encouragement-text {
  font-size: 14px;
  color: white;
  font-weight: bold;
}

</style>
