import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { UniTable } from '../uni-table';
import { buildReportHelpViewConfig } from '../page-help-wiki/reportHelpViewConfig';
import { ListPageTemplate, type StatCard } from '../layout-templates';
import { UniReportMetaHeader } from './UniReportMetaHeader';
import { buildUniReportSummaryFooter } from './UniReportSummaryFooter';
import {
  applyUniReportColumnQuery,
  type ReportColumnFilter,
  type ReportColumnFacets,
  resolveReportTableSort,
  resolveReportTableSortFromAntdSorter,
  serializeReportColumnFilters,
} from './applyUniReportColumnQuery';
import { buildReportPeriodSearchSeed, ReportPeriodFilter } from './ReportPeriodFilter';
import {
  buildExecuteFilters,
  buildFieldMeta,
  computeSummaryFromRows,
  parseUniReportExtra,
  reportConfigToColumns,
  resolveSummaryFields,
} from './configAdapter';
import { getUniReportTemplate } from './templates';
import { buildUniReportTablePagination } from './uniReportPagination';
import { useUniReportExport } from './useUniReportExport';
import { useUniReportPrint } from './useUniReportPrint';
import type { UniReportProps } from './types';
import { stableJsonForQueryKey } from '../../utils/tableQueryKey';

/** 专业包 kuaireport：未 compose 时不可用，避免壳层静态依赖导致主仓白屏 */
const KUAIREPORT_SERVICE = import.meta.glob('../../apps/kuaireport/services/kuaireport.ts');

async function executeReport(reportId: string | number, filters: Record<string, unknown>) {
  const entry = Object.entries(KUAIREPORT_SERVICE)[0];
  if (!entry) {
    throw new Error('kuaireport is not composed into this workspace');
  }
  const mod = (await entry[1]()) as {
    executeReport: (id: string | number, f: Record<string, unknown>) => Promise<{
      data?: unknown[];
      total?: number;
      success?: boolean;
      summary?: Record<string, number>;
    }>;
  };
  return mod.executeReport(reportId, filters);
}

/** 报表是账表：单号只出文本，禁止复制图标、禁止挂关联抽屉链接 */
function stripReportCopyable<T>(columns: ProColumns<T>[]): ProColumns<T>[] {
  return columns.map((col) => ({
    ...col,
    copyable: false,
    skipLinkedDocumentLink: true,
  }));
}

const REPORT_KEEP_WIDTH_FIELDS = new Set([
  'unit',
  'material_unit',
  'rank',
  'currency',
  'currency_code',
]);

const REPORT_STRUCTURED_VALUE_TYPES = new Set([
  'index',
  'indexBorder',
  'date',
  'dateTime',
  'dateRange',
  'money',
  'digit',
]);

function reportColumnDataIndex(col: ProColumns): string {
  const raw = col.dataIndex;
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0];
  return '';
}

/** 报表单元格禁止溢出邻列：长编码/名称省略；单位等窄列 keepWidth，禁止被弹性列挤没 */
function applyReportEllipsis<T>(columns: ProColumns<T>[]): ProColumns<T>[] {
  return columns.map((col) => {
    if (col.hideInTable) return col;
    const dataIndex = reportColumnDataIndex(col as ProColumns);
    const valueType = col.valueType != null ? String(col.valueType) : '';
    const keepWidth =
      col.uniTableKeepWidth === true ||
      REPORT_KEEP_WIDTH_FIELDS.has(dataIndex) ||
      REPORT_STRUCTURED_VALUE_TYPES.has(valueType);
    if (keepWidth) {
      const width = typeof col.width === 'number' ? col.width : undefined;
      return {
        ...col,
        uniTableKeepWidth: true,
        ...(width != null ? { minWidth: (col.minWidth as number | undefined) ?? width } : {}),
        ellipsis: col.ellipsis === true,
      };
    }
    if (col.ellipsis === false) return col;
    return { ...col, ellipsis: true };
  });
}

