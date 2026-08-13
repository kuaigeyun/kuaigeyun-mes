export const KUAIZHIZAO_TOOL_LEDGER_LIST_PATH = '/apps/kuaizhizao/equipment-management/tool-ledger';

export const KUAIZHIZAO_TOOL_LEDGER_DETAIL_PATH = `${KUAIZHIZAO_TOOL_LEDGER_LIST_PATH}/:uuid`;

export function buildToolLedgerDetailPath(uuid: string, tab?: string): string {
  const base = `${KUAIZHIZAO_TOOL_LEDGER_LIST_PATH}/${uuid}`;
  return tab ? `${base}?tab=${encodeURIComponent(tab)}` : base;
}

export type ToolLedgerDetailTabKey = 'info' | 'maintenances' | 'calibrations' | 'ops';

export function resolveToolLedgerDetailTabKey(raw: string | null): ToolLedgerDetailTabKey {
  const allowed: ToolLedgerDetailTabKey[] = ['info', 'maintenances', 'calibrations', 'ops'];
  if (raw && allowed.includes(raw as ToolLedgerDetailTabKey)) {
    return raw as ToolLedgerDetailTabKey;
  }
  return 'info';
}
