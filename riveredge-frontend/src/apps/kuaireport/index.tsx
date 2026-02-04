/**
 * 快格报表 APP 入口文件
 */

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ReportDesigner from './pages/ReportDesigner';
import JimuReportDesigner from './pages/JimuReportDesigner';
import DashboardDesigner from './pages/DashboardDesigner';
import ReportList from './pages/ReportList';
import DashboardList from './pages/DashboardList';
import DashboardView from './pages/DashboardView';
import ReportGridViewer from './pages/ReportGridViewer';

const KuaireportApp: React.FC = () => {
    return (
        <Routes>
            <Route path="reports" element={<ReportList />} />
            <Route path="report-designer" element={<ReportDesigner />} />
            <Route path="jimu-designer" element={<JimuReportDesigner />} />
            <Route path="report-grid" element={<ReportGridViewer />} />
            <Route path="dashboards" element={<DashboardList />} />
            <Route path="dashboard-designer" element={<DashboardDesigner />} />
            <Route path="dashboard-view" element={<DashboardView />} />
            {/* Redirect default path back to reports */}
            <Route path="" element={<Navigate to="reports" replace />} />
        </Routes>
    );
};

export default KuaireportApp;
