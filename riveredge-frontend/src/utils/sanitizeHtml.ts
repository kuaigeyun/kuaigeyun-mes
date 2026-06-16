import DOMPurify from 'dompurify';

const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'h1',
  'h2',
  'h3',
  'h4',
  'ul',
  'ol',
  'li',
  'a',
  'span',
  'div',
  'blockquote',
];

const ALLOWED_ATTR = ['href', 'target', 'rel', 'class', 'style'];

/** 清洗登录页等用户配置的 HTML，防止 XSS */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}

/** 判断内容是否包含 HTML 标签（用于兼容历史纯文本） */
export function looksLikeHtml(content: string): boolean {
  const trimmed = (content || '').trim();
  if (!trimmed) return false;
  return /<[a-z][\s\S]*>/i.test(trimmed);
}
