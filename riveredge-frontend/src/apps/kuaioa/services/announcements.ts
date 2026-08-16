import { kuaioaDelete, kuaioaGet, kuaioaList, kuaioaPost, kuaioaPut } from './kuaioaApi';

const BASE = '/apps/kuaioa/announcements';

export const listAnnouncements = (params?: Record<string, unknown>) =>
  kuaioaList<Record<string, unknown>>(BASE, params);

export const getAnnouncement = (id: number) =>
  kuaioaGet<Record<string, unknown>>(`${BASE}/${id}`);

export const createAnnouncement = (data: Record<string, unknown>) =>
  kuaioaPost<Record<string, unknown>>(BASE, data);

export const updateAnnouncement = (id: number, data: Record<string, unknown>) =>
  kuaioaPut<Record<string, unknown>>(`${BASE}/${id}`, data);

export const deleteAnnouncement = (id: number) => kuaioaDelete(`${BASE}/${id}`);

export const publishAnnouncement = (id: number) =>
  kuaioaPost<Record<string, unknown>>(`${BASE}/${id}/publish`);
