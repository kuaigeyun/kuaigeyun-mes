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
  remark?: string | null;
}

export interface CategoryRow {
  id: number;
  uuid: string;
  code: string;
  name: string;
  default_inspection_param_set_id?: number | null;
}

export function listCategories(): Promise<CategoryRow[]> {
  return apiRequest(`${PREFIX}/equipment/categories`);
}

export type EquipmentCreatePayload = {
  asset_code: string;
  name: string;
  category_id: number;
  workshop_id: number;
  manufacturer_id?: number | null;
  manufacture_date?: string | null;
  inspection_param_set_id?: number | null;
  remark?: string | null;
};

export type EquipmentUpdatePayload = {
  name?: string;
  category_id?: number;
  workshop_id?: number;
  manufacturer_id?: number | null;
  manufacture_date?: string | null;
  inspection_param_set_id?: number | null;
  remark?: string | null;
};

export function listEquipments(params?: {
  workshop_id?: number;
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

/** 点检项（与后端 InspectionParamOut 对齐） */
export interface InspectionParamRow {
  id: number;
  uuid: string;
  code: string;
  name: string;
  unit?: string | null;
  value_type: string;
}

export type InspectionParamCreatePayload = {
  code: string;
  name: string;
  unit?: string | null;
  value_type?: string;
};

export type InspectionParamUpdatePayload = {
  name?: string;
  unit?: string | null;
  value_type?: string;
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

export interface InspectionParamSetItemRow {
  id: number;
  param_id: number;
  set_id: number;
  sort_order: number;
  is_required: boolean;
}

export type SetItemCreatePayload = { param_id: number; sort_order?: number; is_required?: boolean };
export type SetItemUpdatePayload = { sort_order?: number; is_required?: boolean };

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

/** 模具台账（与后端 MoldOut 对齐） */
export interface MoldRow {
  id: number;
  uuid: string;
  mold_code: string;
  name: string;
  unit: string;
  mold_capacity: string;
  processing_time_min?: number | null;
  service_life_years?: number | null;
  usable_times?: number | null;
  usable_yield?: string | null;
  maintenance_cycle_by_yield?: string | null;
  maintenance_cycle_by_days?: number | null;
  allow_repeated_borrow: boolean;
  purchase_vendor_name?: string | null;
  status: string;
  total_manufacture_qty: string;
  outsource_vendor_code?: string | null;
  outsource_vendor_name?: string | null;
  erp_material_code?: string | null;
  remark?: string | null;
  /** 已使用次数（每笔还入单 +1，存于台账） */
  used_times?: number;
  /** 已使用产量（还入制造数量累计） */
  used_yield?: string;
}

export type MoldCreatePayload = {
  mold_code: string;
  name: string;
  unit: string;
  mold_capacity: string | number;
  service_life_years?: number | null;
  usable_times?: number | null;
  usable_yield?: string | number | null;
  maintenance_cycle_by_yield?: string | number | null;
  maintenance_cycle_by_days?: number | null;
  allow_repeated_borrow: boolean;
  purchase_vendor_name?: string | null;
  status: string;
  total_manufacture_qty?: string | number;
  outsource_vendor_code?: string | null;
  outsource_vendor_name?: string | null;
  erp_material_code?: string | null;
  remark?: string | null;
};

export type MoldUpdatePayload = Partial<Omit<MoldCreatePayload, 'mold_code'>>;

export function listMolds(params?: {
  skip?: number;
  limit?: number;
  status?: string;
  /** 模糊：代号/名称/单位/厂商与物料编码/备注（后端 icontains OR） */
  keyword?: string;
}): Promise<PageResult<MoldRow>> {
  return apiRequest(`${PREFIX}/molds`, { params });
}

export function getMold(rowId: number): Promise<MoldRow> {
  return apiRequest(`${PREFIX}/molds/${rowId}`);
}

/** 模具台账详情 — 操作记录（与后端 MoldOperationRecordOut 对齐） */
export type MoldOperationRecordKind =
  | 'borrow'
  | 'return'
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

/** 批量更新寿命/维修周期等（与列表筛选一致） */
export type MoldBatchLifecycleScope = 'selected' | 'all_filtered';

export interface MoldBatchLifecyclePayload {
  scope: MoldBatchLifecycleScope;
  mold_ids?: number[];
  filter_status?: string;
  filter_keyword?: string;
  service_life_years?: number;
  usable_times?: number;
  usable_yield?: string | number;
  maintenance_cycle_by_yield?: string | number;
  maintenance_cycle_by_days?: number;
}

export function batchMoldsLifecycle(body: MoldBatchLifecyclePayload): Promise<{ updated: number }> {
  return apiRequest(`${PREFIX}/molds/batch-lifecycle`, { method: 'POST', data: body });
}

export function deleteMold(rowId: number): Promise<void> {
  return apiRequest(`${PREFIX}/molds/${rowId}`, { method: 'DELETE' });
}

/** 模具台账 ↔ 数据集关联（同步代号/名称/单位；可选映射模具产能） */
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
  purchase_order_no: string;
  supplier_name?: string | null;
  mold_code?: string | null;
  mold_name?: string | null;
  trial_times?: number | null;
  result_attachment_file_uuids: string[];
  inspection_attachment_file_uuids: string[];
  trial_result: string;
  sheet_status: string;
}

export type MoldTrialSheetCreatePayload = {
  purchase_order_no: string;
  supplier_name?: string | null;
  mold_code?: string | null;
  mold_name?: string | null;
  trial_times?: number | null;
  result_attachment_file_uuids?: string[];
  inspection_attachment_file_uuids?: string[];
  trial_result: '合格' | '不合格';
  sheet_status?: '草稿' | '已提交' | '待审核' | '已通过' | '已驳回' | '已作废';
};

export type MoldTrialSheetUpdatePayload = Partial<MoldTrialSheetCreatePayload>;

export function listMoldTrialSheets(params?: {
  skip?: number;
  limit?: number;
  sheet_status?: string;
  trial_result?: string;
  keyword?: string;
}): Promise<PageResult<MoldTrialSheetRow>> {
  return apiRequest(`${PREFIX}/molds/trial-sheets`, { params });
}

export function getMoldTrialSheet(rowId: number): Promise<MoldTrialSheetRow> {
  return apiRequest(`${PREFIX}/molds/trial-sheets/${rowId}`);
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
}

/** 外协维保单（与后端 MoldOutsourceMaintenanceSheetOut 对齐） */
export interface MoldOutsourceMaintenanceSheetRow {
  id: number;
  uuid: string;
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
}): Promise<PageResult<MoldOutsourceMaintenanceSheetRow>> {
  return apiRequest(`${PREFIX}/molds/outsource-maintenance-sheets`, { params });
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
  applicant_user_id?: number | null;
  applicant_name?: string | null;
  department_uuid?: string | null;
  department_name?: string | null;
  service_type: string;
  source_order_no?: string | null;
  header_attachment_file_uuids: string[];
  line_items: MoldMaintLineRow[];
  primary_mold_code?: string | null;
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

/** 维保完修单 — 模具行 */
export interface MoldCompleteLineRow {
  mold_code: string;
  mold_name?: string | null;
  repair_reason?: string | null;
}

export interface MoldMaintenanceCompleteSheetRow {
  id: number;
  uuid: string;
  source_maintenance_sheet_id?: number | null;
  source_order_no: string;
  service_type: string;
  clear_total_production: boolean;
  header_attachment_file_uuids: string[];
  line_items: MoldCompleteLineRow[];
  primary_mold_code?: string | null;
}

export type MoldCompleteLinePayload = {
  mold_code: string;
  mold_name?: string | null;
  repair_reason?: string | null;
};

export type MoldMaintenanceCompleteSheetCreatePayload = {
  source_maintenance_sheet_id?: number | null;
  source_order_no: string;
  service_type: '维修' | '保养';
  clear_total_production: boolean;
  header_attachment_file_uuids?: string[];
  line_items: MoldCompleteLinePayload[];
};

export type MoldMaintenanceCompleteSheetUpdatePayload = Partial<MoldMaintenanceCompleteSheetCreatePayload>;

export function listMoldMaintenanceCompleteSheets(params?: {
  skip?: number;
  limit?: number;
  keyword?: string;
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
  repair_cost?: string | number | null;
  attachment_file_uuids: string[];
}

export interface MoldOutsourceMaintenanceCompleteSheetRow {
  id: number;
  uuid: string;
  source_outsource_maintenance_sheet_id?: number | null;
  source_order_no: string;
  outsourced_unit_code?: string | null;
  outsourced_unit_name: string;
  service_type: string;
  clear_total_production: boolean;
  header_attachment_file_uuids: string[];
  line_items: MoldOutsourceCompleteLineRow[];
  primary_mold_code?: string | null;
}

export type MoldOutsourceCompleteLinePayload = {
  mold_code: string;
  mold_name?: string | null;
  repair_reason?: string | null;
  repair_cost?: string | number | null;
  attachment_file_uuids?: string[];
};

export type MoldOutsourceMaintenanceCompleteSheetCreatePayload = {
  source_outsource_maintenance_sheet_id?: number | null;
  source_order_no: string;
  outsourced_unit_code?: string | null;
  outsourced_unit_name: string;
  service_type: '维修' | '保养';
  clear_total_production: boolean;
  header_attachment_file_uuids?: string[];
  line_items: MoldOutsourceCompleteLinePayload[];
};

export type MoldOutsourceMaintenanceCompleteSheetUpdatePayload =
  Partial<MoldOutsourceMaintenanceCompleteSheetCreatePayload>;

export function listMoldOutsourceMaintenanceCompleteSheets(params?: {
  skip?: number;
  limit?: number;
  keyword?: string;
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

/** 领用单（与后端 MoldBorrowSheetOut 对齐） */
export interface MoldBorrowSheetRow {
  id: number;
  uuid: string;
  source_order_no?: string | null;
  department_uuid?: string | null;
  department_name: string;
  mold_code: string;
  mold_name: string;
  finished_product_code?: string | null;
  finished_product_name?: string | null;
  planned_qty?: string | null;
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
