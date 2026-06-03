/**
 * 好力 GO 业务 API（/api/v1/apps/haoligo）
 */

import { apiRequest } from '../../../services/api';

const PREFIX = '/apps/haoligo';

export interface PageResult<T> {
  items: T[];
  total: number;
  skip: number;
  limit: number;
}

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
  inspection_param_set_ids?: number[];
  upkeep_param_set_id?: number | null;
  criticality?: string | null;
  operational_status?: string | null;
  /** 进入当前运行状态的时间（ISO），用于看板停机时长等 */
  operational_status_since?: string | null;
  maintenance_cycle_by_yield?: string | null;
  maintenance_cycle_by_days?: number | null;
  used_yield?: string | null;
  remark?: string | null;
  image_file_uuids?: string[];
}

export interface CategoryRow {
  id: number;
  uuid: string;
  code: string;
  level1_category: string;
  level2_category: string;
  name: string;
  default_inspection_param_set_id?: number | null;
}

export function formatCategoryDisplayName(
  c: Pick<CategoryRow, 'level1_category' | 'level2_category' | 'name'>,
): string {
  const l1 = (c.level1_category ?? '').trim();
  const l2 = (c.level2_category ?? '').trim();
  if (l1 && l2 && l1 !== l2) return `${l1} / ${l2}`;
  return l2 || l1 || (c.name ?? '').trim();
}

export function formatCategoryLabel(c: Pick<CategoryRow, 'code' | 'level1_category' | 'level2_category' | 'name'>): string {
  return `${c.code} · ${formatCategoryDisplayName(c)}`;
}

export function listCategories(): Promise<CategoryRow[]> {
  return apiRequest(`${PREFIX}/equipment/categories`);
}

export type CategoryCreatePayload = {
  code: string;
  level1_category?: string;
  level2_category: string;
  default_inspection_param_set_id?: number | null;
};

export type CategoryUpdatePayload = {
  level1_category?: string;
  level2_category?: string;
  default_inspection_param_set_id?: number | null;
};

export function createCategory(body: CategoryCreatePayload): Promise<CategoryRow> {
  return apiRequest(`${PREFIX}/equipment/categories`, { method: 'POST', data: body });
}

export function updateCategory(rowId: number, body: CategoryUpdatePayload): Promise<CategoryRow> {
  return apiRequest(`${PREFIX}/equipment/categories/${rowId}`, { method: 'PATCH', data: body });
}

export function deleteCategory(rowId: number): Promise<void> {
  return apiRequest(`${PREFIX}/equipment/categories/${rowId}`, { method: 'DELETE' });
}

export type EquipmentCreatePayload = {
  asset_code: string;
  name: string;
  category_id: number;
  workshop_id: number;
  manufacturer_id?: number | null;
  manufacture_date?: string | null;
  inspection_param_set_ids?: number[];
  upkeep_param_set_id?: number | null;
  criticality?: string | null;
  operational_status?: string | null;
  maintenance_cycle_by_yield?: string | number | null;
  maintenance_cycle_by_days?: number | null;
  remark?: string | null;
  image_file_uuids?: string[] | null;
};

export type EquipmentUpdatePayload = {
  name?: string;
  category_id?: number;
  workshop_id?: number;
  manufacturer_id?: number | null;
  manufacture_date?: string | null;
  inspection_param_set_ids?: number[];
  upkeep_param_set_id?: number | null;
  criticality?: string | null;
  operational_status?: string | null;
  maintenance_cycle_by_yield?: string | number | null;
  maintenance_cycle_by_days?: number | null;
  remark?: string | null;
  image_file_uuids?: string[] | null;
};

/** 设备保养计划表：各设备最近保养完修时间 */
export function fetchMaintenanceUpkeepLastByEquipment(): Promise<{ items: Record<string, string> }> {
  return apiRequest(`${PREFIX}/equipment/reports/maintenance-upkeep-last-by-equipment`);
}

export function listEquipments(params?: {
  workshop_id?: number;
  level1_category?: string;
  keyword?: string;
  asset_code?: string;
  name?: string;
  skip?: number;
  limit?: number;
}): Promise<PageResult<EquipmentRow>> {
  return apiRequest(`${PREFIX}/equipment/equipments`, { params });
}

export function getEquipment(rowId: number): Promise<EquipmentRow> {
  return apiRequest(`${PREFIX}/equipment/equipments/${rowId}`);
}

export function createEquipment(body: EquipmentCreatePayload): Promise<EquipmentRow> {
  return apiRequest(`${PREFIX}/equipment/equipments`, { method: 'POST', data: body });
}

export function updateEquipment(rowId: number, body: EquipmentUpdatePayload): Promise<EquipmentRow> {
  return apiRequest(`${PREFIX}/equipment/equipments/${rowId}`, { method: 'PATCH', data: body });
}

export interface EquipmentOperationalStatusLogRow {
  id: number;
  created_at: string;
  old_status?: string | null;
  new_status: string;
  changed_by_user_id: number;
}

export function listEquipmentOperationalStatusHistory(
  equipmentId: number,
  params?: { limit?: number },
): Promise<EquipmentOperationalStatusLogRow[]> {
  return apiRequest(`${PREFIX}/equipment/equipments/${equipmentId}/operational-status-history`, { params });
}

export function deleteEquipment(rowId: number): Promise<void> {
  return apiRequest(`${PREFIX}/equipment/equipments/${rowId}`, { method: 'DELETE' });
}

/** 巡检路线（PatrolRouteOut） */
export interface PatrolRouteRow {
  id: number;
  uuid: string;
  code: string;
  name: string;
  workshop_id?: number | null;
}

export interface PatrolStepRow {
  id: number;
  equipment_id: number;
  sequence: number;
}

export type PatrolRouteCreatePayload = {
  code: string;
  name: string;
  workshop_id?: number | null;
};

export type PatrolRouteCreateWithStepsPayload = PatrolRouteCreatePayload & {
  steps: PatrolStepInPayload[];
};

export type PatrolRouteUpdatePayload = {
  name?: string;
  workshop_id?: number | null;
};

export type PatrolStepInPayload = {
  equipment_id: number;
  sequence: number;
};

export function listPatrolRoutes(): Promise<PatrolRouteRow[]> {
  return apiRequest(`${PREFIX}/equipment/patrol-routes`);
}

export function createPatrolRoute(body: PatrolRouteCreatePayload): Promise<PatrolRouteRow> {
  return apiRequest(`${PREFIX}/equipment/patrol-routes`, { method: 'POST', data: body });
}

export function createPatrolRouteWithSteps(body: PatrolRouteCreateWithStepsPayload): Promise<PatrolRouteRow> {
  return apiRequest(`${PREFIX}/equipment/patrol-routes/with-steps`, { method: 'POST', data: body });
}

export function updatePatrolRoute(rowId: number, body: PatrolRouteUpdatePayload): Promise<PatrolRouteRow> {
  return apiRequest(`${PREFIX}/equipment/patrol-routes/${rowId}`, { method: 'PATCH', data: body });
}

export function deletePatrolRoute(rowId: number): Promise<void> {
  return apiRequest(`${PREFIX}/equipment/patrol-routes/${rowId}`, { method: 'DELETE' });
}

export function listPatrolSteps(routeId: number): Promise<PatrolStepRow[]> {
  return apiRequest(`${PREFIX}/equipment/patrol-routes/${routeId}/steps`);
}

export function replacePatrolSteps(routeId: number, steps: PatrolStepInPayload[]): Promise<PatrolStepRow[]> {
  return apiRequest(`${PREFIX}/equipment/patrol-routes/${routeId}/steps`, { method: 'PUT', data: steps });
}

/** 设备制造厂商（与后端 ManufacturerOut 对齐） */
export interface ManufacturerRow {
  id: number;
  uuid: string;
  code: string;
  name: string;
}

export type ManufacturerCreatePayload = {
  code: string;
  name: string;
};

export type ManufacturerUpdatePayload = {
  name?: string;
};

export function listManufacturers(): Promise<ManufacturerRow[]> {
  return apiRequest(`${PREFIX}/equipment/manufacturers`);
}

export function createManufacturer(body: ManufacturerCreatePayload): Promise<ManufacturerRow> {
  return apiRequest(`${PREFIX}/equipment/manufacturers`, { method: 'POST', data: body });
}

export function updateManufacturer(rowId: number, body: ManufacturerUpdatePayload): Promise<ManufacturerRow> {
  return apiRequest(`${PREFIX}/equipment/manufacturers/${rowId}`, { method: 'PATCH', data: body });
}

export function deleteManufacturer(rowId: number): Promise<void> {
  return apiRequest(`${PREFIX}/equipment/manufacturers/${rowId}`, { method: 'DELETE' });
}

/** 模具仓库（与后端 MoldWarehouseOut 对齐） */
export interface MoldWarehouseRow {
  id: number;
  uuid: string;
  warehouse_code: string;
  warehouse_name: string;
  warehouse_type: '内部' | '外部';
  supplier_uuid?: string | null;
  supplier_code?: string | null;
  supplier_name?: string | null;
  workshop_id?: number | null;
  workshop_code?: string | null;
  workshop_name?: string | null;
}

export type MoldWarehouseCreatePayload = {
  warehouse_code: string;
  warehouse_name: string;
  warehouse_type: '内部' | '外部';
  workshop_id?: number | null;
  supplier_uuid?: string | null;
};

export type MoldWarehouseUpdatePayload = {
  warehouse_code?: string;
  warehouse_name?: string;
  warehouse_type?: '内部' | '外部';
  workshop_id?: number | null;
  supplier_uuid?: string | null;
};

export function listMoldWarehouses(params?: {
  keyword?: string;
  warehouse_type?: string;
}): Promise<MoldWarehouseRow[]> {
  return apiRequest(`${PREFIX}/molds/warehouses`, { params });
}

export function getMoldWarehouse(rowId: number): Promise<MoldWarehouseRow> {
  return apiRequest(`${PREFIX}/molds/warehouses/${rowId}`);
}

export function createMoldWarehouse(body: MoldWarehouseCreatePayload): Promise<MoldWarehouseRow> {
  return apiRequest(`${PREFIX}/molds/warehouses`, { method: 'POST', data: body });
}

export function updateMoldWarehouse(rowId: number, body: MoldWarehouseUpdatePayload): Promise<MoldWarehouseRow> {
  return apiRequest(`${PREFIX}/molds/warehouses/${rowId}`, { method: 'PATCH', data: body });
}

export function deleteMoldWarehouse(rowId: number): Promise<void> {
  return apiRequest(`${PREFIX}/molds/warehouses/${rowId}`, { method: 'DELETE' });
}

/** 点检项（与后端 InspectionParamOut 对齐） */
export interface InspectionParamRow {
  id: number;
  uuid: string;
  code: string;
  name: string;
  level1_category?: string | null;
  requirement?: string | null;
  unit?: string | null;
  value_type: string;
  default_value?: string | null;
  numeric_min?: number | string | null;
  numeric_max?: number | string | null;
}

export type InspectionParamCreatePayload = {
  code: string;
  name: string;
  level1_category?: string | null;
  requirement?: string | null;
  unit?: string | null;
  value_type?: string;
  default_value?: string | null;
  numeric_min?: number | string | null;
  numeric_max?: number | string | null;
};

export type InspectionParamUpdatePayload = {
  name?: string;
  level1_category?: string | null;
  requirement?: string | null;
  unit?: string | null;
  value_type?: string;
  default_value?: string | null;
  numeric_min?: number | string | null;
  numeric_max?: number | string | null;
};

export function listInspectionParams(): Promise<InspectionParamRow[]> {
  return apiRequest(`${PREFIX}/equipment/inspection-params`);
}

