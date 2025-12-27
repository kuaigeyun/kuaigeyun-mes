/**
 * 快格轻认证 APP 入口文件
 */

import React from 'react';
import { Routes, Route } from 'react-router-dom';

// 认证类型管理页面
import CertificationTypesPage from './pages/certification-types';
import CertificationStandardsPage from './pages/certification-standards';
import ScoringRulesPage from './pages/scoring-rules';

// 认证评估页面
import CertificationRequirementsPage from './pages/certification-requirements';
import CurrentAssessmentsPage from './pages/current-assessments';
import SelfAssessmentsPage from './pages/self-assessments';
import AssessmentReportsPage from './pages/assessment-reports';

// 提升建议页面
import ImprovementSuggestionsPage from './pages/improvement-suggestions';
import ImprovementPlansPage from './pages/improvement-plans';
import BestPracticesPage from './pages/best-practices';

// 认证管理页面
import CertificationApplicationsPage from './pages/certification-applications';
import CertificationProgresssPage from './pages/certification-progresss';
import CertificationCertificatesPage from './pages/certification-certificates';

const KuaicertApp: React.FC = () => {
  return (
    <Routes>
      {/* 认证类型管理 */}
      <Route path="certification-types" element={<CertificationTypesPage />} />
      <Route path="certification-standards" element={<CertificationStandardsPage />} />
      <Route path="scoring-rules" element={<ScoringRulesPage />} />
      
      {/* 认证评估 */}
      <Route path="certification-requirements" element={<CertificationRequirementsPage />} />
      <Route path="current-assessments" element={<CurrentAssessmentsPage />} />
      <Route path="self-assessments" element={<SelfAssessmentsPage />} />
      <Route path="assessment-reports" element={<AssessmentReportsPage />} />
      
      {/* 提升建议 */}
      <Route path="improvement-suggestions" element={<ImprovementSuggestionsPage />} />
      <Route path="improvement-plans" element={<ImprovementPlansPage />} />
      <Route path="best-practices" element={<BestPracticesPage />} />
      
      {/* 认证管理 */}
      <Route path="certification-applications" element={<CertificationApplicationsPage />} />
      <Route path="certification-progresss" element={<CertificationProgresssPage />} />
      <Route path="certification-certificates" element={<CertificationCertificatesPage />} />
      
      {/* 默认路由 */}
      <Route index element={<div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>快格轻认证</div>} />
      <Route path="*" element={<div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>页面未找到</div>} />
    </Routes>
  );
};

export default KuaicertApp;

