/** 外协维修单 → 外协维修完成单（带出来源）深链 */

export const OUTSOURCE_MAINTENANCE_COMPLETE_PATH = '/apps/haoligo/molds/documents/outsource-complete';

export const OUTSOURCE_COMPLETE_SOURCE_MAINTENANCE_PARAM = 'source_maintenance_id';

export function buildOutsourceCompleteCreateFromMaintenanceUrl(maintenanceSheetId: number): string {
  return `${OUTSOURCE_MAINTENANCE_COMPLETE_PATH}?${OUTSOURCE_COMPLETE_SOURCE_MAINTENANCE_PARAM}=${maintenanceSheetId}`;
}
