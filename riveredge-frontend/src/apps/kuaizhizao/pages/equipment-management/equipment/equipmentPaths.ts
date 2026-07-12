export const KUAIZHIZAO_EQUIPMENT_LIST_PATH = '/apps/kuaizhizao/equipment-management/equipment';

export const KUAIZHIZAO_EQUIPMENT_DETAIL_PATH = `${KUAIZHIZAO_EQUIPMENT_LIST_PATH}/:uuid`;

export function buildEquipmentDetailPath(uuid: string, tab?: string): string {
  const base = `${KUAIZHIZAO_EQUIPMENT_LIST_PATH}/${uuid}`;
  return tab ? `${base}?tab=${encodeURIComponent(tab)}` : base;
}

export type EquipmentDetailTabKey =
  | 'info'
  | 'spot_checks'
  | 'route_patrols'
  | 'faults_repairs'
  | 'maintenance'
  | 'spare_parts'
  | 'scrap';
