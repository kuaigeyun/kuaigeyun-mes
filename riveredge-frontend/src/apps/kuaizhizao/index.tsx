/**
 * 快格轻制造 APP 入口文件
 */

import React from 'react';
import { Routes, Route } from 'react-router-dom';

// 计划管理页面
import DemandManagementPage from './pages/plan-management/demand-management';
import SchedulingPage from './pages/plan-management/scheduling';

// 生产执行页面
import WorkOrdersPage from './pages/production-execution/work-orders';
import ReportingPage from './pages/production-execution/reporting';

// 销售管理页面
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

const KuaizhizaoApp: React.FC = () => {
  return (
    <Routes>
      {/* 计划管理路由 */}
      <Route path="plan-management/demand-management" element={<DemandManagementPage />} />
      <Route path="plan-management/scheduling" element={<SchedulingPage />} />

      {/* 生产执行路由 */}
      <Route path="production-execution/work-orders" element={<WorkOrdersPage />} />
      <Route path="production-execution/reporting" element={<ReportingPage />} />

      {/* 销售管理路由 */}
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
