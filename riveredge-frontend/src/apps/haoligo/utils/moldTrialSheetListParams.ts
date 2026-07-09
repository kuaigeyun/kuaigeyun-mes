import { parseMoldReportCreatedRange } from './moldReportDateRange';

export type MoldTrialSheetListQueryParams = {
  sheet_status?: string;
  trial_result?: string;
  keyword?: string;
  failure_handling?: string;
  workflow_phase?: string;
  production_trial_result?: string;
  purchase_order_no?: string;
  supplier_name?: string;
  sheet_no?: string;
  mold_code?: string;
  mold_name?: string;
  trial_times?: number;
  trial_user_name?: string;
  created_from?: string;
  created_to?: string;
};

function pickSearchString(search: Record<string, unknown> | undefined, key: string): string | undefined {
  if (!search) return undefined;
  const raw = search[key];
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed || undefined;
}

function pickSearchPositiveInt(search: Record<string, unknown> | undefined, key: string): number | undefined {
  if (!search) return undefined;
  const raw = search[key];
  if (raw === undefined || raw === null || raw === '') return undefined;
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n) || n < 1) return undefined;
  return Math.trunc(n);
}

/** 从 ProTable 高级搜索表单解析试模单列表 API 查询参数 */
export function buildMoldTrialSheetListParams(
  search: Record<string, unknown> | undefined,
): MoldTrialSheetListQueryParams {
  return {
    ...parseMoldReportCreatedRange(search),
    sheet_status: pickSearchString(search, 'sheet_status'),
    trial_result: pickSearchString(search, 'trial_result'),
    keyword: pickSearchString(search, 'keyword'),
    failure_handling: pickSearchString(search, 'failure_handling'),
    workflow_phase: pickSearchString(search, 'workflow_phase'),
    production_trial_result: pickSearchString(search, 'production_trial_result'),
    purchase_order_no: pickSearchString(search, 'purchase_order_no'),
    supplier_name: pickSearchString(search, 'supplier_name'),
    sheet_no: pickSearchString(search, 'sheet_no'),
    mold_code: pickSearchString(search, 'mold_code'),
    mold_name: pickSearchString(search, 'mold_name'),
    trial_times: pickSearchPositiveInt(search, 'trial_times'),
    trial_user_name: pickSearchString(search, 'trial_user_name'),
  };
}
