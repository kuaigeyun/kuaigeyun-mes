export type QualityReportKey = 'issue-report' | 'complaint-report' | 'line-stop-report';

export type QualityReportConfig = {
  dimensionTitle: string;
  dimensionColumnTitle: string;
  summaryColumnTitle: string;
};

export const QUALITY_REPORT_CONFIG: Record<QualityReportKey, QualityReportConfig> = {
  'issue-report': {
    dimensionTitle: '车间问题分布',
    dimensionColumnTitle: '责任车间',
    summaryColumnTitle: '问题描述',
  },
  'complaint-report': {
    dimensionTitle: '客户投诉分布',
    dimensionColumnTitle: '客户',
    summaryColumnTitle: '不良现象',
  },
  'line-stop-report': {
    dimensionTitle: '停线类型分布',
    dimensionColumnTitle: '停线类型',
    summaryColumnTitle: '停线原因',
  },
};
