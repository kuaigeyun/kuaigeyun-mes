/**
 * 报表与看板 APP 入口文件（重构版）
 * 弃用 Univer / JimuReport，改用自研报表中心
 */

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ReportCenter from './pages/ReportCenter';
import ReportDesigner from './pages/ReportDesigner';
import ReportViewer from './pages/ReportViewer';
import ReportSharedView from './pages/ReportSharedView';
import DashboardList from './pages/DashboardList';
import DashboardDesigner from './pages/DashboardDesigner';
import DashboardView from './pages/DashboardView';
import DashboardSharedView from './pages/DashboardSharedView';

const KuaireportApp: React.FC = () => {
    return (
        <Routes>
            {/* 报表中心 */}
            <Route path="reports" element={<ReportCenter />} />
            <Route path="reports/new" element={<ReportDesigner />} />
            <Route path="reports/shared" element={<ReportSharedView />} />
            <Route path="reports/:id" element={<ReportViewer />} />
            <Route path="reports/:id/edit" element={<ReportDesigner />} />

            {/* 看板 */}
            <Route path="dashboards" element={<DashboardList />} />
            <Route path="dashboards/shared" element={<DashboardSharedView />} />
            <Route path="dashboards/:id" element={<DashboardView />} />
            <Route path="dashboard-designer" element={<DashboardDesigner />} />
            <Route path="dashboard-view" element={<DashboardView />} />

            {/* 默认跳转 */}
            <Route path="" element={<Navigate to="reports" replace />} />
        </Routes>
    );
};

export default KuaireportApp;
