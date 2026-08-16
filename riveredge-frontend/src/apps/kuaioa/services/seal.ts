import { kuaioaDelete, kuaioaGet, kuaioaList, kuaioaPost, kuaioaPut } from './kuaioaApi';

const BASE = '/apps/kuaioa/seal';

export const listSealRequests = (params?: Record<string, unknown>) =>
  kuaioaList<Record<string, unknown>>(`${BASE}/requests`, params);

export const getSealRequest = (id: number) =>
  kuaioaGet<Record<string, unknown>>(`${BASE}/requests/${id}`);

export const createSealRequest = (data: Record<string, unknown>) =>
  kuaioaPost<Record<string, unknown>>(`${BASE}/requests`, data);

export const updateSealRequest = (id: number, data: Record<string, unknown>) =>
  kuaioaPut<Record<string, unknown>>(`${BASE}/requests/${id}`, data);

export const deleteSealRequest = (id: number) => kuaioaDelete(`${BASE}/requests/${id}`);
