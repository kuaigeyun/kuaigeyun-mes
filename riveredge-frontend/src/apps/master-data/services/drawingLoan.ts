/**
 * 图档借阅单与密级授权 API
 */

import { api } from '../../../services/api';

export type DrawingLoanStatus = 'Draft' | 'Pending' | 'Borrowed' | 'Returned';
export type DrawingSecurityLevel = 'public' | 'internal' | 'secret' | 'confidential';

export interface DrawingLoanLine {
  id: number;
  drawingId: number;
  drawingUuid: string;
  drawingCode: string;
  drawingName: string;
  drawingRevision: string;
  securityLevel: DrawingSecurityLevel;
}

export interface DrawingLoan {
  id: number;
  uuid: string;
  tenantId: number;
  code: string;
  name: string;
  purpose?: string;
  dueAt: string;
  status: DrawingLoanStatus;
  returnedAt?: string;
  returnedByName?: string;
  createdByName?: string;
  updatedByName?: string;
  createdAt: string;
  updatedAt: string;
  lines: DrawingLoanLine[];
}

export interface DrawingLoanListResponse {
  data: DrawingLoan[];
  total: number;
}

export interface DrawingClearance {
  userId: number;
  userName: string;
  securityLevel: DrawingSecurityLevel;
  updatedByName?: string;
  updatedAt: string;
}

export interface DrawingClearanceListResponse {
  data: DrawingClearance[];
  total: number;
}

const BASE = '/apps/master-data/process/drawing-loans';
const CLEARANCE_BASE = '/apps/master-data/process/drawing-clearances';

export const drawingLoanApi = {
  list: async (params?: {
    skip?: number;
    limit?: number;
    status?: string;
    keyword?: string;
  }): Promise<DrawingLoanListResponse> => {
    return api.get<DrawingLoanListResponse>(BASE, { params });
  },

  get: async (uuid: string): Promise<DrawingLoan> => {
    return api.get<DrawingLoan>(`${BASE}/${uuid}`);
  },

  create: async (data: {
    code?: string;
    name: string;
    purpose?: string;
    dueAt: string;
    lines: Array<{ drawingUuid: string }>;
  }): Promise<DrawingLoan> => {
    return api.post<DrawingLoan>(BASE, data);
  },

  update: async (
    uuid: string,
    data: { name?: string; purpose?: string; dueAt?: string; lines?: Array<{ drawingUuid: string }> },
  ): Promise<DrawingLoan> => {
    return api.put<DrawingLoan>(`${BASE}/${uuid}`, data);
  },

  delete: async (uuid: string): Promise<void> => {
    return api.delete(`${BASE}/${uuid}`);
  },

  submit: async (uuid: string): Promise<DrawingLoan> => {
    return api.post<DrawingLoan>(`${BASE}/${uuid}/submit`, {});
  },

  approve: async (uuid: string): Promise<DrawingLoan> => {
    return api.post<DrawingLoan>(`${BASE}/${uuid}/approve`, {});
  },

  reject: async (uuid: string): Promise<DrawingLoan> => {
    return api.post<DrawingLoan>(`${BASE}/${uuid}/reject`, {});
  },

  revoke: async (uuid: string): Promise<DrawingLoan> => {
    return api.post<DrawingLoan>(`${BASE}/${uuid}/revoke`, {});
  },

  complete: async (uuid: string): Promise<DrawingLoan> => {
    return api.post<DrawingLoan>(`${BASE}/${uuid}/complete`, {});
  },

  listClearances: async (): Promise<DrawingClearanceListResponse> => {
    return api.get<DrawingClearanceListResponse>(CLEARANCE_BASE);
  },

  upsertClearance: async (data: {
    userId: number;
    securityLevel: DrawingSecurityLevel;
  }): Promise<DrawingClearance> => {
    return api.put<DrawingClearance>(CLEARANCE_BASE, data);
  },

  deleteClearance: async (userId: number): Promise<void> => {
    return api.delete(`${CLEARANCE_BASE}/${userId}`);
  },
};
