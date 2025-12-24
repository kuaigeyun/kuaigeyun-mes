/**
 * HRM数据 API 服务
 * 
 * 提供员工异动、考勤、薪资、排班等的 API 调用方法
 */

import { api } from '../../../services/api';
import type {
  EmployeeOnboarding,
  EmployeeOnboardingCreate,
  EmployeeOnboardingUpdate,
  EmployeeOnboardingListParams,
  EmployeeResignation,
  EmployeeResignationCreate,
  EmployeeResignationUpdate,
  EmployeeResignationListParams,
  EmployeeTransfer,
  EmployeeTransferCreate,
  EmployeeTransferUpdate,
  EmployeeTransferListParams,
  AttendanceRule,
  AttendanceRuleCreate,
  AttendanceRuleUpdate,
  AttendanceRuleListParams,
  AttendanceRecord,
  AttendanceRecordCreate,
  AttendanceRecordUpdate,
  AttendanceRecordListParams,
  LeaveApplication,
  LeaveApplicationCreate,
  LeaveApplicationUpdate,
  LeaveApplicationListParams,
  OvertimeApplication,
  OvertimeApplicationCreate,
  OvertimeApplicationUpdate,
  OvertimeApplicationListParams,
  AttendanceStatistics,
  AttendanceStatisticsCreate,
  AttendanceStatisticsUpdate,
  AttendanceStatisticsListParams,
  SalaryStructure,
  SalaryStructureCreate,
  SalaryStructureUpdate,
  SalaryStructureListParams,
  SalaryCalculation,
  SalaryCalculationCreate,
  SalaryCalculationUpdate,
  SalaryCalculationListParams,
  SocialSecurityTax,
  SocialSecurityTaxCreate,
  SocialSecurityTaxUpdate,
  SocialSecurityTaxListParams,
  SalaryPayment,
  SalaryPaymentCreate,
  SalaryPaymentUpdate,
  SalaryPaymentListParams,
  SchedulingPlan,
  SchedulingPlanCreate,
  SchedulingPlanUpdate,
  SchedulingPlanListParams,
  SchedulingExecution,
  SchedulingExecutionCreate,
  SchedulingExecutionUpdate,
  SchedulingExecutionListParams,
} from '../types/process';

/**
 * 员工入职 API 服务
 */
export const employeeOnboardingApi = {
  create: async (data: EmployeeOnboardingCreate): Promise<EmployeeOnboarding> => {
    return api.post('/kuaihrm/employee-onboardings', data);
  },
  list: async (params?: EmployeeOnboardingListParams): Promise<EmployeeOnboarding[]> => {
    return api.get('/kuaihrm/employee-onboardings', { params });
  },
  get: async (uuid: string): Promise<EmployeeOnboarding> => {
    return api.get(`/kuaihrm/employee-onboardings/${uuid}`);
  },
  update: async (uuid: string, data: EmployeeOnboardingUpdate): Promise<EmployeeOnboarding> => {
    return api.put(`/kuaihrm/employee-onboardings/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaihrm/employee-onboardings/${uuid}`);
  },
};

/**
 * 员工离职 API 服务
 */
export const employeeResignationApi = {
  create: async (data: EmployeeResignationCreate): Promise<EmployeeResignation> => {
    return api.post('/kuaihrm/employee-resignations', data);
  },
  list: async (params?: EmployeeResignationListParams): Promise<EmployeeResignation[]> => {
    return api.get('/kuaihrm/employee-resignations', { params });
  },
  get: async (uuid: string): Promise<EmployeeResignation> => {
    return api.get(`/kuaihrm/employee-resignations/${uuid}`);
  },
  update: async (uuid: string, data: EmployeeResignationUpdate): Promise<EmployeeResignation> => {
    return api.put(`/kuaihrm/employee-resignations/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaihrm/employee-resignations/${uuid}`);
  },
};

/**
 * 员工异动 API 服务
 */
export const employeeTransferApi = {
  create: async (data: EmployeeTransferCreate): Promise<EmployeeTransfer> => {
    return api.post('/kuaihrm/employee-transfers', data);
  },
  list: async (params?: EmployeeTransferListParams): Promise<EmployeeTransfer[]> => {
    return api.get('/kuaihrm/employee-transfers', { params });
  },
  get: async (uuid: string): Promise<EmployeeTransfer> => {
    return api.get(`/kuaihrm/employee-transfers/${uuid}`);
  },
  update: async (uuid: string, data: EmployeeTransferUpdate): Promise<EmployeeTransfer> => {
    return api.put(`/kuaihrm/employee-transfers/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaihrm/employee-transfers/${uuid}`);
  },
};

