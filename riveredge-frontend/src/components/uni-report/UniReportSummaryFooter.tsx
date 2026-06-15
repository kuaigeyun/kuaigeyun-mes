import React from 'react';
import type { ProColumns } from '@ant-design/pro-components';
import { Table } from 'antd';
import { useTranslation } from 'react-i18next';
import type { SummaryFieldMeta } from './types';

function formatSummaryValue(value: number, format?: string, precision = 2): string {
  if (Number.isNaN(value)) return '-';
  if (format === 'money') {
    return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (format === 'percent') {
    return `${(value * 100).toFixed(precision)}%`;
  }
  if (format === 'digit' || format === 'number') {
    return value.toLocaleString(undefined, { maximumFractionDigits: precision });
  }
  return String(value);
}

function sumPageField(data: Record<string, unknown>[], field: string): number {
  return data.reduce((acc, row) => {
    const v = row[field];
    const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
    return acc + (Number.isFinite(n) ? n : 0);
  }, 0);
}

export type BuildSummaryFooterOptions = {
  columns: ProColumns[];
  summaryFields: string[];
  pageData: Record<string, unknown>[];
  globalSummary?: Record<string, number>;
  fieldMeta?: SummaryFieldMeta[];
  showIndexColumn?: boolean;
};

/**
 * 表尾合计：ProTable summary 行（本页合计 + 全量合计提示）
 */
export function buildUniReportSummaryFooter(options: BuildSummaryFooterOptions) {
  const {
    columns,
    summaryFields,
    pageData,
    globalSummary,
    fieldMeta = [],
    showIndexColumn,
  } = options;

  if (!summaryFields.length) return undefined;

  const metaMap = new Map(fieldMeta.map((m) => [m.field, m]));
  const visibleColumns = columns.filter((c) => !c.hideInTable && c.dataIndex);

  return (pageRows: readonly Record<string, unknown>[]) => {
    const rows = pageRows.length ? [...pageRows] : pageData;
    return (
      <SummaryRowInner
        columns={visibleColumns}
        summaryFields={summaryFields}
        rows={rows}
        globalSummary={globalSummary}
        metaMap={metaMap}
        showIndexColumn={showIndexColumn}
      />
    );
  };
}

type SummaryRowInnerProps = {
  columns: ProColumns[];
  summaryFields: string[];
  rows: Record<string, unknown>[];
  globalSummary?: Record<string, number>;
  metaMap: Map<string, SummaryFieldMeta>;
  showIndexColumn?: boolean;
};

const SummaryRowInner: React.FC<SummaryRowInnerProps> = ({
  columns,
  summaryFields,
  rows,
  globalSummary,
  metaMap,
  showIndexColumn,
}) => {
  const { t } = useTranslation();
  const fieldSet = new Set(summaryFields);
  let colIndex = 0;

  return (
    <Table.Summary fixed>
      <Table.Summary.Row>
        {showIndexColumn && (
          <Table.Summary.Cell index={colIndex++} colSpan={1}>
            <strong>{t('components.uniReport.pageSubtotal')}</strong>
          </Table.Summary.Cell>
        )}
        {columns.map((col, i) => {
          const dataIndex = String(col.dataIndex ?? '');
          const isFirst = i === 0 && !showIndexColumn;
          const idx = colIndex++;
          if (isFirst) {
            return (
              <Table.Summary.Cell index={idx} key={dataIndex || i}>
                <strong>{t('components.uniReport.pageSubtotal')}</strong>
              </Table.Summary.Cell>
            );
          }
          if (fieldSet.has(dataIndex)) {
            const meta = metaMap.get(dataIndex);
            const pageSum = sumPageField(rows, dataIndex);
            const globalVal = globalSummary?.[dataIndex];
            const showGlobal =
              globalVal !== undefined && globalVal !== null && globalVal !== pageSum;
            return (
              <Table.Summary.Cell index={idx} key={dataIndex || i}>
                <div>
                  <strong>{formatSummaryValue(pageSum, meta?.format ?? (col.valueType as string))}</strong>
                  {showGlobal && (
                    <div style={{ fontSize: 11, color: '#888' }}>
                      {t('components.uniReport.grandTotal')}:{' '}
                      {formatSummaryValue(Number(globalVal), meta?.format ?? (col.valueType as string))}
                    </div>
                  )}
                </div>
              </Table.Summary.Cell>
            );
          }
          return <Table.Summary.Cell index={idx} key={dataIndex || i} />;
        })}
      </Table.Summary.Row>
    </Table.Summary>
  );
};

export default buildUniReportSummaryFooter;
