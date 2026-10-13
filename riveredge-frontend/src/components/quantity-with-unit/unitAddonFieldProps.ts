/** ProFormDigit / InputNumber 数量字段右侧单位（业务字段直出名称） */
export function unitAddonFieldProps(
  unit: unknown,
  _unitLabelMap?: Record<string, string>,
): { suffix?: string } {
  const raw = String(unit ?? '').trim();
  if (!raw) return {};
  return { suffix: raw };
}