export function createInspectionParam(body: InspectionParamCreatePayload): Promise<InspectionParamRow> {
  return apiRequest(`${PREFIX}/equipment/inspection-params`, { method: 'POST', data: body });
}

export function updateInspectionParam(rowId: number, body: InspectionParamUpdatePayload): Promise<InspectionParamRow> {
  return apiRequest(`${PREFIX}/equipment/inspection-params/${rowId}`, { method: 'PATCH', data: body });
}

export function deleteInspectionParam(rowId: number): Promise<void> {
  return apiRequest(`${PREFIX}/equipment/inspection-params/${rowId}`, { method: 'DELETE' });
}

export type InspectionParamBatchLevel1Payload = {
  ids: number[];
  level1_category?: string | null;
};

export type InspectionParamBatchLevel1Result = {
  updated: number;
};

export function batchUpdateInspectionParamLevel1(
  body: InspectionParamBatchLevel1Payload,
): Promise<InspectionParamBatchLevel1Result> {
  return apiRequest(`${PREFIX}/equipment/inspection-params/batch-level1-category`, {
    method: 'POST',
    data: body,
  });
}

/** 点检方案 / 参数集 */
export interface InspectionParamSetRow {
  id: number;
  uuid: string;
  code: string;
  name: string;
}

export type InspectionParamSetCreatePayload = { code: string; name: string };
export type InspectionParamSetUpdatePayload = { name?: string };

export function listInspectionParamSets(): Promise<InspectionParamSetRow[]> {
  return apiRequest(`${PREFIX}/equipment/inspection-param-sets`);
}

export function createInspectionParamSet(body: InspectionParamSetCreatePayload): Promise<InspectionParamSetRow> {
  return apiRequest(`${PREFIX}/equipment/inspection-param-sets`, { method: 'POST', data: body });
}

export function updateInspectionParamSet(rowId: number, body: InspectionParamSetUpdatePayload): Promise<InspectionParamSetRow> {
  return apiRequest(`${PREFIX}/equipment/inspection-param-sets/${rowId}`, { method: 'PATCH', data: body });
}

export function deleteInspectionParamSet(rowId: number): Promise<void> {
  return apiRequest(`${PREFIX}/equipment/inspection-param-sets/${rowId}`, { method: 'DELETE' });
}

export type InspectionParamSetImportRowPayload = {
  set_code: string;
  set_name: string;
  param_code?: string | null;
  param_name: string;
  level1_category?: string | null;
  requirement?: string | null;
  value_type?: string;
  default_value?: string | null;
  numeric_min?: number | string | null;
  numeric_max?: number | string | null;
  unit?: string | null;
  is_required?: boolean;
};

export type InspectionParamSetImportResult = {
  plans_created: number;
  plans_updated: number;
  params_created: number;
  params_updated: number;
  plan_codes: string[];
};

export function importInspectionParamSets(rows: InspectionParamSetImportRowPayload[]): Promise<InspectionParamSetImportResult> {
  return apiRequest(`${PREFIX}/equipment/inspection-param-sets/import`, { method: 'POST', data: { rows } });
}

export interface InspectionParamSetItemRow {
  id: number;
  param_id: number;
  set_id: number;
  sort_order: number;
  is_required: boolean;
}

export type SetItemCreatePayload = { param_id: number; sort_order?: number; is_required?: boolean };
export type InspectionParamSetCreateWithItemsPayload = {
  code: string;
  name: string;
  items: SetItemCreatePayload[];
};
export type SetItemUpdatePayload = { sort_order?: number; is_required?: boolean };

export function createInspectionParamSetWithItems(
  body: InspectionParamSetCreateWithItemsPayload,
): Promise<InspectionParamSetRow> {
  return apiRequest(`${PREFIX}/equipment/inspection-param-sets/with-items`, { method: 'POST', data: body });
}

export function listInspectionParamSetItems(setId: number): Promise<InspectionParamSetItemRow[]> {
  return apiRequest(`${PREFIX}/equipment/inspection-param-sets/${setId}/items`);
}

export function addInspectionParamSetItem(setId: number, body: SetItemCreatePayload): Promise<InspectionParamSetItemRow> {
  return apiRequest(`${PREFIX}/equipment/inspection-param-sets/${setId}/items`, { method: 'POST', data: body });
}

export function updateInspectionParamSetItem(itemId: number, body: SetItemUpdatePayload): Promise<InspectionParamSetItemRow> {
  return apiRequest(`${PREFIX}/equipment/inspection-param-set-items/${itemId}`, { method: 'PATCH', data: body });
}

export function deleteInspectionParamSetItem(itemId: number): Promise<void> {
  return apiRequest(`${PREFIX}/equipment/inspection-param-set-items/${itemId}`, { method: 'DELETE' });
}

/** --- 设备运行单据（点检 / 路线巡检 / 维保 / 产出）--- */

export interface EquipmentSpotCheckLineRow {
  id: number;
  inspection_param_id?: number | null;
  param_code: string;
  param_name: string;
  param_requirement?: string | null;
  sort_order: number;
  value_type: string;
  unit?: string | null;
  is_required: boolean;
  numeric_min?: number | string | null;
  numeric_max?: number | string | null;
  measured_value?: string | null;
  result: string;
  remark?: string | null;
  attachment_file_ids?: string[] | null;
}

export interface EquipmentSpotCheckRow {
  id: number;
  uuid: string;
  sheet_no?: string | null;
  recorded_at: string;
  equipment_id: number;
  equipment_asset_code?: string;
  equipment_name?: string;
  inspection_param_set_id?: number | null;
  inspection_param_set_code?: string | null;
  inspection_param_set_name?: string | null;
  reporter_user_id: number;
  abnormal_description?: string | null;
  applied_operational_status?: string | null;
  report_enabled: boolean;
  report_notify_user_ids: number[];
  created_at: string;
  lines?: EquipmentSpotCheckLineRow[];
}

export type EquipmentSpotCheckCreatePayload = {
  equipment_id: number;
  inspection_param_set_id?: number | null;
  recorded_at?: string | null;
  abnormal_description?: string | null;
  applied_operational_status?: string | null;
  report_enabled?: boolean;
  report_notify_user_ids?: number[];
};

export type EquipmentSpotCheckLinePatch = {
  id: number;
  result: string;
  remark?: string | null;
  measured_value?: string | null;
  attachment_file_ids?: string[] | null;
};
export type EquipmentSpotCheckUpdatePayload = {
  recorded_at?: string | null;
  abnormal_description?: string | null;
  applied_operational_status?: string | null;
  report_enabled?: boolean;
  report_notify_user_ids?: number[];
  lines?: EquipmentSpotCheckLinePatch[];
};

export interface EquipmentSpotCheckPreviewLine {
  inspection_param_id?: number | null;
  param_code: string;
  param_name: string;
  param_requirement?: string | null;
  sort_order: number;
  value_type: string;
  unit?: string | null;
  is_required: boolean;
  default_value?: string | null;
  numeric_min?: number | string | null;
  numeric_max?: number | string | null;
}

export interface EquipmentSpotCheckPreviewResult {
  equipment_id: number;
  inspection_param_set_id: number;
  inspection_param_set_code: string;
  inspection_param_set_name: string;
  lines: EquipmentSpotCheckPreviewLine[];
}

export function previewEquipmentSpotCheckLines(params: {
  equipment_id: number;
  inspection_param_set_id?: number;
}): Promise<EquipmentSpotCheckPreviewResult> {
  return apiRequest(`${PREFIX}/equipment/spot-checks/preview-lines`, { params });
}

export function listEquipmentSpotChecks(params?: {
  skip?: number;
  limit?: number;
  equipment_id?: number;
  inspection_param_set_id?: number;
  sheet_no?: string;
  recorded_from?: string;
  recorded_to?: string;
  keyword?: string;
}): Promise<PageResult<EquipmentSpotCheckRow>> {
  return apiRequest(`${PREFIX}/equipment/spot-checks`, { params });
}

export function getEquipmentSpotCheck(rowId: number): Promise<EquipmentSpotCheckRow> {
  return apiRequest(`${PREFIX}/equipment/spot-checks/${rowId}`);
}

export function createEquipmentSpotCheck(body: EquipmentSpotCheckCreatePayload): Promise<EquipmentSpotCheckRow> {
  return apiRequest(`${PREFIX}/equipment/spot-checks`, { method: 'POST', data: body });
}

export function updateEquipmentSpotCheck(
  rowId: number,
  body: EquipmentSpotCheckUpdatePayload,
): Promise<EquipmentSpotCheckRow> {
  return apiRequest(`${PREFIX}/equipment/spot-checks/${rowId}`, { method: 'PATCH', data: body });
}

export function deleteEquipmentSpotCheck(rowId: number): Promise<void> {
  return apiRequest(`${PREFIX}/equipment/spot-checks/${rowId}`, { method: 'DELETE' });
}

export interface EquipmentRoutePatrolLineRow {
  id: number;
  equipment_id: number;
  asset_code: string;
  equipment_name: string;
  sequence: number;
  is_normal: boolean;
  abnormal_description?: string | null;
  applied_operational_status?: string | null;
  attachment_file_ids?: string[] | null;
}

export interface EquipmentRoutePatrolPreviewLine {
  equipment_id: number;
  asset_code: string;
  equipment_name: string;
  sequence: number;
}

export interface EquipmentRoutePatrolRow {
  id: number;
  uuid: string;
  sheet_no?: string | null;
  recorded_at: string;
  patrol_route_id: number;
  patrol_route_code?: string;
  patrol_route_name?: string;
  patrol_route_workshop_id?: number | null;
  patrol_route_workshop_name?: string | null;
  reporter_user_id: number;
  report_enabled: boolean;
  report_notify_user_ids: number[];
  created_at: string;
  lines?: EquipmentRoutePatrolLineRow[];
}

export type EquipmentRoutePatrolCreatePayload = {
  patrol_route_id: number;
  recorded_at?: string | null;
  report_enabled?: boolean;
  report_notify_user_ids?: number[];
};

export type EquipmentRoutePatrolLinePatch = {
  id: number;
  is_normal: boolean;
  abnormal_description?: string | null;
  applied_operational_status?: string | null;
  attachment_file_ids?: string[] | null;
};
export type EquipmentRoutePatrolUpdatePayload = {
  recorded_at?: string | null;
  report_enabled?: boolean;
  report_notify_user_ids?: number[];
  lines?: EquipmentRoutePatrolLinePatch[];
};

export function previewEquipmentRoutePatrolLines(params: {
  patrol_route_id: number;
}): Promise<EquipmentRoutePatrolPreviewLine[]> {
  return apiRequest(`${PREFIX}/equipment/route-patrols/preview-lines`, { params });
}

export function listEquipmentRoutePatrols(params?: {
  skip?: number;
  limit?: number;
  patrol_route_id?: number;
  sheet_no?: string;
  recorded_from?: string;
  recorded_to?: string;
  keyword?: string;
}): Promise<PageResult<EquipmentRoutePatrolRow>> {
  return apiRequest(`${PREFIX}/equipment/route-patrols`, { params });
}

export function getEquipmentRoutePatrol(rowId: number): Promise<EquipmentRoutePatrolRow> {
  return apiRequest(`${PREFIX}/equipment/route-patrols/${rowId}`);
}

export function createEquipmentRoutePatrol(
  body: EquipmentRoutePatrolCreatePayload,
): Promise<EquipmentRoutePatrolRow> {
  return apiRequest(`${PREFIX}/equipment/route-patrols`, { method: 'POST', data: body });
}

