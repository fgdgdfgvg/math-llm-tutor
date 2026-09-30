import { useMemo } from 'react';
import katex from 'katex';
import type { StrictFunction } from 'katex';
import 'katex/dist/katex.min.css';

export interface FormulaRendererProps {
  formula: string;
  displayMode?: boolean;
  className?: string;
  style?: React.CSSProperties;
  throwOnError?: boolean;
  errorColor?: string;
  strict?: boolean | 'error' | 'ignore' | 'warn' | StrictFunction;
  trust?: boolean | ((context: any) => boolean);
  maxSize?: number;
  maxExpand?: number;
}

export default function FormulaRenderer({
  formula,
  displayMode = true,
  className = '',
  style = {},
  throwOnError = false,
  errorColor = '#cc0000',
  strict = false,
  trust = false,
  maxSize = 500,
  maxExpand = 1000,
}: FormulaRendererProps) {
  const html = useMemo(() => {
    if (!formula || formula.trim() === '') {
      return '';
    }

    try {
      return katex.renderToString(formula, {
        displayMode,
        throwOnError,
        errorColor,
        strict,
        trust,
        maxSize,
        maxExpand,
        output: 'html',
      });
    } catch (error: any) {
      const errorMsg = error?.message || '公式渲染错误';
      const displayFormula =
        formula.length > 80 ? formula.substring(0, 80) + '...' : formula;
      return `<span style="color:${errorColor};font-family:monospace;" title="${errorMsg}">
        [LaTeX错误: ${displayFormula}]
      </span>`;
    }
  }, [formula, displayMode, throwOnError, errorColor, strict, trust, maxSize, maxExpand]);

  const containerStyle: React.CSSProperties = {
    ...(displayMode
      ? {
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '0.5em 0',
          overflow: 'auto',
        }
      : {
          display: 'inline-flex',
          alignItems: 'center',
          verticalAlign: 'middle',
        }),
    ...style,
  };

  return (
    <span
      className={`formula-renderer ${displayMode ? 'formula-block' : 'formula-inline'} ${className}`}
      style={containerStyle}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export interface MultiFormulaRendererProps {
  formulas: string[];
  displayMode?: boolean;
  className?: string;
  separator?: React.ReactNode;
}

export function MultiFormulaRenderer({
  formulas,
  displayMode = true,
  className = '',
  separator,
}: MultiFormulaRendererProps) {
  return (
    <div className={`multi-formula-renderer ${className}`}>
      {formulas.map((formula, index) => (
        <span key={index}>
          <FormulaRenderer formula={formula} displayMode={displayMode} />
          {separator && index < formulas.length - 1 && separator}
        </span>
      ))}
    </div>
  );
}
