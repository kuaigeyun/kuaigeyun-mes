import type { ProColumns } from '@ant-design/pro-components';
import type { UniReportTemplate } from '../types';

/** 仓存类：强调批次/库位列宽、数量合计 */
export const inventoryLedgerPreset: UniReportTemplate = {
  id: 'inventoryLedger',
  label: 'components.uniReport.template.inventoryLedger',
  description: 'components.uniReport.template.inventoryLedgerDesc',
  showIndexColumn: true,
  showSummaryRow: true,
  summaryFields: ['opening_qty', 'inbound_qty', 'outbound_qty', 'closing_qty'],
  tableSize: 'small',
  bordered: true,
  kpiBindings: [
    { key: 'total_materials', title: 'components.uniReport.kpi.totalMaterials' },
    { key: 'total_quantity', title: 'components.uniReport.kpi.totalQuantity', precision: 2 },
    { key: 'low_stock_count', title: 'components.uniReport.kpi.lowStock' },
    { key: 'out_of_stock_count', title: 'components.uniReport.kpi.outOfStock' },
  ],
  columnEnhancements: (columns: ProColumns[]) =>
    columns.map((col) => {
      const idx = col.dataIndex as string;
      if (idx === 'warehouse_name' || idx === 'batch_no') {
        return { ...col, width: col.width ?? 160, ellipsis: true };
      }
      if (idx === 'material_name') {
        return { ...col, width: col.width ?? 200, ellipsis: true };
      }
      return col;
    }),
};
