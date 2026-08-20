/**
 * 业务配置 API 服务
 *
 * 变更说明（2026 重构）：
 * - 业务蓝图设置已下线；功能开关改由菜单管理控制，审核改由流程设置控制。
 * - 本文件仅保留纯「参数」读写（bom / sales / purchase / finance 等）
 *   以及 PRO 功能检查相关接口。旧版 modules/nodes/running-mode/
 *   complexity-presets/templates 接口已删除。
 */

import { apiRequest } from './api';

export interface BusinessConfig {
  parameters: Record<string, Record<string, any>>;
}

export interface ProcessParameterUpdateRequest {
  category: string;
  parameter_key: string;
  value: any;
}

export interface BatchProcessParameterUpdateRequest {
  parameters: Record<string, Record<string, any>>;
}

export interface BusinessConfigSchema {
  processRegistry?: Record<string, string[]>;
  processRegistryMeta?: Record<string, { labelKey?: string; descriptionKey?: string }>;
  processRegistryParamMeta?: Record<string, Record<string, { labelKey?: string; descriptionKey?: string }>>;
  processRegistryControlMeta?: Record<
    string,
    Record<string, { type?: 'boolean' | 'number' | 'string' | 'color' | 'select'; min?: number; max?: number; options?: { value: string; labelKey: string }[] }>
  >;
  parameterRegistry?: Record<string, string[]>;
  parameterRegistryMeta?: Record<string, { labelKey?: string; descriptionKey?: string }>;
  parameterRegistryParamMeta?: Record<string, Record<string, { labelKey?: string; descriptionKey?: string }>>;
  parameterRegistryControlMeta?: Record<
    string,
    Record<string, { type?: 'boolean' | 'number' | 'string' | 'color' | 'select'; min?: number; max?: number; options?: { value: string; labelKey: string }[] }>
  >;
  parameterKeys: Record<string, string[]>;
  parameterImplementation?: Record<string, Record<string, boolean>>;
}

export async function getBusinessConfigSchema(): Promise<BusinessConfigSchema> {
  return apiRequest<BusinessConfigSchema>('/infra/business-config/schema', {
    method: 'GET',
  });
}

export async function getBusinessConfig(): Promise<BusinessConfig> {
  return apiRequest<BusinessConfig>('/infra/business-config', {
    method: 'GET',
  });
}

/** 是否开启试运营模式（读取 parameters.common.trial_run_mode，默认 false） */
export function isTrialRunModeEnabled(config: BusinessConfig | null | undefined): boolean {
  return Boolean(config?.parameters?.common?.trial_run_mode);
}

/** 详情抽屉全链路模式：关闭 / 启用（含节点时间） / 只显示单据（不展示节点创建时间） */
export type DetailFullChainMode = 'off' | 'on' | 'documents_only';

export function resolveDetailFullChainMode(
  config: BusinessConfig | null | undefined,
): DetailFullChainMode {
  const common = config?.parameters?.common;
  const raw = common?.detail_full_chain_mode ?? common?.detail_full_chain_enabled;
  if (typeof raw === 'boolean') return raw ? 'documents_only' : 'off';
  if (raw === 'off' || raw === 'on' || raw === 'documents_only') return raw;
  return 'documents_only';
}

/** 启用模式下展示节点创建时间 */
export function isDetailFullChainShowCreatedAt(
  config: BusinessConfig | null | undefined,
): boolean {
  return resolveDetailFullChainMode(config) === 'on';
}

/** 详情抽屉是否展示全链路跟踪 Tab（mode !== off；默认展示） */
export function isDetailFullChainEnabled(config: BusinessConfig | null | undefined): boolean {
  return resolveDetailFullChainMode(config) !== 'off';
}

/** 详情抽屉是否展示操作记录（默认 true） */
export function isDetailOperationLogEnabled(config: BusinessConfig | null | undefined): boolean {
  const raw = config?.parameters?.common?.detail_operation_log_enabled;
  return raw === undefined ? true : Boolean(raw);
}

