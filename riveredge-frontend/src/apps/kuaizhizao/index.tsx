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
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import PageSkeleton from '../../components/page-skeleton';

/** 页面懒加载包装：Suspense + Spin fallback */
const withPageSuspense = (LazyComponent: React.LazyExoticComponent<React.ComponentType<any>>) => (
  <Suspense fallback={<PageSkeleton variant="content" />}>
    <LazyComponent />
  </Suspense>
);

// 计划管理页面
const DemandManagementPage = lazy(() => import('./pages/plan-management/demand-management'));
const DemandComputationPage = lazy(() => import('./pages/plan-management/demand-computation'));
const DemandReplanDashboardPage = lazy(() => import('./pages/plan-management/demand-replan-dashboard'));
const SchedulingPage = lazy(() => import('./pages/plan-management/scheduling'));
const RollingSchedulingPage = lazy(() => import('./pages/plan-management/rolling-scheduling'));
const ProductionControlTower = lazy(() => import('./pages/plan-management/production-plans/ProductionControlTower'));
const MESDashboard = lazy(() => import('./pages/dashboard'));

// 生产执行页面
const ManufacturingDashboardPage = lazy(() => import('./pages/production-execution/dashboard'));
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
const PurchaseDashboardPage = lazy(() => import('./pages/purchase-management/dashboard'));
const PurchaseOrdersPage = lazy(() => import('./pages/purchase-management/purchase-orders'));
const PurchaseOrderChangesPage = lazy(() => import('./pages/purchase-management/purchase-order-changes'));
const PurchaseRequisitionsPage = lazy(() => import('./pages/purchase-management/purchase-requisitions'));
const PurchaseInquiriesPage = lazy(() => import('./pages/purchase-management/purchase-inquiries'));
const ReceiptNoticesPage = lazy(() => import('./pages/purchase-management/receipt-notices'));
const PurchaseReturnsPage = lazy(() => import('./pages/purchase-management/purchase-returns'));

// 销售管理页面
const SalesDashboardPage = lazy(() => import('./pages/sales-management/dashboard'));
const CustomerPoolPage = lazy(() => import('./pages/sales-management/customer-pool'));
const SalesForecastsPage = lazy(() => import('./pages/sales-management/sales-forecasts'));
const QuotationsPage = lazy(() => import('./pages/sales-management/quotations'));
const SalesContractsPage = lazy(() => import('./pages/sales-management/sales-contracts'));
const SalesOrdersPage = lazy(() => import('./pages/sales-management/sales-orders'));
const SalesOrderChangesPage = lazy(() => import('./pages/sales-management/sales-order-changes'));
const DeliveryNotesPage = lazy(() => import('./pages/warehouse-management/delivery-notes'));
const ShipmentNoticesPage = lazy(() => import('./pages/sales-management/shipment-notices'));
const CustomerFollowUpsPage = lazy(() => import('./pages/sales-management/customer-follow-ups'));
const SalesReturnsPage = lazy(() => import('./pages/sales-management/sales-returns'));

// 质量管理页面
const InspectionCenterPage = lazy(() => import('./pages/quality-management/inspection-center'));
const IncomingInspectionPage = lazy(() => import('./pages/quality-management/incoming-inspection'));
const ProcessInspectionPage = lazy(() => import('./pages/quality-management/process-inspection'));
const FinishedGoodsInspectionPage = lazy(() => import('./pages/quality-management/finished-goods-inspection'));
const TraceabilityPage = lazy(() => import('./pages/quality-management/traceability'));
const InspectionPlansPage = lazy(() => import('./pages/quality-management/inspection-plans'));
const NonconformingLedgerPage = lazy(() => import('./pages/quality-management/nonconforming-ledger'));
const EightDReportsPage = lazy(() => import('./pages/quality-management/eight-d-reports'));
const OQCInspectionPage = lazy(() => import('./pages/quality-management/oqc-inspection'));
const SPCMonitorPage = lazy(() => import('./pages/quality-management/spc-monitor'));

// 设备管理页面
const EquipmentDashboardPage = lazy(() => import('./pages/equipment-management/dashboard'));
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

// 设备点检与备件
const EquipmentInspectionPage = lazy(() => import('./pages/equipment-management/inspection'));
const SparePartsPage = lazy(() => import('./pages/equipment-management/spare-parts'));

