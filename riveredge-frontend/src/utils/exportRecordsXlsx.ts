/**
 * 列表导出统一为 XLSX（禁止 JSON Blob 下载）。
 */

export type ExportXlsxColumn = {
  /** 记录字段名；支持 a.b 点路径 */
  key: string;
  title: string;
};

function getByPath(record: Record<string, unknown>, key: string): unknown {
  if (!key.includes('.')) return record[key];
  let cur: unknown = record;
  for (const part of key.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function cellValue(value: unknown): string | number | boolean {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString();
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '';
    if (value.every((v) => v == null || ['string', 'number', 'boolean'].includes(typeof v))) {
      return value.map((v) => (v == null ? '' : String(v))).join(', ');
    }
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function inferColumns(records: Record<string, unknown>[]): ExportXlsxColumn[] {
  const keySet = new Set<string>();
  for (const record of records.slice(0, 80)) {
    for (const [key, value] of Object.entries(record)) {
      if (value != null && typeof value === 'object' && !(value instanceof Date) && !Array.isArray(value)) {
        continue;
      }
      if (
        Array.isArray(value) &&
        value.some((item) => item != null && typeof item === 'object' && !(item instanceof Date))
      ) {
        continue;
      }
      keySet.add(key);
    }
  }
  const preferred = [
    'code',
    'name',
    'status',
    'type',
    'category',
    'created_at',
    'updated_at',
  ];
  const keys = [...keySet];
  keys.sort((a, b) => {
    const ia = preferred.indexOf(a);
    const ib = preferred.indexOf(b);
    if (ia >= 0 || ib >= 0) {
      if (ia < 0) return 1;
      if (ib < 0) return -1;
      return ia - ib;
    }
    return a.localeCompare(b);
  });
  return keys.map((key) => ({ key, title: key }));
}

/**
 * 将对象数组导出为 XLSX 并触发下载。
 */
export async function downloadRecordsAsXlsx(
  records: Array<Record<string, unknown>>,
  fileName: string,
  options?: {
    columns?: ExportXlsxColumn[];
    sheetName?: string;
  },
): Promise<void> {
  if (!records.length) {
    throw new Error('没有可导出的数据');
  }
  const XLSX = await import('xlsx');
  const columns = options?.columns?.length ? options.columns : inferColumns(records);
  const header = columns.map((c) => c.title);
  const body = records.map((record) =>
    columns.map((col) => cellValue(getByPath(record, col.key))),
  );
  const sheet = XLSX.utils.aoa_to_sheet([header, ...body]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, options?.sheetName || '导出数据');
  const safeName = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  XLSX.writeFile(workbook, safeName);
}