function prependIndexColumn<T>(columns: ProColumns<T>[], t: (k: string) => string): ProColumns<T>[] {
  const hasIndex = columns.some((c) => c.valueType === 'index' || c.valueType === 'indexBorder');
  if (hasIndex) return columns;
  return [
    {
      title: t('components.uniReport.indexColumn'),
      valueType: 'index',
      width: 48,
      fixed: 'left',
      hideInSearch: true,
    },
    ...columns,
  ];
}

function buildStatCards(
  summary: Record<string, number>,
  statCardsProp: UniReportProps['statCards'],
  kpiBindings: { key: string; title: string; precision?: number; suffix?: string }[] | undefined,
  t: (k: string) => string,
): StatCard[] {
  if (typeof statCardsProp === 'function') return statCardsProp(summary);
  if (statCardsProp?.length) return statCardsProp;
  if (!kpiBindings?.length) return [];
  return kpiBindings.map((k) => ({
    key: k.key,
    title: k.title.startsWith('components.') ? t(k.title) : k.title,
    value: summary[k.key] ?? 0,
    precision: k.precision,
    suffix: k.suffix,
  }));
}

function formatFilterSummary(values: Record<string, unknown>): string {
  return Object.entries(values)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ~ ') : String(v)}`)
    .join('; ');
}

