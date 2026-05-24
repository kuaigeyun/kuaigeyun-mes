/**
 * 报表与看板 APP 入口文件（重构版）
 * 分析中心已从快制造迁移至快报表。
 */

import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import PageSkeleton from '../../components/page-skeleton';
import ReportCenter from './pages/ReportCenter';
import ReportDesigner from './pages/ReportDesigner';
import ReportViewer from './pages/ReportViewer';
import ReportSharedView from './pages/ReportSharedView';
import DashboardList from './pages/DashboardList';
import DashboardDesigner from './pages/DashboardDesigner';
import DashboardView from './pages/DashboardView';
import DashboardSharedView from './pages/DashboardSharedView';
import PlaceholderPage from '../kuaizhizao/components/PlaceholderPage';

const DocumentTimingPage = lazy(() => import('../kuaizhizao/pages/analysis-center/document-timing'));
const DocumentEfficiencyPage = lazy(() => import('../kuaizhizao/pages/analysis-center/document-efficiency'));
const EfficiencyCenterDashboard = lazy(() => import('./pages/EfficiencyCenterDashboard'));

const withPageSuspense = (LazyComponent: React.LazyExoticComponent<React.ComponentType<any>>) => (
    <Suspense fallback={<PageSkeleton />}><LazyComponent /></Suspense>
);

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

            {/* 分析中心（从快制造迁移） */}
            <Route path="analysis-center" element={withPageSuspense(EfficiencyCenterDashboard)} />
            <Route path="analysis-center/document-timing" element={withPageSuspense(DocumentTimingPage)} />
            <Route path="analysis-center/document-efficiency" element={withPageSuspense(DocumentEfficiencyPage)} />
            <Route path="analysis-center/reports/sales-order-full-trace" element={<PlaceholderPage title="销售订单全链路跟踪" />} />
            <Route path="analysis-center/reports/purchase-order-full-trace" element={<PlaceholderPage title="采购订单全链路跟踪" />} />
            <Route path="analysis-center/reports/material-lifecycle-trace" element={<PlaceholderPage title="物料全生命周期跟踪" />} />
            <Route path="analysis-center/reports/business-status-dashboard" element={<PlaceholderPage title="业务单据状态看板" />} />

            {/* 默认跳转 */}
            <Route path="" element={<Navigate to="reports" replace />} />
        </Routes>
    );
};

export default KuaireportApp;
