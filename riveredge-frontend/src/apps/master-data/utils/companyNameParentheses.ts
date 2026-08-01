/** 公司名中的英文半角括号 */
const ASCII_PAREN_RE = /[()]/;

/** 将英文半角括号替换为中文全角括号 */
export function toChineseParentheses(name: string): string {
  return String(name ?? '')
    .replace(/\(/g, '（')
    .replace(/\)/g, '）');
}

export function hasAsciiParentheses(name: unknown): boolean {
  return typeof name === 'string' && ASCII_PAREN_RE.test(name);
}
