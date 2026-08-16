import { kuaioaDelete, kuaioaGet, kuaioaList, kuaioaPost, kuaioaPut } from './kuaioaApi';

const BASE = '/apps/kuaioa/forms';

export interface FormTemplate {
  id: number;
  uuid?: string;
  template_code: string;
  template_name: string;
  category: string;
  description?: string | null;
  fields_schema?: unknown;
  is_active: boolean;
  show_in_menu?: boolean;
}

export interface FormRequest {
  id: number;
  uuid?: string;
  request_code: string;
  template_id?: number | null;
  template_code?: string | null;
  title: string;
  form_data?: Record<string, unknown>;
  status: string;
  applicant_name?: string | null;
  department_name?: string | null;
  approval_status?: string | null;
}

export const listFormTemplates = (params?: Record<string, unknown>) =>
  kuaioaList<FormTemplate>(`${BASE}/templates`, params);

export const createFormTemplate = (data: Partial<FormTemplate>) =>
  kuaioaPost<FormTemplate>(`${BASE}/templates`, data);

export const updateFormTemplate = (id: number, data: Partial<FormTemplate>) =>
  kuaioaPut<FormTemplate>(`${BASE}/templates/${id}`, data);

export const deleteFormTemplate = (id: number) => kuaioaDelete(`${BASE}/templates/${id}`);

export const getFormTemplate = (id: number) =>
  kuaioaGet<FormTemplate>(`${BASE}/templates/${id}`);

export const getFormTemplateByCode = (templateCode: string) =>
  kuaioaGet<FormTemplate>(`${BASE}/templates/by-code/${encodeURIComponent(templateCode)}`);

export const listFormRequests = (params?: Record<string, unknown>) =>
  kuaioaList<FormRequest>(`${BASE}/requests`, params);

export const getFormRequest = (id: number) =>
  kuaioaGet<FormRequest>(`${BASE}/requests/${id}`);

export const createFormRequest = (data: Partial<FormRequest>) =>
  kuaioaPost<FormRequest>(`${BASE}/requests`, data);

export const updateFormRequest = (id: number, data: Partial<FormRequest>) =>
  kuaioaPut<FormRequest>(`${BASE}/requests/${id}`, data);

export const deleteFormRequest = (id: number) => kuaioaDelete(`${BASE}/requests/${id}`);

export const submitFormRequest = (id: number) =>
  kuaioaPost<FormRequest>(`${BASE}/requests/${id}/submit`);

export const revokeFormRequest = (id: number) =>
  kuaioaPost<FormRequest>(`${BASE}/requests/${id}/revoke`);
