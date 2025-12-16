/**
 * 快格轻EHS APP 入口文件
 */

import React from 'react';
import { Routes, Route } from 'react-router-dom';

// 环境管理页面
import EnvironmentMonitoringsPage from './pages/environment-monitorings';
import EmissionManagementsPage from './pages/emission-managements';
import EnvironmentalCompliancesPage from './pages/environmental-compliances';
import EnvironmentalIncidentsPage from './pages/environmental-incidents';

// 健康管理页面
import OccupationalHealthChecksPage from './pages/occupational-health-checks';
import OccupationalDiseasesPage from './pages/occupational-diseases';
import HealthRecordsPage from './pages/health-records';

// 安全管理页面
import SafetyTrainingsPage from './pages/safety-trainings';
import SafetyInspectionsPage from './pages/safety-inspections';
import SafetyHazardsPage from './pages/safety-hazards';
import SafetyIncidentsPage from './pages/safety-incidents';

// 合规管理页面
import RegulationsPage from './pages/regulations';
import ComplianceChecksPage from './pages/compliance-checks';
import ComplianceReportsPage from './pages/compliance-reports';

const KuaiehsApp: React.FC = () => {
  return (
    <Routes>
      {/* 环境管理 */}
      <Route path="environment-monitorings" element={<EnvironmentMonitoringsPage />} />
      <Route path="emission-managements" element={<EmissionManagementsPage />} />
      <Route path="environmental-compliances" element={<EnvironmentalCompliancesPage />} />
      <Route path="environmental-incidents" element={<EnvironmentalIncidentsPage />} />
      
      {/* 健康管理 */}
      <Route path="occupational-health-checks" element={<OccupationalHealthChecksPage />} />
      <Route path="occupational-diseases" element={<OccupationalDiseasesPage />} />
      <Route path="health-records" element={<HealthRecordsPage />} />
      
      {/* 安全管理 */}
      <Route path="safety-trainings" element={<SafetyTrainingsPage />} />
      <Route path="safety-inspections" element={<SafetyInspectionsPage />} />
      <Route path="safety-hazards" element={<SafetyHazardsPage />} />
      <Route path="safety-incidents" element={<SafetyIncidentsPage />} />
      
      {/* 合规管理 */}
      <Route path="regulations" element={<RegulationsPage />} />
      <Route path="compliance-checks" element={<ComplianceChecksPage />} />
      <Route path="compliance-reports" element={<ComplianceReportsPage />} />
      
      {/* 默认路由 */}
      <Route index element={<div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>快格轻EHS</div>} />
      <Route path="*" element={<div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>页面未找到</div>} />
    </Routes>
  );
};

export default KuaiehsApp;

