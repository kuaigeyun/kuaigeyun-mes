/**
 * 快格轻制造 APP 入口文件
 *
 * 路由级代码分割：各页面使用 React.lazy 按需加载，避免 70+ 页面打包成单一 10MB chunk
 *
 * 路由约定（与 pages/ 一一对应，无重复）：
 * - 文件: pages/{path}/index.tsx
 * - Route path: {path}
 * - 完整 URL: /apps/kuaizhizao/{path}
 */

import React, { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import PageSkeleton from '../../components/page-skeleton';
import PlaceholderPage from './components/PlaceholderPage';

/** 页面懒加载包装：Suspense + PageSkeleton fallback */
const withPageSuspense = (LazyComponent: React.LazyExoticComponent<React.ComponentType<any>>) => (
  <Suspense fallback={<PageSkeleton />}><LazyComponent /></Suspense>
);

// 计划管理页面
const DemandManagementPage = lazy(() => import('./pages/plan-management/demand-management'));
const DemandComputationPage = lazy(() => import('./pages/plan-management/demand-computation'));
const ComputationConfigPage = lazy(() => import('./pages/plan-management/computation-config'));
const SchedulingPage = lazy(() => import('./pages/plan-management/scheduling'));

// 生产执行页面
const WorkOrdersPage = lazy(() => import('./pages/production-execution/work-orders'));
const WorkOrdersTerminalPage = lazy(() => import('./pages/production-execution/work-orders/kiosk'));
const WorkOrderDetailKioskPage = lazy(() => import('./pages/production-execution/work-orders/detail-kiosk'));
const ReportingPage = lazy(() => import('./pages/production-execution/reporting'));
const ReportingKioskPage = lazy(() => import('./pages/production-execution/reporting/kiosk'));
const ReportingStatisticsPage = lazy(() => import('./pages/production-execution/reporting/statistics'));
const SOPViewerKioskPage = lazy(() => import('./pages/production-execution/sop-viewer/kiosk'));
const DrawingViewerKioskPage = lazy(() => import('./pages/production-execution/drawing-viewer/kiosk'));
const ProgramViewerKioskPage = lazy(() => import('./pages/production-execution/program-viewer/kiosk'));
const ReworkOrdersPage = lazy(() => import('./pages/production-execution/rework-orders'));
const OutsourceManagementPage = lazy(() => import('./pages/production-execution/outsource-management'));

// 采购管理页面
const PurchaseOrdersPage = lazy(() => import('./pages/purchase-management/purchase-orders'));
const PurchaseRequisitionsPage = lazy(() => import('./pages/purchase-management/purchase-requisitions'));
const ReceiptNoticesPage = lazy(() => import('./pages/purchase-management/receipt-notices'));
const LogisticsTrackingPage = lazy(() => import('./pages/purchase-management/logistics-tracking'));

// 销售管理页面
const SalesForecastsPage = lazy(() => import('./pages/sales-management/sales-forecasts'));
const QuotationsPage = lazy(() => import('./pages/sales-management/quotations'));
const SalesOrdersPage = lazy(() => import('./pages/sales-management/sales-orders'));
const DeliveryNotesPage = lazy(() => import('./pages/warehouse-management/delivery-notes'));
const ShipmentNoticesPage = lazy(() => import('./pages/sales-management/shipment-notices'));
const SampleTrialsPage = lazy(() => import('./pages/sales-management/sample-trials'));

// 质量管理页面
const InspectionCenterPage = lazy(() => import('./pages/quality-management/inspection-center'));
const IncomingInspectionPage = lazy(() => import('./pages/quality-management/incoming-inspection'));
const ProcessInspectionPage = lazy(() => import('./pages/quality-management/process-inspection'));
const FinishedGoodsInspectionPage = lazy(() => import('./pages/quality-management/finished-goods-inspection'));
const TraceabilityPage = lazy(() => import('./pages/quality-management/traceability'));
const InspectionPlansPage = lazy(() => import('./pages/quality-management/inspection-plans'));

// 设备管理页面
const EquipmentPage = lazy(() => import('./pages/equipment-management/equipment'));
const EquipmentFaultsPage = lazy(() => import('./pages/equipment-management/equipment-faults'));
const MaintenancePlansPage = lazy(() => import('./pages/equipment-management/maintenance-plans'));
const MoldsPage = lazy(() => import('./pages/equipment-management/molds'));
const ToolLedgerPage = lazy(() => import('./pages/equipment-management/tool-ledger'));
const EquipmentStatusPage = lazy(() => import('./pages/equipment-management/equipment-status'));
const MaintenanceRemindersPage = lazy(() => import('./pages/equipment-management/maintenance-reminders'));
const MoldUsagesPage = lazy(() => import('./pages/equipment-management/mold-usages'));
const MoldCalibrationsPage = lazy(() => import('./pages/equipment-management/mold-calibrations'));
const MoldMaintenanceRemindersPage = lazy(() => import('./pages/equipment-management/mold-maintenance-reminders'));
const ToolUsagesPage = lazy(() => import('./pages/equipment-management/tool-usages'));
const ToolMaintenancesPage = lazy(() => import('./pages/equipment-management/tool-maintenances'));
const ToolCalibrationsPage = lazy(() => import('./pages/equipment-management/tool-calibrations'));
const ToolMaintenanceRemindersPage = lazy(() => import('./pages/equipment-management/tool-maintenance-reminders'));

// 财务管理（发票、应收应付已迁至 kuaicaiwu）

// 仓储管理页面
const InventoryPage = lazy(() => import('./pages/warehouse-management/inventory'));
const InboundPage = lazy(() => import('./pages/warehouse-management/inbound'));
const OtherInboundPage = lazy(() => import('./pages/warehouse-management/other-inbound'));
const OtherOutboundPage = lazy(() => import('./pages/warehouse-management/other-outbound'));
const MaterialBorrowsPage = lazy(() => import('./pages/warehouse-management/material-borrows'));
const MaterialReturnsPage = lazy(() => import('./pages/warehouse-management/material-returns'));
const InitialDataImportPage = lazy(() => import('./pages/warehouse-management/initial-data'));
const OutboundPage = lazy(() => import('./pages/warehouse-management/outbound'));
const CustomerMaterialRegistrationPage = lazy(() => import('./pages/warehouse-management/customer-material-registration'));
const BarcodeMappingRulesPage = lazy(() => import('./pages/warehouse-management/barcode-mapping-rules'));
const MaterialShortageExceptionsPage = lazy(() => import('./pages/production-execution/material-shortage-exceptions'));
const DeliveryDelayExceptionsPage = lazy(() => import('./pages/production-execution/delivery-delay-exceptions'));
const QualityExceptionsPage = lazy(() => import('./pages/production-execution/quality-exceptions'));
const ExceptionStatisticsPage = lazy(() => import('./pages/production-execution/exception-statistics'));
const ExceptionProcessPage = lazy(() => import('./pages/production-execution/exception-process'));
const ReplenishmentSuggestionsPage = lazy(() => import('./pages/warehouse-management/replenishment-suggestions'));
const BatchInventoryQueryPage = lazy(() => import('./pages/warehouse-management/batch-inventory-query'));
const LineSideWarehousePage = lazy(() => import('./pages/warehouse-management/line-side-warehouse'));
const BackflushRecordsPage = lazy(() => import('./pages/warehouse-management/backflush-records'));
const StocktakingPage = lazy(() => import('./pages/warehouse-management/stocktaking'));
const InventoryTransferPage = lazy(() => import('./pages/warehouse-management/inventory-transfer'));
const AssemblyOrdersPage = lazy(() => import('./pages/warehouse-management/assembly-orders'));
const BatchingCenterPage = lazy(() => import('./pages/warehouse-management/batching-center'));
const MaterialCallsPage = lazy(() => import('./pages/warehouse-management/material-calls'));
const DisassemblyOrdersPage = lazy(() => import('./pages/warehouse-management/disassembly-orders'));
const InventoryAlertPage = lazy(() => import('./pages/warehouse-management/inventory-alert'));
const PackingBindingPage = lazy(() => import('./pages/production-execution/packing-binding'));

// 绩效管理页面
const HolidaysPage = lazy(() => import('./pages/performance/holidays'));
const SkillsPage = lazy(() => import('./pages/performance/skills'));
const EmployeeConfigsPage = lazy(() => import('./pages/performance/employee-configs'));
const PieceRatesPage = lazy(() => import('./pages/performance/piece-rates'));
const HourlyRatesPage = lazy(() => import('./pages/performance/hourly-rates'));
const KpiDefinitionsPage = lazy(() => import('./pages/performance/kpi-definitions'));
const SummariesPage = lazy(() => import('./pages/performance/summaries'));

const KuaizhizaoApp: React.FC = () => {
  return (
    <Routes>
      {/* 计划管理路由 */}
      <Route path="plan-management/demand-management" element={withPageSuspense(DemandManagementPage)} />
      <Route path="plan-management/demand-computation" element={withPageSuspense(DemandComputationPage)} />
      <Route path="plan-management/computation-config" element={withPageSuspense(ComputationConfigPage)} />
      <Route path="plan-management/scheduling" element={withPageSuspense(SchedulingPage)} />

      {/* 采购管理路由 */}
      <Route path="purchase-management/purchase-orders" element={withPageSuspense(PurchaseOrdersPage)} />
      <Route path="purchase-management/purchase-requisitions" element={withPageSuspense(PurchaseRequisitionsPage)} />
      <Route path="purchase-management/receipt-notices" element={withPageSuspense(ReceiptNoticesPage)} />
      <Route path="purchase-management/logistics-tracking" element={withPageSuspense(LogisticsTrackingPage)} />

      {/* 生产执行路由 */}
      <Route path="production-execution/work-orders" element={withPageSuspense(WorkOrdersPage)} />
      <Route path="production-execution/terminal" element={withPageSuspense(WorkOrdersTerminalPage)} />
      <Route path="production-execution/reporting" element={withPageSuspense(ReportingPage)} />
      <Route path="production-execution/reporting/kiosk" element={withPageSuspense(ReportingKioskPage)} />
      <Route path="production-execution/reporting/statistics" element={withPageSuspense(ReportingStatisticsPage)} />
      <Route path="production-execution/sop-viewer/kiosk" element={withPageSuspense(SOPViewerKioskPage)} />
      <Route path="production-execution/drawing-viewer/kiosk" element={withPageSuspense(DrawingViewerKioskPage)} />
      <Route path="production-execution/program-viewer/kiosk" element={withPageSuspense(ProgramViewerKioskPage)} />
      <Route path="production-execution/rework-orders" element={withPageSuspense(ReworkOrdersPage)} />
      <Route path="production-execution/outsource-management" element={withPageSuspense(OutsourceManagementPage)} />
      <Route path="production-execution/packing-binding" element={withPageSuspense(PackingBindingPage)} />
      <Route path="production-execution/material-shortage-exceptions" element={withPageSuspense(MaterialShortageExceptionsPage)} />
      <Route path="production-execution/delivery-delay-exceptions" element={withPageSuspense(DeliveryDelayExceptionsPage)} />
      <Route path="production-execution/quality-exceptions" element={withPageSuspense(QualityExceptionsPage)} />
      <Route path="production-execution/exception-statistics" element={withPageSuspense(ExceptionStatisticsPage)} />
      <Route path="production-execution/exception-process" element={withPageSuspense(ExceptionProcessPage)} />

      {/* 销售管理路由 */}
      <Route path="sales-management/sales-forecasts" element={withPageSuspense(SalesForecastsPage)} />
      <Route path="sales-management/quotations" element={withPageSuspense(QuotationsPage)} />
      <Route path="sales-management/sales-orders" element={withPageSuspense(SalesOrdersPage)} />
      <Route path="sales-management/shipment-notices" element={withPageSuspense(ShipmentNoticesPage)} />
      <Route path="sales-management/sample-trials" element={withPageSuspense(SampleTrialsPage)} />

      <Route path="production-execution/work-orders/:id/kiosk" element={withPageSuspense(WorkOrderDetailKioskPage)} />

      {/* 质量管理路由 */}
      <Route path="quality-management/inspection-center" element={withPageSuspense(InspectionCenterPage)} />
      <Route path="quality-management/incoming-inspection" element={withPageSuspense(IncomingInspectionPage)} />
      <Route path="quality-management/process-inspection" element={withPageSuspense(ProcessInspectionPage)} />
      <Route path="quality-management/finished-goods-inspection" element={withPageSuspense(FinishedGoodsInspectionPage)} />
      <Route path="quality-management/traceability" element={withPageSuspense(TraceabilityPage)} />
      <Route path="quality-management/inspection-plans" element={withPageSuspense(InspectionPlansPage)} />

      {/* 设备管理路由 */}
      <Route path="equipment-management/equipment" element={withPageSuspense(EquipmentPage)} />
      <Route path="equipment-management/equipment-faults" element={withPageSuspense(EquipmentFaultsPage)} />
      <Route path="equipment-management/maintenance-plans" element={withPageSuspense(MaintenancePlansPage)} />
      <Route path="equipment-management/molds" element={withPageSuspense(MoldsPage)} />
      <Route path="equipment-management/tool-ledger" element={withPageSuspense(ToolLedgerPage)} />
      <Route path="equipment-management/equipment-status" element={withPageSuspense(EquipmentStatusPage)} />
      <Route path="equipment-management/maintenance-reminders" element={withPageSuspense(MaintenanceRemindersPage)} />
      <Route path="equipment-management/mold-usages" element={withPageSuspense(MoldUsagesPage)} />
      <Route path="equipment-management/mold-calibrations" element={withPageSuspense(MoldCalibrationsPage)} />
      <Route path="equipment-management/mold-maintenance-reminders" element={withPageSuspense(MoldMaintenanceRemindersPage)} />
      <Route path="equipment-management/tool-usages" element={withPageSuspense(ToolUsagesPage)} />
      <Route path="equipment-management/tool-maintenances" element={withPageSuspense(ToolMaintenancesPage)} />
      <Route path="equipment-management/tool-calibrations" element={withPageSuspense(ToolCalibrationsPage)} />
      <Route path="equipment-management/tool-maintenance-reminders" element={withPageSuspense(ToolMaintenanceRemindersPage)} />

      {/* 绩效管理路由 */}
      <Route path="performance/holidays" element={withPageSuspense(HolidaysPage)} />
      <Route path="performance/skills" element={withPageSuspense(SkillsPage)} />
      <Route path="performance/employee-configs" element={withPageSuspense(EmployeeConfigsPage)} />
      <Route path="performance/piece-rates" element={withPageSuspense(PieceRatesPage)} />
      <Route path="performance/hourly-rates" element={withPageSuspense(HourlyRatesPage)} />
      <Route path="performance/kpi-definitions" element={withPageSuspense(KpiDefinitionsPage)} />
      <Route path="performance/summaries" element={withPageSuspense(SummariesPage)} />

      {/* 仓储管理路由 */}
      <Route path="warehouse-management/inventory" element={withPageSuspense(InventoryPage)} />
      <Route path="warehouse-management/replenishment-suggestions" element={withPageSuspense(ReplenishmentSuggestionsPage)} />
      <Route path="warehouse-management/inbound" element={withPageSuspense(InboundPage)} />
      <Route path="warehouse-management/other-inbound" element={withPageSuspense(OtherInboundPage)} />
      <Route path="warehouse-management/other-outbound" element={withPageSuspense(OtherOutboundPage)} />
      <Route path="warehouse-management/material-borrows" element={withPageSuspense(MaterialBorrowsPage)} />
      <Route path="warehouse-management/material-returns" element={withPageSuspense(MaterialReturnsPage)} />
      <Route path="warehouse-management/outbound" element={withPageSuspense(OutboundPage)} />
      <Route path="warehouse-management/customer-material-registration" element={withPageSuspense(CustomerMaterialRegistrationPage)} />
      <Route path="warehouse-management/barcode-mapping-rules" element={withPageSuspense(BarcodeMappingRulesPage)} />
      <Route path="warehouse-management/initial-data" element={withPageSuspense(InitialDataImportPage)} />
      <Route path="warehouse-management/stocktaking" element={withPageSuspense(StocktakingPage)} />
      <Route path="warehouse-management/inventory-transfer" element={withPageSuspense(InventoryTransferPage)} />
      <Route path="warehouse-management/delivery-notes" element={withPageSuspense(DeliveryNotesPage)} />
      <Route path="warehouse-management/batching-center" element={withPageSuspense(BatchingCenterPage)} />
      <Route path="warehouse-management/material-calls" element={withPageSuspense(MaterialCallsPage)} />
      <Route path="warehouse-management/assembly-orders" element={withPageSuspense(AssemblyOrdersPage)} />
      <Route path="warehouse-management/disassembly-orders" element={withPageSuspense(DisassemblyOrdersPage)} />
      <Route path="warehouse-management/batch-inventory-query" element={withPageSuspense(BatchInventoryQueryPage)} />
      <Route path="warehouse-management/inventory-alert" element={withPageSuspense(InventoryAlertPage)} />
      <Route path="warehouse-management/line-side-warehouse" element={withPageSuspense(LineSideWarehousePage)} />
      <Route path="warehouse-management/backflush-records" element={withPageSuspense(BackflushRecordsPage)} />

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
