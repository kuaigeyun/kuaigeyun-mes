/**
 * 图档反查 API
 */

import { api } from '../../../services/api';
import { normalizeFileBrief, type EngineeringDrawing } from './drawing';

export type DrawingWhereUsedKind = 'material' | 'process_route' | 'operation' | 'work_order' | 'bom';

export interface DrawingWhereUsedUsage {
  kind: DrawingWhereUsedKind;
  uuid: string;
  code: string;
  name: string;
  extra?: string;
}

export interface DrawingWhereUsedResponse {
  direction: 'forward' | 'reverse';
  drawings: EngineeringDrawing[];
  usages: DrawingWhereUsedUsage[];
}

export interface DrawingWhereUsedQuery {
  materialUuid?: string;
  processRouteUuid?: string;
  operationUuid?: string;
  workOrderUuid?: string;
  drawingUuid?: string;
}

function normalizeDrawing(raw: EngineeringDrawing): EngineeringDrawing {
  return {
    ...raw,
    file: normalizeFileBrief(raw.file as Record<string, unknown> | undefined) ?? raw.file ?? null,
  };
}

export const drawingWhereUsedApi = {
  query: async (params: DrawingWhereUsedQuery): Promise<DrawingWhereUsedResponse> => {
    const res = await api.get<DrawingWhereUsedResponse>('/apps/master-data/process/drawing-where-used', {
      params,
    });
    return {
      direction: res.direction,
      drawings: (res.drawings ?? []).map(normalizeDrawing),
      usages: res.usages ?? [],
    };
  },
};