export function updateEquipmentRoutePatrol(
  rowId: number,
  body: EquipmentRoutePatrolUpdatePayload,
): Promise<EquipmentRoutePatrolRow> {
  return apiRequest(`${PREFIX}/equipment/route-patrols/${rowId}`, { method: 'PATCH', data: body });
}

export function deleteEquipmentRoutePatrol(rowId: number): Promise<void> {
  return apiRequest(`${PREFIX}/equipment/route-patrols/${rowId}`, { method: 'DELETE' });
}

export interface EquipmentUpkeepSheetRow {
  id: number;
  uuid: string;
  sheet_no?: string | null;
  service_type?: string;
  applicant_user_id?: number | null;
  applicant_name?: string | null;
  department_uuid?: string | null;
  department_name?: string | null;
  header_attachment_file_uuids: string[];
  equipment_id: number;
  equipment_asset_code?: string | null;
  equipment_name?: string | null;
  description?: string | null;
  upkeep_param_set_id?: number | null;
  upkeep_param_set_code?: string | null;
  upkeep_param_set_name?: string | null;
  reporter_user_id: number;
  created_at: string;
}

export type EquipmentUpkeepSheetCreatePayload = {
  service_type?: '维修' | '保养';
  applicant_user_id: number;
  department_uuid: string;
  equipment_id: number;
  description?: string | null;
  upkeep_param_set_id?: number | null;
  header_attachment_file_uuids?: string[] | null;
};

export type EquipmentUpkeepSheetUpdatePayload = {
  service_type?: '维修' | '保养';
  applicant_user_id?: number;
  department_uuid?: string;
  equipment_id?: number;
  description?: string;
  upkeep_param_set_id?: number | null;
  header_attachment_file_uuids?: string[] | null;
};

export function listEquipmentUpkeepSheets(params?: {
  skip?: number;
  limit?: number;
  keyword?: string;
  service_type?: string;
  open_for_complete?: boolean;
}): Promise<PageResult<EquipmentUpkeepSheetRow>> {
  return apiRequest(`${PREFIX}/equipment/upkeep-sheets`, { params });
}

export function getEquipmentUpkeepSheet(rowId: number): Promise<EquipmentUpkeepSheetRow> {
  return apiRequest(`${PREFIX}/equipment/upkeep-sheets/${rowId}`);
}

export function createEquipmentUpkeepSheet(
  body: EquipmentUpkeepSheetCreatePayload,
): Promise<EquipmentUpkeepSheetRow> {
  return apiRequest(`${PREFIX}/equipment/upkeep-sheets`, { method: 'POST', data: body });
}

export function updateEquipmentUpkeepSheet(
  rowId: number,
  body: EquipmentUpkeepSheetUpdatePayload,
): Promise<EquipmentUpkeepSheetRow> {
  return apiRequest(`${PREFIX}/equipment/upkeep-sheets/${rowId}`, { method: 'PATCH', data: body });
}

export function deleteEquipmentUpkeepSheet(rowId: number): Promise<void> {
  return apiRequest(`${PREFIX}/equipment/upkeep-sheets/${rowId}`, { method: 'DELETE' });
}

export interface EquipmentUpkeepCompleteSheetRow {
  id: number;
  uuid: string;
  sheet_no?: string | null;
  service_type?: string;
  source_upkeep_sheet_id?: number | null;
  source_order_no: string;
  applicant_user_id?: number | null;
  applicant_name?: string | null;
  department_uuid?: string | null;
  department_name?: string | null;
  header_attachment_file_uuids: string[];
  source_header_attachment_file_uuids: string[];
  equipment_id?: number | null;
  equipment_asset_code?: string | null;
  equipment_name?: string | null;
  source_description?: string | null;
  source_service_type?: string | null;
  completion_content?: string | null;
  upkeep_param_set_id?: number | null;
  upkeep_record_lines?: EquipmentUpkeepSchemeLineRow[];
  repair_content?: string | null;
  repair_result?: string | null;
  source_upkeep_param_set_id?: number | null;
  source_upkeep_param_set_code?: string | null;
  source_upkeep_param_set_name?: string | null;
  /** 保养完修：是否清空累计产量 */
  clear_total_production?: boolean;
  reporter_user_id: number;
  created_at: string;
}

export type EquipmentUpkeepRecordLinePayload = {
  param_id: number;
  record_value?: string | null;
};

export type EquipmentUpkeepCompleteSheetCreatePayload = {
  source_upkeep_sheet_id: number;
  applicant_user_id?: number | null;
  department_uuid?: string | null;
  header_attachment_file_uuids?: string[] | null;
  completion_content?: string | null;
  upkeep_param_set_id?: number | null;
  upkeep_record_lines?: EquipmentUpkeepRecordLinePayload[];
  repair_content?: string | null;
  repair_result?: string | null;
  clear_total_production?: boolean;
};

export type EquipmentUpkeepCompleteSheetUpdatePayload = {
  applicant_user_id?: number;
  department_uuid?: string;
  header_attachment_file_uuids?: string[] | null;
  completion_content?: string | null;
  upkeep_param_set_id?: number | null;
  upkeep_record_lines?: EquipmentUpkeepRecordLinePayload[];
  repair_content?: string | null;
  repair_result?: string | null;
  clear_total_production?: boolean;
};

export function listEquipmentUpkeepCompleteSheets(params?: {
  skip?: number;
  limit?: number;
  keyword?: string;
  service_type?: string;
  created_from?: string;
  created_to?: string;
}): Promise<PageResult<EquipmentUpkeepCompleteSheetRow>> {
  return apiRequest(`${PREFIX}/equipment/upkeep-complete-sheets`, { params });
}

export function getEquipmentUpkeepCompleteSheet(rowId: number): Promise<EquipmentUpkeepCompleteSheetRow> {
  return apiRequest(`${PREFIX}/equipment/upkeep-complete-sheets/${rowId}`);
}

export function createEquipmentUpkeepCompleteSheet(
  body: EquipmentUpkeepCompleteSheetCreatePayload,
): Promise<EquipmentUpkeepCompleteSheetRow> {
  return apiRequest(`${PREFIX}/equipment/upkeep-complete-sheets`, { method: 'POST', data: body });
}

export function updateEquipmentUpkeepCompleteSheet(
  rowId: number,
  body: EquipmentUpkeepCompleteSheetUpdatePayload,
): Promise<EquipmentUpkeepCompleteSheetRow> {
  return apiRequest(`${PREFIX}/equipment/upkeep-complete-sheets/${rowId}`, { method: 'PATCH', data: body });
}

export function deleteEquipmentUpkeepCompleteSheet(rowId: number): Promise<void> {
  return apiRequest(`${PREFIX}/equipment/upkeep-complete-sheets/${rowId}`, { method: 'DELETE' });
}

export interface EquipmentOutputRecordRow {
  id: number;
  uuid: string;
  sheet_no?: string | null;
  recorded_at: string;
  equipment_id: number;
  equipment_asset_code?: string;
  equipment_name?: string;
  work_order_no?: string | null;
  customer_name?: string | null;
  product_name?: string | null;
  finished_product_code?: string | null;
  finished_product_name?: string | null;
  planned_qty?: string | number | null;
  completed_qty: string | number;
  startup_at?: string | null;
  completed_at?: string | null;
  operator_name?: string | null;
  team_leader_name?: string | null;
  reporter_user_id: number;
  dataset_snapshot?: Record<string, unknown> | null;
  created_at: string;
}

export type EquipmentOutputRecordCreatePayload = {
  equipment_id: number;
  work_order_no?: string | null;
  recorded_at?: string | null;
  customer_name?: string | null;
  product_name?: string | null;
  finished_product_code?: string | null;
  finished_product_name?: string | null;
  planned_qty?: string | number | null;
  completed_qty?: string | number;
  startup_at?: string | null;
  completed_at?: string | null;
  operator_name?: string | null;
  team_leader_name?: string | null;
  dataset_snapshot?: Record<string, unknown> | null;
};

export type EquipmentOutputRecordUpdatePayload = Partial<
  Omit<EquipmentOutputRecordCreatePayload, 'equipment_id' | 'work_order_no'>
> & { work_order_no?: string | null };

export function listEquipmentOutputRecords(params?: {
  skip?: number;
  limit?: number;
  equipment_id?: number;
  sheet_no?: string;
  work_order_no?: string;
  recorded_from?: string;
  recorded_to?: string;
  keyword?: string;
}): Promise<PageResult<EquipmentOutputRecordRow>> {
  return apiRequest(`${PREFIX}/equipment/output-records`, { params });
}

export function getEquipmentOutputRecord(rowId: number): Promise<EquipmentOutputRecordRow> {
  return apiRequest(`${PREFIX}/equipment/output-records/${rowId}`);
}

export function createEquipmentOutputRecord(
  body: EquipmentOutputRecordCreatePayload,
): Promise<EquipmentOutputRecordRow> {
  return apiRequest(`${PREFIX}/equipment/output-records`, { method: 'POST', data: body });
}

export function updateEquipmentOutputRecord(
  rowId: number,
  body: EquipmentOutputRecordUpdatePayload,
): Promise<EquipmentOutputRecordRow> {
  return apiRequest(`${PREFIX}/equipment/output-records/${rowId}`, { method: 'PATCH', data: body });
}

export function deleteEquipmentOutputRecord(rowId: number): Promise<void> {
  return apiRequest(`${PREFIX}/equipment/output-records/${rowId}`, { method: 'DELETE' });
}

export interface EquipmentCapacitySummary {
  record_count: number;
  planned_qty_total?: string | number | null;
  completed_qty_total: string | number;
  achievement_rate_pct?: number | null;
}

export interface EquipmentCapacityByEquipmentRow {
  equipment_id: number;
  equipment_asset_code?: string;
  equipment_name?: string;
  record_count: number;
  planned_qty_total?: string | number | null;
  completed_qty_total: string | number;
  achievement_rate_pct?: number | null;
}

export interface EquipmentCapacityReportResult {
  summary: EquipmentCapacitySummary;
  group_by: 'detail' | 'equipment' | string;
  items: EquipmentOutputRecordRow[];
  equipment_items: EquipmentCapacityByEquipmentRow[];
  total: number;
  skip: number;
  limit: number;
}

export function getEquipmentCapacityReport(params?: {
  skip?: number;
  limit?: number;
  equipment_id?: number;
  sheet_no?: string;
  work_order_no?: string;
  recorded_from?: string;
  recorded_to?: string;
  keyword?: string;
  group_by?: 'detail' | 'equipment';
}): Promise<EquipmentCapacityReportResult> {
  return apiRequest(`${PREFIX}/equipment/reports/capacity`, { params });
}

export interface EquipmentOutputDatasetBindingPayload {
  dataset_uuid?: string | null;
  work_order_param_key?: string | null;
  customer_column?: string | null;
  product_name_column?: string | null;
  finished_product_code_column?: string | null;
  finished_product_name_column?: string | null;
  planned_qty_column?: string | null;
}

export function getEquipmentOutputDatasetBinding(): Promise<EquipmentOutputDatasetBindingPayload> {
  return apiRequest(`${PREFIX}/equipment/output-dataset-binding`);
}

export function putEquipmentOutputDatasetBinding(
  body: EquipmentOutputDatasetBindingPayload,
): Promise<EquipmentOutputDatasetBindingPayload> {
  return apiRequest(`${PREFIX}/equipment/output-dataset-binding`, { method: 'PUT', data: body });
}

export interface EquipmentStatusAdjustmentRow {
  id: number;
  uuid: string;
  sheet_no?: string | null;
  recorded_at: string;
  equipment_id: number;
  equipment_asset_code?: string | null;
  equipment_name?: string | null;
  old_operational_status?: string | null;
  new_operational_status: string;
  remark?: string | null;
  reporter_user_id: number;
  created_at: string;
}

