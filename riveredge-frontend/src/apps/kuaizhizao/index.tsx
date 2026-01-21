/**
 * 快格轻制造 APP 入口文件
 */

import React from 'react';
import { Routes, Route } from 'react-router-dom';

// 计划管理页面
import DemandManagementPage from './pages/plan-management/demand-management';
import DemandComputationPage from './pages/plan-management/demand-computation';
// TODO: MRP和LRP已合并为统一需求计算，相关页面已删除
// import MRPComputationPage from './pages/plan-management/mrp-computation';
// import LRPComputationPage from './pages/plan-management/lrp-computation';
import ProductionPlansPage from './pages/plan-management/production-plans';
import SchedulingPage from './pages/plan-management/scheduling';

// 生产执行页面
import WorkOrdersPage from './pages/production-execution/work-orders';
import WorkOrdersKioskPage from './pages/production-execution/work-orders/kiosk';
import ReportingPage from './pages/production-execution/reporting';
import ReportingKioskPage from './pages/production-execution/reporting/kiosk';
import ReportingStatisticsPage from './pages/production-execution/reporting/statistics';
import SOPViewerKioskPage from './pages/production-execution/sop-viewer/kiosk';
import DrawingViewerKioskPage from './pages/production-execution/drawing-viewer/kiosk';
import ProgramViewerKioskPage from './pages/production-execution/program-viewer/kiosk';
import ReworkOrdersPage from './pages/production-execution/rework-orders';
import OutsourceOrdersPage from './pages/production-execution/outsource-orders';
import OutsourceWorkOrdersPage from './pages/production-execution/outsource-work-orders';

// 采购管理页面
import PurchaseOrdersPage from './pages/purchase-management/purchase-orders';
import PurchaseReceiptsPage from './pages/purchase-management/purchase-receipts';
import PurchaseReturnsPage from './pages/purchase-management/purchase-returns';

// 销售管理页面
// TODO: 销售预测已合并为统一需求管理，但销售订单需要独立管理
// import SalesForecastsPage from './pages/sales-management/sales-forecasts';
import SalesOrdersPage from './pages/sales-management/sales-orders';
import SalesDeliveriesPage from './pages/sales-management/sales-deliveries';
import SalesReturnsPage from './pages/sales-management/sales-returns';

// 质量管理页面
import IncomingInspectionPage from './pages/quality-management/incoming-inspection';
import ProcessInspectionPage from './pages/quality-management/process-inspection';
import FinishedGoodsInspectionPage from './pages/quality-management/finished-goods-inspection';

// 成本管理页面
import CostRulesPage from './pages/cost-management/cost-rules';
import CostCalculationsPage from './pages/cost-management/cost-calculations';
import CostCalculationTabsPage from './pages/cost-management/cost-calculation-tabs';
import ProductionCostPage from './pages/cost-management/production-cost';
import OutsourceCostPage from './pages/cost-management/outsource-cost';
import PurchaseCostPage from './pages/cost-management/purchase-cost';
import QualityCostPage from './pages/cost-management/quality-cost';
import CostComparisonPage from './pages/cost-management/cost-comparison';
import CostOptimizationPage from './pages/cost-management/cost-optimization';
import CostReportPage from './pages/cost-management/cost-report';

// 设备管理页面
import EquipmentPage from './pages/equipment-management/equipment';
import EquipmentFaultsPage from './pages/equipment-management/equipment-faults';
import MaintenancePlansPage from './pages/equipment-management/maintenance-plans';
import MoldsPage from './pages/equipment-management/molds';
import EquipmentStatusPage from './pages/equipment-management/equipment-status';
import MaintenanceRemindersPage from './pages/equipment-management/maintenance-reminders';

// 财务管理页面
import AccountsPayablePage from './pages/finance-management/accounts-payable';
import AccountsReceivablePage from './pages/finance-management/accounts-receivable';

// 报表分析页面
import InventoryReportPage from './pages/reports/inventory-report';
import ProductionReportPage from './pages/reports/production-report';
import QualityReportPage from './pages/reports/quality-report';

