/**
 * UniReport 预设模板注册表
 *
 * 用法：
 * - kuaizhizao 模块页：`<UniReport templateId="queryTable" ... />`
 * - 快报表：在 report_config.extra.uni_report.templateId 指定同一 id
 *
 * | templateId           | 场景                         |
 * |----------------------|------------------------------|
 * | queryTable           | 通用明细查询（默认）         |
 * | inventoryLedger      | 仓存/库存流水类              |
 * | salesAnalysisTable   | 销售分析、订单综合查询       |
 * | kuaireportTable      | 快报表 config 模式默认       |
 */
import type { UniReportTemplate } from '../types';
import { queryTablePreset } from './queryTablePreset';
import { inventoryLedgerPreset } from './inventoryLedgerPreset';
import { salesAnalysisTablePreset } from './salesAnalysisTablePreset';

export const kuaireportTablePreset: UniReportTemplate = {
  id: 'kuaireportTable',
  label: 'components.uniReport.template.kuaireportTable',
  description: 'components.uniReport.template.kuaireportTableDesc',
  showIndexColumn: true,
  showSummaryRow: true,
  tableSize: 'small',
  bordered: true,
};

const REGISTRY: Record<string, UniReportTemplate> = {
  queryTable: queryTablePreset,
  inventoryLedger: inventoryLedgerPreset,
  salesAnalysisTable: salesAnalysisTablePreset,
  kuaireportTable: kuaireportTablePreset,
};

export function getUniReportTemplate(templateId?: string): UniReportTemplate {
  if (!templateId) return queryTablePreset;
  return REGISTRY[templateId] ?? queryTablePreset;
}

export function listUniReportTemplates(): UniReportTemplate[] {
  return Object.values(REGISTRY);
}

export { queryTablePreset, inventoryLedgerPreset, salesAnalysisTablePreset };
