/**
 * 字体常量
 * 与 global.less 中 code 元素字体一致
 */
export const CODE_FONT_FAMILY =
  "'JetBrains Mono', 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace";

/** 英文界面 UI 字体（正文、Ant Design 组件、顶栏 LOGO 等） */
export const ENGLISH_UI_FONT_FAMILY =
  "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const ENGLISH_UI_FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap';

const ENGLISH_UI_FONT_CSS_VAR = '--riveredge-ui-font-family';

let englishUiFontInjected = false;

/** 按需加载英文 UI 字体，避免中文界面等多余请求 */
export function ensureEnglishUiFontLoaded(): void {
  if (englishUiFontInjected) return;
  if (typeof document === 'undefined') return;

  const existing = document.head.querySelector(
    `link[data-riveredge="english-ui-font"], link[href="${ENGLISH_UI_FONT_HREF}"]`,
  );
  if (existing) {
    englishUiFontInjected = true;
    return;
  }

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = ENGLISH_UI_FONT_HREF;
  link.setAttribute('data-riveredge', 'english-ui-font');
  document.head.appendChild(link);
  englishUiFontInjected = true;
}

/** 随语言切换同步英文 UI 字体（html class + CSS 变量） */
export function syncEnglishUiFont(language: string): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const isEnglish = language.startsWith('en');

  if (isEnglish) {
    ensureEnglishUiFontLoaded();
    root.classList.add('locale-en');
    root.style.setProperty(ENGLISH_UI_FONT_CSS_VAR, ENGLISH_UI_FONT_FAMILY);
  } else {
    root.classList.remove('locale-en');
    root.style.removeProperty(ENGLISH_UI_FONT_CSS_VAR);
  }
}