export type EquipmentStatusAdjustmentCreatePayload = {
  equipment_id: number;
  new_operational_status: string;
  recorded_at?: string | null;
  remark?: string | null;
};

export type EquipmentStatusAdjustmentUpdatePayload = {
  recorded_at?: string | null;
  remark?: string | null;
};

export function listEquipmentStatusAdjustments(params?: {
  skip?: number;
  limit?: number;
  equipment_id?: number;
  sheet_no?: string;
  recorded_from?: string;
  recorded_to?: string;
  keyword?: string;
}): Promise<PageResult<EquipmentStatusAdjustmentRow>> {
  return apiRequest(`${PREFIX}/equipment/status-adjustments`, { params });
}

export function getEquipmentStatusAdjustment(rowId: number): Promise<EquipmentStatusAdjustmentRow> {
  return apiRequest(`${PREFIX}/equipment/status-adjustments/${rowId}`);
}

export function createEquipmentStatusAdjustment(
  body: EquipmentStatusAdjustmentCreatePayload,
): Promise<EquipmentStatusAdjustmentRow> {
  return apiRequest(`${PREFIX}/equipment/status-adjustments`, { method: 'POST', data: body });
}

export function updateEquipmentStatusAdjustment(
  rowId: number,
  body: EquipmentStatusAdjustmentUpdatePayload,
): Promise<EquipmentStatusAdjustmentRow> {
  return apiRequest(`${PREFIX}/equipment/status-adjustments/${rowId}`, { method: 'PATCH', data: body });
}

export function deleteEquipmentStatusAdjustment(rowId: number): Promise<void> {
  return apiRequest(`${PREFIX}/equipment/status-adjustments/${rowId}`, { method: 'DELETE' });
}

export function previewEquipmentOutputByWorkOrder(body: {
  work_order_no?: string | null;
}): Promise<{
  work_order_no?: string | null;
  finished_product_code?: string | null;
  finished_product_name?: string | null;
  planned_qty?: string | number | null;
  dataset_row?: Record<string, unknown> | null;
}> {
  return apiRequest(`${PREFIX}/equipment/output-records/preview-by-work-order`, { method: 'POST', data: body });
}

/** 模具台账（与后端 MoldOut 对齐） */
export interface MoldRow {
  id: number;
  uuid: string;
  mold_code: string;
  name: string;
  unit: string;
  mold_capacity: string;
  processing_time_min?: number | null;
  /** 模具寿命（累计产量上限） */
  service_life_years?: string | number | null;
  usable_times?: number | null;
  usable_yield?: string | null;
  maintenance_cycle_by_yield?: string | null;
  allow_repeated_borrow: boolean;
  purchase_vendor_name?: string | null;
  status: string;
  total_manufacture_qty: string;
  outsource_vendor_code?: string | null;
  outsource_vendor_name?: string | null;
  mold_warehouse_id?: number | null;
  mold_warehouse_code?: string | null;
  mold_warehouse_name?: string | null;
  erp_material_code?: string | null;
  remark?: string | null;
  /** 来源：sync=数据集同步，manual=手工创建/导入 */
  ledger_source?: string;
  /** 已使用次数（每笔还入单 +1，存于台账） */
  used_times?: number;
  /** 已使用产量（还入制造数量累计） */
  used_yield?: string;
  /** 试模不合格待处理：记忆的消息提醒人员 */
  trial_pending_notify_user_ids?: number[];
  upkeep_param_set_id?: number | null;
}

export type MoldCreatePayload = {
  mold_code: string;
  name: string;
  unit: string;
  mold_capacity: string | number;
  service_life_years?: string | number | null;
  usable_times?: number | null;
  usable_yield?: string | number | null;
  maintenance_cycle_by_yield?: string | number | null;
  allow_repeated_borrow: boolean;
  purchase_vendor_name?: string | null;
  status: string;
  total_manufacture_qty?: string | number;
  outsource_vendor_code?: string | null;
  outsource_vendor_name?: string | null;
  mold_warehouse_id?: number | null;
  erp_material_code?: string | null;
  remark?: string | null;
  upkeep_param_set_id?: number | null;
};

export type MoldUpdatePayload = Partial<Omit<MoldCreatePayload, 'mold_code'>>;

/** 模具保养项 */
export interface MoldUpkeepParamRow {
  id: number;
  uuid: string;
  code: string;
  name: string;
  requirement?: string | null;
  value_type: string;
  default_value?: string | null;
}

export type MoldUpkeepParamCreatePayload = {
  code: string;
  name: string;
  requirement?: string | null;
  value_type?: string;
  default_value?: string | null;
};

export type MoldUpkeepParamUpdatePayload = {
  name?: string;
  requirement?: string | null;
  value_type?: string;
  default_value?: string | null;
};

export function listMoldUpkeepParams(): Promise<MoldUpkeepParamRow[]> {
  return apiRequest(`${PREFIX}/molds/upkeep-params`);
}

export function createMoldUpkeepParam(body: MoldUpkeepParamCreatePayload): Promise<MoldUpkeepParamRow> {
  return apiRequest(`${PREFIX}/molds/upkeep-params`, { method: 'POST', data: body });
}

export function updateMoldUpkeepParam(rowId: number, body: MoldUpkeepParamUpdatePayload): Promise<MoldUpkeepParamRow> {
  return apiRequest(`${PREFIX}/molds/upkeep-params/${rowId}`, { method: 'PATCH', data: body });
}

export function deleteMoldUpkeepParam(rowId: number): Promise<void> {
  return apiRequest(`${PREFIX}/molds/upkeep-params/${rowId}`, { method: 'DELETE' });
}

/** 模具保养方案 */
export interface MoldUpkeepParamSetRow {
  id: number;
  uuid: string;
  code: string;
  name: string;
}

export type MoldUpkeepParamSetCreatePayload = { code: string; name: string };
export type MoldUpkeepParamSetUpdatePayload = { name?: string };

export interface MoldUpkeepParamSetItemRow {
  id: number;
  param_id: number;
  set_id: number;
  sort_order: number;
  is_required: boolean;
}

export type MoldUpkeepSetItemCreatePayload = {
  param_id: number;
  sort_order?: number;
  is_required?: boolean;
};

export type MoldUpkeepSetItemUpdatePayload = {
  sort_order?: number;
  is_required?: boolean;
};

export type MoldUpkeepParamSetCreateWithItemsPayload = {
  code: string;
  name: string;
  items: MoldUpkeepSetItemCreatePayload[];
};

export function listMoldUpkeepParamSets(): Promise<MoldUpkeepParamSetRow[]> {
  return apiRequest(`${PREFIX}/molds/upkeep-param-sets`);
}

export function createMoldUpkeepParamSet(body: MoldUpkeepParamSetCreatePayload): Promise<MoldUpkeepParamSetRow> {
  return apiRequest(`${PREFIX}/molds/upkeep-param-sets`, { method: 'POST', data: body });
}

export function createMoldUpkeepParamSetWithItems(
  body: MoldUpkeepParamSetCreateWithItemsPayload,
): Promise<MoldUpkeepParamSetRow> {
  return apiRequest(`${PREFIX}/molds/upkeep-param-sets/with-items`, { method: 'POST', data: body });
}

export function updateMoldUpkeepParamSet(
  rowId: number,
  body: MoldUpkeepParamSetUpdatePayload,
): Promise<MoldUpkeepParamSetRow> {
  return apiRequest(`${PREFIX}/molds/upkeep-param-sets/${rowId}`, { method: 'PATCH', data: body });
}

export function deleteMoldUpkeepParamSet(rowId: number): Promise<void> {
  return apiRequest(`${PREFIX}/molds/upkeep-param-sets/${rowId}`, { method: 'DELETE' });
}

export function listMoldUpkeepParamSetItems(setId: number): Promise<MoldUpkeepParamSetItemRow[]> {
  return apiRequest(`${PREFIX}/molds/upkeep-param-sets/${setId}/items`);
}

export function addMoldUpkeepParamSetItem(
  setId: number,
  body: MoldUpkeepSetItemCreatePayload,
): Promise<MoldUpkeepParamSetItemRow> {
  return apiRequest(`${PREFIX}/molds/upkeep-param-sets/${setId}/items`, { method: 'POST', data: body });
}

export function updateMoldUpkeepParamSetItem(
  itemId: number,
  body: MoldUpkeepSetItemUpdatePayload,
): Promise<MoldUpkeepParamSetItemRow> {
  return apiRequest(`${PREFIX}/molds/upkeep-param-set-items/${itemId}`, { method: 'PATCH', data: body });
}

export function deleteMoldUpkeepParamSetItem(itemId: number): Promise<void> {
  return apiRequest(`${PREFIX}/molds/upkeep-param-set-items/${itemId}`, { method: 'DELETE' });
}

/** 保养方案展开行（完修单按方案填记录） */
export interface MoldUpkeepSchemeLineRow {
  param_id: number;
  param_code: string;
  param_name: string;
  requirement?: string | null;
  value_type?: string;
  option_values?: string[];
  is_required: boolean;
  sort_order: number;
  record_value?: string | null;
}

export function fetchMoldUpkeepSchemeByMoldCode(moldCode: string): Promise<MoldUpkeepSchemeLineRow[]> {
  return apiRequest(`${PREFIX}/molds/upkeep-scheme-by-code`, { params: { mold_code: moldCode } });
}

export interface MoldUpkeepSchemeContext {
  mold_code: string;
  ledger_upkeep_param_set_id?: number | null;
  lines: MoldUpkeepSchemeLineRow[];
}

export function fetchMoldUpkeepSchemeContext(moldCode: string): Promise<MoldUpkeepSchemeContext> {
  return apiRequest(`${PREFIX}/molds/upkeep-scheme-context`, { params: { mold_code: moldCode } });
}

export function fetchMoldUpkeepSchemeLinesBySet(setId: number): Promise<MoldUpkeepSchemeLineRow[]> {
  return apiRequest(`${PREFIX}/molds/upkeep-param-sets/${setId}/scheme-lines`);
}

/** 设备保养项 */
export interface EquipmentUpkeepParamRow {
  id: number;
  uuid: string;
  code: string;
  name: string;
  requirement?: string | null;
  value_type: string;
  default_value?: string | null;
}

export type EquipmentUpkeepParamCreatePayload = MoldUpkeepParamCreatePayload;
export type EquipmentUpkeepParamUpdatePayload = MoldUpkeepParamUpdatePayload;

export function listEquipmentUpkeepParams(): Promise<EquipmentUpkeepParamRow[]> {
  return apiRequest(`${PREFIX}/equipment/upkeep-params`);
}

export function createEquipmentUpkeepParam(body: EquipmentUpkeepParamCreatePayload): Promise<EquipmentUpkeepParamRow> {
  return apiRequest(`${PREFIX}/equipment/upkeep-params`, { method: 'POST', data: body });
}

export function updateEquipmentUpkeepParam(
  rowId: number,
  body: EquipmentUpkeepParamUpdatePayload,
): Promise<EquipmentUpkeepParamRow> {
  return apiRequest(`${PREFIX}/equipment/upkeep-params/${rowId}`, { method: 'PATCH', data: body });
}

export function deleteEquipmentUpkeepParam(rowId: number): Promise<void> {
  return apiRequest(`${PREFIX}/equipment/upkeep-params/${rowId}`, { method: 'DELETE' });
}

/** 设备保养方案 */
export interface EquipmentUpkeepParamSetRow {
  id: number;
  uuid: string;
  code: string;
  name: string;
}

