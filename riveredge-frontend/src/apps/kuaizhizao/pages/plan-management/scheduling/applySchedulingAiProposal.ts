/**
 * 将 AI 改期提案载入可视排产 Draft 暂存
 */

import type { MutableRefObject } from 'react';
import type { MessageInstance } from 'antd/es/message/interface';
import type { TFunction } from 'i18next';
import type { WorkOrderForGantt } from '../../components/GanttSchedulingChart/types';
import type { SchedulingAiProposal } from '../../services/scheduling-ai';

export interface ApplySchedulingAiProposalOptions {
  proposal: SchedulingAiProposal;
  draftWoUpdatesRef: MutableRefObject<
    Map<number, { work_order_id: number; planned_start_date: string; planned_end_date: string }>
  >;
  draftOpUpdatesRef: MutableRefObject<
    Map<number, { operation_id: number; planned_start_date: string; planned_end_date: string }>
  >;
  draftStationUpdatesRef: MutableRefObject<
    Map<number, { operation_id: number; assigned_station_id: number }>
  >;
  mutateGanttWorkOrders: (updater: (prev: WorkOrderForGantt[] | undefined) => WorkOrderForGantt[]) => void;
  pushUndoSnapshot: () => void;
  syncDraftPendingCount: () => void;
  setDraftMode: (on: boolean) => void;
  onPoolReorder?: (order: number[]) => void;
  message: MessageInstance;
  t: TFunction;
}

function applyStationUpdates(
  list: WorkOrderForGantt[],
  updates: Array<{ operation_id: number; assigned_station_id: number }>,
): WorkOrderForGantt[] {
  if (!updates.length) return list;
  const byOp = new Map(updates.map((u) => [u.operation_id, u.assigned_station_id]));
  return list.map((wo) => {
    if (!wo.operations?.length) return wo;
    let changed = false;
    const operations = wo.operations.map((op) => {
      if (op.id == null) return op;
      const sid = byOp.get(op.id);
      if (sid == null) return op;
      changed = true;
      return { ...op, assigned_station_id: sid };
    });
    return changed ? { ...wo, operations } : wo;
  });
}

export function applySchedulingAiProposal(options: ApplySchedulingAiProposalOptions): boolean {
  const {
    proposal,
    draftWoUpdatesRef,
    draftOpUpdatesRef,
    draftStationUpdatesRef,
    mutateGanttWorkOrders,
    pushUndoSnapshot,
    syncDraftPendingCount,
    setDraftMode,
    onPoolReorder,
    message,
    t,
  } = options;

  const woUpdates = (proposal.workOrderAdjustments ?? [])
    .filter((a) => a.workOrderId && a.plannedStartDate && a.plannedEndDate)
    .map((a) => ({
      work_order_id: a.workOrderId,
      planned_start_date: a.plannedStartDate,
      planned_end_date: a.plannedEndDate,
    }));

  const opUpdates = (proposal.operationAdjustments ?? [])
    .filter((a) => a.operationId && a.plannedStartDate && a.plannedEndDate)
    .map((a) => ({
      operation_id: a.operationId,
      planned_start_date: a.plannedStartDate!,
      planned_end_date: a.plannedEndDate!,
    }));

  const stationUpdates = (proposal.operationAdjustments ?? [])
    .filter((a) => a.operationId && a.assignedStationId)
    .map((a) => ({
      operation_id: a.operationId,
      assigned_station_id: a.assignedStationId!,
    }));

  const poolReorder = proposal.poolReorder ?? [];

  if (
    woUpdates.length === 0 &&
    opUpdates.length === 0 &&
    stationUpdates.length === 0 &&
    poolReorder.length === 0
  ) {
    message.warning(t('app.kuaizhizao.scheduling.aiAssist.applyEmpty'));
    return false;
  }

  pushUndoSnapshot();
  setDraftMode(true);

  mutateGanttWorkOrders((prev) => {
    let next = prev ?? [];
    if (woUpdates.length) {
      const byId = new Map(woUpdates.map((u) => [u.work_order_id, u]));
      next = next.map((wo) => {
        const patch = byId.get(wo.id);
        if (!patch) return wo;
        return {
          ...wo,
          planned_start_date: patch.planned_start_date,
          planned_end_date: patch.planned_end_date,
        };
      });
    }
    if (opUpdates.length) {
      const byOp = new Map(opUpdates.map((u) => [u.operation_id, u]));
      next = next.map((wo) => {
        if (!wo.operations?.length) return wo;
        let changed = false;
        const operations = wo.operations.map((op) => {
          if (op.id == null) return op;
          const patch = byOp.get(op.id);
          if (!patch) return op;
          changed = true;
          return {
            ...op,
            planned_start_date: patch.planned_start_date,
            planned_end_date: patch.planned_end_date,
          };
        });
        return changed ? { ...wo, operations } : wo;
      });
    }
    if (stationUpdates.length) {
      next = applyStationUpdates(next, stationUpdates);
    }
    return next;
  });

  woUpdates.forEach((u) => draftWoUpdatesRef.current.set(u.work_order_id, u));
  opUpdates.forEach((u) => draftOpUpdatesRef.current.set(u.operation_id, u));
  stationUpdates.forEach((u) => draftStationUpdatesRef.current.set(u.operation_id, u));
  syncDraftPendingCount();

  if (poolReorder.length && onPoolReorder) {
    onPoolReorder(poolReorder);
  }

  message.success(t('app.kuaizhizao.scheduling.aiAssist.applyDraftSuccess'));
  return true;
}
