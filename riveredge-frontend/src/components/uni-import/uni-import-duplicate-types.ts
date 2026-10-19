import { getImportDataRows } from './import-preview-utils';
import { resolveSystemFieldKey } from './apply-import-mapping';

/** 按唯一键（编码/单号等）处理库内重复时的写入策略 */
export type UniImportDuplicateStrategy = 'upsert' | 'skip' | 'fail';

export type ImportDuplicateSummary = {
  totalRows: number;
  newCount: number;
  updateCount: number;
  skipCount: number;
  duplicateInFileCount: number;
  missingKeyCount: number;
};

export type UniImportDuplicateConfig = {
  /** importFieldMap 中的字段名，如 code、document_no */
  keyField: string;
  /** i18n key，用于预检文案，如 field.supplier.code */
  keyLabelKey?: string;
  defaultStrategy?: UniImportDuplicateStrategy;
  supportedStrategies?: UniImportDuplicateStrategy[];
  /** 预检时解析库内已存在的键（不传则仅检测文件内重复） */
  resolveExistingKeys?: (keys: string[]) => Promise<Set<string>>;
};

export type UniImportCommitContext = {
  duplicateStrategy?: UniImportDuplicateStrategy;
};

const DEFAULT_STRATEGIES: UniImportDuplicateStrategy[] = ['upsert', 'skip', 'fail'];

export function normalizeDuplicateStrategies(
  supported?: UniImportDuplicateStrategy[],
): UniImportDuplicateStrategy[] {
  const list = supported?.length ? supported : DEFAULT_STRATEGIES;
  return list.filter((s, i, arr) => arr.indexOf(s) === i);
}

function resolveKeyColumnIndex(
  headers: string[],
  keyField: string,
  importFieldMap?: Record<string, string>,
): number | undefined {
  for (let i = 0; i < headers.length; i += 1) {
    const field = resolveSystemFieldKey(headers[i], importFieldMap);
    if (field === keyField) return i;
  }
  return undefined;
}

export function extractImportRowKeys(options: {
  data: any[][];
  dataStartRow?: number;
  keyField: string;
  importFieldMap?: Record<string, string>;
}): {
  keyColumnIndex?: number;
  rows: Array<{ rowNo: number; key: string }>;
} {
  const { data, dataStartRow = 2, keyField, importFieldMap } = options;
  const headers = (data[0] || []).map((h) => String(h ?? '').trim());
  const keyColumnIndex = resolveKeyColumnIndex(headers, keyField, importFieldMap);
  if (keyColumnIndex === undefined) {
    return { keyColumnIndex: undefined, rows: [] };
  }
  const dataRows = getImportDataRows(data, dataStartRow);
  const rows = dataRows.map((row, index) => ({
    rowNo: dataStartRow + index + 1,
    key: String(row?.[keyColumnIndex] ?? '').trim(),
  }));
  return { keyColumnIndex, rows };
}

export function summarizeImportDuplicates(
  rowKeys: Array<{ rowNo: number; key: string }>,
  existingKeys: Set<string>,
): ImportDuplicateSummary {
  const seenInFile = new Map<string, number>();
  let duplicateInFileCount = 0;
  let missingKeyCount = 0;
  let newCount = 0;
  let updateCount = 0;

  for (const { key } of rowKeys) {
    if (!key) {
      missingKeyCount += 1;
      continue;
    }
    if (seenInFile.has(key)) {
      duplicateInFileCount += 1;
      continue;
    }
    seenInFile.add(key);
    if (existingKeys.has(key)) {
      updateCount += 1;
    } else {
      newCount += 1;
    }
  }

  const skipCount = updateCount;

  return {
    totalRows: rowKeys.length,
    newCount,
    updateCount,
    skipCount,
    duplicateInFileCount,
    missingKeyCount,
  };
}

export async function analyzeImportDuplicatePlan(options: {
  data: any[][];
  dataStartRow?: number;
  config: UniImportDuplicateConfig;
  importFieldMap?: Record<string, string>;
  strategy: UniImportDuplicateStrategy;
}): Promise<{
  summary: ImportDuplicateSummary | null;
  errors: string[];
  warnings: string[];
  keyColumnMissing: boolean;
}> {
  const { data, config, importFieldMap, strategy, dataStartRow = 2 } = options;
  const { rows, keyColumnIndex } = extractImportRowKeys({
    data,
    dataStartRow,
    keyField: config.keyField,
    importFieldMap,
  });
  if (keyColumnIndex === undefined) {
    return {
      summary: null,
      errors: [],
      warnings: [],
      keyColumnMissing: true,
    };
  }

  const uniqueKeys = [...new Set(rows.map((r) => r.key).filter(Boolean))];
  const existingKeys = config.resolveExistingKeys
    ? await config.resolveExistingKeys(uniqueKeys)
    : new Set<string>();

  const summary = summarizeImportDuplicates(rows, existingKeys);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (summary.duplicateInFileCount > 0) {
    warnings.push(`duplicate_in_file:${summary.duplicateInFileCount}`);
    if (strategy === 'fail') {
      errors.push(`duplicate_in_file:${summary.duplicateInFileCount}`);
    }
  }

  if (strategy === 'fail' && summary.updateCount > 0) {
    errors.push(`duplicate_fail_blocked:${summary.updateCount}`);
  }

  if (strategy === 'skip' && summary.updateCount > 0) {
    warnings.push(`duplicate_skip_hint:${summary.updateCount}`);
  }

  return { summary, errors, warnings, keyColumnMissing: false };
}
