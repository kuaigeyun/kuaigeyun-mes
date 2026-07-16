import type { SchedulingAiProposal } from '../../../services/scheduling-ai';

export interface EngineSchedulingProposal {
  summary?: string | null;
  warnings?: string[];
  unfreezed?: number[];
  work_order_adjustments?: Array<{
    work_order_id: number;
    planned_start_date: string;
    planned_end_date: string;
  }>;
  operation_adjustments?: Array<{
    operation_id: number;
    planned_start_date: string;
    planned_end_date: string;
  }>;
  operation_station_adjustments?: Array<{
    operation_id: number;
    assigned_station_id: number;
  }>;
}

export function convertEngineProposalToAiProposal(
  engineProposal: EngineSchedulingProposal
): SchedulingAiProposal {
  const opMap = new Map<
    number,
    {
      operationId: number;
      plannedStartDate?: string | null;
      plannedEndDate?: string | null;
      assignedStationId?: number | null;
    }
  >();

  for (const item of engineProposal.operation_adjustments ?? []) {
    opMap.set(item.operation_id, {
      operationId: item.operation_id,
      plannedStartDate: item.planned_start_date,
      plannedEndDate: item.planned_end_date,
      assignedStationId: opMap.get(item.operation_id)?.assignedStationId ?? null,
    });
  }
  for (const item of engineProposal.operation_station_adjustments ?? []) {
    const prev = opMap.get(item.operation_id);
    opMap.set(item.operation_id, {
      operationId: item.operation_id,
      plannedStartDate: prev?.plannedStartDate ?? null,
      plannedEndDate: prev?.plannedEndDate ?? null,
      assignedStationId: item.assigned_station_id,
    });
  }

  return {
    summary: engineProposal.summary,
    confidenceNotes: null,
    warnings: engineProposal.warnings ?? [],
    workOrderAdjustments: (engineProposal.work_order_adjustments ?? []).map((item) => ({
      workOrderId: item.work_order_id,
      plannedStartDate: item.planned_start_date,
      plannedEndDate: item.planned_end_date,
    })),
    operationAdjustments: [...opMap.values()],
    poolReorder: [],
    validationPreview: null,
  };
}