export type EquipmentUpkeepParamSetCreatePayload = MoldUpkeepParamSetCreatePayload;
export type EquipmentUpkeepParamSetUpdatePayload = MoldUpkeepParamSetUpdatePayload;
export type EquipmentUpkeepParamSetItemRow = MoldUpkeepParamSetItemRow;
export type EquipmentUpkeepSetItemCreatePayload = MoldUpkeepSetItemCreatePayload;
export type EquipmentUpkeepSetItemUpdatePayload = MoldUpkeepSetItemUpdatePayload;
export type EquipmentUpkeepParamSetCreateWithItemsPayload = MoldUpkeepParamSetCreateWithItemsPayload;

export function listEquipmentUpkeepParamSets(): Promise<EquipmentUpkeepParamSetRow[]> {
  return apiRequest(`${PREFIX}/equipment/upkeep-param-sets`);
}

export function createEquipmentUpkeepParamSet(
  body: EquipmentUpkeepParamSetCreatePayload,
): Promise<EquipmentUpkeepParamSetRow> {
  return apiRequest(`${PREFIX}/equipment/upkeep-param-sets`, { method: 'POST', data: body });
}

export function createEquipmentUpkeepParamSetWithItems(
  body: EquipmentUpkeepParamSetCreateWithItemsPayload,
): Promise<EquipmentUpkeepParamSetRow> {
  return apiRequest(`${PREFIX}/equipment/upkeep-param-sets/with-items`, { method: 'POST', data: body });
}

export function updateEquipmentUpkeepParamSet(
  rowId: number,
  body: EquipmentUpkeepParamSetUpdatePayload,
): Promise<EquipmentUpkeepParamSetRow> {
  return apiRequest(`${PREFIX}/equipment/upkeep-param-sets/${rowId}`, { method: 'PATCH', data: body });
}

export function deleteEquipmentUpkeepParamSet(rowId: number): Promise<void> {
  return apiRequest(`${PREFIX}/equipment/upkeep-param-sets/${rowId}`, { method: 'DELETE' });
}

export function listEquipmentUpkeepParamSetItems(setId: number): Promise<EquipmentUpkeepParamSetItemRow[]> {
  return apiRequest(`${PREFIX}/equipment/upkeep-param-sets/${setId}/items`);
}

export function addEquipmentUpkeepParamSetItem(
  setId: number,
  body: EquipmentUpkeepSetItemCreatePayload,
): Promise<EquipmentUpkeepParamSetItemRow> {
  return apiRequest(`${PREFIX}/equipment/upkeep-param-sets/${setId}/items`, { method: 'POST', data: body });
}

export function updateEquipmentUpkeepParamSetItem(
  itemId: number,
  body: EquipmentUpkeepSetItemUpdatePayload,
): Promise<EquipmentUpkeepParamSetItemRow> {
  return apiRequest(`${PREFIX}/equipment/upkeep-param-set-items/${itemId}`, { method: 'PATCH', data: body });
}

export function deleteEquipmentUpkeepParamSetItem(itemId: number): Promise<void> {
  return apiRequest(`${PREFIX}/equipment/upkeep-param-set-items/${itemId}`, { method: 'DELETE' });
}

export type EquipmentUpkeepSchemeLineRow = MoldUpkeepSchemeLineRow;

export interface EquipmentUpkeepSchemeContext {
  equipment_id: number;
  ledger_upkeep_param_set_id?: number | null;
  lines: EquipmentUpkeepSchemeLineRow[];
}

export function fetchEquipmentUpkeepSchemeContext(equipmentId: number): Promise<EquipmentUpkeepSchemeContext> {
  return apiRequest(`${PREFIX}/equipment/upkeep-scheme-context`, { params: { equipment_id: equipmentId } });
}

export function fetchEquipmentUpkeepSchemeLinesBySet(setId: number): Promise<EquipmentUpkeepSchemeLineRow[]> {
  return apiRequest(`${PREFIX}/equipment/upkeep-param-sets/${setId}/scheme-lines`);
}

export function listMolds(params?: {
  skip?: number;
  limit?: number;
  status?: string;
  mold_code?: string;
  name?: string;
  /** sync | manual */
  ledger_source?: string;
  /** 模糊：代号/名称/单位/厂商与物料编码/备注（后端 icontains OR） */
  keyword?: string;
}): Promise<PageResult<MoldRow>> {
  return apiRequest(`${PREFIX}/molds`, { params });
}

/** 保养预警表：各模具最近保养完修时间（厂内 + 外协已通过） */
export function fetchMaintenanceUpkeepLastByMold(): Promise<{ items: Record<string, string> }> {
  return apiRequest(`${PREFIX}/molds/reports/maintenance-upkeep-last-by-mold`);
}

export function getMold(rowId: number): Promise<MoldRow> {
  return apiRequest(`${PREFIX}/molds/${rowId}`);
}

/** 模具台账详情 — 操作记录（与后端 MoldOperationRecordOut 对齐） */
export type MoldOperationRecordKind =
  | 'borrow'
  | 'return'
  | 'trial'
  | 'maintenance'
  | 'maintenance_complete'
  | 'outsource_maintenance'
  | 'outsource_maintenance_complete';

export interface MoldOperationRecordRow {
  kind: MoldOperationRecordKind;
  occurred_at: string;
  record_id: number;
  uuid: string;
  title: string;
  detail: string;
  /** 标准业务单号；历史数据可能为空 */
  sheet_no?: string | null;
}

export function listMoldOperationRecords(rowId: number): Promise<{ items: MoldOperationRecordRow[] }> {
  return apiRequest(`${PREFIX}/molds/${rowId}/operation-records`);
}

export function createMold(body: MoldCreatePayload): Promise<MoldRow> {
  return apiRequest(`${PREFIX}/molds`, { method: 'POST', data: body });
}

export function updateMold(rowId: number, body: MoldUpdatePayload): Promise<MoldRow> {
  return apiRequest(`${PREFIX}/molds/${rowId}`, { method: 'PATCH', data: body });
}

/** 批量更新寿命/维修周期/状态等（与列表筛选一致） */
export type MoldBatchLifecycleScope = 'selected' | 'all_filtered';

export interface MoldBatchLifecyclePayload {
  scope: MoldBatchLifecycleScope;
  mold_ids?: number[];
  filter_status?: string;
  filter_keyword?: string;
  service_life_years?: string | number;
  usable_times?: number;
  maintenance_cycle_by_yield?: string | number;
  status?: string;
  /** 显式传 null 表示批量清空所在仓库 */
  mold_warehouse_id?: number | null;
}

export function batchMoldsLifecycle(body: MoldBatchLifecyclePayload): Promise<{ updated: number }> {
  return apiRequest(`${PREFIX}/molds/batch-lifecycle`, { method: 'POST', data: body });
}

export function deleteMold(rowId: number): Promise<void> {
  return apiRequest(`${PREFIX}/molds/${rowId}`, { method: 'DELETE' });
}

/** 模具台账 ↔ 数据集关联（同步代号/名称/单位；可选映射单模产能） */
export interface MoldLedgerDatasetBindingPayload {
  dataset_uuid?: string | null;
  mold_code_column?: string | null;
  mold_name_column?: string | null;
  unit_column?: string | null;
  mold_capacity_column?: string | null;
}

export function getMoldLedgerDatasetBinding(): Promise<MoldLedgerDatasetBindingPayload> {
  return apiRequest(`${PREFIX}/molds/ledger/dataset-binding`);
}

export function putMoldLedgerDatasetBinding(
  body: MoldLedgerDatasetBindingPayload,
): Promise<MoldLedgerDatasetBindingPayload> {
  return apiRequest(`${PREFIX}/molds/ledger/dataset-binding`, { method: 'PUT', data: body });
}

export interface MoldLedgerSyncResult {
  created: number;
  updated: number;
  skipped: number;
}

export function syncMoldLedgerFromDataset(): Promise<MoldLedgerSyncResult> {
  return apiRequest(`${PREFIX}/molds/ledger/sync-from-dataset`, { method: 'POST' });
}

/** 试模单（与后端 MoldTrialSheetOut 对齐） */
export interface MoldTrialSheetRow {
  id: number;
  uuid: string;
  sheet_no?: string | null;
  purchase_order_no?: string | null;
  supplier_name?: string | null;
  mold_code?: string | null;
  mold_name?: string | null;
  trial_times?: number | null;
  trial_user_id?: number | null;
  trial_user_name?: string | null;
  failure_handling?: string | null;
  pending_notify_user_ids?: number[];
  pending_notify_users?: Array<{ id: number; name: string }>;
  submitted_notify_user_ids?: number[];
  submitted_notify_users?: Array<{ id: number; name: string }>;
  repair_warehouse_id?: number | null;
  dispatch_origin_warehouse_id?: number | null;
  result_attachment_file_uuids: string[];
  inspection_attachment_file_uuids: string[];
  trial_result: string;
  /** 试模 / 试模合格待试产 / 已结案 */
  workflow_phase?: string | null;
  production_trial_result?: string | null;
  production_trial_user_id?: number | null;
  production_trial_user_name?: string | null;
  sheet_status: string;
  audited_at?: string | null;
  audited_by_user_id?: number | null;
  created_at?: string | null;
}

export type MoldTrialSheetCreatePayload = {
  purchase_order_no?: string | null;
  supplier_name?: string | null;
  mold_code?: string | null;
  mold_name?: string | null;
  /** 创建时由后端按模具代号（或采购订单号）自动累计，勿传 */
  result_attachment_file_uuids?: string[];
  inspection_attachment_file_uuids?: string[];
  trial_result: '合格' | '不合格';
  trial_user_id?: number;
  failure_handling?: '待处理' | '立即送修' | null;
  pending_notify_user_ids?: number[];
  submitted_notify_user_ids?: number[];
  repair_warehouse_id?: number | null;
  production_trial_result?: '合格' | '不合格' | null;
  production_trial_user_id?: number;
};

export type MoldTrialSheetUpdatePayload = Partial<MoldTrialSheetCreatePayload>;

export function previewTrialSupplierNotifyUsers(params?: {
  supplier_name?: string;
}): Promise<{ items: { id: number; name: string }[] }> {
  return apiRequest(`${PREFIX}/molds/trial-sheets/supplier-notify-preview`, { params });
}

export function previewTrialRepairNotifyUsers(params?: {
  supplier_name?: string;
  trial_user_id?: number;
}): Promise<{ items: { id: number; name: string }[] }> {
  return apiRequest(`${PREFIX}/molds/trial-sheets/repair-notify-preview`, { params });
}

export function listMoldTrialSheets(params?: {
  skip?: number;
  limit?: number;
  sheet_status?: string;
  trial_result?: string;
  keyword?: string;
  /** ISO8601，含边界由前端按日起止传入 */
  created_from?: string;
  created_to?: string;
}): Promise<PageResult<MoldTrialSheetRow>> {
  return apiRequest(`${PREFIX}/molds/trial-sheets`, { params });
}

export function getMoldTrialSheet(rowId: number): Promise<MoldTrialSheetRow> {
  return apiRequest(`${PREFIX}/molds/trial-sheets/${rowId}`);
}

/** 新建试模单前预览：本单为第几次试模（与创建时自动计数规则一致） */
export function getNextMoldTrialTimes(params?: {
  mold_code?: string;
  purchase_order_no?: string;
}): Promise<{
  trial_times: number;
  can_create: boolean;
  blocking_sheet_no?: string | null;
}> {
  return apiRequest(`${PREFIX}/molds/trial-sheets/next-trial-times`, { params });
}

