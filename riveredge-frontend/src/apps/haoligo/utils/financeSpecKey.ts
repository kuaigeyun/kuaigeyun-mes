/** 规格比对键：去掉空格与中英文括号（与后端 finance_spec_key 一致） */

const SPEC_KEY_STRIP_RE = /[\s()（）\[\]【】{}｛｝]/g;

export function normalizeFinanceMaterialSpecKey(spec: unknown): string {
  return String(spec ?? '').trim().replace(SPEC_KEY_STRIP_RE, '');
}
