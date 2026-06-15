import type { TFunction } from 'i18next';
import type { VisualSchedulingBoardScan } from '../../../../services/production';
import type { WorkOrderForGantt } from '../../../../components/GanttSchedulingChart/types';
import {
  getOperationsNeedingStation,
  getWorkOrderSchedulingMissingFields,
} from '../schedulingDropUtils';

export type WorkOrderDiagnosticSeverity = 'error' | 'warning';

export interface WorkOrderDiagnosticIssue {
  key: string;
  severity: WorkOrderDiagnosticSeverity;
  label: string;
}

const CONFLICT_TYPE_KEYS: Record<string, string> = {
  station_overlap: 'app.kuaizhizao.scheduling.diagnostics.conflict.stationOverlap',
  equipment_overlap: 'app.kuaizhizao.scheduling.diagnostics.conflict.equipmentOverlap',
  mold_overlap: 'app.kuaizhizao.scheduling.diagnostics.conflict.moldOverlap',
  tool_overlap: 'app.kuaizhizao.scheduling.diagnostics.conflict.toolOverlap',
  sequence_violation: 'app.kuaizhizao.scheduling.diagnostics.conflict.sequenceViolation',
  frozen: 'app.kuaizhizao.scheduling.diagnostics.conflict.frozen',
  freeze_window: 'app.kuaizhizao.scheduling.diagnostics.conflict.freezeWindow',
};

export function conflictTypeLabel(type: string, t?: TFunction): string {
  const key = CONFLICT_TYPE_KEYS[type];
  return key && t ? t(key) : type;
}

function missingFieldLabel(
  field: 'planned_start_date' | 'planned_end_date',
  t: TFunction
): string {
  return field === 'planned_start_date'
    ? t('app.kuaizhizao.scheduling.diagnostics.missingPlannedStart')
    : t('app.kuaizhizao.scheduling.diagnostics.missingPlannedEnd');
}

/** 汇总工单在待排表格中展示的排产问题（本地校验 + board-scan 诊断） */
export function collectWorkOrderDiagnosticIssues(
  wo: WorkOrderForGantt,
  boardScan: VisualSchedulingBoardScan | null | undefined,
  t: TFunction
): WorkOrderDiagnosticIssue[] {
  const issues: WorkOrderDiagnosticIssue[] = [];
  const seen = new Set<string>();

  const push = (issue: WorkOrderDiagnosticIssue) => {
    if (seen.has(issue.key)) return;
    seen.add(issue.key);
    issues.push(issue);
  };

  for (const field of getWorkOrderSchedulingMissingFields(wo)) {
    push({
      key: `missing-${field}`,
      severity: 'warning',
      label: missingFieldLabel(field, t),
    });
  }

  const missingStations = getOperationsNeedingStation(wo);
  if (missingStations.length > 0) {
    push({
      key: 'missing-station',
      severity: 'warning',
      label: t('app.kuaizhizao.scheduling.diagnostics.missingStations', { count: missingStations.length }),
    });
  }

  if (!boardScan) return issues;

  for (const item of boardScan.unscheduled_orders ?? []) {
    if (item.work_order_id !== wo.id) continue;
    if (issues.some((i) => i.key.startsWith('missing-planned'))) continue;
    push({
      key: 'unscheduled',
      severity: 'warning',
      label: item.reason || t('app.kuaizhizao.scheduling.diagnostics.unscheduledFallback'),
    });
  }

  for (const conflict of boardScan.conflicts ?? []) {
    if (conflict.work_order_id !== wo.id) continue;
    push({
      key: `conflict-${conflict.type}-${conflict.task_id ?? conflict.operation_id ?? conflict.message}`,
      severity: 'error',
      label: conflictTypeLabel(conflict.type, t),
    });
  }

  for (const material of boardScan.material_issues ?? []) {
    if (material.work_order_id !== wo.id) continue;
    push({
      key: 'material',
      severity: 'warning',
      label: material.message || t('app.kuaizhizao.scheduling.diagnostics.materialShortageFallback'),
    });
  }

  return issues;
}
