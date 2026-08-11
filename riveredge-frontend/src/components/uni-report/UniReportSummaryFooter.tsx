import React from 'react';
import type { ProColumns } from '@ant-design/pro-components';
import type { ColumnsState } from '@ant-design/pro-table';
import { TableContext } from '@ant-design/pro-table/es/Store/Provide';
import { columnSort } from '@ant-design/pro-table/es/utils/columnSort';
import { Table } from 'antd';
import { useTranslation } from 'react-i18next';
import { getProColumnStateKey } from '../uni-table/uniTableLayoutEngine';
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

type SummarySlot =
  | { kind: 'empty' }
  | { kind: 'summary'; dataIndex: string; col: ProColumns };

function isIndexColumn(col: ProColumns): boolean {
  return col.valueType === 'index' || col.valueType === 'indexBorder';
}

/** 与 ProTable 表体一致：hideInTable + columnsMap.show + columnSort */
function resolveSummaryVisibleColumns(
  columns: ProColumns[],
  columnsMap: Record<string, ColumnsState> | undefined,
): ProColumns[] {
  const items = columns
    .map((col, index) => ({ col, index, key: getProColumnStateKey(col, index) }))
    .filter(({ col }) => !col.hideInTable)
    .filter(({ key }) => (columnsMap?.[key]?.show ?? true) !== false);

  if (!items.length) return [];

  const sortable = items.map(({ col, index, key }) => ({
    ...col,
    key,
    index,
  }));
  if (columnsMap && Object.keys(columnsMap).length > 0) {
    sortable.sort(columnSort(columnsMap));
  }
  return sortable;
}

function buildSummarySlots(
  columns: ProColumns[],
  summaryFields: string[],
  showIndexColumn?: boolean,
): SummarySlot[] {
  const fieldSet = new Set(summaryFields);
  const slots: SummarySlot[] = [];
  if (showIndexColumn) {
    slots.push({ kind: 'empty' });
  }
  for (const col of columns) {
    const dataIndex = String(col.dataIndex ?? '');
    if (fieldSet.has(dataIndex)) {
      slots.push({ kind: 'summary', dataIndex, col });
    } else {
      slots.push({ kind: 'empty' });
    }
  }
  return slots;
}

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

  return (pageRows: readonly Record<string, unknown>[]) => {
    const rows = pageRows.length ? [...pageRows] : pageData;
    return (
      <SummaryRowInner
        columns={columns}
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
  const counter = React.useContext(TableContext);
  const columnsMap = counter?.columnsMap as Record<string, ColumnsState> | undefined;

  const tableVisibleColumns = React.useMemo(
    () => resolveSummaryVisibleColumns(columns, columnsMap),
    [columns, columnsMap],
  );

  const includeIndexColumn =
    !!showIndexColumn && tableVisibleColumns.some(isIndexColumn);
  const dataColumns = tableVisibleColumns.filter((col) => !isIndexColumn(col));

  const slots = buildSummarySlots(dataColumns, summaryFields, includeIndexColumn);
  const firstSummaryIdx = slots.findIndex((slot) => slot.kind === 'summary');
  if (firstSummaryIdx < 0) return null;

  let cellIndex = 0;

  return (
    <Table.Summary fixed>
      <Table.Summary.Row>
        <Table.Summary.Cell index={cellIndex++} colSpan={firstSummaryIdx}>
          <strong style={{ whiteSpace: 'nowrap' }}>{t('components.uniReport.pageSubtotal')}</strong>
        </Table.Summary.Cell>
        {slots.slice(firstSummaryIdx).map((slot, i) => {
          if (slot.kind === 'summary') {
            const { dataIndex, col } = slot;
            const meta = metaMap.get(dataIndex);
            const pageSum = sumPageField(rows, dataIndex);
            const globalVal = globalSummary?.[dataIndex];
            const showGlobal =
              globalVal !== undefined && globalVal !== null && globalVal !== pageSum;
            return (
              <Table.Summary.Cell index={cellIndex++} key={dataIndex || i}>
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
          return <Table.Summary.Cell index={cellIndex++} key={`empty-${i}`} />;
        })}
      </Table.Summary.Row>
    </Table.Summary>
  );
};

export default buildUniReportSummaryFooter;
