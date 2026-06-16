import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { UniTable } from '../uni-table';
import { ListPageTemplate, type StatCard } from '../layout-templates';
import { executeReport } from '../../apps/kuaireport/services/kuaireport';
import { UniReportMetaHeader } from './UniReportMetaHeader';
import { buildUniReportSummaryFooter } from './UniReportSummaryFooter';
import {
  buildExecuteFilters,
  buildFieldMeta,
  computeSummaryFromRows,
  parseUniReportExtra,
  reportConfigToColumns,
  resolveSummaryFields,
} from './configAdapter';
import { getUniReportTemplate } from './templates';
import { useUniReportExport } from './useUniReportExport';
import { useUniReportPrint } from './useUniReportPrint';
import type { UniReportProps } from './types';

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
  reportConfig,
  reportId,
  datasetExecute,
  showSummaryRow: showSummaryRowProp,
  showIndexColumn: showIndexColumnProp,
  summaryFields: summaryFieldsProp,
  showPrintButton = true,
  showExportButton = true,
}: UniReportProps<T>) {
  const { t } = useTranslation();
  const internalActionRef = useRef<ActionType>();
  const actionRef = externalActionRef ?? internalActionRef;
  const searchValuesRef = useRef<Record<string, unknown>>({});
  const [globalSummary, setGlobalSummary] = useState<Record<string, number>>({});
  const [pageData, setPageData] = useState<T[]>([]);

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
    let cols = (columnsProp ?? []) as ProColumns<T>[];
    if (template.columnEnhancements) {
      cols = template.columnEnhancements(cols as ProColumns[]) as ProColumns<T>[];
    }
    return cols;
  }, [columnsProp, mode, reportConfig, template]);

  const columns = useMemo(() => {
    if (!showIndexColumn) return baseColumns;
    return prependIndexColumn(baseColumns, t);
  }, [baseColumns, showIndexColumn, t]);

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
      searchValuesRef.current = searchFormValues ?? {};

      if (mode === 'page') {
        if (!request) {
          return { data: [], total: 0, success: true };
        }
        const res = await request(params, sort, filter, searchFormValues);
        const rows = res.data ?? [];
        setPageData(rows);

        let summary = (res as { summary?: Record<string, number> }).summary;
        if (summaryRequest) {
          summary = await summaryRequest(searchFormValues ?? {});
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
    [datasetExecute, mode, reportConfig, reportId, request, summaryFields, summaryRequest],
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

  return (
    <ListPageTemplate statCards={statCards} fillMain tableScrollLayout="report">
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <UniReportMetaHeader title={title} subtitle={resolvedSubtitle} />
        {children}
        <UniTable<T>
          headerTitle={title}
          columnPersistenceId={columnPersistenceId}
          actionRef={actionRef}
          rowKey={rowKey as string}
          columns={columns}
          viewTypes={['table']}
          fillViewportBody
          showAdvancedSearch
          request={wrappedRequest}
          permissionResource={permissionResource}
          showExportButton={showExportButton}
          onExport={handleExport}
          showPrintButton={showPrintButton}
          onPrint={handlePrint}
          scroll={{ x: 1200 }}
          bordered={template.bordered ?? true}
          size={template.tableSize ?? 'small'}
          summary={tableSummary}
        />
      </div>
    </ListPageTemplate>
  );
}

export default UniReport;
