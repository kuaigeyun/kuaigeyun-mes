/**
 * 好力 GO — 模具台账 status 与后端 `apps.haoligo.constants.mold_status` 一致。
 */

export const MOLD_LEDGER_STATUSES = [
  '待启用',
  '待用',
  '在用',
  '维修',
  '保养',
  '外协维修',
  '报废',
  '停用',
] as const;

export type MoldLedgerStatus = (typeof MOLD_LEDGER_STATUSES)[number];

export const MOLD_LEDGER_STATUS_SET: ReadonlySet<string> = new Set(MOLD_LEDGER_STATUSES);

export const MOLD_STATUS_TAG_COLORS: Record<MoldLedgerStatus, string> = {
  待启用: 'cyan',
  待用: 'blue',
  在用: 'green',
  维修: 'volcano',
  保养: 'gold',
  外协维修: 'purple',
  报废: 'red',
  停用: 'default',
};

/** 仅对约定状态返回 antd Tag 的 color；未知状态返回 undefined（由调用方只渲染 Tag、不强行上色） */
export function getMoldLedgerStatusTagColor(status: string): string | undefined {
  if (!MOLD_LEDGER_STATUS_SET.has(status)) {
    return undefined;
  }
  return MOLD_STATUS_TAG_COLORS[status as MoldLedgerStatus];
}

/** 模具台账状态 → 图表配色（与 Tag 语义一致，值为 hex） */
export const MOLD_STATUS_CHART_COLORS: Record<MoldLedgerStatus, string> = {
  待启用: '#13c2c2',
  待用: '#1677ff',
  在用: '#52c41a',
  维修: '#fa541c',
  保养: '#faad14',
  外协维修: '#722ed1',
  报废: '#ff4d4f',
  停用: 'rgba(0, 0, 0, 0.45)',
};
