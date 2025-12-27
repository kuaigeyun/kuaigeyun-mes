/**
 * 快格轻OA APP 入口文件
 */

import React from 'react';
import { Routes, Route } from 'react-router-dom';

// 流程审批页面
import ApprovalProcesssPage from './pages/approval-processs';
import ApprovalInstancesPage from './pages/approval-instances';
import ApprovalNodesPage from './pages/approval-nodes';

// 文档管理页面
import DocumentsPage from './pages/documents';
import DocumentVersionsPage from './pages/document-versions';

// 会议管理页面
import MeetingsPage from './pages/meetings';
import MeetingMinutessPage from './pages/meeting-minutess';
import MeetingResourcesPage from './pages/meeting-resources';

// 公告通知页面
import NoticesPage from './pages/notices';
import NotificationsPage from './pages/notifications';

const KuaioaApp: React.FC = () => {
  return (
    <Routes>
      {/* 流程审批 */}
      <Route path="approval-processs" element={<ApprovalProcesssPage />} />
      <Route path="approval-instances" element={<ApprovalInstancesPage />} />
      <Route path="approval-nodes" element={<ApprovalNodesPage />} />
      
      {/* 文档管理 */}
      <Route path="documents" element={<DocumentsPage />} />
      <Route path="document-versions" element={<DocumentVersionsPage />} />
      
      {/* 会议管理 */}
      <Route path="meetings" element={<MeetingsPage />} />
      <Route path="meeting-minutess" element={<MeetingMinutessPage />} />
      <Route path="meeting-resources" element={<MeetingResourcesPage />} />
      
      {/* 公告通知 */}
      <Route path="notices" element={<NoticesPage />} />
      <Route path="notifications" element={<NotificationsPage />} />
      
      {/* 默认路由 */}
      <Route index element={<div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>快格轻OA</div>} />
      <Route path="*" element={<div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>页面未找到</div>} />
    </Routes>
  );
};

export default KuaioaApp;