/** 仍有未完结试模流程的模具（待启用选用列表过滤） */
export function getMoldTrialIncompleteMolds(): Promise<{
  items: { mold_code: string; blocking_sheet_no?: string | null; blocking_sheet_id: number }[];
}> {
  return apiRequest(`${PREFIX}/molds/trial-sheets/incomplete-molds`);
}

export function createMoldTrialSheet(body: MoldTrialSheetCreatePayload): Promise<MoldTrialSheetRow> {
  return apiRequest(`${PREFIX}/molds/trial-sheets`, { method: 'POST', data: body });
}

export function updateMoldTrialSheet(rowId: number, body: MoldTrialSheetUpdatePayload): Promise<MoldTrialSheetRow> {
  return apiRequest(`${PREFIX}/molds/trial-sheets/${rowId}`, { method: 'PATCH', data: body });
}

export function deleteMoldTrialSheet(rowId: number): Promise<void> {
  return apiRequest(`${PREFIX}/molds/trial-sheets/${rowId}`, { method: 'DELETE' });
}

export function approveMoldTrialSheet(rowId: number): Promise<MoldTrialSheetRow> {
  return apiRequest(`${PREFIX}/molds/trial-sheets/${rowId}/approve`, { method: 'POST' });
}

export function rejectMoldTrialSheet(rowId: number): Promise<MoldTrialSheetRow> {
  return apiRequest(`${PREFIX}/molds/trial-sheets/${rowId}/reject`, { method: 'POST' });
}

export function revokeMoldTrialSheetApproval(rowId: number): Promise<MoldTrialSheetRow> {
  return apiRequest(`${PREFIX}/molds/trial-sheets/${rowId}/revoke-approval`, { method: 'POST' });
}

export function getMoldTrialViewerContext(): Promise<{
  is_external_partner: boolean;
}> {
  return apiRequest(`${PREFIX}/molds/trial-sheets/viewer-context`);
}

export function dispatchMoldTrialSheet(
  rowId: number,
  body: { target_warehouse_id: number },
): Promise<MoldTrialSheetRow> {
  return apiRequest(`${PREFIX}/molds/trial-sheets/${rowId}/dispatch`, { method: 'POST', data: body });
}

export function markMoldTrialSheetAdjustmentComplete(rowId: number): Promise<MoldTrialSheetRow> {
  return apiRequest(`${PREFIX}/molds/trial-sheets/${rowId}/mark-adjustment-complete`, { method: 'POST' });
}

export function recallMoldTrialSheet(
  rowId: number,
  body?: { target_warehouse_id?: number | null },
): Promise<MoldTrialSheetRow> {
  return apiRequest(`${PREFIX}/molds/trial-sheets/${rowId}/recall`, { method: 'POST', data: body ?? {} });
}

export function recallMoldTrialSheetAndRetrial(
  rowId: number,
  body: { target_warehouse_id: number },
): Promise<{ recalled: MoldTrialSheetRow; new_sheet: MoldTrialSheetRow }> {
  return apiRequest(`${PREFIX}/molds/trial-sheets/${rowId}/recall-and-retrial`, { method: 'POST', data: body });
}

/** 试模单 ↔ 数据集关联（按采购订单号执行查询并映射列） */
export interface MoldTrialDatasetBindingPayload {
  dataset_uuid?: string | null;
  /** 与 SQL 中 :参数名 一致，不填则不在「采购订单号」失焦时自动查询 */
  order_param_key?: string | null;
  supplier_column?: string | null;
  mold_code_column?: string | null;
  mold_name_column?: string | null;
  /** 查询结果里采购订单号列的别名，用于列表选单与带出 */
  purchase_order_column?: string | null;
}

export function getMoldTrialDatasetBinding(): Promise<MoldTrialDatasetBindingPayload> {
  return apiRequest(`${PREFIX}/molds/trial-sheets/dataset-binding`);
}

export function putMoldTrialDatasetBinding(
  body: MoldTrialDatasetBindingPayload,
): Promise<MoldTrialDatasetBindingPayload> {
  return apiRequest(`${PREFIX}/molds/trial-sheets/dataset-binding`, { method: 'PUT', data: body });
}

/** 外协维保单 — 明细行 */
export interface OutsourceMaintLineRow {
  mold_code: string;
  mold_name?: string | null;
  repair_reason: string;
  repair_cost?: string | null;
  attachment_file_uuids: string[];
  mold_warehouse_id?: number | null;
  mold_warehouse_code?: string | null;
  mold_warehouse_name?: string | null;
  before_outsource_warehouse_id?: number | null;
}

/** 外协维保单（与后端 MoldOutsourceMaintenanceSheetOut 对齐） */
export interface MoldOutsourceMaintenanceSheetRow {
  id: number;
  uuid: string;
  sheet_no?: string | null;
  applicant_user_id?: number | null;
  applicant_name?: string | null;
  department_uuid?: string | null;
  department_name?: string | null;
  outsourced_unit_code?: string | null;
  outsourced_unit_name: string;
  service_type: string;
  source_order_no?: string | null;
  header_attachment_file_uuids: string[];
  line_items: OutsourceMaintLineRow[];
  primary_mold_code?: string | null;
  primary_mold_warehouse_name?: string | null;
  sheet_status: string;
  audited_at?: string | null;
  audited_by_user_id?: number | null;
  created_at?: string | null;
  /** 是否可发起完修（维修类且尚无未驳回的关联完修单） */
  can_complete?: boolean;
}

export type OutsourceMaintLinePayload = {
  mold_code: string;
  mold_name?: string | null;
  repair_reason: string;
  repair_cost?: string | number | null;
  attachment_file_uuids?: string[];
};

export type MoldOutsourceMaintenanceSheetCreatePayload = {
  outsourced_unit_code?: string | null;
  outsourced_unit_name: string;
  applicant_user_id: number;
  department_uuid: string;
  service_type: '维修' | '保养';
  source_order_no?: string | null;
  header_attachment_file_uuids?: string[];
  line_items: OutsourceMaintLinePayload[];
};

export type MoldOutsourceMaintenanceSheetUpdatePayload = Partial<MoldOutsourceMaintenanceSheetCreatePayload>;

export function listMoldOutsourceMaintenanceSheets(params?: {
  skip?: number;
  limit?: number;
  keyword?: string;
  sheet_status?: string;
  /** 仅返回尚未关联未删除外协维保完修单的外协维保单（完修单选源） */
  open_for_complete?: boolean;
}): Promise<PageResult<MoldOutsourceMaintenanceSheetRow>> {
  return apiRequest(`${PREFIX}/molds/outsource-maintenance-sheets`, { params });
}

/** 外协维修单「外协单位」下拉（走 haoligo 权限，不依赖主数据供应商菜单） */
export function listOutsourceMaintenanceSupplierOptions(params?: {
  limit?: number;
}): Promise<Array<{ uuid: string; code: string; name: string }>> {
  return apiRequest(`${PREFIX}/molds/outsource-maintenance-sheets/supplier-options`, { params });
}

export function getMoldOutsourceMaintenanceSheet(rowId: number): Promise<MoldOutsourceMaintenanceSheetRow> {
  return apiRequest(`${PREFIX}/molds/outsource-maintenance-sheets/${rowId}`);
}

export function createMoldOutsourceMaintenanceSheet(
  body: MoldOutsourceMaintenanceSheetCreatePayload,
): Promise<MoldOutsourceMaintenanceSheetRow> {
  return apiRequest(`${PREFIX}/molds/outsource-maintenance-sheets`, { method: 'POST', data: body });
}

export function updateMoldOutsourceMaintenanceSheet(
  rowId: number,
  body: MoldOutsourceMaintenanceSheetUpdatePayload,
): Promise<MoldOutsourceMaintenanceSheetRow> {
  return apiRequest(`${PREFIX}/molds/outsource-maintenance-sheets/${rowId}`, { method: 'PATCH', data: body });
}

export function deleteMoldOutsourceMaintenanceSheet(rowId: number): Promise<void> {
  return apiRequest(`${PREFIX}/molds/outsource-maintenance-sheets/${rowId}`, { method: 'DELETE' });
}

export function approveMoldOutsourceMaintenanceSheet(
  rowId: number,
): Promise<MoldOutsourceMaintenanceSheetRow> {
  return apiRequest(`${PREFIX}/molds/outsource-maintenance-sheets/${rowId}/approve`, { method: 'POST' });
}

export function rejectMoldOutsourceMaintenanceSheet(
  rowId: number,
): Promise<MoldOutsourceMaintenanceSheetRow> {
  return apiRequest(`${PREFIX}/molds/outsource-maintenance-sheets/${rowId}/reject`, { method: 'POST' });
}

export function revokeMoldOutsourceMaintenanceSheetApproval(
  rowId: number,
): Promise<MoldOutsourceMaintenanceSheetRow> {
  return apiRequest(`${PREFIX}/molds/outsource-maintenance-sheets/${rowId}/revoke-approval`, {
    method: 'POST',
  });
}

/** 厂内维保单 — 明细行（与外协维保单行字段一致） */
export interface MoldMaintLineRow {
  mold_code: string;
  mold_name?: string | null;
  repair_reason: string;
  repair_cost?: string | null;
  attachment_file_uuids: string[];
}

export interface MoldMaintenanceSheetRow {
  id: number;
  uuid: string;
  sheet_no?: string | null;
  applicant_user_id?: number | null;
  applicant_name?: string | null;
  department_uuid?: string | null;
  department_name?: string | null;
  service_type: string;
  source_order_no?: string | null;
  header_attachment_file_uuids: string[];
  line_items: MoldMaintLineRow[];
  primary_mold_code?: string | null;
  sheet_status: string;
  audited_at?: string | null;
  audited_by_user_id?: number | null;
  created_at?: string | null;
}

export type MoldMaintLinePayload = {
  mold_code: string;
  mold_name?: string | null;
  repair_reason: string;
  repair_cost?: string | number | null;
  attachment_file_uuids?: string[];
};

export type MoldMaintenanceSheetCreatePayload = {
  applicant_user_id: number;
  /** 须为末级部门 UUID，与表单下拉一致 */
  department_uuid: string;
  service_type: '维修' | '保养';
  source_order_no?: string | null;
  header_attachment_file_uuids?: string[];
  line_items: MoldMaintLinePayload[];
};

export type MoldMaintenanceSheetUpdatePayload = Partial<MoldMaintenanceSheetCreatePayload>;

export function listMoldMaintenanceSheets(params?: {
  skip?: number;
  limit?: number;
  keyword?: string;
  sheet_status?: string;
  /** 维修 / 保养 */
  service_type?: string;
  /** 仅返回尚未关联未删除维保完修单的维保单（完修单选源） */
  open_for_complete?: boolean;
}): Promise<PageResult<MoldMaintenanceSheetRow>> {
  return apiRequest(`${PREFIX}/molds/maintenance-sheets`, { params });
}

export function getMoldMaintenanceSheet(rowId: number): Promise<MoldMaintenanceSheetRow> {
  return apiRequest(`${PREFIX}/molds/maintenance-sheets/${rowId}`);
}

export function createMoldMaintenanceSheet(body: MoldMaintenanceSheetCreatePayload): Promise<MoldMaintenanceSheetRow> {
  return apiRequest(`${PREFIX}/molds/maintenance-sheets`, { method: 'POST', data: body });
}

export function updateMoldMaintenanceSheet(
  rowId: number,
  body: MoldMaintenanceSheetUpdatePayload,
): Promise<MoldMaintenanceSheetRow> {
  return apiRequest(`${PREFIX}/molds/maintenance-sheets/${rowId}`, { method: 'PATCH', data: body });
}

