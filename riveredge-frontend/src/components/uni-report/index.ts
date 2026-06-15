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