// 仓储管理页面
import InventoryPage from './pages/warehouse-management/inventory';
import InboundPage from './pages/warehouse-management/inbound';
import FinishedGoodsInboundPage from './pages/warehouse-management/finished-goods-inventory';
import SalesOutboundPage from './pages/warehouse-management/sales-outbound';
import InitialDataImportPage from './pages/warehouse-management/initial-data';
import OutboundPage from './pages/warehouse-management/outbound';
import CustomerMaterialRegistrationPage from './pages/warehouse-management/customer-material-registration';
import BarcodeMappingRulesPage from './pages/warehouse-management/barcode-mapping-rules';
import DocumentTimingPage from './pages/warehouse-management/document-timing';
import DocumentEfficiencyPage from './pages/warehouse-management/document-efficiency';
import MaterialShortageExceptionsPage from './pages/production-execution/material-shortage-exceptions';
import DeliveryDelayExceptionsPage from './pages/production-execution/delivery-delay-exceptions';
import QualityExceptionsPage from './pages/production-execution/quality-exceptions';
import ExceptionStatisticsPage from './pages/production-execution/exception-statistics';
import ExceptionProcessPage from './pages/production-execution/exception-process';
import ReplenishmentSuggestionsPage from './pages/warehouse-management/replenishment-suggestions';

