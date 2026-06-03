import type { CurrentUser } from '../../../types/api';
import { hasModulePermission } from '../../../utils/permissionContract';
import type { HaoligoPrintDocumentType } from '../components/HaoligoDocumentPrintModal';
import {
  HAOLIGO_RESOURCE_MOLD_UPKEEP_COMPLETE,
  HAOLIGO_RESOURCE_OUTSOURCE_MAINTENANCE_COMPLETE,
  inhouseCompleteResourceForServiceType,
  type InhouseMaintenanceServiceType,
} from '../constants/documentPermissionResources';

const PRINT_DOCUMENT_TYPE_RESOURCE: Record<HaoligoPrintDocumentType, string> = {
  equipment_spot_check: 'haoligo:equipment-documents-spot-check',
  equipment_upkeep_complete: 'haoligo:equipment-documents-upkeep-complete',
  mold_maintenance_complete: HAOLIGO_RESOURCE_MOLD_UPKEEP_COMPLETE,
  mold_outsource_maintenance_complete: HAOLIGO_RESOURCE_OUTSOURCE_MAINTENANCE_COMPLETE,
};

/** 厂内完修单打印权限按保养/维修分属不同资源 */
export function printResourceForMoldMaintenanceComplete(
  serviceType: InhouseMaintenanceServiceType,
): string {
  return inhouseCompleteResourceForServiceType(serviceType);
}

export function printResourceForDocumentType(documentType: HaoligoPrintDocumentType): string {
  return PRINT_DOCUMENT_TYPE_RESOURCE[documentType];
}

export function canPrintHaoligoDocument(
  user: CurrentUser | undefined,
  resource: string,
): boolean {
  return hasModulePermission(user, resource, 'print');
}

export function canPrintHaoligoDocumentByType(
  user: CurrentUser | undefined,
  documentType: HaoligoPrintDocumentType,
  options?: { moldMaintenanceServiceType?: InhouseMaintenanceServiceType },
): boolean {
  if (documentType === 'mold_maintenance_complete' && options?.moldMaintenanceServiceType) {
    return canPrintHaoligoDocument(
      user,
      printResourceForMoldMaintenanceComplete(options.moldMaintenanceServiceType),
    );
  }
  return canPrintHaoligoDocument(user, printResourceForDocumentType(documentType));
}
