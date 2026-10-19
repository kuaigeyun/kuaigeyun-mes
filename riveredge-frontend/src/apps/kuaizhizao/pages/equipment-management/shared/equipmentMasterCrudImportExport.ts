/**
 * 设备主数据（点检项/保养项等）列表导入导出：走既有 CRUD API，按编码 upsert。
 */
import type { ActionType } from '@ant-design/pro-components';
import type { MessageInstance } from 'antd/es/message/interface';
import type { TFunction } from 'i18next';
import { importInChunksViaPerItemCreate } from '../../../../../utils/chunkedBulkImport';
import { fetchAllListItems } from '../../../../../utils/fetchAllListPages';
import {
  downloadRecordsAsXlsx,
  type ExportXlsxColumn,
} from '../../../../../utils/exportRecordsXlsx';
import { resolveFactoryImportHeaderIndexMap } from '../../../../../utils/spreadsheetImportTemplate';

type FactoryImportTemplate = {
  importHeaders: string[];
  importExampleRow: string[];
  importHeaderMap: Record<string, string>;
  importColumnOptions: Array<string[] | undefined>;
};

export type EquipmentMasterCrudApi = {
  list: (params?: Record<string, unknown>) => Promise<unknown>;
  create: (data: unknown) => Promise<unknown>;
  update: (id: number, data: unknown) => Promise<unknown>;
};

export function parseImportActiveFlag(raw: string): boolean | undefined {
  if (!raw) return undefined;
  const v = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', '是', '启用', 'active'].includes(v)) return true;
  if (['0', 'false', 'no', 'n', '否', '停用', 'inactive'].includes(v)) return false;
  return undefined;
}

export function parseImportNumber(raw: string): number | undefined {
  if (!raw?.trim()) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

const VALUE_TYPE_ALIASES: Record<string, string> = {
  boolean: 'boolean',
  numeric: 'numeric',
  text: 'text',
  是否: 'boolean',
  '是/否': 'boolean',
  数值: 'numeric',
  文本: 'text',
};

export function parseInspectionValueType(raw: string): string {
  const key = raw.trim().toLowerCase();
  if (VALUE_TYPE_ALIASES[key]) return VALUE_TYPE_ALIASES[key];
  const cn = raw.trim();
  if (VALUE_TYPE_ALIASES[cn]) return VALUE_TYPE_ALIASES[cn];
  return 'boolean';
}

async function buildCodeIdMap(api: EquipmentMasterCrudApi): Promise<Map<string, number>> {
  const rows = (await fetchAllListItems((p) => api.list(p))) as Array<{ id?: number; code?: string }>;
  const map = new Map<string, number>();
  for (const row of rows) {
    const code = String(row.code ?? '').trim();
    if (code && row.id != null) {
      map.set(code, Number(row.id));
    }
  }
  return map;
}

function filterImportRows(data: unknown[][]): unknown[][] {
  return data.slice(2).filter((row) =>
    (row as unknown[])?.some((c) => c != null && String(c).trim() !== ''),
  );
}

function makeCellAt(headerIndexMap: Record<string, number | undefined>, row: unknown[]) {
  return (field: string): string => {
    const idx = headerIndexMap[field];
    if (idx === undefined) return '';
    return String((row as unknown[])[idx] ?? '').trim();
  };
}

export type MasterCrudImportOptions = {
  t: TFunction;
  messageApi: MessageInstance;
  actionRef: React.RefObject<ActionType | null | undefined>;
  api: EquipmentMasterCrudApi;
  template: FactoryImportTemplate;
  importTitle: string;
  importEmptyKey?: string;
  importNoRowsKey?: string;
  importHeaderMissingNameKey?: string;
  /** 除编码外必填字段（编码在 mapRow 内自行校验） */
  requireName?: boolean;
  mapRow: (cellAt: (field: string) => string) => Record<string, unknown> | null;
};

export function createMasterCrudImportHandler(options: MasterCrudImportOptions) {
  const {
    t,
    messageApi,
    actionRef,
    api,
    template,
    importTitle,
    mapRow,
    requireName = true,
    importEmptyKey = 'app.master-data.importEmpty',
    importNoRowsKey = 'app.master-data.importNoRows',
    importHeaderMissingNameKey = 'app.master-data.importHeaderMissingName',
  } = options;

  return async (data: unknown[][]) => {
    if (!data || data.length < 2) {
      messageApi.warning(t(importEmptyKey));
      return;
    }
    const headers = (data[0] || []).map((h) => String(h ?? '').trim());
    const headerIndexMap = resolveFactoryImportHeaderIndexMap(headers, template.importHeaderMap);
    if (requireName && headerIndexMap.name === undefined) {
      messageApi.error(t(importHeaderMissingNameKey));
      return;
    }
    const importRows = filterImportRows(data);
    const items: Record<string, unknown>[] = [];
    for (const row of importRows) {
      const cellAt = makeCellAt(headerIndexMap, row as unknown[]);
      const item = mapRow(cellAt);
      if (item) items.push(item);
    }
    if (items.length === 0) {
      messageApi.warning(t(importNoRowsKey));
      return;
    }
    const codeToId = await buildCodeIdMap(api);
    const result = await importInChunksViaPerItemCreate({
      items,
      rowNumberForIndex: (globalIndex) => globalIndex + 3,
      createOne: async (item) => {
        const code = String(item.code ?? '').trim();
        if (!code) {
          await api.create(item);
          return;
        }
        const existingId = codeToId.get(code);
        if (existingId != null) {
          await api.update(existingId, item);
          return;
        }
        const created = (await api.create(item)) as { id?: number };
        if (created?.id != null) {
          codeToId.set(code, created.id);
        }
      },
      title: importTitle,
      chunkSize: 50,
      concurrency: 4,
    });
    if (result.successCount > 0) {
      messageApi.success(t('common.importSuccess', { count: result.successCount }));
      actionRef.current?.reload();
    } else if (result.failureCount > 0) {
      actionRef.current?.reload();
    }
  };
}

export type MasterCrudExportOptions<T extends { id?: number }> = {
  t: TFunction;
  messageApi: MessageInstance;
  api: EquipmentMasterCrudApi;
  fileName: string;
  columns: ExportXlsxColumn[];
  listParams?: Record<string, unknown>;
  rowKey?: keyof T & string;
};

export function createMasterCrudExportHandler<T extends { id?: number }>(
  options: MasterCrudExportOptions<T>,
) {
  const {
    t,
    messageApi,
    api,
    fileName,
    columns,
    listParams,
    rowKey = 'id' as keyof T & string,
  } = options;

  return async (
    type: 'all' | 'currentPage' | 'selected',
    keys?: React.Key[],
    pageData?: T[],
  ) => {
    try {
      let items: T[] =
        type === 'currentPage' && pageData?.length
          ? pageData
          : ((await fetchAllListItems((p) => api.list({ ...p, ...listParams }))) as T[]);
      if (type === 'selected' && keys?.length) {
        items = items.filter((item) => {
          const key = item[rowKey];
          return key != null && keys.includes(key as React.Key);
        });
      }
      if (!items.length) {
        messageApi.warning(t('common.noDataToExport'));
        return;
      }
      await downloadRecordsAsXlsx(items as Array<Record<string, unknown>>, columns, fileName);
    } catch (err: unknown) {
      messageApi.error(err instanceof Error ? err.message : t('common.exportFailed'));
    }
  };
}
