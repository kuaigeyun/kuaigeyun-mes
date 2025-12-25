/**
 * 快格轻EPM APP 入口文件
 */

import React from 'react';
import { Routes, Route } from 'react-router-dom';

// KPI管理页面
import KPIsPage from './pages/kpis';
import KPIMonitoringsPage from './pages/kpi-monitorings';
import KPIAnalysissPage from './pages/kpi-analysiss';
import KPIAlertsPage from './pages/kpi-alerts';

// 平衡计分卡页面
import StrategyMapsPage from './pages/strategy-maps';
import ObjectivesPage from './pages/objectives';
import PerformanceEvaluationsPage from './pages/performance-evaluations';

// 经营分析页面
import BusinessDashboardsPage from './pages/business-dashboards';
import BusinessDataAnalysissPage from './pages/business-data-analysiss';
import TrendAnalysissPage from './pages/trend-analysiss';
import ComparisonAnalysissPage from './pages/comparison-analysiss';

// 预算分析页面
import BudgetsPage from './pages/budgets';
import BudgetVariancesPage from './pages/budget-variances';
import BudgetForecastsPage from './pages/budget-forecasts';

const KuaiepmApp: React.FC = () => {
  return (
    <Routes>
      {/* KPI管理 */}
      <Route path="kpis" element={<KPIsPage />} />
      <Route path="kpi-monitorings" element={<KPIMonitoringsPage />} />
      <Route path="kpi-analysiss" element={<KPIAnalysissPage />} />
      <Route path="kpi-alerts" element={<KPIAlertsPage />} />
      
      {/* 平衡计分卡 */}
      <Route path="strategy-maps" element={<StrategyMapsPage />} />
      <Route path="objectives" element={<ObjectivesPage />} />
      <Route path="performance-evaluations" element={<PerformanceEvaluationsPage />} />
      
      {/* 经营分析 */}
      <Route path="business-dashboards" element={<BusinessDashboardsPage />} />
      <Route path="business-data-analysiss" element={<BusinessDataAnalysissPage />} />
      <Route path="trend-analysiss" element={<TrendAnalysissPage />} />
      <Route path="comparison-analysiss" element={<ComparisonAnalysissPage />} />
      
      {/* 预算分析 */}
      <Route path="budgets" element={<BudgetsPage />} />
      <Route path="budget-variances" element={<BudgetVariancesPage />} />
      <Route path="budget-forecasts" element={<BudgetForecastsPage />} />
      
      {/* 默认路由 */}
      <Route index element={<div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>快格轻EPM</div>} />
      <Route path="*" element={<div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>页面未找到</div>} />
    </Routes>
  );
};

export default KuaiepmApp;

