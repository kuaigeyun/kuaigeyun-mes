import type { MutableRefObject } from 'react';
import { fetchAllListItems } from '../../../../../utils/fetchAllListPages';

type ExportColumn<T> = { title: string; key: keyof T | string; getValue?: (row: T) => string };

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const content = [headers.map(escapeCsvCell).join(','), ...rows.map((r) => r.map(escapeCsvCell).join(','))].join('\n');
  const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function createDeliveryListExporter<T extends { id?: number }>(options: {
  filename: string;
  columns: ExportColumn<T>[];
  fetchPage: (page: { skip: number; limit: number }) => Promise<{ items: T[]; total: number }>;
  getListParams: () => Record<string, unknown>;
  tableRowsRef: MutableRefObject<T[]>;
  onEmpty: () => void;
}) {
  return async (
    type: 'selected' | 'currentPage' | 'all',
    exportKeys?: React.Key[],
    currentPageData?: T[],
  ) => {
    let toExport: T[] = [];
    if (type === 'all') {
      const params = options.getListParams();
      toExport = await fetchAllListItems((page) =>
        options.fetchPage({ skip: page.skip, limit: page.limit, ...params }),
      );
    } else if (type === 'selected' && exportKeys?.length) {
      toExport = (currentPageData ?? options.tableRowsRef.current).filter(
        (row) => row.id != null && exportKeys.includes(row.id),
      );
    } else {
      toExport = currentPageData ?? options.tableRowsRef.current;
    }
    if (toExport.length === 0) {
      options.onEmpty();
      return;
    }
    const headers = options.columns.map((c) => c.title);
    const rows = toExport.map((row) =>
      options.columns.map((c) => {
        if (c.getValue) return c.getValue(row);
        const raw = (row as Record<string, unknown>)[c.key as string];
        return raw == null ? '' : String(raw);
      }),
    );
    downloadCsv(`${options.filename}.csv`, headers, rows);
  };
}
