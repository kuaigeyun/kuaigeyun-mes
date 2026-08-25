import type { ProColumns } from '@ant-design/pro-components';
import React, { useEffect, useMemo, useState } from 'react';
import { FilterOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, Checkbox, Input, Space } from 'antd';
import type { FilterDropdownProps } from 'antd/es/table/interface';
import { useTranslation } from 'react-i18next';

export const REPORT_COLUMN_FILTER_BLANK = '__blank__';
export const REPORT_COLUMN_FILTER_NONE = '__none__';

export type ReportColumnFilterOp =
  | 'contains'
  | 'eq'
  | 'ne'
  | 'gt'
  | 'lt'
  | 'gte'
  | 'lte'
  | 'between'
  | 'in'
  | 'nin'
  | 'startswith'
  | 'endswith'
  | 'isnull';

export type ReportColumnFilter = {
  field: string;
  op: ReportColumnFilterOp;
  value?: string | number | string[];
  value_to?: string | number;
};

export type ReportColumnFacetOption = {
  value: string;
  count: number;
};

export type ReportColumnFacets = Record<string, ReportColumnFacetOption[]>;

function columnFieldKey(col: ProColumns): string {
  const raw = col.dataIndex;
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0];
  return '';
}

function rowFieldValue(row: Record<string, unknown>, field: string): unknown {
  if (field in row) return row[field];
  const parts = field.split('.');
  let cur: unknown = row;
  for (const part of parts) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function columnFilterValueKey(raw: unknown): string {
  if (raw == null || raw === '') return REPORT_COLUMN_FILTER_BLANK;
  return String(raw);
}

/** 将 ProTable / antd sorter 事件解析为 dataIndex 字段排序（报表服务端排序唯一路径） */
export function resolveReportTableSortFromAntdSorter(
  sorter: unknown,
  columns: ProColumns[],
): Record<string, 'ascend' | 'descend'> {
  const raw: Record<string, 'ascend' | 'descend'> = {};
  if (Array.isArray(sorter)) {
    for (const item of sorter) {
      if (item && typeof item === 'object' && 'field' in item && item.order) {
        const order = (item as { order?: string }).order;
        if (order === 'ascend' || order === 'descend') {
          raw[String((item as { field: unknown }).field)] = order;
        }
      }
    }
  } else if (sorter && typeof sorter === 'object' && 'field' in sorter) {
    const s = sorter as { field?: unknown; order?: string | null };
    if (s.field != null && (s.order === 'ascend' || s.order === 'descend')) {
      raw[String(s.field)] = s.order;
    }
  }
  return resolveReportTableSort(raw, columns);
}

export function resolveReportTableSort(
  sort: Record<string, 'ascend' | 'descend' | null | undefined> | undefined,
  columns: ProColumns[],
): Record<string, 'ascend' | 'descend'> {
  const entries = Object.entries(sort ?? {}).filter(
    ([, v]) => v === 'ascend' || v === 'descend',
  ) as [string, 'ascend' | 'descend'][];
  if (!entries.length) return {};
  const [rawKey, order] = entries[0];
  const visible = columns.filter(
    (c) =>
      !c.hideInTable &&
      c.valueType !== 'index' &&
      c.valueType !== 'indexBorder' &&
      c.key !== 'option' &&
      c.key !== 'actions',
  );
  if (/^\d+$/.test(rawKey)) {
    const col = visible[Number(rawKey)];
    const field = columnFieldKey(col);
    if (field) return { [field]: order };
  }
  const matched = visible.find(
    (c) => columnFieldKey(c) === rawKey || String(c.key ?? '') === rawKey,
  );
  const field = matched ? columnFieldKey(matched) : rawKey;
  return field ? { [field]: order } : {};
}

function isQueryableColumn(col: ProColumns): boolean {
  if (col.hideInTable) return false;
  if (col.valueType === 'index' || col.valueType === 'indexBorder') return false;
  if (col.key === 'option' || col.key === 'actions') return false;
  if (col.fixed === 'right' && (col.key === 'lifecycle' || col.dataIndex === 'lifecycle')) return false;
  const field = columnFieldKey(col);
  if (!field) return false;
  return true;
}

function hideToolbarDateSearchColumns<T>(columns: ProColumns<T>[]): ProColumns<T>[] {
  return columns.map((col) => {
    if (col.hideInTable && col.valueType === 'dateRange') {
      return { ...col, hideInSearch: true };
    }
    return col;
  });
}

function resolveFacetOptionLabel(column: ProColumns, value: string, t: (k: string) => string): React.ReactNode {
  if (value === REPORT_COLUMN_FILTER_BLANK) {
    return t('components.uniReport.columnFilter.blank');
  }
  const valueEnum = column.valueEnum as Record<string, { text?: React.ReactNode }> | undefined;
  const enumMeta = valueEnum?.[value];
  if (enumMeta?.text != null) return enumMeta.text;
  return value;
}

function buildClientColumnFacets(
  rows: Record<string, unknown>[],
  field: string,
): ReportColumnFacetOption[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = columnFilterValueKey(rowFieldValue(row, field));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => {
      if (a.value === REPORT_COLUMN_FILTER_BLANK) return -1;
      if (b.value === REPORT_COLUMN_FILTER_BLANK) return 1;
      return a.value.localeCompare(b.value, undefined, { numeric: true, sensitivity: 'base' });
    });
}

