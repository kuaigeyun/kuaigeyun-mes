import React from 'react';
import type { ProColumns } from '@ant-design/pro-components';
import type { ColumnsState } from '@ant-design/pro-table';
import { TableContext } from '@ant-design/pro-table/es/Store/Provide';
import { columnSort } from '@ant-design/pro-table/es/utils/columnSort';
import { Table } from 'antd';
import { useTranslation } from 'react-i18next';
import { getProColumnStateKey } from '../uni-table/uniTableLayoutEngine';
import type { SummaryFieldMeta } from './types';

/** 与 ProTable `valueType: 'money'`（pro-field Money / zh-Hans-CN + CNY）同一套，含币种符号 */
const REPORT_MONEY_INTL = new Intl.NumberFormat('zh-Hans-CN', {
  currency: 'CNY',
  style: 'currency',
});

function formatSummaryValue(value: number, format?: string, precision = 2): string {
  if (Number.isNaN(value)) return '-';
  if (format === 'money') {
    return REPORT_MONEY_INTL.format(value);
  }
  if (format === 'percent') {
    return `${(value * 100).toFixed(precision)}%`;
  }
  if (format === 'digit' || format === 'number') {
    return value.toLocaleString('zh-CN', { maximumFractionDigits: precision });
  }
  return String(value);
}

function resolveSummaryAlign(col: ProColumns): 'left' | 'right' | 'center' | undefined {
  if (col.align === 'left' || col.align === 'right' || col.align === 'center') return col.align;
  const valueType = String(col.valueType ?? '');
  if (valueType === 'money' || valueType === 'digit' || valueType === 'percent') return 'right';
  return undefined;
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

type SummaryRowCellsProps = {
  columns: ProColumns[];
  summaryFields: string[];
  rows: Record<string, unknown>[];
  globalSummary?: Record<string, number>;
  metaMap: Map<string, SummaryFieldMeta>;
  showIndexColumn?: boolean;
};

const STACK_SECONDARY_STYLE: React.CSSProperties = {
  fontSize: 11,
  color: '#888',
  lineHeight: '16px',
};

/** 合计单元格行：须作为 Table.Summary 子节点，不可再包一层自定义组件当 summary 根 */
const SummaryRowCells: React.FC<SummaryRowCellsProps> = ({
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
    <Table.Summary.Row>
      <Table.Summary.Cell index={cellIndex++} colSpan={firstSummaryIdx}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, whiteSpace: 'nowrap' }}>
          <strong>{t('components.uniReport.pageSubtotal')}</strong>
          <span style={STACK_SECONDARY_STYLE}>{t('components.uniReport.allTotal')}</span>
        </div>
      </Table.Summary.Cell>
      {slots.slice(firstSummaryIdx).map((slot, i) => {
        if (slot.kind === 'summary') {
          const { dataIndex, col } = slot;
          const meta = metaMap.get(dataIndex);
          const pageSum = sumPageField(rows, dataIndex);
          const globalRaw = globalSummary?.[dataIndex];
          const globalVal =
            globalRaw !== undefined && globalRaw !== null ? Number(globalRaw) : pageSum;
          const format = meta?.format ?? (col.valueType as string);
          return (
            <Table.Summary.Cell
              index={cellIndex++}
              key={dataIndex || i}
              align={resolveSummaryAlign(col)}
            >
              <div style={{ whiteSpace: 'nowrap' }}>
                <strong>{formatSummaryValue(pageSum, format)}</strong>
                <div style={STACK_SECONDARY_STYLE}>{formatSummaryValue(globalVal, format)}</div>
              </div>
            </Table.Summary.Cell>
          );
        }
        return <Table.Summary.Cell index={cellIndex++} key={`empty-${i}`} />;
      })}
    </Table.Summary.Row>
  );
};

/**
 * 表尾合计：单行内堆叠本页合计 + 全部合计
 *
 * rc-table 仅当 summary 回调直接返回 `<Table.Summary fixed>` 时才吸底固定；
 * 不可再外包自定义组件。
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
      <Table.Summary fixed>
        <SummaryRowCells
          columns={columns}
          summaryFields={summaryFields}
          rows={rows}
          globalSummary={globalSummary}
          metaMap={metaMap}
          showIndexColumn={showIndexColumn}
        />
      </Table.Summary>
    );
  };
}

export default buildUniReportSummaryFooter;
