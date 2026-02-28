/**
 * 快格轻制造 APP 入口文件
 */

import React from 'react';
import { Routes, Route } from 'react-router-dom';

// 计划管理页面（MRP/LRP 已合并为统一需求计算 demand-computation）
import DemandManagementPage from './pages/plan-management/demand-management';
import DemandComputationPage from './pages/plan-management/demand-computation';
import ComputationConfigPage from './pages/plan-management/computation-config';
import ComputationHistoryPage from './pages/plan-management/computation-history';
import ProductionPlansPage from './pages/plan-management/production-plans';
import SchedulingPage from './pages/plan-management/scheduling';

// 生产执行页面
import WorkOrdersPage from './pages/production-execution/work-orders';
import WorkOrdersTerminalPage from './pages/production-execution/work-orders/kiosk';
import WorkOrderDetailKioskPage from './pages/production-execution/work-orders/detail-kiosk';
import ReportingPage from './pages/production-execution/reporting';
import ReportingKioskPage from './pages/production-execution/reporting/kiosk';
import ReportingStatisticsPage from './pages/production-execution/reporting/statistics';
import SOPViewerKioskPage from './pages/production-execution/sop-viewer/kiosk';
import DrawingViewerKioskPage from './pages/production-execution/drawing-viewer/kiosk';
import ProgramViewerKioskPage from './pages/production-execution/program-viewer/kiosk';
import ReworkOrdersPage from './pages/production-execution/rework-orders';
// 委外管理：已统一整合至 OutsourceManagementPage，包含工序委外(OutsourceOrder)与委外工单(OutsourceWorkOrder)功能
// import OutsourceOrdersPage from './pages/production-execution/outsource-orders';
// import OutsourceWorkOrdersPage from './pages/production-execution/outsource-work-orders';
import OutsourceManagementPage from './pages/production-execution/outsource-management';

// 采购管理页面
import PurchaseOrdersPage from './pages/purchase-management/purchase-orders';
import PurchaseRequisitionsPage from './pages/purchase-management/purchase-requisitions';
import ReceiptNoticesPage from './pages/purchase-management/receipt-notices';

// 销售管理页面
// TODO: 销售预测已合并为统一需求管理，但销售订单需要独立管理
import SalesForecastsPage from './pages/sales-management/sales-forecasts';
import QuotationsPage from './pages/sales-management/quotations';
import SalesOrdersPage from './pages/sales-management/sales-orders';
import DeliveryNotesPage from './pages/warehouse-management/delivery-notes';
import ShipmentNoticesPage from './pages/sales-management/shipment-notices';
import SampleTrialsPage from './pages/sales-management/sample-trials';

// 质量管理页面
import IncomingInspectionPage from './pages/quality-management/incoming-inspection';
import ProcessInspectionPage from './pages/quality-management/process-inspection';
import FinishedGoodsInspectionPage from './pages/quality-management/finished-goods-inspection';
import TraceabilityPage from './pages/quality-management/traceability';
import InspectionPlansPage from './pages/quality-management/inspection-plans';

// 成本管理页面
import CostRulesPage from './pages/cost-management/cost-rules';
import CostCalculationsPage from './pages/cost-management/cost-calculations';
import CostDetailsPage from './pages/cost-management/cost-details';
import CostComparisonPage from './pages/cost-management/cost-comparison';
import CostOptimizationPage from './pages/cost-management/cost-optimization';
import CostReportPage from './pages/cost-management/cost-report';

// 设备管理页面
import EquipmentPage from './pages/equipment-management/equipment';
import EquipmentFaultsPage from './pages/equipment-management/equipment-faults';
import MaintenancePlansPage from './pages/equipment-management/maintenance-plans';
import MoldsPage from './pages/equipment-management/molds';
import ToolLedgerPage from './pages/equipment-management/tool-ledger';
import EquipmentStatusPage from './pages/equipment-management/equipment-status';
import MaintenanceRemindersPage from './pages/equipment-management/maintenance-reminders';
import MoldUsagesPage from './pages/equipment-management/mold-usages';
import MoldCalibrationsPage from './pages/equipment-management/mold-calibrations';
import MoldMaintenanceRemindersPage from './pages/equipment-management/mold-maintenance-reminders';
import ToolUsagesPage from './pages/equipment-management/tool-usages';
import ToolMaintenancesPage from './pages/equipment-management/tool-maintenances';
import ToolCalibrationsPage from './pages/equipment-management/tool-calibrations';
import ToolMaintenanceRemindersPage from './pages/equipment-management/tool-maintenance-reminders';

