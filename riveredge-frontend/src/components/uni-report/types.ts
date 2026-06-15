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
}

/** 快报表 report_config（与后端 ReportConfigSchema 对齐） */
export interface ReportConfigSchema {
  chart_type?: string;
  dataset_uuid?: string;
  dataset_code?: string;
  fields?: ReportFieldMapping[];
  filters?: ReportFilterConfig[];
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
};

export type SummaryFieldMeta = {
  field: string;
  label?: string;
  format?: string;
};
