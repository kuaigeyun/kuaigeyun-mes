/** 拼接 UI 展示片段（不使用圆点 - 分隔） */
export function joinDisplayParts(...parts: Array<string | number | undefined | null | false>): string {
  return parts
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(' ');
}

/** 编码 + 名称类展示：code - name */
export function formatCodeNameLabel(
  code: string | number | undefined | null,
  name: string | number | undefined | null,
): string {
  const c = String(code ?? '').trim();
  const n = String(name ?? '').trim();
  if (c && n) return `${c} - ${n}`;
  return c || n;
}
