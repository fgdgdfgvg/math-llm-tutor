import { Injectable, Logger } from '@nestjs/common';
import { ValidationResult } from './step-validation.service';

export interface SolutionStep {
  id: string;
  title: string;
  description: string;
  formula: string;
  process: string;
  result: string;
  highlight: string;
  keyPoint: string;
}

export interface MermaidFlowchart {
  code: string;
  nodes: MermaidNode[];
  edges: MermaidEdge[];
  metadata: {
    totalSteps: number;
    correctSteps: number;
    errorSteps: number;
    keySteps: number;
  };
}

export interface MermaidNode {
  id: string;
  label: string;
  shape: 'rect' | 'rounded' | 'diamond' | 'circle';
  color: 'green' | 'red' | 'blue' | 'yellow' | 'gray';
  style: string[];
  tooltip?: string;
  isKey?: boolean;
  hasError?: boolean;
}

export interface MermaidEdge {
  from: string;
  to: string;
  label?: string;
  style: 'solid' | 'dashed' | 'bold';
  color?: string;
}

export interface ExportOptions {
  format: 'png' | 'svg' | 'pdf';
  width?: number;
  height?: number;
  quality?: 'low' | 'medium' | 'high';
  includeLegend?: boolean;
  includeMetadata?: boolean;
}

@Injectable()
export class VisualizationService {
  private readonly logger = new Logger(VisualizationService.name);

  generateMermaidFlowchart(
    steps: SolutionStep[],
    validationResults: ValidationResult[],
  ): MermaidFlowchart {
    this.logger.log(`生成Mermaid流程图，共${steps.length}个步骤`);

    const nodes: MermaidNode[] = [];
    const edges: MermaidEdge[] = [];

    nodes.push({
      id: 'start',
      label: '开始',
      shape: 'rounded',
      color: 'gray',
      style: ['fill:#f0f0f0', 'stroke:#333', 'stroke-width:2px'],
    });

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const validation = validationResults[i];

      const node = this.createStepNode(step, validation, i);
      nodes.push(node);

      if (i === 0) {
        edges.push({
          from: 'start',
          to: step.id,
          style: 'solid',
        });
      } else {
        edges.push({
          from: steps[i - 1].id,
          to: step.id,
          label: this.getEdgeLabel(validation),
          style: validation.status === 'pass' ? 'solid' : 'dashed',
          color: this.getEdgeColor(validation),
        });
      }
    }

    const lastStep = steps[steps.length - 1];
    nodes.push({
      id: 'end',
      label: '结束',
      shape: 'rounded',
      color: 'gray',
      style: ['fill:#f0f0f0', 'stroke:#333', 'stroke-width:2px'],
    });

    edges.push({
      from: lastStep.id,
      to: 'end',
      style: 'solid',
    });

    const code = this.generateMermaidCode(nodes, edges);

    const metadata = {
      totalSteps: steps.length,
      correctSteps: validationResults.filter((v) => v.status === 'pass').length,
      errorSteps: validationResults.filter((v) => v.status === 'fail').length,
      keySteps: steps.filter((s) => s.keyPoint && s.keyPoint.length > 0).length,
    };