// 成本管理（分析中心已迁至快报表 kuaireport）
const CostCalculationsPage = lazy(() => import('./pages/cost-management/cost-calculations'));
const CostCenterDashboardPage = lazy(() => import('./pages/cost-management/dashboard'));
const CostComparisonPage = lazy(() => import('./pages/cost-management/cost-comparison'));
const CostRulesPage = lazy(() => import('./pages/cost-management/cost-rules'));
const CostDetailsPage = lazy(() => import('./pages/cost-management/cost-details'));
const CostOptimizationPage = lazy(() => import('./pages/cost-management/cost-optimization'));
const CostReportPage = lazy(() => import('./pages/cost-management/cost-report'));

// 仓储管理页面
const WarehouseDashboard = lazy(() => import('./pages/warehouse-management/dashboard'));
const InventoryPage = lazy(() => import('./pages/warehouse-management/inventory'));
const InboundPage = lazy(() => import('./pages/warehouse-management/inbound'));
const InboundPoPullEntryPage = lazy(() => import('./pages/warehouse-management/inbound/InboundPoPullEntryPage'));
const InboundWorkOrderPullEntryPage = lazy(() => import('./pages/warehouse-management/inbound/InboundWorkOrderPullEntryPage'));
const InboundSalesReturnPullEntryPage = lazy(() => import('./pages/warehouse-management/inbound/InboundSalesReturnPullEntryPage'));
const InboundProductionReturnPullEntryPage = lazy(() => import('./pages/warehouse-management/inbound/InboundProductionReturnPullEntryPage'));
const InboundOutsourcePullEntryPage = lazy(() => import('./pages/warehouse-management/inbound/InboundOutsourcePullEntryPage'));
const OtherInboundPage = lazy(() => import('./pages/warehouse-management/other-inbound'));
const OtherOutboundPage = lazy(() => import('./pages/warehouse-management/other-outbound'));
const MaterialBorrowsPage = lazy(() => import('./pages/warehouse-management/material-borrows'));
const MaterialReturnsPage = lazy(() => import('./pages/warehouse-management/material-returns'));
const OutboundPage = lazy(() => import('./pages/warehouse-management/outbound'));
const OutboundWorkOrderPullEntryPage = lazy(
  () => import('./pages/warehouse-management/outbound/OutboundWorkOrderPullEntryPage'),
);
const OutboundSalesOrderPullEntryPage = lazy(
  () => import('./pages/warehouse-management/outbound/OutboundSalesOrderPullEntryPage'),
);
const OutboundOutsourcePullEntryPage = lazy(
  () => import('./pages/warehouse-management/outbound/OutboundOutsourcePullEntryPage'),
);
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
const ShiftsPage = lazy(() => import('./pages/performance/shifts'));
const ShiftRostersPage = lazy(() => import('./pages/performance/shift-rosters'));
const PerformanceCenterDashboardPage = lazy(() => import('./pages/performance/dashboard'));
const SkillsPage = lazy(() => import('./pages/performance/skills'));
const EmployeeConfigsPage = lazy(() => import('./pages/performance/employee-configs'));
const HourlyRatesPage = lazy(() => import('./pages/performance/hourly-rates'));
const KpiDefinitionsPage = lazy(() => import('./pages/performance/kpi-definitions'));
const SummariesPage = lazy(() => import('./pages/performance/summaries'));

/** 分析中心已迁至快报表：旧书签 /apps/kuaizhizao/analysis-center/... 跳转至对应快报表路径 */
const RedirectAnalysisCenterToKuaireport: React.FC = () => {
  const loc = useLocation();
  const raw = loc.pathname.replace(/^\/apps\/kuaizhizao\/analysis-center\/?/, '').replace(/\/$/, '');
  const to = raw
    ? `/apps/kuaireport/analysis-center/${raw}`
    : '/apps/kuaireport/analysis-center/document-timing';
  return <Navigate to={to} replace />;
};

