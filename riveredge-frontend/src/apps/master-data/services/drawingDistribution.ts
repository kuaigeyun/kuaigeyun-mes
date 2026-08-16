/**
 * 图档发放单 API
 */

import { api } from '../../../services/api';

export type DrawingDistributionStatus = 'Draft' | 'Pending' | 'Issued' | 'Recalled';

export interface DrawingDistributionLine {
  id: number;
  drawingId: number;
  drawingUuid: string;
  drawingCode: string;
  drawingName: string;
  drawingRevision: string;
}

export interface DrawingDistribution {
  id: number;
  uuid: string;
  tenantId: number;
  code: string;
  name: string;
  status: DrawingDistributionStatus;
  remark?: string;
  issuedAt?: string;
  issuedByName?: string;
  recalledAt?: string;
  recalledByName?: string;
  recallReason?: string;
  createdByName?: string;
  updatedByName?: string;
  createdAt: string;
  updatedAt: string;
  lines: DrawingDistributionLine[];
}

export interface DrawingDistributionListResponse {
  data: DrawingDistribution[];
  total: number;
}

export interface DrawingDistributionPolicy {
  isEnabled: boolean;
}

const BASE = '/apps/master-data/process/drawing-distributions';

export const drawingDistributionApi = {
  list: async (params?: {
    skip?: number;
    limit?: number;
    status?: string;
    keyword?: string;
  }): Promise<DrawingDistributionListResponse> => {
    return api.get<DrawingDistributionListResponse>(BASE, { params });
  },

  get: async (uuid: string): Promise<DrawingDistribution> => {
    return api.get<DrawingDistribution>(`${BASE}/${uuid}`);
  },

  create: async (data: {
    code?: string;
    name: string;
    remark?: string;
    lines: Array<{ drawingUuid: string }>;
  }): Promise<DrawingDistribution> => {
    return api.post<DrawingDistribution>(BASE, data);
  },

  update: async (
    uuid: string,
    data: { name?: string; remark?: string; lines?: Array<{ drawingUuid: string }> },
  ): Promise<DrawingDistribution> => {
    return api.put<DrawingDistribution>(`${BASE}/${uuid}`, data);
  },

  delete: async (uuid: string): Promise<void> => {
    return api.delete(`${BASE}/${uuid}`);
  },

  submit: async (uuid: string): Promise<DrawingDistribution> => {
    return api.post<DrawingDistribution>(`${BASE}/${uuid}/submit`, {});
  },

  approve: async (uuid: string): Promise<DrawingDistribution> => {
    return api.post<DrawingDistribution>(`${BASE}/${uuid}/approve`, {});
  },

  reject: async (uuid: string): Promise<DrawingDistribution> => {
    return api.post<DrawingDistribution>(`${BASE}/${uuid}/reject`, {});
  },

  revoke: async (uuid: string): Promise<DrawingDistribution> => {
    return api.post<DrawingDistribution>(`${BASE}/${uuid}/revoke`, {});
  },

  recall: async (uuid: string, reason?: string): Promise<DrawingDistribution> => {
    return api.post<DrawingDistribution>(`${BASE}/${uuid}/recall`, { reason });
  },

  getPolicy: async (): Promise<DrawingDistributionPolicy> => {
    return api.get<DrawingDistributionPolicy>(`${BASE}/policy`);
  },

  updatePolicy: async (isEnabled: boolean): Promise<DrawingDistributionPolicy> => {
    return api.put<DrawingDistributionPolicy>(`${BASE}/policy`, { isEnabled });
  },
};
