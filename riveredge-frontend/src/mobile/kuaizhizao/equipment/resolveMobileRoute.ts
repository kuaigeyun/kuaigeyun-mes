import {
  KUAIZHIZAO_MOBILE_EQUIPMENT_FAULTS_PATH,
  KUAIZHIZAO_MOBILE_EQUIPMENT_MAINTENANCE_PATH,
  KUAIZHIZAO_MOBILE_EQUIPMENT_SCAN_PATH,
  KUAIZHIZAO_MOBILE_EQUIPMENT_SPOT_CHECKS_PATH,
} from './paths';

const PC_TO_MOBILE_ROUTE: Record<string, string> = {
  '/apps/kuaizhizao/equipment-management/spot-checks': KUAIZHIZAO_MOBILE_EQUIPMENT_SPOT_CHECKS_PATH,
  '/apps/kuaizhizao/equipment-management/equipment-faults': KUAIZHIZAO_MOBILE_EQUIPMENT_FAULTS_PATH,
  '/apps/kuaizhizao/equipment-management/maintenance-reminders': KUAIZHIZAO_MOBILE_EQUIPMENT_MAINTENANCE_PATH,
};

/** 将 manifest / 旧 PC 路由解析为企微 H5 路由 */
export function resolveMobileEquipmentRoute(route: string): string {
  const trimmed = route.trim();
  if (trimmed.startsWith('/m/')) {
    return trimmed;
  }
  return PC_TO_MOBILE_ROUTE[trimmed] ?? trimmed;
}

export function isMobileEquipmentInternalRoute(route: string): boolean {
  const resolved = resolveMobileEquipmentRoute(route);
  return resolved.startsWith('/m/kuaizhizao/equipment');
}

export { KUAIZHIZAO_MOBILE_EQUIPMENT_SCAN_PATH };
