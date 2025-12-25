/**
 * 快格轻QMS APP 入口文件
 */

import React from 'react';
import { Routes, Route } from 'react-router-dom';

// 质量检验页面
import InspectionTasksPage from './pages/inspection-tasks';

// 质量检验记录页面
import InspectionRecordsPage from './pages/inspection-records';

// 不合格品记录页面
import NonconformingProductsPage from './pages/nonconforming-products';

// 不合格品处理页面
import NonconformingHandlingsPage from './pages/nonconforming-handlings';

// 质量追溯页面
import QualityTraceabilitiesPage from './pages/quality-traceabilities';

// ISO质量审核页面
import ISOAuditsPage from './pages/iso-audits';

// CAPA管理页面
import CAPAsPage from './pages/capas';

// 持续改进页面
import ContinuousImprovementsPage from './pages/continuous-improvements';

// 质量目标页面
import QualityObjectivesPage from './pages/quality-objectives';

// 质量指标页面
import QualityIndicatorsPage from './pages/quality-indicators';

const KuaiqmsApp: React.FC = () => {
  return (
    <Routes>
      {/* 质量检验 */}
      <Route path="inspection/incoming" element={<InspectionTasksPage />} />
      <Route path="inspection/process" element={<InspectionTasksPage />} />
      <Route path="inspection/finished" element={<InspectionTasksPage />} />
      <Route path="inspection/outsourcing" element={<InspectionTasksPage />} />
      <Route path="inspection/records" element={<InspectionRecordsPage />} />
      
      {/* 不合格品 */}
      <Route path="nonconforming/records" element={<NonconformingProductsPage />} />
      <Route path="nonconforming/handling" element={<NonconformingHandlingsPage />} />
      <Route path="nonconforming/traceability" element={<QualityTraceabilitiesPage />} />
      
      {/* 质量追溯 */}
      <Route path="traceability/batch" element={<QualityTraceabilitiesPage />} />
      <Route path="traceability/serial" element={<QualityTraceabilitiesPage />} />
      <Route path="traceability/archive" element={<QualityTraceabilitiesPage />} />
      
      {/* ISO体系 */}
      <Route path="iso/config" element={<div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>ISO体系配置</div>} />
      <Route path="iso/audit" element={<ISOAuditsPage />} />
      <Route path="iso/capa" element={<CAPAsPage />} />
      <Route path="iso/improvement" element={<ContinuousImprovementsPage />} />
      <Route path="iso/objectives" element={<QualityObjectivesPage />} />
      
      {/* 质量分析 */}
      <Route path="analysis/reports" element={<div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>质量报表</div>} />
      <Route path="analysis/trend" element={<div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>质量趋势</div>} />
      <Route path="analysis/cost" element={<div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>质量成本</div>} />
      
      {/* 默认路由 */}
      <Route index element={<div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>快格轻QMS</div>} />
      <Route path="*" element={<div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>页面未找到</div>} />
    </Routes>
  );
};

export default KuaiqmsApp;
