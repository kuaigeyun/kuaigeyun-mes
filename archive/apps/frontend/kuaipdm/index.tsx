/**
 * 快格轻PDM APP 入口文件
 */

import React from 'react';
import { Routes, Route } from 'react-router-dom';

// 设计变更页面
import DesignChangesPage from './pages/design-changes';

// 工程变更页面
import EngineeringChangesPage from './pages/engineering-changes';

// 设计评审页面
import DesignReviewsPage from './pages/design-reviews';

// 研发流程页面
import ResearchProcessesPage from './pages/research-processes';

// 知识管理页面
import KnowledgesPage from './pages/knowledges';

const KuaipdmApp: React.FC = () => {
  return (
    <Routes>
      {/* 设计变更 */}
      <Route path="design-change/apply" element={<DesignChangesPage />} />
      <Route path="design-change/approval" element={<DesignChangesPage />} />
      <Route path="design-change/execution" element={<DesignChangesPage />} />
      
      {/* 工程变更 */}
      <Route path="engineering-change/apply" element={<EngineeringChangesPage />} />
      <Route path="engineering-change/tracking" element={<EngineeringChangesPage />} />
      
      {/* 设计评审 */}
      <Route path="review/plan" element={<DesignReviewsPage />} />
      <Route path="review/execution" element={<DesignReviewsPage />} />
      <Route path="review/records" element={<DesignReviewsPage />} />
      
      {/* 研发流程 */}
      <Route path="process/config" element={<ResearchProcessesPage />} />
      <Route path="process/stages" element={<ResearchProcessesPage />} />
      <Route path="process/monitoring" element={<ResearchProcessesPage />} />
      
      {/* 知识管理 */}
      <Route path="knowledge/library" element={<KnowledgesPage />} />
      <Route path="knowledge/patents" element={<KnowledgesPage />} />
      
      {/* 默认路由 */}
      <Route index element={<div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>快格轻PDM</div>} />
      <Route path="*" element={<div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>页面未找到</div>} />
    </Routes>
  );
};

export default KuaipdmApp;
