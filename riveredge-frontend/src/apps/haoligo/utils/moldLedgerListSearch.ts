/**
 * 模具台账列表筛选：钉住 Tab 写入 lifecycle_stage，需映射到 API 的 status / ledger_source。
 */
import { MOLD_LEDGER_STATUS_SET } from '../constants/moldStatus';
import { MOLD_LEDGER_SOURCE_VALUES } from '../constants/moldLedgerSource';

const MOLD_LEDGER_SOURCE_SET = new Set<string>(MOLD_LEDGER_SOURCE_VALUES);

function pickTrimmedString(...candidates: unknown[]): string | undefined {
  for (const raw of candidates) {
    if (typeof raw === 'string' && raw.trim()) {
      return raw.trim();
    }
  }
  return undefined;
}

export interface MoldLedgerListSearchFilters {
  keyword?: string;
  mold_code?: string;
  name?: string;
  status?: string;
  ledger_source?: string;
}

/** 合并高级搜索表单与钉住条件（lifecycle_stage → status / ledger_source）。 */
export function parseMoldLedgerListSearchFilters(
  searchFormValues?: Record<string, unknown> | null,
  params?: Record<string, unknown> | null,
): MoldLedgerListSearchFilters {
  const merged: Record<string, unknown> = { ...params, ...searchFormValues };

  let status = pickTrimmedString(merged.status);
  let ledger_source = pickTrimmedString(merged.ledger_source);

  const stage = pickTrimmedString(merged.lifecycle_stage, merged.lifecycle);
  if (stage) {
    if (MOLD_LEDGER_STATUS_SET.has(stage)) {
      status = status ?? stage;
    } else if (MOLD_LEDGER_SOURCE_SET.has(stage)) {
      ledger_source = ledger_source ?? stage;
    }
  }

  return {
    keyword: pickTrimmedString(merged.keyword),
    mold_code: pickTrimmedString(merged.mold_code),
    name: pickTrimmedString(merged.name),
    status,
    ledger_source,
  };
}
