/**
 * 按需加载 SVAR 甘特图图标字体 CSS
 *
 * 背景：`wx-icons.css` 仅在甘特图组件里使用，但之前写死在 index.html / login.html
 * 的 `<link rel="stylesheet">`，每次访问系统（包括登录页/无甘特图的页面）都会发起
 * 外链请求与 DNS/连接握手。改成按需注入：真正打开甘特图组件时再加载，幂等。
 */

const GANTT_ICONS_CSS_HREF = 'https://cdn.svar.dev/fonts/wxi/wx-icons.css';

let injected = false;

export function ensureGanttIconsCssLoaded(): void {
  if (injected) return;
  if (typeof document === 'undefined') return;

  // 如果已存在（可能由 HTML 或他处注入过），标记为已处理后直接返回
  const existing = document.head.querySelector(
    `link[data-riveredge="gantt-icons"], link[href="${GANTT_ICONS_CSS_HREF}"]`,
  );
  if (existing) {
    injected = true;
    return;
  }

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = GANTT_ICONS_CSS_HREF;
  link.crossOrigin = 'anonymous';
  link.setAttribute('data-riveredge', 'gantt-icons');
  document.head.appendChild(link);
  injected = true;
}