/**
 * 考勤规则 API 服务
 */
export const attendanceRuleApi = {
  create: async (data: AttendanceRuleCreate): Promise<AttendanceRule> => {
    return api.post('/kuaihrm/attendance-rules', data);
  },
  list: async (params?: AttendanceRuleListParams): Promise<AttendanceRule[]> => {
    return api.get('/kuaihrm/attendance-rules', { params });
  },
  get: async (uuid: string): Promise<AttendanceRule> => {
    return api.get(`/kuaihrm/attendance-rules/${uuid}`);
  },
  update: async (uuid: string, data: AttendanceRuleUpdate): Promise<AttendanceRule> => {
    return api.put(`/kuaihrm/attendance-rules/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaihrm/attendance-rules/${uuid}`);
  },
};

/**
 * 打卡记录 API 服务
 */
export const attendanceRecordApi = {
  create: async (data: AttendanceRecordCreate): Promise<AttendanceRecord> => {
    return api.post('/kuaihrm/attendance-records', data);
  },
  list: async (params?: AttendanceRecordListParams): Promise<AttendanceRecord[]> => {
    return api.get('/kuaihrm/attendance-records', { params });
  },
  get: async (uuid: string): Promise<AttendanceRecord> => {
    return api.get(`/kuaihrm/attendance-records/${uuid}`);
  },
  update: async (uuid: string, data: AttendanceRecordUpdate): Promise<AttendanceRecord> => {
    return api.put(`/kuaihrm/attendance-records/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaihrm/attendance-records/${uuid}`);
  },
};

/**
 * 请假申请 API 服务
 */
export const leaveApplicationApi = {
  create: async (data: LeaveApplicationCreate): Promise<LeaveApplication> => {
    return api.post('/kuaihrm/leave-applications', data);
  },
  list: async (params?: LeaveApplicationListParams): Promise<LeaveApplication[]> => {
    return api.get('/kuaihrm/leave-applications', { params });
  },
  get: async (uuid: string): Promise<LeaveApplication> => {
    return api.get(`/kuaihrm/leave-applications/${uuid}`);
  },
  update: async (uuid: string, data: LeaveApplicationUpdate): Promise<LeaveApplication> => {
    return api.put(`/kuaihrm/leave-applications/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaihrm/leave-applications/${uuid}`);
  },
};

/**
 * 加班申请 API 服务
 */
export const overtimeApplicationApi = {
  create: async (data: OvertimeApplicationCreate): Promise<OvertimeApplication> => {
    return api.post('/kuaihrm/overtime-applications', data);
  },
  list: async (params?: OvertimeApplicationListParams): Promise<OvertimeApplication[]> => {
    return api.get('/kuaihrm/overtime-applications', { params });
  },
  get: async (uuid: string): Promise<OvertimeApplication> => {
    return api.get(`/kuaihrm/overtime-applications/${uuid}`);
  },
  update: async (uuid: string, data: OvertimeApplicationUpdate): Promise<OvertimeApplication> => {
    return api.put(`/kuaihrm/overtime-applications/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaihrm/overtime-applications/${uuid}`);
  },
};

/**
 * 考勤统计 API 服务
 */
export const attendanceStatisticsApi = {
  create: async (data: AttendanceStatisticsCreate): Promise<AttendanceStatistics> => {
    return api.post('/kuaihrm/attendance-statistics', data);
  },
  list: async (params?: AttendanceStatisticsListParams): Promise<AttendanceStatistics[]> => {
    return api.get('/kuaihrm/attendance-statistics', { params });
  },
  get: async (uuid: string): Promise<AttendanceStatistics> => {
    return api.get(`/kuaihrm/attendance-statistics/${uuid}`);
  },
  update: async (uuid: string, data: AttendanceStatisticsUpdate): Promise<AttendanceStatistics> => {
    return api.put(`/kuaihrm/attendance-statistics/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaihrm/attendance-statistics/${uuid}`);
  },
};

/**
 * 薪资结构 API 服务
 */
