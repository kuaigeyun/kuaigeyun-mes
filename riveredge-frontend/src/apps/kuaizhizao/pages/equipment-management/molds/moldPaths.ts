export const KUAIZHIZAO_MOLD_LIST_PATH = '/apps/kuaizhizao/equipment-management/molds';

export const KUAIZHIZAO_MOLD_DETAIL_PATH = `${KUAIZHIZAO_MOLD_LIST_PATH}/:uuid`;

export function buildMoldDetailPath(uuid: string, tab?: string): string {
  const base = `${KUAIZHIZAO_MOLD_LIST_PATH}/${uuid}`;
  return tab ? `${base}?tab=${encodeURIComponent(tab)}` : base;
}

export type MoldDetailTabKey = 'info' | 'borrow_return' | 'calibrations' | 'ops';

export function resolveMoldDetailTabKey(raw: string | null): MoldDetailTabKey {
  const allowed: MoldDetailTabKey[] = ['info', 'borrow_return', 'calibrations', 'ops'];
  if (raw && allowed.includes(raw as MoldDetailTabKey)) {
    return raw as MoldDetailTabKey;
  }
  return 'info';
}
