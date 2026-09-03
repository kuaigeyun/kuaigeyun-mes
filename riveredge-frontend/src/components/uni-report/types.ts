import type { ReactNode } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import type { StatCard } from '../layout-templates';

/** 快报表 ReportConfigSchema.extra.uni_report 段 */
export interface UniReportExtraConfig {
  templateId?: string;
  showIndexColumn?: boolean;
  showSummaryRow?: boolean;
  summaryFields?: string[];
  kpiBindings?: UniReportKpiBinding[];
}

export interface UniReportKpiBinding {
  key: string;
  title: string;
  aggregate?: 'sum' | 'count' | 'avg';
  precision?: number;
  suffix?: string;
}

export interface ReportFieldMapping {
  field: string;
  label: string;
  x_axis?: boolean;
  y_axis?: boolean;
  visible?: boolean;
  width?: number;
  format?: string;
  aggregate?: string;
}

export interface ReportFilterConfig {
  field: string;
  label: string;
  operator?: string;
  default_value?: unknown;
  required?: boolean;
  control?: string;
  options?: Array<{ label: string; value: string | number }>;
}

export interface ReportParameterConfig {
  key: string;
  label: string;
  control?: string;
  default_value?: unknown;
  required?: boolean;
  options?: Array<{ label: string; value: string | number }>;
  maps_to_filter?: string;
}

export interface ReportDrilldownConfig {
  enabled?: boolean;
  dimension_field?: string;
  detail_chart_type?: string;
  title?: string;
}

export interface ReportInteractionConfig {
  global_filter_keys?: string[];
  drilldown?: ReportDrilldownConfig;
}

/** 快报表 report_config（与后端 ReportConfigSchema 对齐） */
export interface ReportConfigSchema {
  chart_type?: string;
  dataset_uuid?: string;
  dataset_code?: string;
  fields?: ReportFieldMapping[];
  filters?: ReportFilterConfig[];
  parameters?: ReportParameterConfig[];
  interaction?: ReportInteractionConfig;
  page_size?: number;
  extra?: {
    uni_report?: UniReportExtraConfig;
    [key: string]: unknown;
  };
}

export interface UniReportTemplate {
  id: string;
  label: string;
  description?: string;
  showIndexColumn?: boolean;
  showSummaryRow?: boolean;
  summaryFields?: string[];
  tableSize?: 'small' | 'middle' | 'large';
  bordered?: boolean;
  defaultDateRangeKey?: string;
  kpiBindings?: UniReportKpiBinding[];
  columnEnhancements?: (columns: ProColumns[]) => ProColumns[];
}

export type UniReportExecuteResult<T = Record<string, unknown>> = {
  data: T[];
  total?: number;
  success?: boolean;
  summary?: Record<string, number>;
};

export type UniReportRequestFn<T = Record<string, unknown>> = (
  params: Record<string, unknown>,
  sort?: Record<string, unknown>,
  filter?: Record<string, unknown>,
  searchFormValues?: Record<string, unknown>,
) => Promise<UniReportExecuteResult<T>>;

export type UniReportExportConfig = {
  domain: string;
  reportType: string;
};

export type UniReportProps<T = Record<string, unknown>> = {
  mode?: 'page' | 'config';
  title: string;
  subtitle?: string | ((ctx: { filters?: Record<string, unknown> }) => ReactNode);
  templateId?: string;
  permissionResource?: string;
  columnPersistenceId: string;
  /** page 模式 */
  columns?: ProColumns<T>[];
  request?: UniReportRequestFn<T>;
  summaryRequest?: (filters: Record<string, unknown>) => Promise<Record<string, number>>;
  statCards?: StatCard[] | ((summary: Record<string, number>) => StatCard[]);
  exportConfig?: UniReportExportConfig;
  rowKey?: string | keyof T;
  actionRef?: React.MutableRefObject<ActionType | undefined>;
  children?: ReactNode;
  /** 功能区：模糊搜索之前（报表视图切换 Segmented） */
  beforeSearchButtons?: ReactNode;
  /** 并入 ProTable params；变更会重取（报表视图切换） */
  params?: Record<string, unknown>;
  /** 报表头左侧操作（如返回），与标题同一行 */
  headerLeft?: ReactNode;
  /** config 模式（快报表） */
  reportConfig?: ReportConfigSchema;
  reportId?: string | number;
  datasetExecute?: (filters: Record<string, unknown>) => Promise<UniReportExecuteResult<T>>;
  /** 覆盖模板默认 */
  showSummaryRow?: boolean;
  showIndexColumn?: boolean;
  summaryFields?: string[];
  showPrintButton?: boolean;
  showExportButton?: boolean;
  skipFuzzyPinyinClientFilter?: boolean;
  /** 工具栏期间筛选（默认开启 page 模式） */
  periodFilter?: boolean;
  /** 期间筛选左侧文案（如「按入库日」） */
  periodFilterLabel?: ReactNode;
  /** 列头排序/筛选（默认开启 page 模式） */
  enableColumnQuery?: boolean;
};

export type SummaryFieldMeta = {
  field: string;
  label?: string;
  format?: string;
};
