import { HallucinationGuardService, HallucinationType } from './hallucination-guard.service';

/**
 * 幻觉防控服务边界单测。
 *
 * 聚焦 verifyTheoremUsage 的两类核心检测（这是"AI 不信任自评"防线的最外层）：
 *   1. 虚构定理：步骤里引用不存在的定理名 → FALSE_THEOREM（critical）
 *   2. 误用条件：引用了真实定理但未验证其前提 → MISAPPLIED_CONDITION
 * 辅助纯函数：isLikelyFakeTheoremName / normalizeExpression / calculateSimilarity。
 */
describe('HallucinationGuardService 幻觉防控', () => {
  const guard = new HallucinationGuardService();

  describe('verifyTheoremUsage — 虚构定理检测', () => {
    it('引用不存在的定理名 → 判 FALSE_THEOREM', () => {
      const issues = guard.verifyTheoremUsage('根据量子中值定理，函数在区间上取得极值');
      expect(issues.some(i => i.type === HallucinationType.FALSE_THEOREM)).toBe(true);
    });

    it('引用真实定理（罗尔定理）→ 不判虚构定理', () => {
      const issues = guard.verifyTheoremUsage('由罗尔定理可知，存在 ξ 使 f\'(ξ)=0');
      expect(issues.some(i => i.type === HallucinationType.FALSE_THEOREM)).toBe(false);
    });

    it('引用真实法则（洛必达）→ 不判虚构定理', () => {
      const issues = guard.verifyTheoremUsage('应用洛必达法则求该极限');
      expect(issues.some(i => i.type === HallucinationType.FALSE_THEOREM)).toBe(false);
    });

    it('空步骤不产生任何 issue', () => {
      expect(guard.verifyTheoremUsage('')).toHaveLength(0);
      expect(guard.verifyTheoremUsage('这是一个普通的代数计算步骤')).toHaveLength(0);
    });
  });

  describe('verifyTheoremUsage — 条件未验证检测', () => {
    it('引用罗尔定理但未验证 f(a)=f(b) → 判 MISAPPLIED_CONDITION', () => {
      const issues = guard.verifyTheoremUsage('由罗尔定理得 f\'(ξ)=0');
      expect(issues.some(i => i.type === HallucinationType.MISAPPLIED_CONDITION)).toBe(true);
    });

    it('引用罗尔定理且验证了全部条件 → 不误判 critical', () => {
      // extractConditionKeywords 将条件按非中英文字符分词，长度≥2 的词才作为关键词：
      //   "f在[a,b]上连续" → 连续；"f在(a,b)内可导" → 可导；"f(a)=f(b)（端点值相等）" → 端点值相等
      const content = '因为 f 在 [a,b] 上连续，在 (a,b) 内可导，且满足端点值相等，由罗尔定理得 f\'(ξ)=0';
      const issues = guard.verifyTheoremUsage(content);
      // 三个前提关键词均已出现，不应再因"未验证条件"报 critical
      const criticals = issues.filter(i => i.type === HallucinationType.MISAPPLIED_CONDITION && i.severity === 'critical');
      expect(criticals).toHaveLength(0);
    });
  });

  describe('辅助纯函数', () => {
    it('normalizeExpression 去除空白/反斜杠/花括号并小写', () => {
      const g: any = guard;
      expect(g.normalizeExpression('\\frac{a}{b} + C')).toBe('fracab+c');
    });

    it('calculateSimilarity 相同串为 1，完全不同为 0', () => {
      const g: any = guard;
      expect(g.calculateSimilarity('x+1', 'x+1')).toBe(1);
      expect(g.calculateSimilarity('x', 'y')).toBe(0);
    });

    it('calculateSimilarity 空串返回 0', () => {
      const g: any = guard;
      expect(g.calculateSimilarity('', '')).toBe(0);
      expect(g.calculateSimilarity('x', '')).toBe(0);
    });

    it('isLikelyFakeTheoremName 对真实定理名返回 false', () => {
      const g: any = guard;
      expect(g.isLikelyFakeTheoremName('罗尔定理')).toBe(false);
      expect(g.isLikelyFakeTheoremName('洛必达法则')).toBe(false);
    });

    it('isLikelyFakeTheoremName 对虚构名返回 true', () => {
      const g: any = guard;
      expect(g.isLikelyFakeTheoremName('量子中值定理')).toBe(true);
      expect(g.isLikelyFakeTheoremName('宇宙终极公式')).toBe(true);
    });
  });
});
