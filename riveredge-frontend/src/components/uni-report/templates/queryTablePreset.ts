import type { UniReportTemplate } from '../types';

/** 通用明细查询报表（kuaizhizao 大部分报表页默认） */
export const queryTablePreset: UniReportTemplate = {
  id: 'queryTable',
  label: 'components.uniReport.template.queryTable',
  description: 'components.uniReport.template.queryTableDesc',
  showIndexColumn: true,
  showSummaryRow: true,
  tableSize: 'small',
  bordered: true,
};