function resolveColumnFilterOptions(
  field: string,
  column: ProColumns,
  columnFacets: ReportColumnFacets | undefined,
  facetRows: Record<string, unknown>[] | undefined,
): ReportColumnFacetOption[] {
  const fromServer = columnFacets?.[field];
  if (fromServer?.length) return fromServer;
  if (facetRows?.length) return buildClientColumnFacets(facetRows, field);
  const valueEnum = column.valueEnum as Record<string, { text?: React.ReactNode }> | undefined;
  if (valueEnum && Object.keys(valueEnum).length > 0) {
    return Object.keys(valueEnum).map((value) => ({ value, count: 0 }));
  }
  return [];
}

function initSelectedValues(
  activeFilter: ReportColumnFilter | undefined,
  options: ReportColumnFacetOption[],
): Set<string> {
  if (activeFilter?.op === 'in' && Array.isArray(activeFilter.value)) {
    return new Set(activeFilter.value.map(String));
  }
  return new Set(options.map((item) => item.value));
}

type FilterPanelProps = FilterDropdownProps & {
  column: ProColumns;
  activeFilter?: ReportColumnFilter;
  columnFacets?: ReportColumnFacets;
  facetRows?: Record<string, unknown>[];
  onApply: (filter?: ReportColumnFilter) => void;
};

const ReportColumnFilterPanel: React.FC<FilterPanelProps> = ({
  column,
  activeFilter,
  columnFacets,
  facetRows,
  onApply,
  confirm,
  clearFilters,
}) => {
  const { t } = useTranslation();
  const field = columnFieldKey(column);

  const options = useMemo(
    () => resolveColumnFilterOptions(field, column, columnFacets, facetRows),
    [column, columnFacets, facetRows, field],
  );

  const [keyword, setKeyword] = useState('');
  const [selected, setSelected] = useState<Set<string>>(() => initSelectedValues(activeFilter, options));

  useEffect(() => {
    setKeyword('');
    setSelected(initSelectedValues(activeFilter, options));
  }, [activeFilter, field, options]);

  const filteredOptions = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return options;
    return options.filter((item) => {
      const label = String(resolveFacetOptionLabel(column, item.value, t)).toLowerCase();
      return label.includes(q) || item.value.toLowerCase().includes(q);
    });
  }, [column, keyword, options, t]);

  const totalCount = useMemo(
    () => options.reduce((sum, item) => sum + item.count, 0),
    [options],
  );

  const visibleValues = filteredOptions.map((item) => item.value);
  const allVisibleSelected =
    visibleValues.length > 0 && visibleValues.every((value) => selected.has(value));
  const someVisibleSelected = visibleValues.some((value) => selected.has(value));

  const apply = () => {
    const allValues = options.map((item) => item.value);
    const selectedValues = allValues.filter((value) => selected.has(value));
    let next: ReportColumnFilter | undefined;
    if (!selectedValues.length) {
      next = { field, op: 'in', value: [REPORT_COLUMN_FILTER_NONE] };
    } else if (selectedValues.length === allValues.length) {
      next = undefined;
    } else {
      next = { field, op: 'in', value: selectedValues };
    }
    onApply(next);
    confirm?.({ closeDropdown: true });
  };

  const cancel = () => {
    confirm?.({ closeDropdown: true });
  };

  const clear = () => {
    clearFilters?.();
    onApply(undefined);
    confirm?.({ closeDropdown: true });
  };

  return (
    <div style={{ padding: 8, width: 260 }} onKeyDown={(e) => e.stopPropagation()}>
      <Space orientation="vertical" size={8} style={{ width: '100%' }}>
        <Input
          size="small"
          allowClear
          value={keyword}
          prefix={<SearchOutlined style={{ color: 'rgba(0,0,0,0.35)' }} />}
          placeholder={t('common.search')}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <div style={{ maxHeight: 280, overflowY: 'auto', paddingRight: 4 }}>
          <div style={{ marginBottom: 6 }}>
            <Checkbox
              indeterminate={someVisibleSelected && !allVisibleSelected}
              checked={allVisibleSelected}
              onChange={(e) => {
                const checked = e.target.checked;
                setSelected((prev) => {
                  const next = new Set(prev);
                  if (checked) {
                    visibleValues.forEach((value) => next.add(value));
                  } else {
                    visibleValues.forEach((value) => next.delete(value));
                  }
                  return next;
                });
              }}
            >
              {t('components.uniReport.columnFilter.selectAll')}
              {totalCount ? ` (${totalCount})` : ''}
            </Checkbox>
          </div>
          {filteredOptions.map((item) => (
            <div key={item.value} style={{ marginBottom: 4 }}>
              <Checkbox
                checked={selected.has(item.value)}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setSelected((prev) => {
                    const next = new Set(prev);
                    if (checked) next.add(item.value);
                    else next.delete(item.value);
                    return next;
                  });
                }}
              >
                {resolveFacetOptionLabel(column, item.value, t)}
                {item.count ? ` (${item.count})` : ''}
              </Checkbox>
            </div>
          ))}
          {!filteredOptions.length ? (
            <div style={{ color: 'rgba(0,0,0,0.45)', fontSize: 12, padding: '4px 0' }}>
              {t('components.uniReport.columnFilter.emptyOptions')}
            </div>
          ) : null}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button size="small" onClick={cancel}>
            {t('common.cancel')}
          </Button>
          <Button size="small" onClick={clear}>
            {t('components.uniReport.columnFilter.clear')}
          </Button>
          <Button type="primary" size="small" onClick={apply}>
            {t('components.uniReport.columnFilter.apply')}
          </Button>
        </div>
      </Space>
    </div>
  );
};

