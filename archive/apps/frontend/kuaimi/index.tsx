/**
 * 快格轻MI APP 入口文件
 */

import React from 'react';
import { Routes, Route } from 'react-router-dom';

// 实时生产看板页面
import ProductionDashboardsPage from './pages/production-dashboards';

// 设备综合效率分析页面
import OEEAnalysesPage from './pages/oee-analyses';

// 工艺参数优化页面
import ProcessParameterOptimizationsPage from './pages/process-parameter-optimizations';

// 质量预测分析页面
import QualityPredictionAnalysesPage from './pages/quality-prediction-analyses';

// 系统应用绩效分析页面
import SystemPerformanceAnalysesPage from './pages/system-performance-analyses';

const KuaimiApp: React.FC = () => {
  return (
    <Routes>
      {/* 实时生产看板 */}
      <Route path="production-dashboards" element={<ProductionDashboardsPage />} />
      
      {/* 设备综合效率分析 */}
      <Route path="oee-analyses" element={<OEEAnalysesPage />} />
      
      {/* 工艺参数优化 */}
      <Route path="process-parameter-optimizations" element={<ProcessParameterOptimizationsPage />} />
      
      {/* 质量预测分析 */}
      <Route path="quality-prediction-analyses" element={<QualityPredictionAnalysesPage />} />
      
      {/* 系统应用绩效分析 */}
      <Route path="system-performance-analyses" element={<SystemPerformanceAnalysesPage />} />
      
      {/* 默认路由 */}
      <Route index element={<div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>快格轻MI</div>} />
      <Route path="*" element={<div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>页面未找到</div>} />
    </Routes>
  );
};

export default KuaimiApp;

