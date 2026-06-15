import type { ProColumns } from '@ant-design/pro-components';
import type {
  ReportConfigSchema,
  ReportFieldMapping,
  ReportFilterConfig,
  SummaryFieldMeta,
  UniReportExtraConfig,
} from './types';

function mapFormatToValueType(format?: string): ProColumns['valueType'] {
  switch (format) {
    case 'money':
      return 'money';
    case 'date':
    case 'datetime':
      return 'dateTime';
    case 'percent':
      return 'percent';
    case 'number':
    case 'digit':
      return 'digit';
    default:
      return 'text';
  }
}

function mapFilterToValueType(operator?: string, field?: string): ProColumns['valueType'] {
  if (operator === 'between') return 'dateRange';
  if (field?.includes('date') || field?.endsWith('_at')) return 'dateRange';
  return 'text';
}

/** ReportConfigSchema → ProColumns */
export function reportConfigToColumns(config: ReportConfigSchema): ProColumns[] {
  const fields = config.fields ?? [];
  const filterCols: ProColumns[] = (config.filters ?? []).map((f: ReportFilterConfig, i) => ({
    title: f.label,
    dataIndex: f.field,
    hideInTable: true,
    valueType: mapFilterToValueType(f.operator, f.field),
    initialValue: f.default_value,
    search: { order: 10 - i } as ProColumns['search'],
  }));

  const tableCols: ProColumns[] = fields
    .filter((f: ReportFieldMapping) => f.visible !== false)
    .map((f: ReportFieldMapping) => ({
      title: f.label,
      dataIndex: f.field,
      key: f.field,
      width: f.width,
      valueType: mapFormatToValueType(f.format),
      hideInSearch: true,
    }));

  return [...filterCols, ...tableCols];
}

/** 从 report_config 解析 uni_report 扩展段（兼容 extra 为 JSON 或嵌套对象） */
export function parseUniReportExtra(config?: ReportConfigSchema | null): UniReportExtraConfig {
  const extra = config?.extra;
  if (!extra) return {};
  const uni = extra.uni_report;
  if (!uni || typeof uni !== 'object') return {};
  return uni as UniReportExtraConfig;
}

/** 合并 config fields 中带 aggregate 的字段为 summaryFields */
export function resolveSummaryFields(
  config?: ReportConfigSchema | null,
  templateFields?: string[],
): string[] {
  const uni = parseUniReportExtra(config);
  if (uni.summaryFields?.length) return uni.summaryFields;
  if (templateFields?.length) return templateFields;
  const fromFields = (config?.fields ?? [])
    .filter((f) => f.aggregate === 'sum' || f.format === 'money' || f.format === 'number')
    .map((f) => f.field);
  return fromFields;
}

export function buildFieldMeta(config?: ReportConfigSchema | null): SummaryFieldMeta[] {
  return (config?.fields ?? []).map((f) => ({
    field: f.field,
    label: f.label,
    format: f.format,
  }));
}

/** 搜索表单 + 分页 → execute 参数 */
export function buildExecuteFilters(
  config: ReportConfigSchema,
  searchFormValues: Record<string, unknown> = {},
  pageParams: { current?: number; pageSize?: number } = {},
): Record<string, unknown> {
  const filters: Record<string, unknown> = { ...searchFormValues };
  const pageSize = pageParams.pageSize ?? config.page_size ?? 20;
  const current = pageParams.current ?? 1;
  filters.limit = pageSize;
  filters.offset = Math.max(0, (Number(current) - 1) * Number(pageSize));

  for (const fc of config.filters ?? []) {
    const val = searchFormValues[fc.field];
    if (fc.operator === 'between' && Array.isArray(val) && val.length === 2) {
      const fmt = (v: unknown) =>
        v && typeof (v as { format?: (s: string) => string }).format === 'function'
          ? (v as { format: (s: string) => string }).format('YYYY-MM-DD')
          : v;
      filters[`${fc.field}_start`] = fmt(val[0]);
      filters[`${fc.field}_end`] = fmt(val[1]);
    }
  }
  return filters;
}

/** 从 execute 结果计算 summary（前端兜底，后端 summary 优先） */
export function computeSummaryFromRows(
  rows: Record<string, unknown>[],
  summaryFields: string[],
): Record<string, number> {
  const summary: Record<string, number> = {};
  for (const field of summaryFields) {
    summary[field] = rows.reduce((acc, row) => {
      const v = row[field];
      const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
      return acc + (Number.isFinite(n) ? n : 0);
    }, 0);
  }
  return summary;
}
