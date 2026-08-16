export { UniReport, default } from './UniReport';
export { UniReportMetaHeader } from './UniReportMetaHeader';
export { buildUniReportSummaryFooter } from './UniReportSummaryFooter';
export { UniReportChartPanel } from './UniReportChartPanel';
export {
  reportConfigToColumns,
  parseUniReportExtra,
  resolveSummaryFields,
  buildExecuteFilters,
  buildFieldMeta,
  computeSummaryFromRows,
} from './configAdapter';
export { useUniReportExport } from './useUniReportExport';
export { useUniReportPrint } from './useUniReportPrint';
export { ReportPeriodFilter, buildReportPeriodSearchSeed } from './ReportPeriodFilter';
export {
  UNI_REPORT_PAGE_SIZE_ALL,
  UNI_REPORT_PAGE_SIZE_OPTIONS,
  buildUniReportTablePagination,
} from './uniReportPagination';
export {
  resolveUniReportScrollMode,
  measureUniReportTableScroll,
  resolveUniReportTableBodyScrollY,
} from './uniReportScrollPolicy';
export type { UniReportScrollMode, UniReportTableScrollMeasure } from './uniReportScrollPolicy';
export {
  applyUniReportColumnQuery,
  parseReportColumnFilters,
  serializeReportColumnFilters,
} from './applyUniReportColumnQuery';
export type { ReportColumnFilter, ReportColumnFacets } from './applyUniReportColumnQuery';
export {
  getUniReportTemplate,
  listUniReportTemplates,
  queryTablePreset,
  inventoryLedgerPreset,
  salesAnalysisTablePreset,
  kuaireportTablePreset,
} from './templates';
export type {
  UniReportProps,
  UniReportTemplate,
  UniReportExtraConfig,
  UniReportKpiBinding,
  ReportConfigSchema,
  ReportFieldMapping,
  ReportFilterConfig,
  UniReportExportConfig,
  UniReportExecuteResult,
  UniReportRequestFn,
  SummaryFieldMeta,
} from './types';