// 财务管理页面
import InvoiceListPage from './pages/finance-management/invoices';
import InvoiceDetailPage from './pages/finance-management/invoices/detail';
import PayableListPage from './pages/finance-management/payables';
import PayableDetailPage from './pages/finance-management/payables/detail';
import ReceivableListPage from './pages/finance-management/receivables';
import ReceivableDetailPage from './pages/finance-management/receivables/detail';

// 仓储管理页面
import InventoryPage from './pages/warehouse-management/inventory';
import InboundPage from './pages/warehouse-management/inbound';
import OtherInboundPage from './pages/warehouse-management/other-inbound';
import OtherOutboundPage from './pages/warehouse-management/other-outbound';
import MaterialBorrowsPage from './pages/warehouse-management/material-borrows';
import MaterialReturnsPage from './pages/warehouse-management/material-returns';
import InitialDataImportPage from './pages/warehouse-management/initial-data';
import OutboundPage from './pages/warehouse-management/outbound';
import CustomerMaterialRegistrationPage from './pages/warehouse-management/customer-material-registration';
import BarcodeMappingRulesPage from './pages/warehouse-management/barcode-mapping-rules';
import DocumentTimingPage from './pages/analysis-center/document-timing';
import DocumentEfficiencyPage from './pages/analysis-center/document-efficiency';
import MaterialShortageExceptionsPage from './pages/production-execution/material-shortage-exceptions';
import DeliveryDelayExceptionsPage from './pages/production-execution/delivery-delay-exceptions';
import QualityExceptionsPage from './pages/production-execution/quality-exceptions';
import ExceptionStatisticsPage from './pages/production-execution/exception-statistics';
import ExceptionProcessPage from './pages/production-execution/exception-process';
import ReplenishmentSuggestionsPage from './pages/warehouse-management/replenishment-suggestions';
import BatchInventoryQueryPage from './pages/warehouse-management/batch-inventory-query';
import LineSideWarehousePage from './pages/warehouse-management/line-side-warehouse';
import BackflushRecordsPage from './pages/warehouse-management/backflush-records';
import StocktakingPage from './pages/warehouse-management/stocktaking';
import InventoryTransferPage from './pages/warehouse-management/inventory-transfer';
import AssemblyOrdersPage from './pages/warehouse-management/assembly-orders';
import BatchingCenterPage from './pages/warehouse-management/batching-center';
import DisassemblyOrdersPage from './pages/warehouse-management/disassembly-orders';
import InventoryAlertPage from './pages/warehouse-management/inventory-alert';
import PackingBindingPage from './pages/production-execution/packing-binding';
import PlaceholderPage from './components/PlaceholderPage';

// 绩效管理页面
import HolidaysPage from './pages/performance/holidays';
import SkillsPage from './pages/performance/skills';
import EmployeeConfigsPage from './pages/performance/employee-configs';
import PieceRatesPage from './pages/performance/piece-rates';
import HourlyRatesPage from './pages/performance/hourly-rates';
import KpiDefinitionsPage from './pages/performance/kpi-definitions';
import SummariesPage from './pages/performance/summaries';

