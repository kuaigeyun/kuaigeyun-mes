/** 厂内维保单 → 模具维保完成单（带出来源）深链 */

import type { InhouseMaintenanceServiceType } from '../constants/documentPermissionResources';

export const INHOUSE_UPKEEP_COMPLETE_PATH = '/apps/haoligo/molds/documents/upkeep-complete';
export const INHOUSE_REPAIR_COMPLETE_PATH = '/apps/haoligo/molds/documents/repair-complete';

export const INHOUSE_COMPLETE_SOURCE_MAINTENANCE_PARAM = 'source_maintenance_sheet_id';

export function inhouseCompletePathForServiceType(
  serviceType: InhouseMaintenanceServiceType,
): string {
  return serviceType === '保养' ? INHOUSE_UPKEEP_COMPLETE_PATH : INHOUSE_REPAIR_COMPLETE_PATH;
}

export function buildInhouseCompleteCreateFromMaintenanceUrl(
  maintenanceSheetId: number,
  serviceType: InhouseMaintenanceServiceType,
): string {
  return `${inhouseCompletePathForServiceType(serviceType)}?${INHOUSE_COMPLETE_SOURCE_MAINTENANCE_PARAM}=${maintenanceSheetId}`;
}