export function UniReport<T extends Record<string, unknown> = Record<string, unknown>>({
  mode = 'page',
  title,
  subtitle,
  templateId,
  permissionResource,
  columnPersistenceId,
  columns: columnsProp,
  request,
  summaryRequest,
  statCards: statCardsProp,
  exportConfig,
  rowKey = 'id',
  actionRef: externalActionRef,
  children,
  beforeSearchButtons,
  params,
  headerLeft,
  reportConfig,
  reportId,
  datasetExecute,
  showSummaryRow: showSummaryRowProp,
  showIndexColumn: showIndexColumnProp,
  summaryFields: summaryFieldsProp,
  showPrintButton = true,
  showExportButton = true,
  skipFuzzyPinyinClientFilter,
  periodFilter: periodFilterProp,
  enableColumnQuery: enableColumnQueryProp,
}: UniReportProps<T>) {
  const { t } = useTranslation();
  const internalActionRef = useRef<ActionType>();
  const actionRef = externalActionRef ?? internalActionRef;
  const periodFilterEnabled = periodFilterProp ?? mode === 'page';
  const searchParamsRef = useRef<Record<string, unknown> | undefined>(
    periodFilterEnabled ? buildReportPeriodSearchSeed() : undefined,
  );
  const searchValuesRef = useRef<Record<string, unknown>>({});
  const [globalSummary, setGlobalSummary] = useState<Record<string, number>>({});
  const [pageData, setPageData] = useState<T[]>([]);
  const [columnFilters, setColumnFilters] = useState<ReportColumnFilter[]>([]);
  const [columnFacets, setColumnFacets] = useState<ReportColumnFacets>({});
  const reportSortRef = useRef<Record<string, 'ascend' | 'descend'>>({});
  const [periodRevision, setPeriodRevision] = useState(0);

  const periodFilter = periodFilterEnabled;
  const enableColumnQuery = enableColumnQueryProp ?? mode === 'page';

  const configExtra = mode === 'config' ? parseUniReportExtra(reportConfig) : {};
  const resolvedTemplateId = templateId ?? configExtra.templateId ?? (mode === 'config' ? 'kuaireportTable' : 'queryTable');
  const template = getUniReportTemplate(resolvedTemplateId);

  const showIndexColumn = showIndexColumnProp ?? configExtra.showIndexColumn ?? template.showIndexColumn ?? false;
  const showSummaryRow = showSummaryRowProp ?? configExtra.showSummaryRow ?? template.showSummaryRow ?? false;
  const summaryFields =
    summaryFieldsProp ?? configExtra.summaryFields ?? template.summaryFields ?? resolveSummaryFields(reportConfig, undefined);
  const kpiBindings = configExtra.kpiBindings ?? template.kpiBindings;

  const baseColumns = useMemo(() => {
    if (mode === 'config' && reportConfig) {
      return reportConfigToColumns(reportConfig) as ProColumns<T>[];
    }
    let cols = applyReportEllipsis(stripReportCopyable((columnsProp ?? []) as ProColumns<T>[]));
    if (template.columnEnhancements) {
      cols = template.columnEnhancements(cols as ProColumns[]) as ProColumns<T>[];
    }
    return cols;
  }, [columnsProp, mode, reportConfig, template]);

  const columns = useMemo(() => {
    let cols = baseColumns;
    if (showIndexColumn) {
      cols = prependIndexColumn(cols, t);
    }
    return applyUniReportColumnQuery({
      columns: cols,
      columnFilters,
      enableColumnQuery,
      columnFacets,
      facetRows: pageData as Record<string, unknown>[],
      onColumnFiltersChange: (next) => {
        setColumnFilters(next);
        const merged: Record<string, unknown> = { ...(searchParamsRef.current || {}) };
        const serialized = serializeReportColumnFilters(next);
        if (serialized) merged.column_filters = serialized;
        else delete merged.column_filters;
        searchParamsRef.current = Object.keys(merged).length ? merged : undefined;
        setPeriodRevision((e) => e + 1);
        actionRef.current?.reload?.();
      },
    });
  }, [baseColumns, columnFacets, columnFilters, enableColumnQuery, pageData, showIndexColumn, t, actionRef]);

  const periodFilterNode = useMemo(() => {
    if (!periodFilter) return null;
    return (
      <ReportPeriodFilter
        searchParamsRef={searchParamsRef}
        actionRef={actionRef}
        revision={periodRevision}
        onApplied={() => setPeriodRevision((e) => e + 1)}
      />
    );
  }, [actionRef, periodFilter, periodRevision]);

  const toolbarBeforeSearch = useMemo(() => {
    if (!periodFilterNode && !beforeSearchButtons) return undefined;
    return (
      <>
        {periodFilterNode}
        {beforeSearchButtons}
      </>
    );
  }, [beforeSearchButtons, periodFilterNode]);

  const statCards = useMemo(
    () => buildStatCards(globalSummary, statCardsProp, kpiBindings, t),
    [globalSummary, statCardsProp, kpiBindings, t],
  );

  const getFilters = useCallback(
    () => searchValuesRef.current as Record<string, unknown>,
    [],
  );

  const handleExport = useUniReportExport({
    title,
    exportConfig,
    columns: columns as ProColumns[],
    getFilters,
  });

  const resolvedSubtitle =
    typeof subtitle === 'function'
      ? subtitle({ filters: searchValuesRef.current })
      : subtitle;

  const handlePrint = useUniReportPrint({
    title,
    subtitle: typeof resolvedSubtitle === 'string' ? resolvedSubtitle : undefined,
    columns: columns as ProColumns[],
    filterSummary: formatFilterSummary(searchValuesRef.current),
  });

  const wrappedRequest = useCallback(
    async (
      params: Record<string, unknown>,
      sort?: Record<string, unknown>,
      filter?: Record<string, unknown>,
      searchFormValues?: Record<string, unknown>,
    ) => {
      const mergedSearch: Record<string, unknown> = {
        ...(searchParamsRef.current || {}),
        ...(searchFormValues || {}),
      };
      if (columnFilters.length) {
        mergedSearch.column_filters = serializeReportColumnFilters(columnFilters);
      }
      searchValuesRef.current = mergedSearch;
      searchParamsRef.current = mergedSearch;

      const fromArg = resolveReportTableSort(
        sort as Record<string, 'ascend' | 'descend' | null | undefined>,
        columns,
      );
      const proSort = Object.keys(fromArg).length > 0 ? fromArg : reportSortRef.current;
      reportSortRef.current = proSort;

      if (mode === 'page') {
        if (!request) {
          return { data: [], total: 0, success: true };
        }
        const res = await request(params, proSort, filter, mergedSearch);
        const rows = res.data ?? [];
        setPageData(rows);
        const facets = (res as { column_facets?: ReportColumnFacets }).column_facets;
        if (facets && typeof facets === 'object') {
          setColumnFacets(facets);
        }

        let summary = (res as { summary?: Record<string, number> }).summary;
        if (summaryRequest) {
          summary = await summaryRequest(mergedSearch);
        }
        if (summary) {
          setGlobalSummary(summary);
        } else if (summaryFields.length) {
          setGlobalSummary(computeSummaryFromRows(rows as Record<string, unknown>[], summaryFields));
        }
        return res;
      }

      const filters = buildExecuteFilters(reportConfig ?? {}, searchFormValues ?? {}, {
        current: params.current as number,
        pageSize: params.pageSize as number,
      });

      const exec =
        datasetExecute ??
        (async (f: Record<string, unknown>) => {
          if (!reportId) return { data: [], total: 0, success: true };
          return executeReport(reportId, f);
        });

      const res = await exec(filters);
      const rows = (res.data ?? []) as T[];
      setPageData(rows);
      const facets = (res as { column_facets?: ReportColumnFacets }).column_facets;
      if (facets && typeof facets === 'object') {
        setColumnFacets(facets);
      }

      const summary =
        res.summary ??
        (summaryFields.length
          ? computeSummaryFromRows(rows as Record<string, unknown>[], summaryFields)
          : undefined);
      if (summary) setGlobalSummary(summary);

      return {
        data: rows,
        total: res.total ?? rows.length,
        success: res.success ?? true,
      };
    },
    [columnFilters, columns, datasetExecute, mode, reportConfig, reportId, request, summaryFields, summaryRequest],
  );

  const handleTableChange = useCallback(
    (
      _pagination: unknown,
      _filters: unknown,
      sorter: unknown,
    ) => {
      const resolved = resolveReportTableSortFromAntdSorter(sorter, columns);
      const prevKey = stableJsonForQueryKey(reportSortRef.current);
      const nextKey = stableJsonForQueryKey(resolved);
      reportSortRef.current = resolved;
      if (prevKey !== nextKey) {
        actionRef.current?.reload?.();
      }
    },
    [actionRef, columns],
  );

  const tableSummary = useMemo(() => {
    if (!showSummaryRow || !summaryFields.length) return undefined;
    return buildUniReportSummaryFooter({
      columns: columns as ProColumns[],
      summaryFields,
      pageData: pageData as Record<string, unknown>[],
      globalSummary,
      fieldMeta: buildFieldMeta(reportConfig),
      showIndexColumn,
    });
  }, [columns, globalSummary, pageData, reportConfig, showIndexColumn, showSummaryRow, summaryFields]);

  const reportPagination = useMemo(() => buildUniReportTablePagination(t), [t]);

  return (
    <ListPageTemplate statCards={statCards}>
      <UniReportMetaHeader title={title} subtitle={resolvedSubtitle} extraLeft={headerLeft} />
      {children}
      <UniTable<T>
          columnPersistenceId={columnPersistenceId}
          actionRef={actionRef}
          searchParamsRef={searchParamsRef}
          rowKey={rowKey as string}
          columns={columns}
          viewTypes={['table', 'help']}
          helpViewConfig={buildReportHelpViewConfig()}
          reportLayout
          showAdvancedSearch
          searchPlacement="toolbarLeft"
          request={wrappedRequest}
          permissionResource={permissionResource}
          showExportButton={showExportButton}
          onExport={handleExport}
          showPrintButton={showPrintButton}
          onPrint={handlePrint}
          bordered={template.bordered ?? true}
          size={template.tableSize ?? 'small'}
          summary={tableSummary}
          skipFuzzyPinyinClientFilter={skipFuzzyPinyinClientFilter}
          beforeSearchButtons={toolbarBeforeSearch}
          searchResetSeed={periodFilter ? buildReportPeriodSearchSeed() : undefined}
          onSearchReset={() => {
            setColumnFilters([]);
            setColumnFacets({});
            reportSortRef.current = {};
            setPeriodRevision((e) => e + 1);
          }}
          onChange={handleTableChange}
          params={params}
          pagination={reportPagination}
        />
    </ListPageTemplate>
  );
}

export default UniReport;
