import type { TFunction } from 'i18next';

export type SyncSourceType = 'api' | 'dataset';

export interface SyncTargetField {
  value: string;
  /** i18n key；与 label 二选一，优先 label */
  labelKey?: string;
  /** 直接展示名（自定义字段等无 i18n 时） */
  label?: string;
  required?: boolean;
  kind?: 'system' | 'custom' | 'helper';
}

/** 自定义字段映射目标键前缀：custom:{field_code} */
export const SYNC_CUSTOM_FIELD_TARGET_PREFIX = 'custom:';

export function syncCustomFieldTargetKey(code: string): string {
  return `${SYNC_CUSTOM_FIELD_TARGET_PREFIX}${code}`;
}

export function isSyncCustomFieldTarget(value: string): boolean {
  return value.startsWith(SYNC_CUSTOM_FIELD_TARGET_PREFIX);
}

export function syncCustomFieldCodeFromTarget(value: string): string {
  return value.slice(SYNC_CUSTOM_FIELD_TARGET_PREFIX.length);
}

export interface SyncBinding {
  source_type?: SyncSourceType | null;
  api_uuid?: string | null;
  dataset_uuid?: string | null;
  field_mapping: Record<string, string>;
  match_key_field?: string;
  sync_mode?: string;
  schedule_interval_minutes?: number;
  last_success_at?: string | null;
  last_attempt_at?: string | null;
  last_error?: string | null;
}

export interface SyncFromSourcePayload {
  source_type?: SyncSourceType;
  api_uuid?: string;
  dataset_uuid?: string;
  field_mapping?: Record<string, string>;
  save_binding?: boolean;
  skip_prerequisite_syncs?: boolean;
  sync_mode?: string;
  schedule_interval_minutes?: number;
  incremental?: boolean;
  /** 仅同步有效主数据或未完成单据，默认 true */
  active_only?: boolean;
}

export type SyncProgressHandler = (message: string) => void;

export interface SyncPrerequisiteStep {
  id: string;
  titleKey: string;
  getBinding: () => Promise<SyncBinding>;
  syncFromSource: (
    payload: SyncFromSourcePayload,
    onProgress?: SyncProgressHandler,
  ) => Promise<SyncFromSourceResult>;
}

export type SyncProgressStatus = 'wait' | 'process' | 'finish' | 'error' | 'skip';

export interface SyncProgressItem {
  id: string;
  titleKey: string;
  status: SyncProgressStatus;
  description?: string;
}

export interface SyncFromSourceResult {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  /** 源端本轮拉取行数 */
  fetched?: number;
  /** full | incremental */
  mode?: string;
  errors: string[];
}

export interface SyncFromSourceConfig {
  titleKey: string;
  hintKey?: string;
  apiRealtimeHintKey?: string;
  datasetBatchHintKey?: string;
  targetFieldLabelKey?: string;
  /** 默认展示的常用目标字段 */
  targetFields: SyncTargetField[];
  /**
   * 可通过「添加更多字段」追加的系统/辅助字段（不含 targetFields）。
   * 与 loadAvailableTargetFields / customFieldTableName 合并去重。
   */
  availableTargetFields?: SyncTargetField[];
  /** 异步加载额外目标字段（如自定义字段）；打开弹窗时调用 */
  loadAvailableTargetFields?: () => Promise<SyncTargetField[]>;
  /** 便捷：按表名拉取启用中的自定义字段并转为 custom:{code} 目标 */
  customFieldTableName?: string;
  requiredTargets: string[];
  validateMapping?: (targetToSource: Record<string, string>, t: TFunction) => string | null;
  getBinding: () => Promise<SyncBinding>;
  syncFromSource: (
    payload: SyncFromSourcePayload,
    onProgress?: SyncProgressHandler,
  ) => Promise<SyncFromSourceResult>;
  completeSuccessKey: string;
  completePartialKey: string;
  failedKey: string;
  /** 主同步前先逐步执行的关联同步（界面展示进度） */
  prerequisiteSteps?: SyncPrerequisiteStep[];
  /** 主同步请求跳过服务端内置关联同步（由前端 prerequisiteSteps 负责时设为 true） */
  skipBackendPrerequisites?: boolean;
  /** 主同步步骤标题（有 prerequisiteSteps 时在进度条中展示） */
  mainStepTitleKey?: string;
}
