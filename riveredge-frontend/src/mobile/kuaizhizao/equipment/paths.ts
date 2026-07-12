/** 快制造设备企微 H5 路由（唯一真源） */

export const KUAIZHIZAO_MOBILE_EQUIPMENT_BASE = '/m/kuaizhizao/equipment';

export const KUAIZHIZAO_MOBILE_EQUIPMENT_SCAN_PATH = `${KUAIZHIZAO_MOBILE_EQUIPMENT_BASE}/scan`;
export const KUAIZHIZAO_MOBILE_EQUIPMENT_SPOT_CHECKS_PATH = `${KUAIZHIZAO_MOBILE_EQUIPMENT_BASE}/spot-checks`;
export const KUAIZHIZAO_MOBILE_EQUIPMENT_FAULTS_PATH = `${KUAIZHIZAO_MOBILE_EQUIPMENT_BASE}/faults`;
export const KUAIZHIZAO_MOBILE_EQUIPMENT_MAINTENANCE_PATH = `${KUAIZHIZAO_MOBILE_EQUIPMENT_BASE}/maintenance-reminders`;

/** 企微 H5 应用 document.title */
export const KUAIZHIZAO_MOBILE_EQUIPMENT_APP_TITLE_KEY = 'app.kuaizhizao.mobileEquipment.appTitle';

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
