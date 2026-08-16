import { kuaioaDelete, kuaioaGet, kuaioaList, kuaioaPost, kuaioaPut } from './kuaioaApi';

const BASE = '/apps/kuaioa/leave';

export const listLeaveRequests = (params?: Record<string, unknown>) =>
  kuaioaList<Record<string, unknown>>(`${BASE}/requests`, params);

export const getLeaveRequest = (id: number) =>
  kuaioaGet<Record<string, unknown>>(`${BASE}/requests/${id}`);

export const createLeaveRequest = (data: Record<string, unknown>) =>
  kuaioaPost<Record<string, unknown>>(`${BASE}/requests`, data);

export const updateLeaveRequest = (id: number, data: Record<string, unknown>) =>
  kuaioaPut<Record<string, unknown>>(`${BASE}/requests/${id}`, data);

export const deleteLeaveRequest = (id: number) => kuaioaDelete(`${BASE}/requests/${id}`);