const KuaizhizaoApp: React.FC = () => {
  return (
    <Routes>
      {/* 计划管理路由 */}
      <Route path="plan-management/demand-management" element={<DemandManagementPage />} />
      <Route path="plan-management/demand-computation" element={<DemandComputationPage />} />
      <Route path="plan-management/computation-config" element={<ComputationConfigPage />} />
      <Route path="plan-management/computation-history" element={<ComputationHistoryPage />} />
      <Route path="plan-management/production-plans" element={<ProductionPlansPage />} />
      <Route path="plan-management/scheduling" element={<SchedulingPage />} />

      {/* 采购管理路由 */}
      <Route path="purchase-management/purchase-orders" element={<PurchaseOrdersPage />} />
      <Route path="purchase-management/purchase-requisitions" element={<PurchaseRequisitionsPage />} />
      <Route path="purchase-management/receipt-notices" element={<ReceiptNoticesPage />} />

      {/* 生产执行路由 */}
      <Route path="production-execution/work-orders" element={<WorkOrdersPage />} />
      <Route path="production-execution/terminal" element={<WorkOrdersTerminalPage />} />
      <Route path="production-execution/reporting" element={<ReportingPage />} />
      <Route path="production-execution/reporting/kiosk" element={<ReportingKioskPage />} />
      <Route path="production-execution/reporting/statistics" element={<ReportingStatisticsPage />} />
      <Route path="production-execution/sop-viewer/kiosk" element={<SOPViewerKioskPage />} />
      <Route path="production-execution/drawing-viewer/kiosk" element={<DrawingViewerKioskPage />} />
      <Route path="production-execution/program-viewer/kiosk" element={<ProgramViewerKioskPage />} />
      <Route path="production-execution/rework-orders" element={<ReworkOrdersPage />} />
      {/* 委外管理：整合工序委外与委外工单，路由 /outsource-management */}
      <Route path="production-execution/outsource-management" element={<OutsourceManagementPage />} />
      <Route path="production-execution/packing-binding" element={<PackingBindingPage />} />
      <Route path="production-execution/material-shortage-exceptions" element={<MaterialShortageExceptionsPage />} />
      <Route path="production-execution/delivery-delay-exceptions" element={<DeliveryDelayExceptionsPage />} />
      <Route path="production-execution/quality-exceptions" element={<QualityExceptionsPage />} />
      <Route path="production-execution/exception-statistics" element={<ExceptionStatisticsPage />} />
      <Route path="production-execution/exception-process" element={<ExceptionProcessPage />} />

      {/* 销售管理路由 */}
      {/* TODO: 销售预测已合并为统一需求管理，但销售订单需要独立管理 */}
      <Route path="sales-management/sales-forecasts" element={<SalesForecastsPage />} />
      <Route path="sales-management/quotations" element={<QuotationsPage />} />
      <Route path="sales-management/sales-orders" element={<SalesOrdersPage />} />
      <Route path="sales-management/shipment-notices" element={<ShipmentNoticesPage />} />
      <Route path="sales-management/sample-trials" element={<SampleTrialsPage />} />
      
      <Route path="production-execution/work-orders/:id/kiosk" element={<WorkOrderDetailKioskPage />} />

      {/* 质量管理路由 */}
      <Route path="quality-management/incoming-inspection" element={<IncomingInspectionPage />} />
      <Route path="quality-management/process-inspection" element={<ProcessInspectionPage />} />
      <Route path="quality-management/finished-goods-inspection" element={<FinishedGoodsInspectionPage />} />
      <Route path="quality-management/traceability" element={<TraceabilityPage />} />
      <Route path="quality-management/inspection-plans" element={<InspectionPlansPage />} />

      {/* 成本管理路由 */}
      <Route path="cost-management/cost-rules" element={<CostRulesPage />} />
      <Route path="cost-management/cost-calculations" element={<CostCalculationsPage />} />
      <Route path="cost-management/cost-details" element={<CostDetailsPage />} />
      <Route path="cost-management/cost-comparison" element={<CostComparisonPage />} />
      <Route path="cost-management/cost-optimization" element={<CostOptimizationPage />} />
      <Route path="cost-management/cost-report" element={<CostReportPage />} />

      {/* 设备管理路由 */}
      <Route path="equipment-management/equipment" element={<EquipmentPage />} />
      <Route path="equipment-management/equipment-faults" element={<EquipmentFaultsPage />} />
      <Route path="equipment-management/maintenance-plans" element={<MaintenancePlansPage />} />
      <Route path="equipment-management/molds" element={<MoldsPage />} />
      <Route path="equipment-management/tool-ledger" element={<ToolLedgerPage />} />
      <Route path="equipment-management/equipment-status" element={<EquipmentStatusPage />} />
      <Route path="equipment-management/maintenance-reminders" element={<MaintenanceRemindersPage />} />
      <Route path="equipment-management/mold-usages" element={<MoldUsagesPage />} />
      <Route path="equipment-management/mold-calibrations" element={<MoldCalibrationsPage />} />
      <Route path="equipment-management/mold-maintenance-reminders" element={<MoldMaintenanceRemindersPage />} />
      <Route path="equipment-management/tool-usages" element={<ToolUsagesPage />} />
      <Route path="equipment-management/tool-maintenances" element={<ToolMaintenancesPage />} />
      <Route path="equipment-management/tool-calibrations" element={<ToolCalibrationsPage />} />
      <Route path="equipment-management/tool-maintenance-reminders" element={<ToolMaintenanceRemindersPage />} />

      {/* 财务管理路由 */}
      <Route path="finance-management/invoices" element={<InvoiceListPage />} />
      <Route path="finance-management/invoices/:code" element={<InvoiceDetailPage />} />
      <Route path="finance-management/sales-invoices" element={<InvoiceListPage />} /> {/* Alias or same component with filter handled in URL/State */}
      <Route path="finance-management/purchase-invoices" element={<InvoiceListPage />} />

      <Route path="finance-management/payables" element={<PayableListPage />} />
      <Route path="finance-management/payables/:id" element={<PayableDetailPage />} />
      <Route path="finance-management/payments" element={<PayableListPage />} /> {/* Shortcut to payment records if needed, for now reuse list */}

      <Route path="finance-management/receivables" element={<ReceivableListPage />} />
      <Route path="finance-management/receivables/:id" element={<ReceivableDetailPage />} />
      <Route path="finance-management/receipts" element={<ReceivableListPage />} />

      {/* 绩效管理路由 */}
      <Route path="performance/holidays" element={<HolidaysPage />} />
      <Route path="performance/skills" element={<SkillsPage />} />
      <Route path="performance/employee-configs" element={<EmployeeConfigsPage />} />
      <Route path="performance/piece-rates" element={<PieceRatesPage />} />
      <Route path="performance/hourly-rates" element={<HourlyRatesPage />} />
      <Route path="performance/kpi-definitions" element={<KpiDefinitionsPage />} />
      <Route path="performance/summaries" element={<SummariesPage />} />

      {/* 分析中心路由 */}
      <Route path="analysis-center/document-timing" element={<DocumentTimingPage />} />
      <Route path="analysis-center/document-efficiency" element={<DocumentEfficiencyPage />} />

      {/* 仓储管理路由 */}
      <Route path="warehouse-management/inventory" element={<InventoryPage />} />
      <Route path="warehouse-management/replenishment-suggestions" element={<ReplenishmentSuggestionsPage />} />
      <Route path="warehouse-management/inbound" element={<InboundPage />} />
      <Route path="warehouse-management/other-inbound" element={<OtherInboundPage />} />
      <Route path="warehouse-management/other-outbound" element={<OtherOutboundPage />} />
      <Route path="warehouse-management/material-borrows" element={<MaterialBorrowsPage />} />
      <Route path="warehouse-management/material-returns" element={<MaterialReturnsPage />} />
      <Route path="warehouse-management/outbound" element={<OutboundPage />} />
      <Route path="warehouse-management/customer-material-registration" element={<CustomerMaterialRegistrationPage />} />
      <Route path="warehouse-management/barcode-mapping-rules" element={<BarcodeMappingRulesPage />} />
      <Route path="warehouse-management/initial-data" element={<InitialDataImportPage />} />
      <Route path="warehouse-management/stocktaking" element={<StocktakingPage />} />
      <Route path="warehouse-management/inventory-transfer" element={<InventoryTransferPage />} />
      <Route path="warehouse-management/delivery-notes" element={<DeliveryNotesPage />} />
      <Route path="warehouse-management/batching-center" element={<BatchingCenterPage />} />
      <Route path="warehouse-management/assembly-orders" element={<AssemblyOrdersPage />} />
      <Route path="warehouse-management/disassembly-orders" element={<DisassemblyOrdersPage />} />
      <Route path="warehouse-management/batch-inventory-query" element={<BatchInventoryQueryPage />} />
      <Route path="warehouse-management/inventory-alert" element={<InventoryAlertPage />} />
      <Route path="warehouse-management/line-side-warehouse" element={<LineSideWarehousePage />} />
      <Route path="warehouse-management/backflush-records" element={<BackflushRecordsPage />} />

      {/* 报表路由（占位） */}
      <Route path="sales-management/reports/sales-order-query" element={<PlaceholderPage title="销售订单综合查询" />} />
      <Route path="sales-management/reports/order-execution-tracking" element={<PlaceholderPage title="销售订单执行跟踪" />} />
      <Route path="sales-management/reports/customer-sales-summary" element={<PlaceholderPage title="客户销售业绩汇总" />} />
      <Route path="sales-management/reports/customer-sales-reconciliation" element={<PlaceholderPage title="客户销售明细对账" />} />
      <Route path="sales-management/reports/product-sales-ranking" element={<PlaceholderPage title="产品销售排行榜" />} />
      <Route path="sales-management/reports/forecast-vs-actual" element={<PlaceholderPage title="销售预测与实际对比" />} />
      <Route path="sales-management/reports/quotation-query" element={<PlaceholderPage title="报价单综合查询" />} />
      <Route path="sales-management/reports/sample-trial-query" element={<PlaceholderPage title="样品试用单综合查询" />} />
      <Route path="plan-management/reports/demand-plan-detail" element={<PlaceholderPage title="需求计划明细表" />} />
      <Route path="plan-management/reports/production-plan-comparison" element={<PlaceholderPage title="生产计划下达与完成对比" />} />
      <Route path="plan-management/reports/purchase-plan-comparison" element={<PlaceholderPage title="采购计划下达与完成对比" />} />
      <Route path="plan-management/reports/capacity-load-analysis" element={<PlaceholderPage title="产能负荷分析" />} />
      <Route path="plan-management/reports/material-shortage-alert" element={<PlaceholderPage title="物料缺口/短缺预警" />} />
      <Route path="purchase-management/reports/purchase-requisition-tracking" element={<PlaceholderPage title="采购申请状态跟踪" />} />
      <Route path="purchase-management/reports/purchase-order-query" element={<PlaceholderPage title="采购订单综合查询" />} />
      <Route path="purchase-management/reports/purchase-order-progress" element={<PlaceholderPage title="采购订单执行进度" />} />
      <Route path="purchase-management/reports/supplier-delivery-summary" element={<PlaceholderPage title="供应商交货明细与统计" />} />
      <Route path="purchase-management/reports/supplier-price-comparison" element={<PlaceholderPage title="供应商价格对比分析" />} />
      <Route path="purchase-management/reports/purchase-reconciliation" element={<PlaceholderPage title="采购对账" />} />
      <Route path="purchase-management/reports/supplier-quality-rate" element={<PlaceholderPage title="供应商到货质量合格率" />} />
      <Route path="production-execution/reports/work-order-query" element={<PlaceholderPage title="工单综合查询" />} />
      <Route path="production-execution/reports/work-order-tracking" element={<PlaceholderPage title="工单状态跟踪" />} />
      <Route path="production-execution/reports/work-order-material-usage" element={<PlaceholderPage title="工单物料耗用明细" />} />
      <Route path="production-execution/reports/work-order-labor-detail" element={<PlaceholderPage title="工单工时/报工明细" />} />
      <Route path="production-execution/reports/production-efficiency" element={<PlaceholderPage title="生产效率分析" />} />
      <Route path="production-execution/reports/process-progress-detail" element={<PlaceholderPage title="工序生产进度明细" />} />
      <Route path="production-execution/reports/rework-order-analysis" element={<PlaceholderPage title="返工工单综合查询" />} />
      <Route path="production-execution/reports/outsource-order-query" element={<PlaceholderPage title="委外工单综合查询" />} />
      <Route path="production-execution/reports/outsource-material-reconciliation" element={<PlaceholderPage title="委外工单发料与收货对账" />} />
      <Route path="production-execution/reports/wip-inventory" element={<PlaceholderPage title="车间在制品盘点" />} />
      <Route path="quality-management/reports/incoming-inspection-report" element={<PlaceholderPage title="来料检验报告查询与统计" />} />
      <Route path="quality-management/reports/process-inspection-report" element={<PlaceholderPage title="过程检验报告查询与统计" />} />
      <Route path="quality-management/reports/finished-inspection-report" element={<PlaceholderPage title="成品检验报告查询与统计" />} />
      <Route path="quality-management/reports/quality-exception-tracking" element={<PlaceholderPage title="质量异常处理跟踪" />} />
      <Route path="quality-management/reports/nonconforming-summary" element={<PlaceholderPage title="不合格品处理汇总" />} />
      <Route path="quality-management/reports/quality-rate-trend" element={<PlaceholderPage title="质量合格率趋势" />} />
      <Route path="equipment-management/reports/equipment-maintenance-detail" element={<PlaceholderPage title="设备维修记录明细" />} />
      <Route path="equipment-management/reports/equipment-maintenance-plan" element={<PlaceholderPage title="设备保养计划与执行" />} />
      <Route path="equipment-management/reports/equipment-fault-analysis" element={<PlaceholderPage title="设备故障统计" />} />
      <Route path="equipment-management/reports/equipment-status-log" element={<PlaceholderPage title="设备运行状态日志" />} />
      <Route path="warehouse-management/reports/inventory-summary" element={<PlaceholderPage title="库存收发存汇总" />} />
      <Route path="warehouse-management/reports/inventory-ledger" element={<PlaceholderPage title="库存收发存明细" />} />
      <Route path="warehouse-management/reports/inventory-age-analysis" element={<PlaceholderPage title="库龄分析" />} />
      <Route path="warehouse-management/reports/slow-moving-inventory" element={<PlaceholderPage title="呆滞物料统计" />} />
      <Route path="warehouse-management/reports/inbound-summary" element={<PlaceholderPage title="入库明细汇总" />} />
      <Route path="warehouse-management/reports/outbound-summary" element={<PlaceholderPage title="出库明细汇总" />} />
      <Route path="warehouse-management/reports/stocktaking-history" element={<PlaceholderPage title="盘点单历史与差异" />} />
      <Route path="warehouse-management/reports/transfer-tracking" element={<PlaceholderPage title="调拨单跟踪" />} />
      <Route path="finance-management/reports/receivable-age-analysis" element={<PlaceholderPage title="应收账款账龄分析" />} />
      <Route path="finance-management/reports/receivable-reconciliation" element={<PlaceholderPage title="应收账款对账" />} />
      <Route path="finance-management/reports/sales-receipt-detail" element={<PlaceholderPage title="销售回款明细" />} />
      <Route path="finance-management/reports/payable-age-analysis" element={<PlaceholderPage title="应付账款账龄分析" />} />
      <Route path="finance-management/reports/payable-reconciliation" element={<PlaceholderPage title="应付账款对账" />} />
      <Route path="finance-management/reports/three-way-match" element={<PlaceholderPage title="三单匹配" />} />
      <Route path="analysis-center/reports/sales-order-full-trace" element={<PlaceholderPage title="销售订单全链路跟踪" />} />
      <Route path="analysis-center/reports/purchase-order-full-trace" element={<PlaceholderPage title="采购订单全链路跟踪" />} />
      <Route path="analysis-center/reports/material-lifecycle-trace" element={<PlaceholderPage title="物料全生命周期跟踪" />} />
      <Route path="analysis-center/reports/business-status-dashboard" element={<PlaceholderPage title="业务单据状态看板" />} />

      {/* 默认路由 - 应用首页 */}
      <Route path="" element={
        <div style={{ padding: '24px', textAlign: 'center' }}>
          <h2>快格轻制造</h2>
          <p>轻量级MES系统 - 专注生产执行核心流程</p>
        </div>
      } />
    </Routes>
  );
};

export default KuaizhizaoApp;
