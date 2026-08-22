import { apiRequest } from '../../../services/api';

export interface FaiCharacteristic {
  id?: number;
  sequence?: number;
  balloon_no?: string;
  characteristic_name: string;
  nominal_value?: number | null;
  upper_tolerance?: number | null;
  lower_tolerance?: number | null;
  unit?: string;
  measured_value?: number | null;
  sample_values?: number[];
  judgment?: string;
  gauge_id?: number;
  gauge_code?: string;
  gauge_name?: string;
  source_step_key?: string;
  remarks?: string;
}

export interface FaiBalloonCandidate {
  id?: string;
  balloon_no?: string;
  characteristic_name: string;
  nominal_value?: number | null;
  upper_tolerance?: number | null;
  lower_tolerance?: number | null;
  unit?: string;
  remarks?: string;
  /** 气泡中心，相对图纸 0~1 */
  x?: number;
  y?: number;
  anchor_x?: number;
  anchor_y?: number;
  source?: 'manual' | 'ocr';
}

export interface FaiBalloonOcrResult {
  candidates: FaiBalloonCandidate[];
  confidence_notes?: string | null;
}

export interface FaiOrder {
  id: number;
  uuid?: string;
  fai_code: string;
  title: string;
  trigger_reason: string;
  status: string;
  conclusion: string;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  drawing_no?: string;
  drawing_revision?: string;
  work_order_id?: number;
  work_order_code?: string;
  inspection_plan_id?: number;
  inspection_plan_code?: string;
  part_number?: string;
  part_name?: string;
  serial_number?: string;
  lot_number?: string;
  material_spec?: string;
  process_spec?: string;
  organization_name?: string;
  sample_size?: number;
  cpk_summary?: any;
  drawing_file_url?: string;
  balloon_candidates?: FaiBalloonCandidate[];
  attachments?: any;
  remarks?: string;
  characteristics?: FaiCharacteristic[];
  created_by?: number;
  created_by_name?: string;
  updated_by?: number;
  updated_by_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FaiFairExport {
  fai_code: string;
  form1: Record<string, unknown>;
  form2: Record<string, unknown>;
  form3: Array<Record<string, unknown>>;
  cpk_summary?: any;
}

type ListEnvelope<T> = { items: T[]; total: number };

export const faiOrderApi = {
  list: (params?: Record<string, unknown>) =>
    apiRequest<ListEnvelope<FaiOrder>>('/apps/kuaizhizao/fai-orders', { method: 'GET', params }),
  get: (id: number) => apiRequest<FaiOrder>(`/apps/kuaizhizao/fai-orders/${id}`, { method: 'GET' }),
  create: (data: Partial<FaiOrder> & { characteristics?: FaiCharacteristic[] }) =>
    apiRequest<FaiOrder>('/apps/kuaizhizao/fai-orders', { method: 'POST', data }),
  update: (id: number, data: Partial<FaiOrder> & { characteristics?: FaiCharacteristic[] }) =>
    apiRequest<FaiOrder>(`/apps/kuaizhizao/fai-orders/${id}`, { method: 'PUT', data }),
  delete: (id: number) => apiRequest(`/apps/kuaizhizao/fai-orders/${id}`, { method: 'DELETE' }),
  submit: (id: number) =>
    apiRequest<FaiOrder>(`/apps/kuaizhizao/fai-orders/${id}/submit`, { method: 'POST' }),
  approve: (id: number) =>
    apiRequest<FaiOrder>(`/apps/kuaizhizao/fai-orders/${id}/approve`, { method: 'POST' }),
  reject: (id: number, remarks?: string) =>
    apiRequest<FaiOrder>(`/apps/kuaizhizao/fai-orders/${id}/reject`, {
      method: 'POST',
      data: { remarks },
    }),
  close: (id: number) =>
    apiRequest<FaiOrder>(`/apps/kuaizhizao/fai-orders/${id}/close`, { method: 'POST' }),
  importFromPlan: (id: number, inspection_plan_id: number) =>
    apiRequest<FaiOrder>(`/apps/kuaizhizao/fai-orders/${id}/import-from-plan`, {
      method: 'POST',
      data: { inspection_plan_id },
    }),
  fairExport: (id: number) =>
    apiRequest<FaiFairExport>(`/apps/kuaizhizao/fai-orders/${id}/fair-export`, { method: 'GET' }),
  saveBalloonCandidates: (id: number, candidates: FaiBalloonCandidate[], drawing_file_url?: string) =>
    apiRequest<FaiOrder>(`/apps/kuaizhizao/fai-orders/${id}/balloon-candidates`, {
      method: 'PUT',
      data: { candidates, drawing_file_url },
    }),
  confirmBalloons: (id: number, candidates: FaiBalloonCandidate[], replace_existing = true) =>
    apiRequest<FaiOrder>(`/apps/kuaizhizao/fai-orders/${id}/confirm-balloons`, {
      method: 'POST',
      data: { candidates, replace_existing },
    }),
  balloonOcr: (id: number, file: Blob | File, persist = true) => {
    const formData = new FormData();
    const name = file instanceof File ? file.name : 'drawing.png';
    formData.append('file', file, name);
    return apiRequest<FaiBalloonOcrResult>(
      `/apps/kuaizhizao/fai-orders/${id}/balloon-ocr?persist=${persist ? 'true' : 'false'}`,
      {
        method: 'POST',
        body: formData,
      },
    );
  },
};
