/**
 * 质量报表 report_type 与后端 get_quality_report 对齐
 */
export const QUALITY_REPORT_TYPES = {
  INCOMING_PASS_RATE: 'incoming_pass_rate',
  OUTSOURCE_PASS_RATE: 'outsource_pass_rate',
  PROCESS_PASS_RATE: 'process_pass_rate',
  FINAL_PASS_RATE: 'final_pass_rate',
  PATROL_PASS_RATE: 'patrol_pass_rate',
  QUALITY_EXCEPTION: 'quality_exception',
  NONCONFORMING_SUMMARY: 'nonconforming_summary',
  QUALITY_RATE_TREND: 'quality_rate_trend',
  DEFECT_PARETO: 'analysis',
  COMPLAINT_MONTHLY_LIST: 'complaint_monthly_list',
  COMPLAINT_DEFECT_DISTRIBUTION: 'complaint_defect_distribution',
  COMPLAINT_SUPPLIER_RANK: 'complaint_supplier_rank',
  COMPLAINT_SUPPLIER_TREND: 'complaint_supplier_trend',
  COMPLAINT_ALERT: 'complaint_alert',
  COMPLAINT_BATCH_RATE: 'complaint_batch_rate',
} as const;

export type QualityReportType = (typeof QUALITY_REPORT_TYPES)[keyof typeof QUALITY_REPORT_TYPES];
