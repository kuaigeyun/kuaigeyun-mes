import { apiRequest } from '../../../services/api';
import type { FaiBalloonCandidate, FaiBalloonOcrResult } from './fai-order';

export interface DrawingBalloonSheetLine {
  id?: number;
  sequence?: number;
  balloon_no?: string;
  characteristic_name: string;
  nominal_value?: number | null;
  upper_tolerance?: number | null;
  lower_tolerance?: number | null;
  unit?: string;
  remarks?: string;
}

export interface DrawingBalloonSheet {
  id: number;
  uuid?: string;
  sheet_code: string;
  title: string;
  status: string;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  drawing_no?: string;
  drawing_revision?: string;
  work_order_id?: number;
  work_order_code?: string;
  drawing_file_url?: string;
  balloon_candidates?: FaiBalloonCandidate[];
  linked_fai_order_id?: number;
  remarks?: string;
  lines?: DrawingBalloonSheetLine[];
  created_by_name?: string;
  updated_by_name?: string;
  created_at?: string;
  updated_at?: string;
}

type ListEnvelope<T> = { items: T[]; total: number };

export const drawingBalloonSheetApi = {
  list: (params?: Record<string, unknown>) =>
    apiRequest<ListEnvelope<DrawingBalloonSheet>>('/apps/kuaizhizao/drawing-balloon-sheets', {
      method: 'GET',
      params,
    }),
  get: (id: number) =>
    apiRequest<DrawingBalloonSheet>(`/apps/kuaizhizao/drawing-balloon-sheets/${id}`, {
      method: 'GET',
    }),
  getByFaiOrder: (faiOrderId: number) =>
    apiRequest<DrawingBalloonSheet | null>(
      `/apps/kuaizhizao/drawing-balloon-sheets/by-fai-order/${faiOrderId}`,
      { method: 'GET' },
    ),
  create: (data: Partial<DrawingBalloonSheet>) =>
    apiRequest<DrawingBalloonSheet>('/apps/kuaizhizao/drawing-balloon-sheets', {
      method: 'POST',
      data,
    }),
  update: (id: number, data: Partial<DrawingBalloonSheet>) =>
    apiRequest<DrawingBalloonSheet>(`/apps/kuaizhizao/drawing-balloon-sheets/${id}`, {
      method: 'PUT',
      data,
    }),
  delete: (id: number) =>
    apiRequest(`/apps/kuaizhizao/drawing-balloon-sheets/${id}`, { method: 'DELETE' }),
  saveBalloonCandidates: (id: number, candidates: FaiBalloonCandidate[], drawing_file_url?: string) =>
    apiRequest<DrawingBalloonSheet>(`/apps/kuaizhizao/drawing-balloon-sheets/${id}/balloon-candidates`, {
      method: 'PUT',
      data: { candidates, drawing_file_url },
    }),
  confirmLines: (id: number, candidates: FaiBalloonCandidate[], replace_existing = true) =>
    apiRequest<DrawingBalloonSheet>(`/apps/kuaizhizao/drawing-balloon-sheets/${id}/confirm-lines`, {
      method: 'POST',
      data: { candidates, replace_existing },
    }),
  balloonOcr: (id: number, file: Blob | File, persist = true) => {
    const formData = new FormData();
    const name = file instanceof File ? file.name : 'drawing.png';
    formData.append('file', file, name);
    return apiRequest<FaiBalloonOcrResult>(
      `/apps/kuaizhizao/drawing-balloon-sheets/${id}/balloon-ocr?persist=${persist ? 'true' : 'false'}`,
      {
        method: 'POST',
        body: formData,
      },
    );
  },
};
