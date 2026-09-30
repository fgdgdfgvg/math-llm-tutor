# 增强诊断智能体功能使用指南

## 一、实时步骤验证系统

### 1.1 功能概述

实时步骤验证系统通过 `validateStep` 函数实现对每个解题步骤的智能验证，包含以下核心功能：

- **数学规则验证**：检查步骤是否符合基础数学公理、定理及运算法则
- **逻辑一致性验证**：验证当前步骤与前序步骤之间的逻辑关联性
- **错误识别与定位**：精确定位计算错误、逻辑谬误或概念混淆
- **优化建议生成**：提供针对性的改进建议和替代解题路径

### 1.2 使用示例

```typescript
import { StepValidationService, SolutionStep } from './step-validation.service';

// 初始化验证服务
const validationService = new StepValidationService();

// 定义解题步骤
const steps: SolutionStep[] = [
  {
    id: 'step1',
    title: '分析函数结构',
    description: '识别待求导函数的基本形式',
    formula: 'f(x) = x^2 + 2x + 1',
    process: '识别函数为二次函数，结构为多项式',
    result: '已分析函数结构',
    highlight: '准确识别函数结构是选择正确求导法则的基础',
    keyPoint: '函数结构分析',
  },
  {
    id: 'step2',
    title: '选择求导法则',
    description: '根据函数结构选择适当的求导法则',
    formula: '',
    process: '根据函数结构选择基本公式、链式法则、乘积法则或商法则',
    result: '已选择合适的求导法则',
    highlight: '复合函数需要使用链式法则',
    keyPoint: '求导法则选择',
  },
];

// 验证单个步骤
const currentStep = steps[1];
const previousSteps = steps.slice(0, 1);
const validationResult = validationService.validateStep(currentStep, previousSteps);

console.log('验证结果:', validationResult);
// 输出:
// {
//   isValid: true,
//   status: 'pass',
//   message: '步骤验证通过',
//   details: '所有验证项均通过检查',
//   suggestions: ['当前步骤验证通过，可以继续下一步', '关键知识点: 求导法则选择'],
//   confidence: 0.85
// }

// 验证所有步骤
const allValidationResults = validationService.validateAllSteps(steps);
console.log('所有步骤验证结果:', allValidationResults);

// 获取验证摘要
const summary = validationService.getValidationSummary(allValidationResults);
console.log('验证摘要:', summary);
// 输出:
// {
//   totalSteps: 2,
//   passedSteps: 2,
//   failedSteps: 0,
//   warningSteps: 0,
//   overallStatus: 'pass',
//   averageConfidence: 0.85
// }
```

### 1.3 验证规则

系统内置了以下数学规则验证：

1. **除零检查**：确保除数不为零
2. **括号匹配**：验证括号成对出现且正确嵌套
3. **导数基本公式**：验证基本导数公式的正确应用
4. **积分基本公式**：验证基本积分公式的正确应用
5. **方程平衡**：验证方程两边保持平衡

### 1.4 错误类型

系统可以识别以下错误类型：

- **calculation（计算错误）**：数值计算、代数运算等错误
- **logic（逻辑错误）**：推理过程、逻辑关联等错误
- **concept（概念错误）**：数学概念理解、应用等错误
- **syntax（语法错误）**：表达式语法、符号使用等错误

## 二、可视化演示模块

### 2.1 功能概述

可视化演示模块基于 Mermaid 实现解题流程的可视化展示，包含以下核心功能：

- **流程图生成**：将解题步骤自动转换为结构化 Mermaid 流程图
- **色彩编码系统**：使用不同颜色标记步骤状态
- **交互功能**：支持步骤展开/折叠、错误提示悬浮显示
- **导出功能**：支持 PNG、SVG、PDF 格式导出

### 2.2 使用示例

```typescript
import { VisualizationService, SolutionStep } from './visualization.service';
import { ValidationResult } from './step-validation.service';

// 初始化可视化服务
const visualizationService = new VisualizationService();

// 定义解题步骤和验证结果
const steps: SolutionStep[] = [
  {
    id: 'step1',
    title: '分析函数结构',
    description: '识别待求导函数的基本形式',
    formula: 'f(x) = x^2 + 2x + 1',
    process: '识别函数为二次函数，结构为多项式',
    result: '已分析函数结构',
    highlight: '准确识别函数结构是选择正确求导法则的基础',
    keyPoint: '函数结构分析',
  },
  {
    id: 'step2',
    title: '选择求导法则',
    description: '根据函数结构选择适当的求导法则',
    formula: '',
    process: '根据函数结构选择基本公式、链式法则、乘积法则或商法则',
    result: '已选择合适的求导法则',
    highlight: '复合函数需要使用链式法则',
    keyPoint: '求导法则选择',
  },
];

const validationResults: ValidationResult[] = [
  {
    isValid: true,
    status: 'pass',
    message: '步骤验证通过',
    details: '所有验证项均通过检查',
    suggestions: [],
    confidence: 0.95,
  },
  {
    isValid: true,
    status: 'pass',
    message: '步骤验证通过',
    details: '所有验证项均通过检查',
    suggestions: [],
    confidence: 0.85,
  },
];

// 生成 Mermaid 流程图
const flowchart = visualizationService.generateMermaidFlowchart(steps, validationResults);
console.log('流程图代码:', flowchart.code);
console.log('流程图元数据:', flowchart.metadata);

// 生成交互式 HTML
const html = visualizationService.generateInteractiveHTML(flowchart);
console.log('交互式HTML已生成');

// 导出为 SVG 格式
const svgContent = await visualizationService.exportFlowchart(flowchart, {
  format: 'svg',
  includeLegend: true,
  includeMetadata: true,
});

// 导出为 PNG 格式
const pngContent = await visualizationService.exportFlowchart(flowchart, {
  format: 'png',
  width: 1200,
  height: 800,
  quality: 'high',
});

// 导出为 PDF 格式
const pdfContent = await visualizationService.exportFlowchart(flowchart, {
  format: 'pdf',
  includeLegend: true,
});

// 生成步骤详情
const stepDetails = visualizationService.generateStepDetails(steps, validationResults);
console.log('步骤详情:', stepDetails);
```