export function deleteMoldMaintenanceSheet(rowId: number): Promise<void> {
  return apiRequest(`${PREFIX}/molds/maintenance-sheets/${rowId}`, { method: 'DELETE' });
}

export function approveMoldMaintenanceSheet(rowId: number): Promise<MoldMaintenanceSheetRow> {
  return apiRequest(`${PREFIX}/molds/maintenance-sheets/${rowId}/approve`, { method: 'POST' });
}

export function rejectMoldMaintenanceSheet(rowId: number): Promise<MoldMaintenanceSheetRow> {
  return apiRequest(`${PREFIX}/molds/maintenance-sheets/${rowId}/reject`, { method: 'POST' });
}

export function revokeMoldMaintenanceSheetApproval(rowId: number): Promise<MoldMaintenanceSheetRow> {
  return apiRequest(`${PREFIX}/molds/maintenance-sheets/${rowId}/revoke-approval`, { method: 'POST' });
}

/** 维保完修单 — 模具行 */
export interface MoldUpkeepRecordLineRow {
  param_id: number;
  param_code: string;
  param_name: string;
  requirement?: string | null;
  is_required: boolean;
  sort_order: number;
  record_value?: string | null;
}

export interface MoldCompleteLineRow {
  mold_code: string;
  mold_name?: string | null;
  repair_reason?: string | null;
  /** 保养完修：该模具是否重置总产量（维修单恒为 false） */
  clear_total_production?: boolean;
  upkeep_content?: string | null;
  upkeep_param_set_id?: number | null;
  upkeep_record_lines?: MoldUpkeepRecordLineRow[];
  repair_content?: string | null;
  repair_result?: string | null;
  /** 完修单上传：模具图片（保养后 / 维修后） */
  attachment_file_uuids?: string[];
  /** 来源维保单该行模具图（保养前 / 维修前，接口只读，用于对比） */
  source_attachment_file_uuids?: string[];
}

/** 维保完修单·维修结果选项（须与后端 `MOLD_MAINTENANCE_COMPLETE_REPAIR_RESULTS` 一致） */
export const HAOLIGO_MAINTENANCE_COMPLETE_REPAIR_RESULTS = [
  '维修完成',
  '待观察',
  '需返修',
  '报废',
  '转外协',
  '无法修复',
] as const;

export interface MoldMaintenanceCompleteSheetRow {
  id: number;
  uuid: string;
  sheet_no?: string | null;
  source_maintenance_sheet_id?: number | null;
  source_order_no: string;
  applicant_user_id?: number | null;
  applicant_name?: string | null;
  department_uuid?: string | null;
  department_name?: string | null;
  service_type: string;
  clear_total_production: boolean;
  header_attachment_file_uuids: string[];
  /** 来源维保单表头附件（保养前 / 维修前，只读，用于对比） */
  source_header_attachment_file_uuids?: string[];
  line_items: MoldCompleteLineRow[];
  primary_mold_code?: string | null;
  created_at?: string | null;
}

export type MoldUpkeepRecordLinePayload = {
  param_id: number;
  record_value?: string | null;
};

export type MoldCompleteLinePayload = {
  mold_code: string;
  mold_name?: string | null;
  repair_reason?: string | null;
  clear_total_production?: boolean;
  upkeep_content?: string | null;
  upkeep_param_set_id?: number | null;
  upkeep_record_lines?: MoldUpkeepRecordLinePayload[];
  repair_content?: string | null;
  repair_result?: string | null;
  attachment_file_uuids?: string[];
};

/** 新建维保完修单：须指定维保单；`line_items` 与维保单模具一致且含每模完修项 */
export type MoldMaintenanceCompleteSheetCreatePayload = {
  source_maintenance_sheet_id: number;
  /** 缺省由后端从来源维保单带出 */
  applicant_user_id?: number;
  department_uuid?: string;
  line_items: MoldCompleteLinePayload[];
  header_attachment_file_uuids?: string[];
};

export type MoldMaintenanceCompleteSheetUpdatePayload = {
  source_maintenance_sheet_id?: number | null;
  source_order_no?: string;
  applicant_user_id?: number;
  department_uuid?: string;
  service_type?: '维修' | '保养';
  header_attachment_file_uuids?: string[];
  line_items?: MoldCompleteLinePayload[];
};

export function listMoldMaintenanceCompleteSheets(params?: {
  skip?: number;
  limit?: number;
  keyword?: string;
  service_type?: string;
  created_from?: string;
  created_to?: string;
}): Promise<PageResult<MoldMaintenanceCompleteSheetRow>> {
  return apiRequest(`${PREFIX}/molds/maintenance-complete-sheets`, { params });
}

export function getMoldMaintenanceCompleteSheet(rowId: number): Promise<MoldMaintenanceCompleteSheetRow> {
  return apiRequest(`${PREFIX}/molds/maintenance-complete-sheets/${rowId}`);
}

export function createMoldMaintenanceCompleteSheet(
  body: MoldMaintenanceCompleteSheetCreatePayload,
): Promise<MoldMaintenanceCompleteSheetRow> {
  return apiRequest(`${PREFIX}/molds/maintenance-complete-sheets`, { method: 'POST', data: body });
}

export function updateMoldMaintenanceCompleteSheet(
  rowId: number,
  body: MoldMaintenanceCompleteSheetUpdatePayload,
): Promise<MoldMaintenanceCompleteSheetRow> {
  return apiRequest(`${PREFIX}/molds/maintenance-complete-sheets/${rowId}`, { method: 'PATCH', data: body });
}

export function deleteMoldMaintenanceCompleteSheet(rowId: number): Promise<void> {
  return apiRequest(`${PREFIX}/molds/maintenance-complete-sheets/${rowId}`, { method: 'DELETE' });
}

/** 外协维保完修单 — 模具行 */
export interface MoldOutsourceCompleteLineRow {
  mold_code: string;
  mold_name?: string | null;
  repair_reason?: string | null;
  repair_content?: string | null;
  repair_result?: string | null;
  repair_cost?: string | number | null;
  attachment_file_uuids: string[];
  /** 来源外协维保单该行附件（维修前，只读对比） */
  source_attachment_file_uuids?: string[];
  mold_warehouse_id?: number | null;
  mold_warehouse_code?: string | null;
  mold_warehouse_name?: string | null;
}

export interface MoldOutsourceMaintenanceCompleteSheetRow {
  id: number;
  uuid: string;
  sheet_no?: string | null;
  source_outsource_maintenance_sheet_id?: number | null;
  source_order_no: string;
  applicant_user_id?: number | null;
  applicant_name?: string | null;
  department_uuid?: string | null;
  department_name?: string | null;
  outsourced_unit_code?: string | null;
  outsourced_unit_name: string;
  service_type: string;
  clear_total_production: boolean;
  header_attachment_file_uuids: string[];
  source_header_attachment_file_uuids?: string[];
  line_items: MoldOutsourceCompleteLineRow[];
  primary_mold_code?: string | null;
  primary_mold_warehouse_name?: string | null;
  sheet_status?: string;
  audited_at?: string | null;
  audited_by_user_id?: number | null;
  created_at?: string | null;
}

export type MoldOutsourceCompleteLinePayload = {
  mold_code: string;
  mold_name?: string | null;
  repair_reason?: string | null;
  repair_content?: string | null;
  repair_result?: string | null;
  repair_cost?: string | number | null;
  attachment_file_uuids?: string[];
};

/** 新建外协维保完修单：须指定外协维保单；`line_items` 与维保单模具一致 */
export type MoldOutsourceMaintenanceCompleteSheetCreatePayload = {
  source_outsource_maintenance_sheet_id: number;
  applicant_user_id?: number;
  department_uuid?: string;
  header_attachment_file_uuids?: string[];
  line_items: MoldOutsourceCompleteLinePayload[];
};

export type MoldOutsourceMaintenanceCompleteSheetUpdatePayload = {
  source_outsource_maintenance_sheet_id?: number | null;
  source_order_no?: string;
  applicant_user_id?: number;
  department_uuid?: string;
  outsourced_unit_code?: string | null;
  outsourced_unit_name?: string;
  header_attachment_file_uuids?: string[];
  line_items?: MoldOutsourceCompleteLinePayload[];
};

export function listMoldOutsourceMaintenanceCompleteSheets(params?: {
  skip?: number;
  limit?: number;
  keyword?: string;
  sheet_status?: string;
  created_from?: string;
  created_to?: string;
}): Promise<PageResult<MoldOutsourceMaintenanceCompleteSheetRow>> {
  return apiRequest(`${PREFIX}/molds/outsource-maintenance-complete-sheets`, { params });
}

export function getMoldOutsourceMaintenanceCompleteSheet(
  rowId: number,
): Promise<MoldOutsourceMaintenanceCompleteSheetRow> {
  return apiRequest(`${PREFIX}/molds/outsource-maintenance-complete-sheets/${rowId}`);
}

export function createMoldOutsourceMaintenanceCompleteSheet(
  body: MoldOutsourceMaintenanceCompleteSheetCreatePayload,
): Promise<MoldOutsourceMaintenanceCompleteSheetRow> {
  return apiRequest(`${PREFIX}/molds/outsource-maintenance-complete-sheets`, { method: 'POST', data: body });
}

export function updateMoldOutsourceMaintenanceCompleteSheet(
  rowId: number,
  body: MoldOutsourceMaintenanceCompleteSheetUpdatePayload,
): Promise<MoldOutsourceMaintenanceCompleteSheetRow> {
  return apiRequest(`${PREFIX}/molds/outsource-maintenance-complete-sheets/${rowId}`, {
    method: 'PATCH',
    data: body,
  });
}

export function deleteMoldOutsourceMaintenanceCompleteSheet(rowId: number): Promise<void> {
  return apiRequest(`${PREFIX}/molds/outsource-maintenance-complete-sheets/${rowId}`, { method: 'DELETE' });
}

export function listPendingMoldOutsourceMaintenanceCompleteSheetsMine(params?: {
  skip?: number;
  limit?: number;
  keyword?: string;
}): Promise<PageResult<MoldOutsourceMaintenanceCompleteSheetRow>> {
  return apiRequest(`${PREFIX}/molds/outsource-maintenance-complete-sheets/pending-mine`, { params });
}

/** 外协维保完修单待审核（需审核权限） */
export function listPendingAuditMoldOutsourceMaintenanceCompleteSheets(params?: {
  skip?: number;
  limit?: number;
  keyword?: string;
}): Promise<PageResult<MoldOutsourceMaintenanceCompleteSheetRow>> {
  return apiRequest(`${PREFIX}/molds/outsource-maintenance-complete-sheets/pending-audit`, { params });
}

/** 委外审核：当前用户为申请人的全部外协维保完修单（含待审核/已通过/已驳回） */
export function listAuditMoldOutsourceMaintenanceCompleteSheetsMine(params?: {
  skip?: number;
  limit?: number;
  keyword?: string;
  sheet_status?: string;
}): Promise<PageResult<MoldOutsourceMaintenanceCompleteSheetRow>> {
  return apiRequest(`${PREFIX}/molds/outsource-maintenance-complete-sheets/audit-mine`, { params });
}

export function approveMoldOutsourceMaintenanceCompleteSheet(
  rowId: number,
): Promise<MoldOutsourceMaintenanceCompleteSheetRow> {
  return apiRequest(`${PREFIX}/molds/outsource-maintenance-complete-sheets/${rowId}/approve`, { method: 'POST' });
}

export function rejectMoldOutsourceMaintenanceCompleteSheet(
  rowId: number,
): Promise<MoldOutsourceMaintenanceCompleteSheetRow> {
  return apiRequest(`${PREFIX}/molds/outsource-maintenance-complete-sheets/${rowId}/reject`, { method: 'POST' });
}