const KuaizhizaoApp: React.FC = () => {
  return (
    <Routes>
      {/* 计划管理路由 */}
      <Route path="plan-management/demand-management" element={<DemandManagementPage />} />
      <Route path="plan-management/demand-computation" element={<DemandComputationPage />} />
      {/* TODO: MRP和LRP路由已移除，已合并为统一需求计算 */}
      {/* <Route path="plan-management/mrp-computation" element={<MRPComputationPage />} /> */}
      {/* <Route path="plan-management/lrp-computation" element={<LRPComputationPage />} /> */}
      <Route path="plan-management/production-plans" element={<ProductionPlansPage />} />
      <Route path="plan-management/scheduling" element={<SchedulingPage />} />

      {/* 采购管理路由 */}
      <Route path="purchase-management/purchase-orders" element={<PurchaseOrdersPage />} />
      <Route path="purchase-management/purchase-receipts" element={<PurchaseReceiptsPage />} />
      <Route path="purchase-management/purchase-returns" element={<PurchaseReturnsPage />} />

      {/* 生产执行路由 */}
      <Route path="production-execution/work-orders" element={<WorkOrdersPage />} />
      <Route path="production-execution/work-orders/kiosk" element={<WorkOrdersKioskPage />} />
      <Route path="production-execution/reporting" element={<ReportingPage />} />
      <Route path="production-execution/reporting/kiosk" element={<ReportingKioskPage />} />
      <Route path="production-execution/reporting/statistics" element={<ReportingStatisticsPage />} />
      <Route path="production-execution/sop-viewer/kiosk" element={<SOPViewerKioskPage />} />
      <Route path="production-execution/drawing-viewer/kiosk" element={<DrawingViewerKioskPage />} />
      <Route path="production-execution/program-viewer/kiosk" element={<ProgramViewerKioskPage />} />
      <Route path="production-execution/rework-orders" element={<ReworkOrdersPage />} />
      <Route path="production-execution/outsource-orders" element={<OutsourceOrdersPage />} />
      <Route path="production-execution/outsource-work-orders" element={<OutsourceWorkOrdersPage />} />
      <Route path="production-execution/material-shortage-exceptions" element={<MaterialShortageExceptionsPage />} />
      <Route path="production-execution/delivery-delay-exceptions" element={<DeliveryDelayExceptionsPage />} />
      <Route path="production-execution/quality-exceptions" element={<QualityExceptionsPage />} />
      <Route path="production-execution/exception-statistics" element={<ExceptionStatisticsPage />} />
      <Route path="production-execution/exception-process" element={<ExceptionProcessPage />} />

      {/* 销售管理路由 */}
      {/* TODO: 销售预测已合并为统一需求管理，但销售订单需要独立管理 */}
      {/* <Route path="sales-management/sales-forecasts" element={<SalesForecastsPage />} /> */}
      <Route path="sales-management/sales-orders" element={<SalesOrdersPage />} />
      <Route path="sales-management/sales-deliveries" element={<SalesDeliveriesPage />} />
      <Route path="sales-management/sales-returns" element={<SalesReturnsPage />} />

      {/* 质量管理路由 */}
      <Route path="quality-management/incoming-inspection" element={<IncomingInspectionPage />} />
      <Route path="quality-management/process-inspection" element={<ProcessInspectionPage />} />
      <Route path="quality-management/finished-goods-inspection" element={<FinishedGoodsInspectionPage />} />

      {/* 成本管理路由 */}
      <Route path="cost-management/cost-rules" element={<CostRulesPage />} />
      <Route path="cost-management/cost-calculations" element={<CostCalculationsPage />} />
      {/* 统一的成本核算页面（使用Tabs） */}
      <Route path="cost-management/cost-calculation-tabs" element={<CostCalculationTabsPage />} />
      {/* 保留原有路由以兼容旧链接，但重定向到统一页面 */}
      <Route path="cost-management/production-cost" element={<CostCalculationTabsPage />} />
      <Route path="cost-management/outsource-cost" element={<CostCalculationTabsPage />} />
      <Route path="cost-management/purchase-cost" element={<CostCalculationTabsPage />} />
      <Route path="cost-management/quality-cost" element={<CostCalculationTabsPage />} />
      <Route path="cost-management/cost-comparison" element={<CostComparisonPage />} />
      <Route path="cost-management/cost-optimization" element={<CostOptimizationPage />} />
      <Route path="cost-management/cost-report" element={<CostReportPage />} />

      {/* 设备管理路由 */}
      <Route path="equipment-management/equipment" element={<EquipmentPage />} />
      <Route path="equipment-management/equipment-faults" element={<EquipmentFaultsPage />} />
      <Route path="equipment-management/maintenance-plans" element={<MaintenancePlansPage />} />
      <Route path="equipment-management/molds" element={<MoldsPage />} />
      <Route path="equipment-management/equipment-status" element={<EquipmentStatusPage />} />
      <Route path="equipment-management/maintenance-reminders" element={<MaintenanceRemindersPage />} />

      {/* 财务管理路由 */}
      <Route path="finance-management/accounts-payable" element={<AccountsPayablePage />} />
      <Route path="finance-management/accounts-receivable" element={<AccountsReceivablePage />} />

      {/* 报表分析路由 */}
      <Route path="reports/inventory-report" element={<InventoryReportPage />} />
      <Route path="reports/production-report" element={<ProductionReportPage />} />
      <Route path="reports/quality-report" element={<QualityReportPage />} />

      {/* 仓储管理路由 */}
      <Route path="warehouse-management/inventory" element={<InventoryPage />} />
      <Route path="warehouse-management/inbound" element={<InboundPage />} />
      <Route path="warehouse-management/finished-goods-inventory" element={<FinishedGoodsInboundPage />} />
      <Route path="warehouse-management/sales-outbound" element={<SalesOutboundPage />} />
      <Route path="warehouse-management/outbound" element={<OutboundPage />} />
      <Route path="warehouse-management/customer-material-registration" element={<CustomerMaterialRegistrationPage />} />
      <Route path="warehouse-management/barcode-mapping-rules" element={<BarcodeMappingRulesPage />} />
      <Route path="warehouse-management/document-timing" element={<DocumentTimingPage />} />
      <Route path="warehouse-management/document-efficiency" element={<DocumentEfficiencyPage />} />
      <Route path="warehouse-management/initial-data" element={<InitialDataImportPage />} />
      <Route path="warehouse-management/replenishment-suggestions" element={<ReplenishmentSuggestionsPage />} />

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
