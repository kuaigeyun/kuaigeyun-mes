/**
 * 快格轻LIMS APP 入口文件
 */

import React from 'react';
import { Routes, Route } from 'react-router-dom';

// 样品管理页面
import SampleManagementsPage from './pages/sample-managements';

// 实验管理页面
import ExperimentManagementsPage from './pages/experiment-managements';

// 数据管理页面
import DataManagementsPage from './pages/data-managements';

// 报告管理页面
import ReportManagementsPage from './pages/report-managements';

const KuailimsApp: React.FC = () => {
  return (
    <Routes>
      {/* 样品管理 */}
      <Route path="sample-managements" element={<SampleManagementsPage />} />
      
      {/* 实验管理 */}
      <Route path="experiment-managements" element={<ExperimentManagementsPage />} />
      
      {/* 数据管理 */}
      <Route path="data-managements" element={<DataManagementsPage />} />
      
      {/* 报告管理 */}
      <Route path="report-managements" element={<ReportManagementsPage />} />
      
      {/* 默认路由 */}
      <Route index element={<div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>快格轻LIMS</div>} />
      <Route path="*" element={<div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>页面未找到</div>} />
    </Routes>
  );
};

export default KuailimsApp;

