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

const CONFLICT_TYPE_LABELS: Record<string, string> = {
  station_overlap: '工位重叠',
  equipment_overlap: '设备重叠',
  mold_overlap: '模具冲突',
  tool_overlap: '工装冲突',
  sequence_violation: '工序顺序',
  frozen: '已冻结',
  freeze_window: '冻结窗',
};

export function conflictTypeLabel(type: string): string {
  return CONFLICT_TYPE_LABELS[type] || type;
}

function missingFieldLabel(field: 'planned_start_date' | 'planned_end_date'): string {
  return field === 'planned_start_date' ? '未设计划开始' : '未设计划结束';
}

/** 汇总工单在待排表格中展示的排产问题（本地校验 + board-scan 诊断） */
export function collectWorkOrderDiagnosticIssues(
  wo: WorkOrderForGantt,
  boardScan: VisualSchedulingBoardScan | null | undefined
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
      label: missingFieldLabel(field),
    });
  }

  const missingStations = getOperationsNeedingStation(wo);
  if (missingStations.length > 0) {
    push({
      key: 'missing-station',
      severity: 'warning',
      label: `${missingStations.length} 道工序缺工位`,
    });
  }

  if (!boardScan) return issues;

  for (const item of boardScan.unscheduled_orders ?? []) {
    if (item.work_order_id !== wo.id) continue;
    if (issues.some((i) => i.key.startsWith('missing-planned'))) continue;
    push({
      key: 'unscheduled',
      severity: 'warning',
      label: item.reason || '未设置计划起止时间',
    });
  }

  for (const conflict of boardScan.conflicts ?? []) {
    if (conflict.work_order_id !== wo.id) continue;
    push({
      key: `conflict-${conflict.type}-${conflict.task_id ?? conflict.operation_id ?? conflict.message}`,
      severity: 'error',
      label: `${conflictTypeLabel(conflict.type)}`,
    });
  }

  for (const material of boardScan.material_issues ?? []) {
    if (material.work_order_id !== wo.id) continue;
    push({
      key: 'material',
      severity: 'warning',
      label: material.message || '齐套不足',
    });
  }

  return issues;
}
