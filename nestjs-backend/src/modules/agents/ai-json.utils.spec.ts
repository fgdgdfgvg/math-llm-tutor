import { extractAiJson } from './ai-json.utils';

describe('extractAiJson（AI 输出 JSON 健壮解析）', () => {
  it('解析纯 JSON 对象', () => {
    expect(extractAiJson('{"a":1}')).toEqual({ a: 1 });
  });

  it('解析 markdown 代码块包裹的 JSON', () => {
    const content = '好的，以下是评估结果：\n```json\n{"accuracy": 0.9, "rating": "good"}\n```\n希望有帮助';
    expect(extractAiJson(content)).toEqual({ accuracy: 0.9, rating: 'good' });
  });

  it('解析前后夹带说明文字的 JSON', () => {
    const content = '评估结果如下 {"accuracy": 0.8, "suggestions": ["a"]} 以上。';
    expect(extractAiJson(content)).toEqual({ accuracy: 0.8, suggestions: ['a'] });
  });

  it('修复被照抄的模板占位值 "accuracy": 0-1（FeedbackAgent 历史故障形态）', () => {
    const content = '{"accuracy": 0-1, "completeness": 0-1, "clarity": 0-1, "suggestions": ["建议"], "improvements": [], "rating": "good"}';
    const parsed = extractAiJson(content);
    expect(parsed).not.toBeNull();
    expect(parsed!.rating).toBe('good');
    expect(parsed!.accuracy).toBe(0.5); // 0-1 的中点
  });

  it('修复尾逗号', () => {
    expect(extractAiJson('{"a": 1, "b": [1, 2,],}')).toEqual({ a: 1, b: [1, 2] });
  });

  it('修复中文引号', () => {
    expect(extractAiJson('{“isValid”: true, “confidence”: 0.8}')).toEqual({ isValid: true, confidence: 0.8 });
  });

  it('嵌套结构中提取深层对象（取含已知字段最多者）', () => {
    const content = '前言 {"meta": {"note": "xx"}} 结果 {"isValid": false, "errorMessage": "符号错误", "confidence": 0.4}';
    const parsed = extractAiJson(content);
    expect(parsed).toEqual({ isValid: false, errorMessage: '符号错误', confidence: 0.4 });
  });

  it('补齐被截断的对象', () => {
    const truncated = '{"accuracy": 0.9, "suggestions": ["建议1", "建议2"';
    const parsed = extractAiJson(truncated);
    expect(parsed).not.toBeNull();
    expect(parsed!.accuracy).toBe(0.9);
    expect(parsed!.suggestions).toEqual(['建议1', '建议2']);
  });

  it('无 JSON 时返回 null 而不抛异常', () => {
    expect(extractAiJson('这是纯文本说明，没有任何结构化内容')).toBeNull();
    expect(extractAiJson('')).toBeNull();
    expect(extractAiJson(null as any)).toBeNull();
  });

  it('字符串内的花括号不会干扰括号配平', () => {
    const content = '{"errorMessage": "括号 } 是文本内容", "confidence": 0.9}';
    expect(extractAiJson(content)).toEqual({ errorMessage: '括号 } 是文本内容', confidence: 0.9 });
  });
});