export type ApplyUniReportColumnQueryOptions<T> = {
  columns: ProColumns<T>[];
  columnFilters: ReportColumnFilter[];
  onColumnFiltersChange: (next: ReportColumnFilter[]) => void;
  enableColumnQuery?: boolean;
  columnFacets?: ReportColumnFacets;
  facetRows?: Record<string, unknown>[];
};

export function applyUniReportColumnQuery<T>({
  columns,
  columnFilters,
  onColumnFiltersChange,
  enableColumnQuery = true,
  columnFacets,
  facetRows,
}: ApplyUniReportColumnQueryOptions<T>): ProColumns<T>[] {
  const withHiddenDate = hideToolbarDateSearchColumns(columns);
  if (!enableColumnQuery) return withHiddenDate;

  const filterMap = new Map<string, ReportColumnFilter>();
  columnFilters.forEach((f) => filterMap.set(f.field, f));

  return withHiddenDate.map((col) => {
    if (!isQueryableColumn(col)) return col;
    const field = columnFieldKey(col);
    const active = filterMap.get(field);
    const nextCol: ProColumns<T> = {
      ...col,
      key: (col.key as string | undefined) ?? field,
      // ProTable 仅 sorter===true 才走服务端排序；filters:false 避免本地筛选分支
      sorter: col.sorter === false ? false : true,
      filters: false,
      filterDropdown: (props) => (
        <ReportColumnFilterPanel
          {...props}
          column={col}
          activeFilter={active}
          columnFacets={columnFacets}
          facetRows={facetRows}
          onApply={(filter) => {
            const rest = columnFilters.filter((item) => item.field !== field);
            onColumnFiltersChange(filter ? [...rest, filter] : rest);
          }}
        />
      ),
      filterIcon: (filtered: boolean) => (
        <FilterOutlined style={{ fontSize: 12, color: filtered ? '#1677ff' : undefined }} />
      ),
      filteredValue: active ? [field] : null,
    };
    return nextCol;
  });
}

export function parseReportColumnFilters(raw: unknown): ReportColumnFilter[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as ReportColumnFilter[];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as ReportColumnFilter[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function serializeReportColumnFilters(filters: ReportColumnFilter[]): string | undefined {
  if (!filters.length) return undefined;
  return JSON.stringify(filters);
}
