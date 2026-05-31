/**
 * 好力 GO — 模具台账来源，与后端 `apps.haoligo.constants.mold_ledger_source` 一致。
 */

export const MOLD_LEDGER_SOURCE_VALUES = ['sync', 'manual'] as const;

export type MoldLedgerSource = (typeof MOLD_LEDGER_SOURCE_VALUES)[number];

export const MOLD_LEDGER_SOURCE_LABELS: Record<MoldLedgerSource, string> = {
  sync: '同步',
  manual: '手工创建',
};

export const MOLD_LEDGER_SOURCE_TAG_COLORS: Record<MoldLedgerSource, string> = {
  sync: 'blue',
  manual: 'default',
};

export function getMoldLedgerSourceLabel(source: string | null | undefined): string {
  const key = (source || '').trim().toLowerCase();
  if (!key) return MOLD_LEDGER_SOURCE_LABELS.manual;
  if (key === 'sync' || key === 'manual') return MOLD_LEDGER_SOURCE_LABELS[key];
  return '—';
}

export function getMoldLedgerSourceTagColor(source: string | null | undefined): string | undefined {
  const key = (source || '').trim().toLowerCase();
  if (!key) return MOLD_LEDGER_SOURCE_TAG_COLORS.manual;
  if (key === 'sync' || key === 'manual') return MOLD_LEDGER_SOURCE_TAG_COLORS[key];
  return undefined;
}
