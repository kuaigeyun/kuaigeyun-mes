/**
 * 字体常量
 * 与 global.less 中 code 元素字体一致
 */
export const CODE_FONT_FAMILY =
  "'JetBrains Mono', 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace";

/** 英文界面 UI 字体（正文、Ant Design 组件、顶栏 LOGO 等） */
export const ENGLISH_UI_FONT_FAMILY =
  "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

/** 老挝语界面 UI 字体（Noto Sans Lao 覆盖老挝文，其余回落到系统 UI） */
export const LAO_UI_FONT_FAMILY =
  "'Noto Sans Lao', 'Phetsarath OT', 'Saysettha OT', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const ENGLISH_UI_FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap';

const LAO_UI_FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Noto+Sans+Lao:wght@400;500;600;700&display=swap';

const UI_FONT_CSS_VAR = '--riveredge-ui-font-family';

const HTML_LANG: Record<string, string> = {
  'zh-CN': 'zh-CN',
  'zh-Hant': 'zh-Hant',
  'en-US': 'en',
  'ja-JP': 'ja',
  'vi-VN': 'vi',
  'lo-LA': 'lo',
};

let englishUiFontInjected = false;
let laoUiFontInjected = false;

function injectStylesheet(href: string, dataAttr: string): boolean {
  if (typeof document === 'undefined') return false;
  const existing = document.head.querySelector(`link[data-riveredge="${dataAttr}"], link[href="${href}"]`);
  if (existing) return true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.setAttribute('data-riveredge', dataAttr);
  document.head.appendChild(link);
  return true;
}

/** 按需加载英文 UI 字体，避免中文界面等多余请求 */
export function ensureEnglishUiFontLoaded(): void {
  if (englishUiFontInjected) return;
  englishUiFontInjected = injectStylesheet(ENGLISH_UI_FONT_HREF, 'english-ui-font');
}

export function ensureLaoUiFontLoaded(): void {
  if (laoUiFontInjected) return;
  laoUiFontInjected = injectStylesheet(LAO_UI_FONT_HREF, 'lao-ui-font');
}

export function resolveUiFontFamily(language: string): string | undefined {
  if (language.startsWith('en')) return ENGLISH_UI_FONT_FAMILY;
  if (language === 'lo-LA' || language.startsWith('lo')) return LAO_UI_FONT_FAMILY;
  return undefined;
}

/** 随语言切换同步 UI 字体与 html lang */
export function syncUiLocaleChrome(language: string): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const isEnglish = language.startsWith('en');
  const isLao = language === 'lo-LA' || language.startsWith('lo');

  root.lang = HTML_LANG[language] ?? language;

  root.classList.toggle('locale-en', isEnglish);
  root.classList.toggle('locale-lo', isLao);

  if (isEnglish) {
    ensureEnglishUiFontLoaded();
    root.style.setProperty(UI_FONT_CSS_VAR, ENGLISH_UI_FONT_FAMILY);
    return;
  }
  if (isLao) {
    ensureLaoUiFontLoaded();
    root.style.setProperty(UI_FONT_CSS_VAR, LAO_UI_FONT_FAMILY);
    return;
  }
  root.style.removeProperty(UI_FONT_CSS_VAR);
}

/** @deprecated 请使用 syncUiLocaleChrome */
export function syncEnglishUiFont(language: string): void {
  syncUiLocaleChrome(language);
}
