/** 永久禁止间隔号作标题分隔：展示/落库前剥离 */
const MIDDLE_DOT_SEPARATORS = /[·・•]/g

export function stripMiddleDotSeparator(value: unknown): string {
  return String(value ?? '').replace(MIDDLE_DOT_SEPARATORS, '')
}
