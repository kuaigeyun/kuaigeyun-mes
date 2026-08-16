import { kuaioaDelete, kuaioaGet, kuaioaList, kuaioaPost, kuaioaPut } from './kuaioaApi';

const BASE = '/apps/kuaioa/collaboration';

export const listSpecialPriceRequests = (params?: Record<string, unknown>) =>
  kuaioaList<Record<string, unknown>>(`${BASE}/special-price`, params);

export const getSpecialPriceRequest = (id: number) =>
  kuaioaGet<Record<string, unknown>>(`${BASE}/special-price/${id}`);

export const createSpecialPriceRequest = (data: Record<string, unknown>) =>
  kuaioaPost<Record<string, unknown>>(`${BASE}/special-price`, data);

export const updateSpecialPriceRequest = (id: number, data: Record<string, unknown>) =>
  kuaioaPut<Record<string, unknown>>(`${BASE}/special-price/${id}`, data);

export const deleteSpecialPriceRequest = (id: number) =>
  kuaioaDelete(`${BASE}/special-price/${id}`);

export const listConcessionRequests = (params?: Record<string, unknown>) =>
  kuaioaList<Record<string, unknown>>(`${BASE}/concession`, params);

export const getConcessionRequest = (id: number) =>
  kuaioaGet<Record<string, unknown>>(`${BASE}/concession/${id}`);

export const createConcessionRequest = (data: Record<string, unknown>) =>
  kuaioaPost<Record<string, unknown>>(`${BASE}/concession`, data);

export const updateConcessionRequest = (id: number, data: Record<string, unknown>) =>
  kuaioaPut<Record<string, unknown>>(`${BASE}/concession/${id}`, data);

export const deleteConcessionRequest = (id: number) =>
  kuaioaDelete(`${BASE}/concession/${id}`);

export const listProcessDeviationRequests = (params?: Record<string, unknown>) =>
  kuaioaList<Record<string, unknown>>(`${BASE}/process-deviation`, params);

export const getProcessDeviationRequest = (id: number) =>
  kuaioaGet<Record<string, unknown>>(`${BASE}/process-deviation/${id}`);

export const createProcessDeviationRequest = (data: Record<string, unknown>) =>
  kuaioaPost<Record<string, unknown>>(`${BASE}/process-deviation`, data);

export const updateProcessDeviationRequest = (id: number, data: Record<string, unknown>) =>
  kuaioaPut<Record<string, unknown>>(`${BASE}/process-deviation/${id}`, data);

export const deleteProcessDeviationRequest = (id: number) =>
  kuaioaDelete(`${BASE}/process-deviation/${id}`);
