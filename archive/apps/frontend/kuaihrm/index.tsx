/**
 * 快格轻HRM APP 入口文件
 */

import React from 'react';
import { Routes, Route } from 'react-router-dom';

// 员工异动页面
import EmployeeOnboardingsPage from './pages/employee-onboardings';
import EmployeeResignationsPage from './pages/employee-resignations';
import EmployeeTransfersPage from './pages/employee-transfers';

// 考勤管理页面
import AttendanceRulesPage from './pages/attendance/rules';

// 占位符组件（用于尚未实现的页面）
const PlaceholderPage: React.FC<{ title: string }> = ({ title }) => (
  <div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>
    {title} 页面开发中...
  </div>
);

const KuaihrmApp: React.FC = () => {
  return (
    <Routes>
      {/* 员工异动 */}
      <Route path="movement/onboarding" element={<EmployeeOnboardingsPage />} />
      <Route path="movement/offboarding" element={<EmployeeResignationsPage />} />
      <Route path="movement/transfer" element={<EmployeeTransfersPage />} />
      
      {/* 考勤管理 */}
      <Route path="attendance/rules" element={<AttendanceRulesPage />} />
      <Route path="attendance/records" element={<PlaceholderPage title="考勤记录" />} />
      <Route path="attendance/leave-overtime" element={<PlaceholderPage title="请假加班申请" />} />
      <Route path="attendance/statistics" element={<PlaceholderPage title="考勤统计" />} />
      
      {/* 薪资管理 */}
      <Route path="salary/structure" element={<PlaceholderPage title="薪资结构" />} />
      <Route path="salary/calculate" element={<PlaceholderPage title="薪资计算" />} />
      <Route path="salary/social-tax" element={<PlaceholderPage title="社保税费" />} />
      <Route path="salary/payment" element={<PlaceholderPage title="薪资发放" />} />
      
      {/* 排班管理 */}
      <Route path="scheduling/plan" element={<PlaceholderPage title="排班计划" />} />
      <Route path="scheduling/execution" element={<PlaceholderPage title="排班执行" />} />
      
      {/* 兼容路由（直接访问） */}
      <Route path="employee-onboardings" element={<EmployeeOnboardingsPage />} />
      <Route path="employee-resignations" element={<EmployeeResignationsPage />} />
      <Route path="employee-transfers" element={<EmployeeTransfersPage />} />
      <Route path="attendance-rules" element={<AttendanceRulesPage />} />
      <Route path="attendance-records" element={<PlaceholderPage title="考勤记录" />} />
      <Route path="leave-applications" element={<PlaceholderPage title="请假申请" />} />
      <Route path="overtime-applications" element={<PlaceholderPage title="加班申请" />} />
      <Route path="attendance-statistics" element={<PlaceholderPage title="考勤统计" />} />
      <Route path="salary-structures" element={<PlaceholderPage title="薪资结构" />} />
      <Route path="salary-calculations" element={<PlaceholderPage title="薪资计算" />} />
      <Route path="social-security-taxes" element={<PlaceholderPage title="社保税费" />} />
      <Route path="salary-payments" element={<PlaceholderPage title="薪资发放" />} />
      <Route path="scheduling-plans" element={<PlaceholderPage title="排班计划" />} />
      <Route path="scheduling-executions" element={<PlaceholderPage title="排班执行" />} />
      
      {/* 默认路由 */}
      <Route index element={<div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>快格轻HRM</div>} />
      <Route path="*" element={<div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>页面未找到</div>} />
    </Routes>
  );
};

export default KuaihrmApp;