/** 详情抽屉基本信息是否展示更新时间（默认 true） */
export function isDetailBasicUpdatedAtEnabled(config: BusinessConfig | null | undefined): boolean {
  const raw = config?.parameters?.common?.detail_basic_updated_at_enabled;
  return raw === undefined ? true : Boolean(raw);
}

/** 详情抽屉按字段隐藏的时间项：key 为 `{documentType}.{dataIndex}`，true 表示隐藏 */
export function resolveDetailTimeFieldHiddenMap(
  config: BusinessConfig | null | undefined,
): Record<string, boolean> {
  const raw = config?.parameters?.common?.detail_time_field_hidden;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof key === 'string' && key.trim()) out[key] = Boolean(value);
  }
  return out;
}

/** 与当前库字段 decimal_places 对齐的配置上限（配置页 max 同源） */
export const NUMERIC_PRECISION_STORAGE_CEILING = {
  quantity: 2,
  price: 4,
  amount: 2,
} as const;

export type NumericPrecisionKind = keyof typeof NUMERIC_PRECISION_STORAGE_CEILING;

export type NumericPrecisionSettings = {
  quantity: number;
  price: number;
  amount: number;
};

function clampDecimalPlaces(raw: unknown, defaultPlaces: number, maxPlaces: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return defaultPlaces;
  return Math.max(0, Math.min(maxPlaces, Math.trunc(n)));
}

/** 从业务配置解析数值精度（默认 2；超出库字段上限则截断） */
export function resolveNumericPrecisionFromConfig(
  config: BusinessConfig | null | undefined,
  kind: NumericPrecisionKind,
): number {
  const common = config?.parameters?.common;
  const key =
    kind === 'quantity'
      ? 'quantity_decimal_places'
      : kind === 'price'
        ? 'price_decimal_places'
        : 'amount_decimal_places';
  return clampDecimalPlaces(common?.[key], 2, NUMERIC_PRECISION_STORAGE_CEILING[kind]);
}

/** 按配置小数位格式化数字（固定位，含尾零） */
export function formatByNumericPrecision(
  value: number | string | null | undefined,
  places: number,
  fallback = '-',
): string {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const safePlaces = Math.max(0, Math.min(6, Math.trunc(places)));
  return n.toLocaleString('zh-CN', {
    minimumFractionDigits: safePlaces,
    maximumFractionDigits: safePlaces,
  });
}

export async function updateProcessParameter(
  request: ProcessParameterUpdateRequest
): Promise<{ success: boolean; message: string; category: string; parameter_key: string; value: any }> {
  return apiRequest('/infra/business-config/parameters/update', {
    method: 'POST',
    data: request,
  });
}

export async function batchUpdateProcessParameters(
  request: BatchProcessParameterUpdateRequest
): Promise<{ success: boolean; message: string; updated_count: number }> {
  return apiRequest('/infra/business-config/parameters/batch-update', {
    method: 'POST',
    data: request,
  });
}

export interface ProFeatureAccessCheck {
  has_access: boolean;
  is_pro_feature: boolean;
  current_plan: string;
  upgrade_message?: string;
}

export interface ProFeaturesList {
  has_pro_access: boolean;
  current_plan: string;
  pro_modules: string[];
  pro_parameters: Record<string, string[]>;
}

export interface AuditRequiredMapResponse {
  audit_required: Record<string, boolean>;
}

export async function getAuditRequiredMap(): Promise<Record<string, boolean>> {
  const res = await apiRequest<AuditRequiredMapResponse>('/infra/business-config/audit-required', {
    method: 'GET',
  });
  return res?.audit_required ?? {};
}

export async function checkProFeatureAccess(
  featureType: string,
  featureCode: string
): Promise<ProFeatureAccessCheck> {
  return apiRequest<ProFeatureAccessCheck>(
    `/infra/business-config/pro-features/check?feature_type=${featureType}&feature_code=${featureCode}`,
    { method: 'GET' }
  );
}

export async function getProFeaturesList(): Promise<ProFeaturesList> {
  return apiRequest<ProFeaturesList>('/infra/business-config/pro-features/list', {
    method: 'GET',
  });
}
