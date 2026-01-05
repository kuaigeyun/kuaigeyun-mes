/**
 * 快格轻制造 APP 入口文件
 */

import React from 'react';
import { Routes, Route } from 'react-router-dom';

// 计划管理页面
import DemandManagementPage from './pages/plan-management/demand-management';
import MRPComputationPage from './pages/plan-management/mrp-computation';
import LRPComputationPage from './pages/plan-management/lrp-computation';
import ProductionPlansPage from './pages/plan-management/production-plans';
import SchedulingPage from './pages/plan-management/scheduling';

// 生产执行页面
import WorkOrdersPage from './pages/production-execution/work-orders';
import ReportingPage from './pages/production-execution/reporting';
import ReportingStatisticsPage from './pages/production-execution/reporting/statistics';
import ReworkOrdersPage from './pages/production-execution/rework-orders';
import OutsourceOrdersPage from './pages/production-execution/outsource-orders';

// 采购管理页面
import PurchaseOrdersPage from './pages/purchase-management/purchase-orders';

// 销售管理页面
import SalesForecastsPage from './pages/sales-management/sales-forecasts';
import SalesOrdersPage from './pages/sales-management/sales-orders';

// 质量管理页面
import IncomingInspectionPage from './pages/quality-management/incoming-inspection';
import ProcessInspectionPage from './pages/quality-management/process-inspection';
import FinishedGoodsInspectionPage from './pages/quality-management/finished-goods-inspection';

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
import OutboundPage from './pages/warehouse-management/outbound';
import CustomerMaterialRegistrationPage from './pages/warehouse-management/customer-material-registration';
import BarcodeMappingRulesPage from './pages/warehouse-management/barcode-mapping-rules';
import DocumentTimingPage from './pages/warehouse-management/document-timing';
import DocumentEfficiencyPage from './pages/warehouse-management/document-efficiency';
import MaterialShortageExceptionsPage from './pages/production-execution/material-shortage-exceptions';
import DeliveryDelayExceptionsPage from './pages/production-execution/delivery-delay-exceptions';
import QualityExceptionsPage from './pages/production-execution/quality-exceptions';
import ExceptionStatisticsPage from './pages/production-execution/exception-statistics';

const KuaizhizaoApp: React.FC = () => {
  return (
    <Routes>
      {/* 计划管理路由 */}
      <Route path="plan-management/demand-management" element={<DemandManagementPage />} />
      <Route path="plan-management/mrp-computation" element={<MRPComputationPage />} />
      <Route path="plan-management/lrp-computation" element={<LRPComputationPage />} />
      <Route path="plan-management/production-plans" element={<ProductionPlansPage />} />
      <Route path="plan-management/scheduling" element={<SchedulingPage />} />

      {/* 采购管理路由 */}
      <Route path="purchase-management/purchase-orders" element={<PurchaseOrdersPage />} />

      {/* 生产执行路由 */}
      <Route path="production-execution/work-orders" element={<WorkOrdersPage />} />
      <Route path="production-execution/reporting" element={<ReportingPage />} />
      <Route path="production-execution/reporting/statistics" element={<ReportingStatisticsPage />} />
      <Route path="production-execution/rework-orders" element={<ReworkOrdersPage />} />
      <Route path="production-execution/outsource-orders" element={<OutsourceOrdersPage />} />
      <Route path="production-execution/material-shortage-exceptions" element={<MaterialShortageExceptionsPage />} />
      <Route path="production-execution/delivery-delay-exceptions" element={<DeliveryDelayExceptionsPage />} />
      <Route path="production-execution/quality-exceptions" element={<QualityExceptionsPage />} />
      <Route path="production-execution/exception-statistics" element={<ExceptionStatisticsPage />} />

      {/* 销售管理路由 */}
      <Route path="sales-management/sales-forecasts" element={<SalesForecastsPage />} />
      <Route path="sales-management/sales-orders" element={<SalesOrdersPage />} />

      {/* 质量管理路由 */}
      <Route path="quality-management/incoming-inspection" element={<IncomingInspectionPage />} />
      <Route path="quality-management/process-inspection" element={<ProcessInspectionPage />} />
      <Route path="quality-management/finished-goods-inspection" element={<FinishedGoodsInspectionPage />} />

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
