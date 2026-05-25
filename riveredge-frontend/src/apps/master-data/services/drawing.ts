/**
 * 工程图纸 API 服务
 */

import { api } from '../../../services/api';

export type DrawingType = 'part' | 'assembly' | 'process' | 'other';
export type DrawingStatus = 'Draft' | 'Released' | 'Obsolete';

export interface FileBrief {
  uuid: string;
  originalName: string;
  fileExtension?: string;
  fileSize?: number;
  previewUrl?: string;
}

/** 兼容 API 蛇形 / 驼峰字段 */
export function normalizeFileBrief(raw?: Record<string, unknown> | FileBrief | null): FileBrief | null {
  if (!raw || typeof raw !== 'object') return null;
  const uuid = raw.uuid;
  if (!uuid || typeof uuid !== 'string') return null;
  const r = raw as Record<string, unknown>;
  return {
    uuid,
    originalName: String(r.originalName ?? r.original_name ?? ''),
    fileExtension: (r.fileExtension ?? r.file_extension) as string | undefined,
    fileSize: (r.fileSize ?? r.file_size) as number | undefined,
    previewUrl: (r.previewUrl ?? r.preview_url) as string | undefined,
  };
}

function normalizeDrawing(raw: EngineeringDrawing): EngineeringDrawing {
  return {
    ...raw,
    file: normalizeFileBrief(raw.file as Record<string, unknown> | undefined) ?? raw.file ?? null,
    supplementaryFiles: raw.supplementaryFiles?.map((f) => normalizeFileBrief(f as Record<string, unknown>) ?? f),
  };
}

export interface EngineeringDrawing {
  id: number;
  uuid: string;
  tenantId: number;
  code: string;
  name: string;
  revision: string;
  drawingType: DrawingType;
  status: DrawingStatus;
  fileUuid: string;
  file?: FileBrief | null;
  supplementaryFileUuids?: string[];
  supplementaryFiles?: FileBrief[];
  materialUuids?: string[];
  processRouteUuids?: string[];
  operationUuids?: string[];
  description?: string;
  releasedAt?: string;
  obsoleteReason?: string;
  linkedBomMaterialId?: number;
  linkedBomVersion?: string;
  lastStepBomImportAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EngineeringDrawingCreate {
  code: string;
  name: string;
  revision?: string;
  drawingType?: DrawingType;
  fileUuid: string;
  supplementaryFileUuids?: string[];
  materialUuids?: string[];
  processRouteUuids?: string[];
  operationUuids?: string[];
  description?: string;
}

export interface EngineeringDrawingUpdate {
  name?: string;
  drawingType?: DrawingType;
  fileUuid?: string;
  supplementaryFileUuids?: string[];
  materialUuids?: string[];
  processRouteUuids?: string[];
  operationUuids?: string[];
  description?: string;
}

export interface EngineeringDrawingListParams {
  skip?: number;
  limit?: number;
  status?: DrawingStatus;
  drawingType?: DrawingType;
  keyword?: string;
  materialUuid?: string;
  processRouteUuid?: string;
  operationUuid?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface EngineeringDrawingListResponse {
  data: EngineeringDrawing[];
  total: number;
}

export interface StepBomEdgePayload {
  parentKey: string;
  childKey: string;
  childName: string;
  quantity: number;
}

export interface StepBomNodePayload {
  key: string;
  name: string;
  hasChildren: boolean;
  materialId?: number;
  materialCode?: string;
}

export interface DrawingStepBomImportRequest {
  rootMaterialId: number;
  version?: string;
  defaultGroupId: number;
  defaultUnit?: string;
  createMissingMaterials?: boolean;
  materialCodePrefix?: string;
  edges: StepBomEdgePayload[];
  nodes: StepBomNodePayload[];
}

export interface DrawingStepBomImportResponse {
  rootMaterialId: number;
  version: string;
  bomItemsCreated: number;
  materialsCreated: Array<{ id: number; uuid: string; mainCode: string; name: string }>;
  materialsMatched: number;
  bomDesignerPath: string;
  drawing: EngineeringDrawing;
}

export const drawingApi = {
  list: async (params?: EngineeringDrawingListParams): Promise<EngineeringDrawingListResponse> => {
    const res = await api.get<EngineeringDrawingListResponse>('/apps/master-data/process/drawings', { params });
    return { ...res, data: (res.data ?? []).map(normalizeDrawing) };
  },

  get: async (uuid: string): Promise<EngineeringDrawing> => {
    const res = await api.get<EngineeringDrawing>(`/apps/master-data/process/drawings/${uuid}`);
    return normalizeDrawing(res);
  },

  create: async (data: EngineeringDrawingCreate): Promise<EngineeringDrawing> => {
    const res = await api.post<EngineeringDrawing>('/apps/master-data/process/drawings', data);
    return normalizeDrawing(res);
  },

  update: async (uuid: string, data: EngineeringDrawingUpdate): Promise<EngineeringDrawing> => {
    const res = await api.put<EngineeringDrawing>(`/apps/master-data/process/drawings/${uuid}`, data);
    return normalizeDrawing(res);
  },

  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/master-data/process/drawings/${uuid}`);
  },

  release: async (uuid: string): Promise<EngineeringDrawing> => {
    const res = await api.post<EngineeringDrawing>(`/apps/master-data/process/drawings/${uuid}/release`, {});
    return normalizeDrawing(res);
  },

  obsolete: async (uuid: string, reason?: string): Promise<EngineeringDrawing> => {
    const res = await api.post<EngineeringDrawing>(`/apps/master-data/process/drawings/${uuid}/obsolete`, { reason });
    return normalizeDrawing(res);
  },

  createRevision: async (uuid: string, data?: { fileUuid?: string; description?: string }): Promise<EngineeringDrawing> => {
    const res = await api.post<EngineeringDrawing>(`/apps/master-data/process/drawings/${uuid}/revision`, data ?? {});
    return normalizeDrawing(res);
  },

  listByContext: async (params: {
    materialUuid?: string;
    processRouteUuid?: string;
    operationUuid?: string;
  }): Promise<EngineeringDrawing[]> => {
    const res = await api.get<EngineeringDrawing[]>('/apps/master-data/process/drawings/by-context', { params });
    return (res ?? []).map(normalizeDrawing);
  },

  importStepBom: async (
    uuid: string,
    data: DrawingStepBomImportRequest,
  ): Promise<DrawingStepBomImportResponse> => {
    const res = await api.post<DrawingStepBomImportResponse>(
      `/apps/master-data/process/drawings/${uuid}/import-step-bom`,
      data,
    );
    return { ...res, drawing: normalizeDrawing(res.drawing) };
  },
};