// 销售管理报表
const SalesOrderQueryPage = lazy(() => import('./pages/sales-management/reports/SalesOrderQuery'));
const SalesDeliveryDetailPage = lazy(() => import('./pages/sales-management/reports/SalesDeliveryDetail'));
const SalesReturnDetailPage = lazy(() => import('./pages/sales-management/reports/SalesReturnDetail'));
const OrderExecutionTrackingPage = lazy(() => import('./pages/sales-management/reports/OrderExecutionTracking'));
const MaterialSalesSummaryPage = lazy(() => import('./pages/sales-management/reports/MaterialSalesSummary'));
const CustomerSalesSummaryPage = lazy(() => import('./pages/sales-management/reports/CustomerSalesSummary'));
const CustomerSalesReconciliationPage = lazy(() => import('./pages/sales-management/reports/CustomerSalesReconciliation'));
const ProductSalesRankingPage = lazy(() => import('./pages/sales-management/reports/ProductSalesRanking'));
const QuotationQueryPage = lazy(() => import('./pages/sales-management/reports/QuotationQuery'));
const SalespersonPerformancePage = lazy(() => import('./pages/sales-management/reports/SalespersonPerformance'));
const ContractExecutionReportPage = lazy(() => import('./pages/sales-management/reports/contract-execution'));

// 计划管理报表
const DemandPlanDetailPage = lazy(() => import('./pages/plan-management/reports/DemandPlanDetail'));
const MaterialShortageAlertPage = lazy(() => import('./pages/plan-management/reports/MaterialShortageAlert'));
const PlanFulfillmentRatePage = lazy(() => import('./pages/plan-management/reports/PlanFulfillmentRate'));

// 采购管理报表
const PurchaseRequisitionTrackingPage = lazy(() => import('./pages/purchase-management/reports/PurchaseRequisitionTracking'));
const PurchaseOrderQueryPage = lazy(() => import('./pages/purchase-management/reports/PurchaseOrderQuery'));
const PurchaseOrderProgressPage = lazy(() => import('./pages/purchase-management/reports/PurchaseOrderProgress'));
const SupplierDeliverySummaryPage = lazy(() => import('./pages/purchase-management/reports/SupplierDeliverySummary'));
const PurchaseReconciliationPage = lazy(() => import('./pages/purchase-management/reports/PurchaseReconciliation'));

// 生产执行报表
const WorkOrderQueryPage = lazy(() => import('./pages/production-execution/reports/WorkOrderQuery'));
const WorkOrderTrackingPage = lazy(() => import('./pages/production-execution/reports/WorkOrderTracking'));
const WorkOrderMaterialUsagePage = lazy(() => import('./pages/production-execution/reports/WorkOrderMaterialUsage'));
const WorkOrderLaborDetailPage = lazy(() => import('./pages/production-execution/reports/WorkOrderLaborDetail'));
const OutsourceOrderQueryPage = lazy(() => import('./pages/production-execution/reports/OutsourceOrderQuery'));
const OutsourceMaterialReconciliationPage = lazy(() => import('./pages/production-execution/reports/OutsourceMaterialReconciliation'));
const ScrapDefectAnalysisPage = lazy(() => import('./pages/production-execution/reports/ScrapDefectAnalysis'));
const ProductionDelayWarningPage = lazy(() => import('./pages/production-execution/reports/ProductionDelayWarning'));

// 质量管理报表
const IncomingInspectionReportPage = lazy(() => import('./pages/quality-management/reports/IncomingInspectionReport'));
const ProcessInspectionReportPage = lazy(() => import('./pages/quality-management/reports/ProcessInspectionReport'));
const FinishedInspectionReportPage = lazy(() => import('./pages/quality-management/reports/FinishedInspectionReport'));
const QualityExceptionTrackingPage = lazy(() => import('./pages/quality-management/reports/QualityExceptionTracking'));
const NonconformingSummaryPage = lazy(() => import('./pages/quality-management/reports/NonconformingSummary'));
const QualityRateTrendPage = lazy(() => import('./pages/quality-management/reports/QualityRateTrend'));

// 设备管理报表
const EquipmentMaintenanceDetailPage = lazy(() => import('./pages/equipment-management/reports/EquipmentMaintenanceDetail'));
const EquipmentMaintenancePlanPage = lazy(() => import('./pages/equipment-management/reports/EquipmentMaintenancePlan'));
const EquipmentFaultAnalysisPage = lazy(() => import('./pages/equipment-management/reports/EquipmentFaultAnalysis'));
const EquipmentStatusLogPage = lazy(() => import('./pages/equipment-management/reports/EquipmentStatusLog'));