### 2.3 色彩编码系统

系统使用以下色彩编码：

- **绿色（#d4edda）**：标记完全正确的解题步骤
- **红色（#f8d7da）**：突出显示存在错误的步骤
- **蓝色（#0066cc）**：强调关键转折点和重要概念应用
- **黄色（#fff3cd）**：标记需要特别注意的步骤
- **灰色（#f0f0f0）**：标记开始和结束节点

### 2.4 交互功能

生成的交互式 HTML 包含以下功能：

1. **步骤展开/折叠**：点击步骤可以展开或折叠详细信息
2. **错误提示悬浮显示**：鼠标悬浮在错误步骤上显示详细错误信息
3. **步骤跳转定位**：点击流程图中的步骤可以跳转到对应的详细说明
4. **统计信息展示**：显示总步骤数、正确步骤数、错误步骤数等统计信息
5. **多格式导出**：支持一键导出为 PNG、SVG、PDF 格式

## 三、集成到诊断智能体

### 3.1 在诊断智能体中使用

```typescript
import { DiagnosticAgent } from './diagnostic.agent';

// 诊断智能体已自动集成步骤验证和可视化功能
const diagnosticAgent = new DiagnosticAgent(
  config,
  configService,
  httpService,
  aiModelsService,
  localComputationService,
  stepValidationService,
  visualizationService,
);

// 使用步骤验证服务
const validationResults = await diagnosticAgent.validateStepsWithService(steps);

// 生成可视化流程图
const flowchart = await diagnosticAgent.generateVisualization(steps, validationResults);

// 生成交互式 HTML
const html = await diagnosticAgent.generateInteractiveHTML(flowchart);

// 导出流程图
const exportedContent = await diagnosticAgent.exportVisualization(flowchart, {
  format: 'svg',
  includeLegend: true,
});

// 获取验证摘要
const summary = diagnosticAgent.getValidationSummary(validationResults);

// 生成步骤详情
const stepDetails = diagnosticAgent.generateStepDetails(steps, validationResults);
```

## 四、应用场景

### 4.1 实时教学辅助

- 在学生解题过程中实时验证每一步的正确性
- 及时发现错误并提供针对性的改进建议
- 帮助学生建立正确的解题思维模式

### 4.2 作业批改

- 自动验证学生作业的解题步骤
- 生成可视化的批改结果
- 提供详细的错误分析和改进建议

### 4.3 考试评分

- 快速验证考试答案的正确性
- 生成标准化的评分报告
- 提供可视化的解题过程展示

### 4.4 教学演示

- 生成清晰的解题流程图
- 突出显示关键步骤和易错点
- 支持多种格式导出，便于教学使用

## 五、技术优势

### 5.1 智能化验证

- 基于数学规则库的智能验证
- 支持多种错误类型的识别和定位
- 提供详细的错误分析和改进建议

### 5.2 可视化展示

- 基于 Mermaid 的标准化流程图
- 色彩编码系统清晰直观
- 支持交互式操作和多格式导出

### 5.3 易于集成

- 模块化设计，易于集成到现有系统
- 提供完整的 API 接口
- 支持自定义配置和扩展

### 5.4 高性能

- 基于规则的快速验证
- 异步处理，不阻塞主流程
- 支持批量验证和并行处理

## 六、未来扩展

### 6.1 更多数学规则

- 添加更多数学领域的验证规则
- 支持高等数学、线性代数、概率论等
- 支持自定义规则扩展

### 6.2 更丰富的可视化

- 支持更多图表类型（时序图、甘特图等）
- 添加动画效果和过渡动画
- 支持主题定制和样式配置

### 6.3 AI 增强验证

- 集成 AI 模型进行更智能的验证
- 支持自然语言错误描述
- 提供个性化的学习建议

### 6.4 协作功能

- 支持多人协作验证
- 提供验证结果共享和讨论
- 支持版本控制和历史记录
