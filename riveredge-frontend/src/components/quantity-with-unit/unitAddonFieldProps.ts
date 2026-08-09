import { resolveMaterialUnitLabel } from '../../utils/materialUnitDisplay';

/** ProFormDigit / InputNumber 数量字段右侧单位展示 */
export function unitAddonFieldProps(
  unitCode: unknown,
  unitLabelMap?: Record<string, string>,
): { addonAfter?: string } {
  const raw = String(unitCode ?? '').trim();
  if (!raw) return {};
  const label = unitLabelMap ? resolveMaterialUnitLabel(raw, unitLabelMap) : raw;
  return { addonAfter: label || raw };
}
