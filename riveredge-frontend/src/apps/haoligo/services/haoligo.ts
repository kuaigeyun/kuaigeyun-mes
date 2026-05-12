/**
 * 好力 GO 业务 API（/api/v1/apps/haoligo）
 */

import { apiRequest } from '../../../services/api';

const PREFIX = '/apps/haoligo';

export interface HaoligoMeta {
  app_key: string;
  display_name: string;
  api_prefix: string;
}

export function fetchHaoligoMeta(): Promise<HaoligoMeta> {
  return apiRequest(`${PREFIX}/meta`);
}

export interface WorkshopRow {
  id: number;
  uuid: string;
  code: string;
  name: string;
}

export function listWorkshops(): Promise<WorkshopRow[]> {
  return apiRequest(`${PREFIX}/equipment/workshops`);
}

export interface EquipmentRow {
  id: number;
  uuid: string;
  asset_code: string;
  name: string;
  category_id: number;
  workshop_id: number;
  manufacturer_id?: number | null;
  manufacture_date?: string | null;
  inspection_param_set_id?: number | null;
  remark?: string | null;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  skip: number;
  limit: number;
}

export function listEquipments(params?: { workshop_id?: number; skip?: number; limit?: number }): Promise<PageResult<EquipmentRow>> {
  return apiRequest(`${PREFIX}/equipment/equipments`, { params });
}

export interface MoldRow {
  id: number;
  uuid: string;
  mold_code: string;
  name: string;
  status: string;
  total_manufacture_qty: string;
  outsource_vendor_code?: string | null;
  outsource_vendor_name?: string | null;
  erp_material_code?: string | null;
  remark?: string | null;
}

export function listMolds(params?: { skip?: number; limit?: number; status?: string }): Promise<PageResult<MoldRow>> {
  return apiRequest(`${PREFIX}/molds`, { params });
}

export interface HazardRow {
  id: number;
  uuid: string;
  workshop_id?: number | null;
  workshop_area?: string | null;
  reported_at?: string | null;
  issue_type_code?: string | null;
  problem_summary?: string | null;
  solution_note?: string | null;
  status: string;
  handler_name?: string | null;
  handled_at?: string | null;
}

export function listHazardReports(params?: { skip?: number; limit?: number; status?: string }): Promise<PageResult<HazardRow>> {
  return apiRequest(`${PREFIX}/patrol/hazard-reports`, { params });
}
