/**
 * 质量报表 report_type 与后端 get_quality_report 对齐
 */
export const QUALITY_REPORT_TYPES = {
  INCOMING_PASS_RATE: 'incoming_pass_rate',
  PROCESS_PASS_RATE: 'process_pass_rate',
  FINAL_PASS_RATE: 'final_pass_rate',
  QUALITY_EXCEPTION: 'quality_exception',
  NONCONFORMING_SUMMARY: 'nonconforming_summary',
  QUALITY_RATE_TREND: 'quality_rate_trend',
  DEFECT_PARETO: 'analysis',
} as const;

export type QualityReportType = (typeof QUALITY_REPORT_TYPES)[keyof typeof QUALITY_REPORT_TYPES];
