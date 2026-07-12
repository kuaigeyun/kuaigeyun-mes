import { apiRequest } from '../../../../services/api';

export interface MobileWorkbenchEntry {
  key: string;
  label: string;
  route: string;
  icon: string;
  icon_group?: string;
  solo_row?: boolean;
}

export interface MobileWorkbenchSection {
  key: string;
  title: string;
  entries: MobileWorkbenchEntry[];
}

export interface MobileEquipmentBootstrap {
  pending_fault_count: number;
  overdue_maintenance_reminder_count: number;
}

export const mobileEquipmentApi = {
  getWorkbench: (scope = 'equipment') =>
    apiRequest<MobileWorkbenchSection[]>(`/apps/kuaizhizao/mobile/workbench`, {
      method: 'GET',
      params: { scope },
    }),

  getBootstrap: () =>
    apiRequest<MobileEquipmentBootstrap>(`/apps/kuaizhizao/mobile/bootstrap`, {
      method: 'GET',
    }),
};