// 仓储管理报表
const InventorySummaryPage = lazy(() => import('./pages/warehouse-management/reports/InventorySummary'));
const InventoryLedgerPage = lazy(() => import('./pages/warehouse-management/reports/InventoryLedger'));
const SlowMovingInventoryPage = lazy(() => import('./pages/warehouse-management/reports/SlowMovingInventory'));
const StocktakingHistoryPage = lazy(() => import('./pages/warehouse-management/reports/StocktakingHistory'));
const TransferTrackingPage = lazy(() => import('./pages/warehouse-management/reports/TransferTracking'));

// 绩效管理报表
const EmployeeEfficiencyRankingPage = lazy(() => import('./pages/performance/reports/EmployeeEfficiencyRanking'));
const PieceRateSalarySummaryPage = lazy(() => import('./pages/performance/reports/PieceRateSalarySummary'));

const KuaizhizaoApp: React.FC = () => {
  return (
    <Routes>
      <Route path="analysis-center/*" element={<RedirectAnalysisCenterToKuaireport />} />
      {/* 计划管理路由 */}
      <Route path="plan-management/demand-management" element={withPageSuspense(DemandManagementPage)} />
      <Route path="plan-management/demand-computation" element={withPageSuspense(DemandComputationPage)} />
      <Route path="plan-management/demand-change" element={withPageSuspense(DemandReplanDashboardPage)} />
      <Route path="plan-management/dashboard" element={withPageSuspense(ProductionControlTower)} />
      <Route path="plan-management/production-control-tower" element={withPageSuspense(ProductionControlTower)} />
      <Route path="plan-management/scheduling" element={withPageSuspense(SchedulingPage)} />
      <Route path="plan-management/rolling-scheduling" element={withPageSuspense(RollingSchedulingPage)} />

      {/* 采购管理路由 */}
      <Route path="purchase-management/dashboard" element={withPageSuspense(PurchaseDashboardPage)} />
      <Route path="purchase-management/purchase-orders/new" element={withPageSuspense(PurchaseOrdersPage)} />
      <Route path="purchase-management/purchase-orders/:id/edit" element={withPageSuspense(PurchaseOrdersPage)} />
      <Route path="purchase-management/purchase-orders" element={withPageSuspense(PurchaseOrdersPage)} />
      <Route path="purchase-management/purchase-order-changes" element={withPageSuspense(PurchaseOrderChangesPage)} />
      <Route path="purchase-management/purchase-requisitions/new" element={withPageSuspense(PurchaseRequisitionsPage)} />
      <Route path="purchase-management/purchase-requisitions/:id/edit" element={withPageSuspense(PurchaseRequisitionsPage)} />
      <Route path="purchase-management/purchase-requisitions" element={withPageSuspense(PurchaseRequisitionsPage)} />
      <Route path="purchase-management/purchase-inquiries" element={withPageSuspense(PurchaseInquiriesPage)} />
      <Route path="purchase-management/receipt-notices" element={withPageSuspense(ReceiptNoticesPage)} />
      <Route path="purchase-management/purchase-returns" element={withPageSuspense(PurchaseReturnsPage)} />

      {/* 生产执行路由 */}
      <Route path="production-execution/dashboard" element={withPageSuspense(ManufacturingDashboardPage)} />
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
      <Route path="sales-management/dashboard" element={withPageSuspense(SalesDashboardPage)} />
      <Route path="sales-management/customer-pool" element={withPageSuspense(CustomerPoolPage)} />
      <Route path="sales-management/sales-forecasts/new" element={withPageSuspense(SalesForecastsPage)} />
      <Route path="sales-management/sales-forecasts/:id/edit" element={withPageSuspense(SalesForecastsPage)} />
      <Route path="sales-management/sales-forecasts" element={withPageSuspense(SalesForecastsPage)} />
      <Route path="sales-management/quotations/new" element={withPageSuspense(QuotationsPage)} />
      <Route path="sales-management/quotations/:id/edit" element={withPageSuspense(QuotationsPage)} />
      <Route path="sales-management/quotations" element={withPageSuspense(QuotationsPage)} />
      <Route path="sales-management/sales-contracts/new" element={withPageSuspense(SalesContractsPage)} />
      <Route path="sales-management/sales-contracts/:id/edit" element={withPageSuspense(SalesContractsPage)} />
      <Route path="sales-management/sales-contracts" element={withPageSuspense(SalesContractsPage)} />
      <Route path="sales-management/sales-orders/new" element={withPageSuspense(SalesOrdersPage)} />
      <Route path="sales-management/sales-orders/:id/edit" element={withPageSuspense(SalesOrdersPage)} />
      <Route path="sales-management/sales-orders" element={withPageSuspense(SalesOrdersPage)} />
      <Route path="sales-management/sales-order-changes" element={withPageSuspense(SalesOrderChangesPage)} />
      <Route path="sales-management/shipment-notices" element={withPageSuspense(ShipmentNoticesPage)} />
      <Route path="sales-management/customer-follow-ups" element={withPageSuspense(CustomerFollowUpsPage)} />
      <Route path="sales-management/sales-returns" element={withPageSuspense(SalesReturnsPage)} />

      <Route path="production-execution/work-orders/:id/kiosk" element={withPageSuspense(WorkOrderDetailKioskPage)} />

      {/* 质量管理路由 */}
      <Route path="quality-management/dashboard" element={withPageSuspense(InspectionCenterPage)} />
      <Route path="quality-management/inspection-center" element={withPageSuspense(InspectionCenterPage)} />
      <Route path="quality-management/incoming-inspection" element={withPageSuspense(IncomingInspectionPage)} />
      <Route path="quality-management/process-inspection" element={withPageSuspense(ProcessInspectionPage)} />
      <Route path="quality-management/finished-goods-inspection" element={withPageSuspense(FinishedGoodsInspectionPage)} />
      <Route path="quality-management/traceability" element={withPageSuspense(TraceabilityPage)} />
      <Route path="quality-management/inspection-plans" element={withPageSuspense(InspectionPlansPage)} />
      <Route path="quality-management/nonconforming-ledger" element={withPageSuspense(NonconformingLedgerPage)} />
      <Route path="quality-management/eight-d-reports" element={withPageSuspense(EightDReportsPage)} />
      <Route path="quality-management/oqc-inspection" element={withPageSuspense(OQCInspectionPage)} />
      <Route path="quality-management/spc-monitor" element={withPageSuspense(SPCMonitorPage)} />

      {/* 设备管理路由 */}
      <Route path="equipment-management/dashboard" element={withPageSuspense(EquipmentDashboardPage)} />
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
      <Route path="equipment-management/inspection" element={withPageSuspense(EquipmentInspectionPage)} />
      <Route path="equipment-management/spare-parts" element={withPageSuspense(SparePartsPage)} />

      {/* 绩效管理路由 */}
      <Route path="performance/dashboard" element={withPageSuspense(PerformanceCenterDashboardPage)} />
      <Route path="performance/holidays" element={withPageSuspense(HolidaysPage)} />
      <Route path="performance/shifts" element={withPageSuspense(ShiftsPage)} />
      <Route path="performance/shift-rosters" element={withPageSuspense(ShiftRostersPage)} />
      <Route path="performance/skills" element={withPageSuspense(SkillsPage)} />
      <Route path="performance/employee-configs" element={withPageSuspense(EmployeeConfigsPage)} />
      <Route path="performance/hourly-rates" element={withPageSuspense(HourlyRatesPage)} />
      <Route path="performance/kpi-definitions" element={withPageSuspense(KpiDefinitionsPage)} />
      <Route path="performance/summaries" element={withPageSuspense(SummariesPage)} />

      {/* 仓储管理路由 */}
      <Route path="warehouse-management/dashboard" element={withPageSuspense(WarehouseDashboard)} />
      <Route path="warehouse-management/inventory" element={withPageSuspense(InventoryPage)} />
      <Route path="warehouse-management/replenishment-suggestions" element={withPageSuspense(ReplenishmentSuggestionsPage)} />
      <Route
        path="warehouse-management/inbound/entry/purchase-order/:poId"
        element={withPageSuspense(InboundPoPullEntryPage)}
      />
      <Route
        path="warehouse-management/inbound/entry/work-order/:woId"
        element={withPageSuspense(InboundWorkOrderPullEntryPage)}
      />
      <Route
        path="warehouse-management/inbound/entry/sales-order/:salesOrderId"
        element={withPageSuspense(InboundSalesReturnPullEntryPage)}
      />
      <Route
        path="warehouse-management/inbound/entry/production-return/:workOrderId"
        element={withPageSuspense(InboundProductionReturnPullEntryPage)}
      />
      <Route
        path="warehouse-management/inbound/entry/outsource-work-order/:woId"
        element={withPageSuspense(InboundOutsourcePullEntryPage)}
      />
      <Route path="warehouse-management/inbound" element={withPageSuspense(InboundPage)} />
      <Route path="warehouse-management/other-inbound" element={withPageSuspense(OtherInboundPage)} />
      <Route path="warehouse-management/other-outbound" element={withPageSuspense(OtherOutboundPage)} />
      <Route path="warehouse-management/material-borrows" element={withPageSuspense(MaterialBorrowsPage)} />
      <Route path="warehouse-management/material-returns" element={withPageSuspense(MaterialReturnsPage)} />
      <Route
        path="warehouse-management/outbound/entry/work-order/:woId"
        element={withPageSuspense(OutboundWorkOrderPullEntryPage)}
      />
      <Route
        path="warehouse-management/outbound/entry/sales-order/:soId"
        element={withPageSuspense(OutboundSalesOrderPullEntryPage)}
      />
      <Route
        path="warehouse-management/outbound/entry/outsource-work-order/:woId"
        element={withPageSuspense(OutboundOutsourcePullEntryPage)}
      />
      <Route path="warehouse-management/outbound" element={withPageSuspense(OutboundPage)} />
      <Route path="warehouse-management/customer-material-registration" element={withPageSuspense(CustomerMaterialRegistrationPage)} />
      <Route path="warehouse-management/barcode-mapping-rules" element={withPageSuspense(BarcodeMappingRulesPage)} />
      <Route path="warehouse-management/initial-data" element={<Navigate to="/system/initial-data" replace />} />
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

      {/* 成本管理 */}
      <Route path="cost-management/dashboard" element={withPageSuspense(CostCenterDashboardPage)} />
      <Route path="cost-management/cost-calculations" element={withPageSuspense(CostCalculationsPage)} />
      <Route path="cost-management/cost-comparison" element={withPageSuspense(CostComparisonPage)} />
      <Route path="cost-management/cost-rules" element={withPageSuspense(CostRulesPage)} />
      <Route path="cost-management/cost-details" element={withPageSuspense(CostDetailsPage)} />
      <Route path="cost-management/cost-optimization" element={withPageSuspense(CostOptimizationPage)} />
      <Route path="cost-management/cost-report" element={withPageSuspense(CostReportPage)} />

      <Route path="sales-management/reports/sales-order-query" element={withPageSuspense(SalesOrderQueryPage)} />
      <Route path="sales-management/reports/sales-delivery-detail" element={withPageSuspense(SalesDeliveryDetailPage)} />
      <Route path="sales-management/reports/sales-return-detail" element={withPageSuspense(SalesReturnDetailPage)} />
      <Route path="sales-management/reports/order-execution-tracking" element={withPageSuspense(OrderExecutionTrackingPage)} />
      <Route path="sales-management/reports/material-sales-summary" element={withPageSuspense(MaterialSalesSummaryPage)} />
      <Route path="sales-management/reports/customer-sales-summary" element={withPageSuspense(CustomerSalesSummaryPage)} />
      <Route path="sales-management/reports/customer-sales-reconciliation" element={withPageSuspense(CustomerSalesReconciliationPage)} />
      <Route path="sales-management/reports/salesperson-performance" element={withPageSuspense(SalespersonPerformancePage)} />
      <Route path="sales-management/reports/product-sales-ranking" element={withPageSuspense(ProductSalesRankingPage)} />
      <Route path="sales-management/reports/quotation-query" element={withPageSuspense(QuotationQueryPage)} />
      <Route path="sales-management/reports/contract-execution" element={withPageSuspense(ContractExecutionReportPage)} />

      {/* 计划管理报表 */}
      <Route path="plan-management/reports/demand-plan-detail" element={withPageSuspense(DemandPlanDetailPage)} />
      <Route path="plan-management/reports/material-shortage-alert" element={withPageSuspense(MaterialShortageAlertPage)} />
      <Route path="plan-management/reports/plan-fulfillment-rate" element={withPageSuspense(PlanFulfillmentRatePage)} />

      {/* 采购管理报表 */}
      <Route path="purchase-management/reports/purchase-requisition-tracking" element={withPageSuspense(PurchaseRequisitionTrackingPage)} />
      <Route path="purchase-management/reports/purchase-order-query" element={withPageSuspense(PurchaseOrderQueryPage)} />
      <Route path="purchase-management/reports/purchase-order-progress" element={withPageSuspense(PurchaseOrderProgressPage)} />
      <Route path="purchase-management/reports/supplier-delivery-summary" element={withPageSuspense(SupplierDeliverySummaryPage)} />
      <Route path="purchase-management/reports/purchase-reconciliation" element={withPageSuspense(PurchaseReconciliationPage)} />

      {/* 生产执行报表 */}
      <Route path="production-execution/reports/work-order-query" element={withPageSuspense(WorkOrderQueryPage)} />
      <Route path="production-execution/reports/work-order-tracking" element={withPageSuspense(WorkOrderTrackingPage)} />
      <Route path="production-execution/reports/work-order-material-usage" element={withPageSuspense(WorkOrderMaterialUsagePage)} />
      <Route path="production-execution/reports/work-order-labor-detail" element={withPageSuspense(WorkOrderLaborDetailPage)} />
      <Route path="production-execution/reports/outsource-order-query" element={withPageSuspense(OutsourceOrderQueryPage)} />
      <Route path="production-execution/reports/outsource-material-reconciliation" element={withPageSuspense(OutsourceMaterialReconciliationPage)} />
      <Route path="production-execution/reports/scrap-defect-analysis" element={withPageSuspense(ScrapDefectAnalysisPage)} />
      <Route path="production-execution/reports/production-delay-warning" element={withPageSuspense(ProductionDelayWarningPage)} />

      {/* 质量管理报表 */}
      <Route path="quality-management/reports/incoming-inspection-report" element={withPageSuspense(IncomingInspectionReportPage)} />
      <Route path="quality-management/reports/process-inspection-report" element={withPageSuspense(ProcessInspectionReportPage)} />
      <Route path="quality-management/reports/finished-inspection-report" element={withPageSuspense(FinishedInspectionReportPage)} />
      <Route path="quality-management/reports/quality-exception-tracking" element={withPageSuspense(QualityExceptionTrackingPage)} />
      <Route path="quality-management/reports/nonconforming-summary" element={withPageSuspense(NonconformingSummaryPage)} />
      <Route path="quality-management/reports/quality-rate-trend" element={withPageSuspense(QualityRateTrendPage)} />

      {/* 设备管理报表 */}
      <Route path="equipment-management/reports/equipment-maintenance-detail" element={withPageSuspense(EquipmentMaintenanceDetailPage)} />
      <Route path="equipment-management/reports/equipment-maintenance-plan" element={withPageSuspense(EquipmentMaintenancePlanPage)} />
      <Route path="equipment-management/reports/equipment-fault-analysis" element={withPageSuspense(EquipmentFaultAnalysisPage)} />
      <Route path="equipment-management/reports/equipment-status-log" element={withPageSuspense(EquipmentStatusLogPage)} />

      {/* 仓储管理报表 */}
      <Route path="warehouse-management/reports/inventory-summary" element={withPageSuspense(InventorySummaryPage)} />
      <Route path="warehouse-management/reports/inventory-ledger" element={withPageSuspense(InventoryLedgerPage)} />
      <Route path="warehouse-management/reports/slow-moving-inventory" element={withPageSuspense(SlowMovingInventoryPage)} />
      <Route path="warehouse-management/reports/stocktaking-history" element={withPageSuspense(StocktakingHistoryPage)} />
      <Route path="warehouse-management/reports/transfer-tracking" element={withPageSuspense(TransferTrackingPage)} />

      {/* 绩效管理报表 */}
      <Route path="performance/reports/employee-efficiency-ranking" element={withPageSuspense(EmployeeEfficiencyRankingPage)} />
      <Route path="performance/reports/piece-rate-salary-summary" element={withPageSuspense(PieceRateSalarySummaryPage)} />
      {/* 默认路由 - 应用首页 */}
      <Route path="" element={withPageSuspense(MESDashboard)} />
    </Routes>
  );
};

export default KuaizhizaoApp;
