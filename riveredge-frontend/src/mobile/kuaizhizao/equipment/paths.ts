/** 快制造设备企微 H5 路由（唯一真源） */

export const KUAIZHIZAO_MOBILE_EQUIPMENT_BASE = '/m/kuaizhizao/equipment';

export function buildMobileEquipmentHubPath(uuid: string): string {
  return `${KUAIZHIZAO_MOBILE_EQUIPMENT_BASE}/${encodeURIComponent(uuid)}`;
}

export function buildMobileEquipmentSpotCheckPath(uuid: string): string {
  return `${buildMobileEquipmentHubPath(uuid)}/spot-check`;
}

export function buildMobileEquipmentFaultPath(uuid: string): string {
  return `${buildMobileEquipmentHubPath(uuid)}/fault`;
}

export function buildMobileEquipmentStatusPath(uuid: string): string {
  return `${buildMobileEquipmentHubPath(uuid)}/status`;
}

export const KUAIZHIZAO_MOBILE_EQUIPMENT_SCAN_PATH = `${KUAIZHIZAO_MOBILE_EQUIPMENT_BASE}/scan`;
