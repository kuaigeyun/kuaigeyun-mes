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
import AttendanceRulesPage from './pages/attendance-rules';
import AttendanceRecordsPage from './pages/attendance-records';
import LeaveApplicationsPage from './pages/leave-applications';
import OvertimeApplicationsPage from './pages/overtime-applications';
import AttendanceStatisticsPage from './pages/attendance-statistics';

// 薪资管理页面
import SalaryStructuresPage from './pages/salary-structures';
import SalaryCalculationsPage from './pages/salary-calculations';
import SocialSecurityTaxesPage from './pages/social-security-taxes';
import SalaryPaymentsPage from './pages/salary-payments';

// 排班管理页面
import SchedulingPlansPage from './pages/scheduling-plans';
import SchedulingExecutionsPage from './pages/scheduling-executions';

const KuaihrmApp: React.FC = () => {
  return (
    <Routes>
      {/* 员工异动 */}
      <Route path="movement/onboarding" element={<EmployeeOnboardingsPage />} />
      <Route path="movement/offboarding" element={<EmployeeResignationsPage />} />
      <Route path="movement/transfer" element={<EmployeeTransfersPage />} />
      
      {/* 考勤管理 */}
      <Route path="attendance/rules" element={<AttendanceRulesPage />} />
      <Route path="attendance/records" element={<AttendanceRecordsPage />} />
      <Route path="attendance/leave-overtime" element={<LeaveApplicationsPage />} />
      <Route path="attendance/statistics" element={<AttendanceStatisticsPage />} />
      
      {/* 薪资管理 */}
      <Route path="salary/structure" element={<SalaryStructuresPage />} />
      <Route path="salary/calculate" element={<SalaryCalculationsPage />} />
      <Route path="salary/social-tax" element={<SocialSecurityTaxesPage />} />
      <Route path="salary/payment" element={<SalaryPaymentsPage />} />
      
      {/* 排班管理 */}
      <Route path="scheduling/plan" element={<SchedulingPlansPage />} />
      <Route path="scheduling/execution" element={<SchedulingExecutionsPage />} />
      
      {/* 兼容路由（直接访问） */}
      <Route path="employee-onboardings" element={<EmployeeOnboardingsPage />} />
      <Route path="employee-resignations" element={<EmployeeResignationsPage />} />
      <Route path="employee-transfers" element={<EmployeeTransfersPage />} />
      <Route path="attendance-rules" element={<AttendanceRulesPage />} />
      <Route path="attendance-records" element={<AttendanceRecordsPage />} />
      <Route path="leave-applications" element={<LeaveApplicationsPage />} />
      <Route path="overtime-applications" element={<OvertimeApplicationsPage />} />
      <Route path="attendance-statistics" element={<AttendanceStatisticsPage />} />
      <Route path="salary-structures" element={<SalaryStructuresPage />} />
      <Route path="salary-calculations" element={<SalaryCalculationsPage />} />
      <Route path="social-security-taxes" element={<SocialSecurityTaxesPage />} />
      <Route path="salary-payments" element={<SalaryPaymentsPage />} />
      <Route path="scheduling-plans" element={<SchedulingPlansPage />} />
      <Route path="scheduling-executions" element={<SchedulingExecutionsPage />} />
      
      {/* 默认路由 */}
      <Route index element={<div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>快格轻HRM</div>} />
      <Route path="*" element={<div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>页面未找到</div>} />
    </Routes>
  );
};

export default KuaihrmApp;
