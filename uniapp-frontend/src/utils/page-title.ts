/**
 * 导航栏标题国际化
 *
 * pages.json 的 navigationBarTitleText 只能写死一种语言，于是切换到中文后
 * 顶部仍然是 “Home / AI Math Solver / Knowledge Graph”，与页面内容语言不一致。
 * 这里在页面显示和语言切换时把标题改成当前语言对应的文案。
 */
import { watch } from 'vue';
import i18n from '@/i18n';
import { t } from '@/i18n';

/** 路由（pages.json 里的 path，不带前导斜杠）→ i18n key */
const TITLE_KEYS: Record<string, string> = {
  'pages/login/index': 'nav.login',
  'pages/index/index': 'nav.home',
  'pages/solver/index': 'nav.solver',
  'pages/knowledge/index': 'nav.knowledge',
  'pages/progress/index': 'nav.progress',
  'pages/scenario/index': 'nav.scenario',
  'pages/settings/index': 'nav.settings',
  'pages/practice/index': 'nav.practice',
  'pages/mistakes/index': 'nav.mistakes',
  'pages/test/index': 'nav.test',
};

const normalizeRoute = (route: string): string => route.replace(/^\//, '').split('?')[0];

/** 把当前页面的导航栏标题设置为当前语言下的文案 */
export const applyNavigationTitle = (): void => {
  try {
    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
    const current: any = pages[pages.length - 1];
    const rawRoute: string = current?.route || current?.$page?.fullPath || '';
    if (!rawRoute) return;

    const key = TITLE_KEYS[normalizeRoute(rawRoute)];
    if (!key) return;

    const title = t(key);
    if (!title || title === key) return;

    uni.setNavigationBarTitle({ title });
  } catch (error) {
    console.warn('[PageTitle] 设置导航栏标题失败:', error);
  }
};

let watching = false;

/** 启动标题同步：首次应用一次，之后跟随语言切换 */
export const initNavigationTitles = (): void => {
  applyNavigationTitle();
  if (watching) return;
  watching = true;

  watch(
    () => (i18n.global.locale as unknown as { value: string }).value,
    () => applyNavigationTitle(),
  );
};