export function revokeApprovalMoldOutsourceMaintenanceCompleteSheet(
  rowId: number,
): Promise<MoldOutsourceMaintenanceCompleteSheetRow> {
  return apiRequest(`${PREFIX}/molds/outsource-maintenance-complete-sheets/${rowId}/revoke-approval`, {
    method: 'POST',
  });
}

/** 领用单（与后端 MoldBorrowSheetOut 对齐） */
export interface MoldBorrowSheetRow {
  id: number;
  uuid: string;
  sheet_no?: string | null;
  source_order_no?: string | null;
  department_uuid?: string | null;
  department_name: string;
  mold_code: string;
  mold_name: string;
  finished_product_code?: string | null;
  finished_product_name?: string | null;
  planned_qty?: string | null;
  created_at?: string | null;
}

export type MoldBorrowSheetCreatePayload = {
  source_order_no?: string | null;
  department_uuid?: string | null;
  department_name: string;
  mold_code: string;
  mold_name: string;
  finished_product_code?: string | null;
  finished_product_name?: string | null;
  planned_qty?: string | number | null;
};

export type MoldBorrowSheetUpdatePayload = Partial<MoldBorrowSheetCreatePayload>;

export function listMoldBorrowSheets(params?: {
  skip?: number;
  limit?: number;
  keyword?: string;
}): Promise<PageResult<MoldBorrowSheetRow>> {
  return apiRequest(`${PREFIX}/molds/borrow-sheets`, { params });
}

/** 按制令单号判断是否已有未删除的领用单；编辑时可传 exclude_sheet_id 排除当前行 */
export function getMoldBorrowSourceOrderUsage(params: {
  source_order_no: string;
  exclude_sheet_id?: number;
}): Promise<{ exists: boolean; count: number }> {
  return apiRequest(`${PREFIX}/molds/borrow-sheets/source-order-usage`, { params });
}

export function getMoldBorrowSheet(rowId: number): Promise<MoldBorrowSheetRow> {
  return apiRequest(`${PREFIX}/molds/borrow-sheets/${rowId}`);
}

export function createMoldBorrowSheet(body: MoldBorrowSheetCreatePayload): Promise<MoldBorrowSheetRow> {
  return apiRequest(`${PREFIX}/molds/borrow-sheets`, { method: 'POST', data: body });
}

export function updateMoldBorrowSheet(rowId: number, body: MoldBorrowSheetUpdatePayload): Promise<MoldBorrowSheetRow> {
  return apiRequest(`${PREFIX}/molds/borrow-sheets/${rowId}`, { method: 'PATCH', data: body });
}

export function deleteMoldBorrowSheet(rowId: number): Promise<void> {
  return apiRequest(`${PREFIX}/molds/borrow-sheets/${rowId}`, { method: 'DELETE' });
}

/** 领用单 — 数据集绑定（制令单号为查询参数） */
export interface MoldBorrowDatasetBindingPayload {
  dataset_uuid?: string;
  work_order_param_key?: string;
  department_uuid_column?: string;
  department_name_column?: string;
  mold_code_column?: string;
  mold_name_column?: string;
  finished_product_code_column?: string;
  finished_product_name_column?: string;
  planned_qty_column?: string;
}

export interface MoldBorrowPrefillFromDatasetPayload {
  source_order_no: string;
}

export type MoldBorrowPrefillFromDatasetResult = {
  source_order_no: string;
  department_uuid?: string | null;
  department_name: string;
  mold_code?: string | null;
  mold_name?: string | null;
  finished_product_code?: string | null;
  finished_product_name?: string | null;
  planned_qty?: string | number | null;
};

export function getMoldBorrowDatasetBinding(): Promise<MoldBorrowDatasetBindingPayload> {
  return apiRequest(`${PREFIX}/molds/borrow-sheets/dataset-binding`);
}

export function putMoldBorrowDatasetBinding(
  body: MoldBorrowDatasetBindingPayload,
): Promise<MoldBorrowDatasetBindingPayload> {
  return apiRequest(`${PREFIX}/molds/borrow-sheets/dataset-binding`, { method: 'PUT', data: body });
}

export function prefillMoldBorrowSheetFromDataset(
  body: MoldBorrowPrefillFromDatasetPayload,
): Promise<MoldBorrowPrefillFromDatasetResult> {
  return apiRequest(`${PREFIX}/molds/borrow-sheets/prefill-from-dataset`, { method: 'POST', data: body });
}

/** 还入单（移动端：制令单、领用单、领出部门、模具/成品、制造数量） */
export interface MoldReturnSheetRow {
  id: number;
  uuid: string;
  sheet_no?: string | null;
  production_order_no?: string | null;
  borrow_sheet_no?: string | null;
  issue_department_uuid?: string | null;
  issue_department_name?: string | null;
  mold_code: string;
  mold_name: string;
  finished_product_code?: string | null;
  finished_product_name?: string | null;
  planned_qty?: string | null;
  manufacture_qty: string;
  created_at?: string | null;
}

export type MoldReturnSheetCreatePayload = {
  production_order_no?: string | null;
  borrow_sheet_no?: string | null;
  issue_department_uuid?: string | null;
  issue_department_name?: string | null;
  mold_code: string;
  mold_name: string;
  finished_product_code?: string | null;
  finished_product_name?: string | null;
  planned_qty?: string | number | null;
  manufacture_qty: string | number;
};

export type MoldReturnSheetUpdatePayload = Partial<MoldReturnSheetCreatePayload>;

export function listMoldReturnSheets(params?: {
  skip?: number;
  limit?: number;
  keyword?: string;
}): Promise<PageResult<MoldReturnSheetRow>> {
  return apiRequest(`${PREFIX}/molds/return-sheets`, { params });
}

export type MoldReturnBorrowLookupResult = {
  borrow_sheet_id: number;
  borrow_sheet_no: string;
  production_order_no?: string | null;
  issue_department_uuid?: string | null;
  issue_department_name?: string | null;
  mold_code: string;
  mold_name: string;
  finished_product_code?: string | null;
  finished_product_name?: string | null;
  planned_qty?: string | number | null;
};

export function getMoldReturnBorrowLookup(params: {
  production_order_no?: string;
  mold_code?: string;
}): Promise<MoldReturnBorrowLookupResult> {
  return apiRequest(`${PREFIX}/molds/return-sheets/borrow-lookup`, { params });
}

export function getMoldReturnSheet(rowId: number): Promise<MoldReturnSheetRow> {
  return apiRequest(`${PREFIX}/molds/return-sheets/${rowId}`);
}

export function createMoldReturnSheet(body: MoldReturnSheetCreatePayload): Promise<MoldReturnSheetRow> {
  return apiRequest(`${PREFIX}/molds/return-sheets`, { method: 'POST', data: body });
}

export function updateMoldReturnSheet(rowId: number, body: MoldReturnSheetUpdatePayload): Promise<MoldReturnSheetRow> {
  return apiRequest(`${PREFIX}/molds/return-sheets/${rowId}`, { method: 'PATCH', data: body });
}

export function deleteMoldReturnSheet(rowId: number): Promise<void> {
  return apiRequest(`${PREFIX}/molds/return-sheets/${rowId}`, { method: 'DELETE' });
}

export interface HazardRow {
  id: number;
  uuid: string;
  sheet_no?: string | null;
  equipment_id?: number | null;
  equipment_asset_code?: string | null;
  equipment_name?: string | null;
  workshop_id?: number | null;
  workshop_name?: string | null;
  workshop_area?: string | null;
  reported_at?: string | null;
  created_at?: string | null;
  issue_type_code?: string | null;
  issue_type_codes?: string[];
  problem_summary?: string | null;
  solution_note?: string | null;
  status: string;
  before_image_file_ids?: string[] | null;
  after_image_file_ids?: string[] | null;
  handler_name?: string | null;
  handled_at?: string | null;
  registrant_user_id?: number | null;
  registrant_name?: string | null;
  responsible_user_id?: number | null;
  responsible_name?: string | null;
  report_enabled?: boolean;
  report_notify_user_ids?: number[];
}

export function listHazardReports(params?: {
  skip?: number;
  limit?: number;
  status?: string;
  equipment_id?: number;
  /** 巡查/反馈时间起（含，ISO8601） */
  reported_from?: string;
  /** 巡查/反馈时间止（含，ISO8601） */
  reported_to?: string;
  /** 为 true 时仅待治理（已登记）；与 status 同时传时以后端为准（通常只传 status） */
  for_remediation?: boolean;
  sheet_no?: string;
  keyword?: string;
}): Promise<PageResult<HazardRow>> {
  return apiRequest(`${PREFIX}/patrol/hazard-reports`, { params });
}

export type HazardCreatePayload = {
  equipment_id?: number | null;
  workshop_id?: number | null;
  workshop_area?: string | null;
  reported_at?: string | null;
  issue_type_code?: string | null;
  issue_type_codes?: string[];
  problem_summary?: string | null;
  solution_note?: string | null;
  status?: string;
  before_image_file_ids?: string[] | null;
  after_image_file_ids?: string[] | null;
  handler_name?: string | null;
  handled_at?: string | null;
  registrant_user_id?: number | null;
  responsible_user_id?: number | null;
  report_enabled?: boolean;
  report_notify_user_ids?: number[];
};

export function createHazardReport(body: HazardCreatePayload): Promise<HazardRow> {
  return apiRequest(`${PREFIX}/patrol/hazard-reports`, { method: 'POST', data: body });
}

export type HazardUpdatePayload = Partial<HazardCreatePayload>;

export function getHazardReport(rowId: number): Promise<HazardRow> {
  return apiRequest(`${PREFIX}/patrol/hazard-reports/${rowId}`);
}

export function updateHazardReport(rowId: number, body: HazardUpdatePayload): Promise<HazardRow> {
  return apiRequest(`${PREFIX}/patrol/hazard-reports/${rowId}`, { method: 'PATCH', data: body });
}

export function deleteHazardReport(rowId: number): Promise<void> {
  return apiRequest(`${PREFIX}/patrol/hazard-reports/${rowId}`, { method: 'DELETE' });
}

export interface PatrolReportPoint {
  label: string;
  value: number;
}

export interface PatrolReportSeries {
  name: string;
  data: PatrolReportPoint[];
}

export interface PatrolReportPayload {
  report_key: string;
  points?: PatrolReportPoint[];
  series?: PatrolReportSeries[];
}

export interface PatrolReportKpiSummary {
  total_tasks: number;
  open_tasks: number;
  completed_tasks: number;
  contributor_count: number;
}

export function getPatrolReportKpiSummary(): Promise<PatrolReportKpiSummary> {
  return apiRequest(`${PREFIX}/patrol/reports/kpi-summary`);
}

export function getPatrolReport(
  reportKey: string,
  params?: { months?: number; days?: number },
): Promise<PatrolReportPayload> {
  return apiRequest(`${PREFIX}/patrol/reports/${reportKey}`, { params });
}

/** 为当前租户创建缺失的好力 GO 维保完成单打印模板预设（幂等） */
export function loadHaoligoPrintTemplatePresets(): Promise<{ created: number }> {
  return apiRequest(`${PREFIX}/print/load-presets`, { method: 'POST' });
}

/** 加载好力 GO 消息提醒规则预设（幂等；已有规则仅合并缺失的收件范围） */
export function loadHaoligoNotificationRulePresets(): Promise<{
  created: number;
  updated: number;
  skipped_duplicate: number;
  skipped_missing_template: number;
  total_rules: number;
}> {
  return apiRequest(`${PREFIX}/config/notification-rules/load-presets`, { method: 'POST' });
}
