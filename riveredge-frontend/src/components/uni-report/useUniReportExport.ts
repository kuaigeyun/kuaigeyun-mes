import { useCallback } from 'react';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import type { ProColumns } from '@ant-design/pro-components';
import { exportDomainReport, type ReportParams } from '../../apps/kuaizhizao/services/reports';
import type { UniReportExportConfig } from './types';

function escapeCsvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(filename: string, headers: string[], rows: Record<string, unknown>[], keys: string[]) {
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => keys.map((k) => escapeCsvCell(row[k])).join(',')),
  ];
  const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export type UseUniReportExportOptions = {
  title: string;
  exportConfig?: UniReportExportConfig;
  columns: ProColumns[];
  getFilters: () => ReportParams;
};

export function useUniReportExport(options: UseUniReportExportOptions) {
  const { message } = App.useApp();
  const { t } = useTranslation();
  const { title, exportConfig, columns, getFilters } = options;

  const exportableKeys = columns
    .filter((c) => c.dataIndex && !c.hideInTable)
    .map((c) => String(c.dataIndex));

  const exportableTitles = columns
    .filter((c) => c.dataIndex && !c.hideInTable)
    .map((c) => String(c.title ?? c.dataIndex));

  return useCallback(
    async (
      type: 'selected' | 'currentPage' | 'all',
      selectedRowKeys?: React.Key[],
      currentPageData?: Record<string, unknown>[],
    ) => {
      const dateStr = new Date().toISOString().split('T')[0];
      const baseName = `${title}-${dateStr}.csv`;

      if (type === 'all') {
        if (!exportConfig?.domain || !exportConfig?.reportType) {
          message.warning(t('components.uniReport.exportNotConfigured'));
          return;
        }
        const hide = message.loading(t('components.uniReport.exporting'), 0);
        try {
          await exportDomainReport(exportConfig.domain, {
            report_type: exportConfig.reportType,
            ...getFilters(),
          });
          hide();
          message.success(t('components.uniReport.exportSuccess', { title }));
        } catch (e) {
          hide();
          message.error(t('components.uniReport.exportFailed', { message: (e as Error).message }));
        }
        return;
      }

      let rows = currentPageData ?? [];
      if (type === 'selected' && selectedRowKeys?.length) {
        const keySet = new Set(selectedRowKeys.map(String));
        rows = rows.filter((r) => keySet.has(String((r as { id?: unknown }).id ?? '')));
      }
      if (!rows.length) {
        message.warning(t('components.uniReport.exportEmpty'));
        return;
      }
      downloadCsv(baseName, exportableTitles, rows, exportableKeys);
      message.success(t('components.uniReport.exportSuccess', { title }));
    },
    [columns, exportConfig, exportableKeys, exportableTitles, getFilters, message, t, title],
  );
}

export default useUniReportExport;