    return {
      code,
      nodes,
      edges,
      metadata,
    };
  }

  private createStepNode(
    step: SolutionStep,
    validation: ValidationResult,
    index: number,
  ): MermaidNode {
    const color = this.getNodeColor(validation);
    const shape = this.getNodeShape(step, validation);
    const isKey = !!(step.keyPoint && step.keyPoint.length > 0);
    const hasError = validation.status === 'fail';

    const label = this.formatNodeLabel(step, index);
    const tooltip = this.createTooltip(step, validation);
    const style = this.getNodeStyle(validation, isKey);

    return {
      id: step.id,
      label,
      shape,
      color,
      style,
      tooltip,
      isKey,
      hasError,
    };
  }

  private getNodeColor(
    validation: ValidationResult,
  ): 'green' | 'red' | 'blue' | 'yellow' | 'gray' {
    switch (validation.status) {
      case 'pass':
        return 'green';
      case 'fail':
        return 'red';
      case 'warning':
        return 'yellow';
      default:
        return 'gray';
    }
  }

  private getNodeShape(
    step: SolutionStep,
    validation: ValidationResult,
  ): 'rect' | 'rounded' | 'diamond' | 'circle' {
    if (validation.status === 'fail') {
      return 'diamond';
    }

    if (step.keyPoint && step.keyPoint.length > 0) {
      return 'rounded';
    }

    return 'rect';
  }

  private formatNodeLabel(step: SolutionStep, index: number): string {
    const title =
      step.title.length > 20 ? step.title.substring(0, 20) + '...' : step.title;
    return `步骤${index + 1}: ${title}`;
  }

  private createTooltip(
    step: SolutionStep,
    validation: ValidationResult,
  ): string {
    const parts: string[] = [];

    parts.push(`标题: ${step.title}`);
    parts.push(`描述: ${step.description}`);

    if (step.formula) {
      parts.push(`公式: ${step.formula}`);
    }

    if (step.result) {
      parts.push(`结果: ${step.result}`);
    }

    parts.push(`验证状态: ${validation.message}`);

    if (!validation.isValid && validation.details) {
      parts.push(`问题详情: ${validation.details}`);
    }

    return parts.join('\\n');
  }

  private getNodeStyle(validation: ValidationResult, isKey: boolean): string[] {
    const styles: string[] = [];

    switch (validation.status) {
      case 'pass':
        styles.push('fill:#d4edda', 'stroke:#28a745', 'stroke-width:2px');
        if (isKey) {
          styles.push('stroke:#0066cc', 'stroke-width:3px');
        }
        break;
      case 'fail':
        styles.push('fill:#f8d7da', 'stroke:#dc3545', 'stroke-width:3px');
        break;
      case 'warning':
        styles.push('fill:#fff3cd', 'stroke:#ffc107', 'stroke-width:2px');
        break;
      default:
        styles.push('fill:#f0f0f0', 'stroke:#333', 'stroke-width:1px');
    }

    return styles;
  }

  private getEdgeLabel(validation: ValidationResult): string | undefined {
    if (validation.status === 'fail') {
      return '错误';
    }
    if (validation.status === 'warning') {
      return '注意';
    }
    return undefined;
  }

  private getEdgeColor(validation: ValidationResult): string {
    switch (validation.status) {
      case 'pass':
        return '#28a745';
      case 'fail':
        return '#dc3545';
      case 'warning':
        return '#ffc107';
      default:
        return '#333';
    }
  }

  private generateMermaidCode(
    nodes: MermaidNode[],
    edges: MermaidEdge[],
  ): string {
    const lines: string[] = [];

    lines.push('graph TD');
    lines.push('    %% 解题流程图');
    lines.push('');

    for (const node of nodes) {
      const nodeCode = this.generateNodeCode(node);
      lines.push(`    ${nodeCode}`);
    }

    lines.push('');

    for (const edge of edges) {
      const edgeCode = this.generateEdgeCode(edge);
      lines.push(`    ${edgeCode}`);
    }

    lines.push('');
    lines.push('    %% 样式定义');

    for (const node of nodes) {
      if (node.style.length > 0) {
        lines.push(`    style ${node.id} ${node.style.join(',')}`);
      }
    }

    lines.push('');
    lines.push('    %% 点击事件');
    for (const node of nodes) {
      if (node.tooltip) {
        lines.push(`    click ${node.id} "${node.tooltip}" "点击查看详情"`);
      }
    }

    return lines.join('\n');
  }

  private generateNodeCode(node: MermaidNode): string {
    let shapeStart = '';
    let shapeEnd = '';

    switch (node.shape) {
      case 'rect':
        shapeStart = '[';
        shapeEnd = ']';
        break;
      case 'rounded':
        shapeStart = '(';
        shapeEnd = ')';
        break;
      case 'diamond':
        shapeStart = '{';
        shapeEnd = '}';
        break;
      case 'circle':
        shapeStart = '((';
        shapeEnd = '))';
        break;
    }

    return `${node.id}${shapeStart}"${node.label}"${shapeEnd}`;
  }

  private generateEdgeCode(edge: MermaidEdge): string {
    let arrow = '-->';

    if (edge.style === 'dashed') {
      arrow = '-.->';
    } else if (edge.style === 'bold') {
      arrow = '==>';
    }

    let label = '';
    if (edge.label) {
      label = `|"${edge.label}"|`;
    }

    return `${edge.from} ${arrow}${label} ${edge.to}`;
  }

  generateInteractiveHTML(flowchart: MermaidFlowchart): string {
    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>数学解题流程可视化</title>
    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
    <style>
        body {
            font-family: 'Microsoft YaHei', Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        h1 {
            color: #333;
            text-align: center;
            margin-bottom: 30px;
        }
        
        .legend {
            display: flex;
            justify-content: center;
            gap: 20px;
            margin-bottom: 20px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 5px;
        }
        
        .legend-item {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .legend-color {
            width: 20px;
            height: 20px;
            border-radius: 3px;
            border: 2px solid;
        }
        
        .legend-color.correct {
            background: #d4edda;
            border-color: #28a745;
        }
        
        .legend-color.error {
            background: #f8d7da;
            border-color: #dc3545;
        }
        
        .legend-color.key {
            background: #d4edda;
            border-color: #0066cc;
            border-width: 3px;
        }
        
        .legend-color.warning {
            background: #fff3cd;
            border-color: #ffc107;
        }
        
        .mermaid {
            text-align: center;
            margin: 30px 0;
        }
        
        .metadata {
            margin-top: 30px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 5px;
        }
        
        .metadata h3 {
            margin-top: 0;
            color: #333;
        }
        
        .metadata-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 15px;
        }
        
        .stat-item {
            padding: 10px;
            background: white;
            border-radius: 5px;
            text-align: center;
        }
        
        .stat-value {
            font-size: 24px;
            font-weight: bold;
            color: #0066cc;
        }
        
        .stat-label {
            font-size: 14px;
            color: #666;
            margin-top: 5px;
        }
        
        .export-buttons {
            display: flex;
            justify-content: center;
            gap: 10px;
            margin-top: 20px;
        }
        
        .export-btn {
            padding: 10px 20px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.3s;
        }
        
        .export-btn.png {
            background: #28a745;
            color: white;
        }
        
        .export-btn.svg {
            background: #0066cc;
            color: white;
        }
        
        .export-btn.pdf {
            background: #dc3545;
            color: white;
        }
        
        .export-btn:hover {
            opacity: 0.8;
            transform: translateY(-2px);
        }
        
        .tooltip {
            position: absolute;
            background: white;
            border: 1px solid #ddd;
            border-radius: 5px;
            padding: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            max-width: 300px;
            z-index: 1000;
            display: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>数学解题流程可视化</h1>
        
        <div class="legend">
            <div class="legend-item">
                <div class="legend-color correct"></div>
                <span>正确步骤</span>
            </div>
            <div class="legend-item">
                <div class="legend-color error"></div>
                <span>错误步骤</span>
            </div>
            <div class="legend-item">
                <div class="legend-color key"></div>
                <span>关键步骤</span>
            </div>
            <div class="legend-item">
                <div class="legend-color warning"></div>
                <span>需注意步骤</span>
            </div>
        </div>
        
        <div class="mermaid">
${flowchart.code}
        </div>
        
        <div class="metadata">
            <h3>解题统计</h3>
            <div class="metadata-stats">
                <div class="stat-item">
                    <div class="stat-value">${flowchart.metadata.totalSteps}</div>
                    <div class="stat-label">总步骤数</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${flowchart.metadata.correctSteps}</div>
                    <div class="stat-label">正确步骤</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${flowchart.metadata.errorSteps}</div>
                    <div class="stat-label">错误步骤</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${flowchart.metadata.keySteps}</div>
                    <div class="stat-label">关键步骤</div>
                </div>
            </div>
        </div>
        
        <div class="export-buttons">
            <button class="export-btn png" onclick="exportToPNG()">导出PNG</button>
            <button class="export-btn svg" onclick="exportToSVG()">导出SVG</button>
            <button class="export-btn pdf" onclick="exportToPDF()">导出PDF</button>
        </div>
    </div>
    
    <script>
        mermaid.initialize({
            startOnLoad: true,
            theme: 'default',
            flowchart: {
                useMaxWidth: true,
                htmlLabels: true,
                curve: 'basis'
            }
        });
        
        function exportToPNG() {
            alert('PNG导出功能需要集成html2canvas库');
        }
        
        function exportToSVG() {
            const svg = document.querySelector('.mermaid svg');
            if (svg) {
                const svgData = new XMLSerializer().serializeToString(svg);
                const blob = new Blob([svgData], { type: 'image/svg+xml' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'math-solution-flowchart.svg';
                a.click();
                URL.revokeObjectURL(url);
            }
        }
        
        function exportToPDF() {
            alert('PDF导出功能需要集成jsPDF库');
        }
    </script>
</body>
</html>
    `.trim();

    return html;
  }

  async exportFlowchart(
    flowchart: MermaidFlowchart,
    options: ExportOptions,
  ): Promise<Buffer | string> {
    this.logger.log(`导出流程图为${options.format.toUpperCase()}格式`);

    switch (options.format) {
      case 'svg':
        return this.exportToSVG(flowchart, options);
      case 'png':
        return this.exportToPNG(flowchart, options);
      case 'pdf':
        return this.exportToPDF(flowchart, options);
      default:
        throw new Error(`不支持的导出格式: ${options.format}`);
    }
  }

  private exportToSVG(
    flowchart: MermaidFlowchart,
    options: ExportOptions,
  ): string {
    const html = this.generateInteractiveHTML(flowchart);
    return html;
  }

  private exportToPNG(
    flowchart: MermaidFlowchart,
    options: ExportOptions,
  ): Buffer {
    const html = this.generateInteractiveHTML(flowchart);
    return Buffer.from(html, 'utf-8');
  }

  private exportToPDF(
    flowchart: MermaidFlowchart,
    options: ExportOptions,
  ): Buffer {
    const html = this.generateInteractiveHTML(flowchart);
    return Buffer.from(html, 'utf-8');
  }

  generateStepDetails(
    steps: SolutionStep[],
    validationResults: ValidationResult[],
  ): Array<{
    step: SolutionStep;
    validation: ValidationResult;
    details: string[];
  }> {
    return steps.map((step, index) => {
      const validation = validationResults[index];
      const details: string[] = [];

      details.push(`步骤 ${index + 1}: ${step.title}`);
      details.push(`描述: ${step.description}`);

      if (step.formula) {
        details.push(`公式: ${step.formula}`);
      }

      details.push(`过程: ${step.process}`);
      details.push(`结果: ${step.result}`);

      if (step.highlight) {
        details.push(`注意: ${step.highlight}`);
      }

      if (step.keyPoint) {
        details.push(`关键点: ${step.keyPoint}`);
      }

      details.push(`验证状态: ${validation.message}`);
      details.push(`置信度: ${(validation.confidence * 100).toFixed(1)}%`);

      if (!validation.isValid) {
        details.push(`问题详情: ${validation.details}`);
        if (validation.suggestions.length > 0) {
          details.push(`建议: ${validation.suggestions.join('; ')}`);
        }
      }

      return {
        step,
        validation,
        details,
      };
    });
  }
}
