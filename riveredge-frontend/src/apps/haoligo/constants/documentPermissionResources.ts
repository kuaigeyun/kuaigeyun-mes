/** 与 manifest / 后端 sheet 资源权限前缀一致（简易审核，非平台审批流） */
export const HAOLIGO_RESOURCE_MOLD_TRIAL = 'haoligo:molds-documents-trial';
export const HAOLIGO_RESOURCE_MOLD_BORROW_OUT = 'haoligo:molds-documents-borrow-out';
export const HAOLIGO_RESOURCE_MOLD_RETURN_IN = 'haoligo:molds-documents-return-in';
export const HAOLIGO_RESOURCE_EQUIPMENT_SPOT_CHECK = 'haoligo:equipment-documents-spot-check';
export const HAOLIGO_RESOURCE_EQUIPMENT_ROUTE_PATROL = 'haoligo:equipment-documents-route-patrol';
export const HAOLIGO_RESOURCE_EQUIPMENT_UPKEEP_SHEET = 'haoligo:equipment-documents-upkeep-sheet';
export const HAOLIGO_RESOURCE_EQUIPMENT_UPKEEP_COMPLETE = 'haoligo:equipment-documents-upkeep-complete';
export const HAOLIGO_RESOURCE_EQUIPMENT_OUTPUT_RECORD = 'haoligo:equipment-documents-output-record';
export const HAOLIGO_RESOURCE_EQUIPMENT_STATUS_ADJUSTMENT =
  'haoligo:equipment-documents-status-adjustment';
export const HAOLIGO_RESOURCE_EQUIPMENT_ACCEPTANCE = 'haoligo:equipment-documents-acceptance';
export const HAOLIGO_RESOURCE_MOLD_UPKEEP = 'haoligo:molds-documents-upkeep';
export const HAOLIGO_RESOURCE_MOLD_UPKEEP_COMPLETE = 'haoligo:molds-documents-upkeep-complete';
export const HAOLIGO_RESOURCE_MOLD_REPAIR = 'haoligo:molds-documents-repair';
export const HAOLIGO_RESOURCE_MOLD_REPAIR_COMPLETE = 'haoligo:molds-documents-repair-complete';
export const HAOLIGO_RESOURCE_OUTSOURCE_MAINTENANCE = 'haoligo:molds-documents-outsource-maintenance';
export const HAOLIGO_RESOURCE_OUTSOURCE_MAINTENANCE_COMPLETE =
  'haoligo:molds-documents-outsource-complete';

export type InhouseMaintenanceServiceType = '保养' | '维修';

export function inhouseSheetResourceForServiceType(
  serviceType: InhouseMaintenanceServiceType,
): string {
  return serviceType === '保养' ? HAOLIGO_RESOURCE_MOLD_UPKEEP : HAOLIGO_RESOURCE_MOLD_REPAIR;
}

export function inhouseCompleteResourceForServiceType(
  serviceType: InhouseMaintenanceServiceType,
): string {
  return serviceType === '保养'
    ? HAOLIGO_RESOURCE_MOLD_UPKEEP_COMPLETE
    : HAOLIGO_RESOURCE_MOLD_REPAIR_COMPLETE;
}
