/** 报工记录同步字段白名单（目标字段） */

import type { SyncTargetField } from '../../../../../components/sync-from-source-modal/types';

export const REPORTING_SYNC_TARGET_FIELDS: SyncTargetField[] = [
  { value: 'work_order_code', labelKey: 'app.kuaizhizao.workReporting.syncField.workOrderCode', required: true },
  { value: 'operation_code', labelKey: 'app.kuaizhizao.workReporting.syncField.operationCode' },
  { value: 'operation_name', labelKey: 'app.kuaizhizao.workReporting.syncField.operationName', required: true },
  { value: 'worker_code', labelKey: 'app.kuaizhizao.workReporting.syncField.workerCode' },
  { value: 'worker_name', labelKey: 'app.kuaizhizao.workReporting.syncField.workerName' },
  { value: 'team_code', labelKey: 'app.kuaizhizao.workReporting.syncField.teamCode' },
  { value: 'team_name', labelKey: 'app.kuaizhizao.workReporting.syncField.teamName' },
  { value: 'reported_quantity', labelKey: 'app.kuaizhizao.workReporting.syncField.reportedQuantity' },
  { value: 'qualified_quantity', labelKey: 'app.kuaizhizao.workReporting.syncField.qualifiedQuantity', required: true },
  { value: 'unqualified_quantity', labelKey: 'app.kuaizhizao.workReporting.syncField.unqualifiedQuantity' },
  { value: 'work_hours', labelKey: 'app.kuaizhizao.workReporting.syncField.workHours' },
  { value: 'work_start_time', labelKey: 'app.kuaizhizao.workReporting.syncField.workStartTime' },
  { value: 'work_end_time', labelKey: 'app.kuaizhizao.workReporting.syncField.workEndTime' },
  { value: 'reported_at', labelKey: 'app.kuaizhizao.workReporting.syncField.reportedAt', required: true },
  { value: 'status', labelKey: 'app.kuaizhizao.workReporting.syncField.status' },
  { value: 'remarks', labelKey: 'app.kuaizhizao.workReporting.syncField.remarks' },
];

export const REPORTING_SYNC_REQUIRED_TARGETS = [
  'work_order_code',
  'operation_name',
  'qualified_quantity',
  'reported_at',
];

export const REPORTING_SYNC_CUSTOM_FIELD_TABLE = 'apps_kuaizhizao_reporting_records';
