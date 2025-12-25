/**
 * HRM数据类型定义
 * 
 * 定义员工异动、考勤、薪资、排班等的数据类型
 */

// ==================== 员工异动相关 ====================

export interface EmployeeOnboarding {
  id: number;
  uuid: string;
  tenantId?: number;
  onboardingNo: string;
  employeeId: number;
  employeeName: string;
  departmentId?: number;
  positionId?: number;
  onboardingDate: string;
  status: string;
  approvalInstanceId?: number;
  approvalStatus?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeOnboardingCreate {
  onboardingNo: string;
  employeeId: number;
  employeeName: string;
  departmentId?: number;
  positionId?: number;
  onboardingDate: string;
  status?: string;
  approvalInstanceId?: number;
  approvalStatus?: string;
}

export interface EmployeeOnboardingUpdate {
  employeeName?: string;
  departmentId?: number;
  positionId?: number;
  onboardingDate?: string;
  status?: string;
}

export interface EmployeeOnboardingListParams {
  skip?: number;
  limit?: number;
  status?: string;
  employeeId?: number;
}

export interface EmployeeResignation {
  id: number;
  uuid: string;
  tenantId?: number;
  resignationNo: string;
  employeeId: number;
  employeeName: string;
  resignationDate: string;
  resignationReason?: string;
  status: string;
  approvalInstanceId?: number;
  approvalStatus?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeResignationCreate {
  resignationNo: string;
  employeeId: number;
  employeeName: string;
  resignationDate: string;
  resignationReason?: string;
  status?: string;
  approvalInstanceId?: number;
  approvalStatus?: string;
}

export interface EmployeeResignationUpdate {
  employeeName?: string;
  resignationDate?: string;
  resignationReason?: string;
  status?: string;
}

export interface EmployeeResignationListParams {
  skip?: number;
  limit?: number;
  status?: string;
  employeeId?: number;
}

export interface EmployeeTransfer {
  id: number;
  uuid: string;
  tenantId?: number;
  transferNo: string;
  employeeId: number;
  employeeName: string;
  transferType: string;
  oldDepartmentId?: number;
  oldPositionId?: number;
  newDepartmentId?: number;
  newPositionId?: number;
  transferDate: string;
  transferReason?: string;
  status: string;
  approvalInstanceId?: number;
  approvalStatus?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeTransferCreate {
  transferNo: string;
  employeeId: number;
  employeeName: string;
  transferType: string;
  oldDepartmentId?: number;
  oldPositionId?: number;
  newDepartmentId?: number;
  newPositionId?: number;
  transferDate: string;
  transferReason?: string;
  status?: string;
  approvalInstanceId?: number;
  approvalStatus?: string;
}

export interface EmployeeTransferUpdate {
  employeeName?: string;
  transferType?: string;
  oldDepartmentId?: number;
  oldPositionId?: number;
  newDepartmentId?: number;
  newPositionId?: number;
  transferDate?: string;
  transferReason?: string;
  status?: string;
}

export interface EmployeeTransferListParams {
  skip?: number;
  limit?: number;
  status?: string;
  employeeId?: number;
  transferType?: string;
}

// ==================== 考勤管理相关 ====================

export interface AttendanceRule {
  id: number;
  uuid: string;
  tenantId?: number;
  ruleCode: string;
  ruleName: string;
  ruleType: string;
  workDays?: string[];
  workStartTime: string;
  workEndTime: string;
  breakDuration: number;
  lateTolerance: number;
  earlyLeaveTolerance: number;
  overtimeThreshold: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceRuleCreate {
  ruleCode: string;
  ruleName: string;
  ruleType: string;
  workDays?: string[];
  workStartTime: string;
  workEndTime: string;
  breakDuration?: number;
  lateTolerance?: number;
  earlyLeaveTolerance?: number;
  overtimeThreshold?: number;
  status?: string;
}

export interface AttendanceRuleUpdate {
  ruleName?: string;
  ruleType?: string;
  workDays?: string[];
  workStartTime?: string;
  workEndTime?: string;
  breakDuration?: number;
  lateTolerance?: number;
  earlyLeaveTolerance?: number;
  overtimeThreshold?: number;
  status?: string;
}

export interface AttendanceRuleListParams {
  skip?: number;
  limit?: number;
  ruleType?: string;
  status?: string;
}

export interface AttendanceRecord {
  id: number;
  uuid: string;
  tenantId?: number;
  recordDate: string;
  employeeId: number;
  employeeName: string;
  ruleId?: number;
  checkInTime?: string;
  checkOutTime?: string;
  checkInLocation?: string;
  checkOutLocation?: string;
  checkInMethod?: string;
  checkOutMethod?: string;
  workHours?: number;
  isLate: boolean;
  isEarlyLeave: boolean;
  isAbsent: boolean;
  isOvertime: boolean;
  overtimeHours: number;
  status: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceRecordCreate {
  recordDate: string;
  employeeId: number;
  employeeName: string;
  ruleId?: number;
  checkInTime?: string;
  checkOutTime?: string;
  checkInLocation?: string;
  checkOutLocation?: string;
  checkInMethod?: string;
  checkOutMethod?: string;
  workHours?: number;
  isLate?: boolean;
  isEarlyLeave?: boolean;
  isAbsent?: boolean;
  isOvertime?: boolean;
  overtimeHours?: number;
  status?: string;
  remark?: string;
}

export interface AttendanceRecordUpdate {
  ruleId?: number;
  checkInTime?: string;
  checkOutTime?: string;
  checkInLocation?: string;
  checkOutLocation?: string;
  checkInMethod?: string;
  checkOutMethod?: string;
  workHours?: number;
  isLate?: boolean;
  isEarlyLeave?: boolean;
  isAbsent?: boolean;
  isOvertime?: boolean;
  overtimeHours?: number;
  status?: string;
  remark?: string;
}

export interface AttendanceRecordListParams {
  skip?: number;
  limit?: number;
  employeeId?: number;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export interface LeaveApplication {
  id: number;
  uuid: string;
  tenantId?: number;
  applicationNo: string;
  employeeId: number;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  leaveDays: number;
  leaveHours: number;
  leaveReason?: string;
  status: string;
  approvalInstanceId?: number;
  approvalStatus?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveApplicationCreate {
  applicationNo: string;
  employeeId: number;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  leaveDays: number;
  leaveHours?: number;
  leaveReason?: string;
  status?: string;
  approvalInstanceId?: number;
  approvalStatus?: string;
}

export interface LeaveApplicationUpdate {
  employeeName?: string;
  leaveType?: string;
  startDate?: string;
  endDate?: string;
  leaveDays?: number;
  leaveHours?: number;
  leaveReason?: string;
  status?: string;
}

export interface LeaveApplicationListParams {
  skip?: number;
  limit?: number;
  employeeId?: number;
  leaveType?: string;
  status?: string;
}

export interface OvertimeApplication {
  id: number;
  uuid: string;
  tenantId?: number;
  applicationNo: string;
  employeeId: number;
  employeeName: string;
  overtimeDate: string;
  startTime: string;
  endTime: string;
  overtimeHours: number;
  overtimeReason?: string;
  status: string;
  approvalInstanceId?: number;
  approvalStatus?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OvertimeApplicationCreate {
  applicationNo: string;
  employeeId: number;
  employeeName: string;
  overtimeDate: string;
  startTime: string;
  endTime: string;
  overtimeHours: number;
  overtimeReason?: string;
  status?: string;
  approvalInstanceId?: number;
  approvalStatus?: string;
}

export interface OvertimeApplicationUpdate {
  employeeName?: string;
  overtimeDate?: string;
  startTime?: string;
  endTime?: string;
  overtimeHours?: number;
  overtimeReason?: string;
  status?: string;
}

export interface OvertimeApplicationListParams {
  skip?: number;
  limit?: number;
  employeeId?: number;
  status?: string;
}

export interface AttendanceStatistics {
  id: number;
  uuid: string;
  tenantId?: number;
  statisticsPeriod: string;
  employeeId: number;
  employeeName: string;
  workDays: number;
  actualWorkDays: number;
  leaveDays: number;
  overtimeHours: number;
  lateCount: number;
  earlyLeaveCount: number;
  absentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceStatisticsCreate {
  statisticsPeriod: string;
  employeeId: number;
  employeeName: string;
  workDays?: number;
  actualWorkDays?: number;
  leaveDays?: number;
  overtimeHours?: number;
  lateCount?: number;
  earlyLeaveCount?: number;
  absentCount?: number;
}

export interface AttendanceStatisticsUpdate {
  employeeName?: string;
  workDays?: number;
  actualWorkDays?: number;
  leaveDays?: number;
  overtimeHours?: number;
  lateCount?: number;
  earlyLeaveCount?: number;
  absentCount?: number;
}

export interface AttendanceStatisticsListParams {
  skip?: number;
  limit?: number;
  employeeId?: number;
  statisticsPeriod?: string;
}

// ==================== 薪资管理相关 ====================

export interface SalaryStructure {
  id: number;
  uuid: string;
  tenantId?: number;
  structureCode: string;
  structureName: string;
  structureType: string;
  baseSalary: number;
  performanceSalary: number;
  allowance: number;
  bonus: number;
  deduction: number;
  totalSalary: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface SalaryStructureCreate {
  structureCode: string;
  structureName: string;
  structureType: string;
  baseSalary?: number;
  performanceSalary?: number;
  allowance?: number;
  bonus?: number;
  deduction?: number;
  totalSalary: number;
  status?: string;
}

export interface SalaryStructureUpdate {
  structureName?: string;
  structureType?: string;
  baseSalary?: number;
  performanceSalary?: number;
  allowance?: number;
  bonus?: number;
  deduction?: number;
  totalSalary?: number;
  status?: string;
}

export interface SalaryStructureListParams {
  skip?: number;
  limit?: number;
  structureType?: string;
  status?: string;
}

export interface SalaryCalculation {
  id: number;
  uuid: string;
  tenantId?: number;
  calculationNo: string;
  employeeId: number;
  employeeName: string;
  salaryPeriod: string;
  structureId?: number;
  baseSalary: number;
  performanceSalary: number;
  allowance: number;
  bonus: number;
  deduction: number;
  socialSecurity: number;
  tax: number;
  totalSalary: number;
  actualSalary: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface SalaryCalculationCreate {
  calculationNo: string;
  employeeId: number;
  employeeName: string;
  salaryPeriod: string;
  structureId?: number;
  baseSalary?: number;
  performanceSalary?: number;
  allowance?: number;
  bonus?: number;
  deduction?: number;
  socialSecurity?: number;
  tax?: number;
  totalSalary: number;
  actualSalary: number;
  status?: string;
}

export interface SalaryCalculationUpdate {
  employeeName?: string;
  structureId?: number;
  baseSalary?: number;
  performanceSalary?: number;
  allowance?: number;
  bonus?: number;
  deduction?: number;
  socialSecurity?: number;
  tax?: number;
  totalSalary?: number;
  actualSalary?: number;
  status?: string;
}

export interface SalaryCalculationListParams {
  skip?: number;
  limit?: number;
  employeeId?: number;
  salaryPeriod?: string;
  status?: string;
}

export interface SocialSecurityTax {
  id: number;
  uuid: string;
  tenantId?: number;
  employeeId: number;
  employeeName: string;
  socialSecurityBase: number;
  pensionRate: number;
  medicalRate: number;
  unemploymentRate: number;
  workInjuryRate: number;
  maternityRate: number;
  housingFundRate: number;
  socialSecurityAmount: number;
  taxBase: number;
  taxRate: number;
  taxAmount: number;
  effectiveDate: string;
  expiryDate?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface SocialSecurityTaxCreate {
  employeeId: number;
  employeeName: string;
  socialSecurityBase: number;
  pensionRate?: number;
  medicalRate?: number;
  unemploymentRate?: number;
  workInjuryRate?: number;
  maternityRate?: number;
  housingFundRate?: number;
  socialSecurityAmount: number;
  taxBase: number;
  taxRate: number;
  taxAmount: number;
  effectiveDate: string;
  expiryDate?: string;
  status?: string;
}

export interface SocialSecurityTaxUpdate {
  employeeName?: string;
  socialSecurityBase?: number;
  pensionRate?: number;
  medicalRate?: number;
  unemploymentRate?: number;
  workInjuryRate?: number;
  maternityRate?: number;
  housingFundRate?: number;
  socialSecurityAmount?: number;
  taxBase?: number;
  taxRate?: number;
  taxAmount?: number;
  effectiveDate?: string;
  expiryDate?: string;
  status?: string;
}

export interface SocialSecurityTaxListParams {
  skip?: number;
  limit?: number;
  employeeId?: number;
  status?: string;
}

export interface SalaryPayment {
  id: number;
  uuid: string;
  tenantId?: number;
  paymentNo: string;
  paymentPeriod: string;
  paymentDate: string;
  employeeId: number;
  employeeName: string;
  calculationId?: number;
  paymentAmount: number;
  paymentMethod: string;
  bankAccount?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface SalaryPaymentCreate {
  paymentNo: string;
  paymentPeriod: string;
  paymentDate: string;
  employeeId: number;
  employeeName: string;
  calculationId?: number;
  paymentAmount: number;
  paymentMethod: string;
  bankAccount?: string;
  status?: string;
}

export interface SalaryPaymentUpdate {
  paymentPeriod?: string;
  paymentDate?: string;
  employeeName?: string;
  calculationId?: number;
  paymentAmount?: number;
  paymentMethod?: string;
  bankAccount?: string;
  status?: string;
}

export interface SalaryPaymentListParams {
  skip?: number;
  limit?: number;
  employeeId?: number;
  paymentPeriod?: string;
  status?: string;
}

// ==================== 排班管理相关 ====================

export interface SchedulingPlan {
  id: number;
  uuid: string;
  tenantId?: number;
  planNo: string;
  planName: string;
  planPeriod: string;
  startDate: string;
  endDate: string;
  departmentId?: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface SchedulingPlanCreate {
  planNo: string;
  planName: string;
  planPeriod: string;
  startDate: string;
  endDate: string;
  departmentId?: number;
  status?: string;
}

export interface SchedulingPlanUpdate {
  planName?: string;
  planPeriod?: string;
  startDate?: string;
  endDate?: string;
  departmentId?: number;
  status?: string;
}

export interface SchedulingPlanListParams {
  skip?: number;
  limit?: number;
  departmentId?: number;
  planPeriod?: string;
  status?: string;
}

export interface SchedulingExecution {
  id: number;
  uuid: string;
  tenantId?: number;
  planId: number;
  planNo: string;
  executionDate: string;
  employeeId: number;
  employeeName: string;
  shiftType: string;
  startTime: string;
  endTime: string;
  workHours?: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface SchedulingExecutionCreate {
  planId: number;
  planNo: string;
  executionDate: string;
  employeeId: number;
  employeeName: string;
  shiftType: string;
  startTime: string;
  endTime: string;
  workHours?: number;
  status?: string;
}

export interface SchedulingExecutionUpdate {
  planId?: number;
  planNo?: string;
  executionDate?: string;
  employeeName?: string;
  shiftType?: string;
  startTime?: string;
  endTime?: string;
  workHours?: number;
  status?: string;
}

export interface SchedulingExecutionListParams {
  skip?: number;
  limit?: number;
  planId?: number;
  employeeId?: number;
  status?: string;
}

