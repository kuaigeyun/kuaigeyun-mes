/**
 * 快格轻PM APP 入口文件
 */

import React from 'react';
import { Routes, Route } from 'react-router-dom';

// 项目立项页面
import ProjectsPage from './pages/projects';
import ProjectApplicationsPage from './pages/project-applications';

// 项目计划页面
import ProjectWBSPage from './pages/project-wbss';
import ProjectTasksPage from './pages/project-tasks';
import ProjectResourcesPage from './pages/project-resources';

// 项目执行页面
import ProjectProgressPage from './pages/project-progresses';
import ProjectCostsPage from './pages/project-costs';

// 项目监控页面
import ProjectRisksPage from './pages/project-risks';
import ProjectQualitiesPage from './pages/project-qualities';

const KuaipmApp: React.FC = () => {
  return (
    <Routes>
      {/* 项目立项 */}
      <Route path="projects" element={<ProjectsPage />} />
      <Route path="project-applications" element={<ProjectApplicationsPage />} />
      
      {/* 项目计划 */}
      <Route path="project-wbss" element={<ProjectWBSPage />} />
      <Route path="project-tasks" element={<ProjectTasksPage />} />
      <Route path="project-resources" element={<ProjectResourcesPage />} />
      
      {/* 项目执行 */}
      <Route path="project-progresses" element={<ProjectProgressPage />} />
      <Route path="project-costs" element={<ProjectCostsPage />} />
      
      {/* 项目监控 */}
      <Route path="project-risks" element={<ProjectRisksPage />} />
      <Route path="project-qualities" element={<ProjectQualitiesPage />} />
      
      {/* 默认路由 */}
      <Route index element={<div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>快格轻PM</div>} />
      <Route path="*" element={<div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>页面未找到</div>} />
    </Routes>
  );
};

export default KuaipmApp;

