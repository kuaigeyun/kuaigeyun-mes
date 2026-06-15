import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProColumns } from '@ant-design/pro-components';

export type UseUniReportPrintOptions = {
  title: string;
  subtitle?: string;
  columns: ProColumns[];
  filterSummary?: string;
};

function buildPrintHtml(options: {
  title: string;
  subtitle?: string;
  filterSummary?: string;
  printedAt: string;
  headers: string[];
  keys: string[];
  rows: Record<string, unknown>[];
  labels: { printedAt: string; filters: string };
}): string {
  const { title, subtitle, filterSummary, printedAt, headers, keys, rows, labels } = options;
  const headCells = headers.map((h) => `<th>${h}</th>`).join('');
  const bodyRows = rows
    .map(
      (row) =>
        `<tr>${keys.map((k) => `<td>${row[k] ?? ''}</td>`).join('')}</tr>`,
    )
    .join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${title}</title>
<style>
  body { font-family: "Microsoft YaHei", sans-serif; padding: 24px; color: #333; }
  h1 { text-align: center; font-size: 18px; margin: 0 0 8px; }
  .meta { text-align: center; color: #666; font-size: 12px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
  th { background: #fafafa; }
  @media print { body { padding: 0; } }
</style></head><body>
<h1>${title}</h1>
<div class="meta">${subtitle ? `<div>${subtitle}</div>` : ''}${filterSummary ? `<div>${labels.filters}: ${filterSummary}</div>` : ''}<div>${labels.printedAt}: ${printedAt}</div></div>
<table><thead><tr>${headCells}</tr></thead><tbody>${bodyRows}</tbody></table>
</body></html>`;
}

export function useUniReportPrint(options: UseUniReportPrintOptions) {
  const { t } = useTranslation();
  const { title, subtitle, columns, filterSummary } = options;

  const visibleCols = columns.filter((c) => c.dataIndex && !c.hideInTable);
  const keys = visibleCols.map((c) => String(c.dataIndex));
  const headers = visibleCols.map((c) => String(c.title ?? c.dataIndex));

  return useCallback(
    (_selectedRowKeys: React.Key[], currentPageData?: Record<string, unknown>[]) => {
      const rows = currentPageData ?? [];
      if (!rows.length) return;
      const html = buildPrintHtml({
        title,
        subtitle,
        filterSummary,
        printedAt: new Date().toLocaleString(),
        headers,
        keys,
        rows,
        labels: {
          printedAt: t('components.uniReport.printedAtLabel'),
          filters: t('components.uniReport.filterSummary'),
        },
      });
      const win = window.open('', '_blank', 'width=960,height=720');
      if (!win) return;
      win.document.write(html);
      win.document.close();
      win.focus();
      win.print();
    },
    [columns, filterSummary, headers, keys, subtitle, t, title],
  );
}

export default useUniReportPrint;