export const salaryStructureApi = {
  create: async (data: SalaryStructureCreate): Promise<SalaryStructure> => {
    return api.post('/kuaihrm/salary-structures', data);
  },
  list: async (params?: SalaryStructureListParams): Promise<SalaryStructure[]> => {
    return api.get('/kuaihrm/salary-structures', { params });
  },
  get: async (uuid: string): Promise<SalaryStructure> => {
    return api.get(`/kuaihrm/salary-structures/${uuid}`);
  },
  update: async (uuid: string, data: SalaryStructureUpdate): Promise<SalaryStructure> => {
    return api.put(`/kuaihrm/salary-structures/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaihrm/salary-structures/${uuid}`);
  },
};

/**
 * 薪资计算 API 服务
 */
export const salaryCalculationApi = {
  create: async (data: SalaryCalculationCreate): Promise<SalaryCalculation> => {
    return api.post('/kuaihrm/salary-calculations', data);
  },
  list: async (params?: SalaryCalculationListParams): Promise<SalaryCalculation[]> => {
    return api.get('/kuaihrm/salary-calculations', { params });
  },
  get: async (uuid: string): Promise<SalaryCalculation> => {
    return api.get(`/kuaihrm/salary-calculations/${uuid}`);
  },
  update: async (uuid: string, data: SalaryCalculationUpdate): Promise<SalaryCalculation> => {
    return api.put(`/kuaihrm/salary-calculations/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaihrm/salary-calculations/${uuid}`);
  },
};

/**
 * 社保个税 API 服务
 */
export const socialSecurityTaxApi = {
  create: async (data: SocialSecurityTaxCreate): Promise<SocialSecurityTax> => {
    return api.post('/kuaihrm/social-security-taxes', data);
  },
  list: async (params?: SocialSecurityTaxListParams): Promise<SocialSecurityTax[]> => {
    return api.get('/kuaihrm/social-security-taxes', { params });
  },
  get: async (uuid: string): Promise<SocialSecurityTax> => {
    return api.get(`/kuaihrm/social-security-taxes/${uuid}`);
  },
  update: async (uuid: string, data: SocialSecurityTaxUpdate): Promise<SocialSecurityTax> => {
    return api.put(`/kuaihrm/social-security-taxes/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaihrm/social-security-taxes/${uuid}`);
  },
};

/**
 * 薪资发放 API 服务
 */
export const salaryPaymentApi = {
  create: async (data: SalaryPaymentCreate): Promise<SalaryPayment> => {
    return api.post('/kuaihrm/salary-payments', data);
  },
  list: async (params?: SalaryPaymentListParams): Promise<SalaryPayment[]> => {
    return api.get('/kuaihrm/salary-payments', { params });
  },
  get: async (uuid: string): Promise<SalaryPayment> => {
    return api.get(`/kuaihrm/salary-payments/${uuid}`);
  },
  update: async (uuid: string, data: SalaryPaymentUpdate): Promise<SalaryPayment> => {
    return api.put(`/kuaihrm/salary-payments/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaihrm/salary-payments/${uuid}`);
  },
};

/**
 * 排班计划 API 服务
 */
export const schedulingPlanApi = {
  create: async (data: SchedulingPlanCreate): Promise<SchedulingPlan> => {
    return api.post('/kuaihrm/scheduling-plans', data);
  },
  list: async (params?: SchedulingPlanListParams): Promise<SchedulingPlan[]> => {
    return api.get('/kuaihrm/scheduling-plans', { params });
  },
  get: async (uuid: string): Promise<SchedulingPlan> => {
    return api.get(`/kuaihrm/scheduling-plans/${uuid}`);
  },
  update: async (uuid: string, data: SchedulingPlanUpdate): Promise<SchedulingPlan> => {
    return api.put(`/kuaihrm/scheduling-plans/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaihrm/scheduling-plans/${uuid}`);
  },
};

/**
 * 排班执行 API 服务
 */
export const schedulingExecutionApi = {
  create: async (data: SchedulingExecutionCreate): Promise<SchedulingExecution> => {
    return api.post('/kuaihrm/scheduling-executions', data);
  },
  list: async (params?: SchedulingExecutionListParams): Promise<SchedulingExecution[]> => {
    return api.get('/kuaihrm/scheduling-executions', { params });
  },
  get: async (uuid: string): Promise<SchedulingExecution> => {
    return api.get(`/kuaihrm/scheduling-executions/${uuid}`);
  },
  update: async (uuid: string, data: SchedulingExecutionUpdate): Promise<SchedulingExecution> => {
    return api.put(`/kuaihrm/scheduling-executions/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaihrm/scheduling-executions/${uuid}`);
  },
};

