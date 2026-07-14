/**
 * 绩效数据类型定义
 *
 * 定义假期、技能的数据类型
 */

export interface Holiday {
  id: number;
  uuid: string;
  tenantId: number;
  name: string;
  holidayDate: string; // ISO date string (YYYY-MM-DD)
  holidayType?: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdByName?: string;
  updatedByName?: string;
  deletedAt?: string;
}

export interface HolidayCreate {
  name: string;
  holidayDate: string; // ISO date string (YYYY-MM-DD)
  holidayType?: string;
  description?: string;
  isActive?: boolean;
}

export interface HolidayUpdate {
  name?: string;
  holidayDate?: string; // ISO date string (YYYY-MM-DD)
  holidayType?: string;
  description?: string;
  isActive?: boolean;
}

export interface HolidayListParams {
  skip?: number;
  limit?: number;
  holidayType?: string;
  holiday_type?: string;
  startDate?: string;
  start_date?: string;
  endDate?: string;
  end_date?: string;
  isActive?: boolean;
  is_active?: boolean;
  keyword?: string;
  order_by?: string;
  created_start_date?: string;
  created_end_date?: string;
  updated_start_date?: string;
  updated_end_date?: string;
}

/** 休息制度：双休 / 单休 / 自定义 */
export type HolidayCnRestMode = 'double' | 'single' | 'custom';

export interface HolidayCnImportRequest {
  year: number;
  restMode: HolidayCnRestMode;
  /** Python weekday：周一=0 … 周日=6 */
  restWeekdays?: number[];
}

export interface HolidayCnImportResult {
  year: number;
  created: number;
  skipped: number;
  failed: number;
  legalCount: number;
  weekendCount: number;
}

export interface PerformanceListResult<T> {
  items: T[];
  total: number;
}

export interface Skill {
  id: number;
  uuid: string;
  tenantId: number;
  code: string;
  name: string;
  category?: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdByName?: string;
  updatedByName?: string;
  deletedAt?: string;
}

export interface SkillCreate {
  code: string;
  name: string;
  category?: string;
  description?: string;
  isActive?: boolean;
}

export interface SkillUpdate {
  code?: string;
  name?: string;
  category?: string;
  description?: string;
  isActive?: boolean;
}

export interface SkillListParams {
  skip?: number;
  limit?: number;
  category?: string;
  isActive?: boolean;
  is_active?: boolean;
  keyword?: string;
  order_by?: string;
  created_start_date?: string;
  created_end_date?: string;
  updated_start_date?: string;
  updated_end_date?: string;
}

// ==================== 员工绩效 ====================
// 注意：后端返回 snake_case，前端类型与之对应

export interface EmployeePerformanceConfig {
  id: number;
  uuid: string;
  tenant_id?: number;
  employee_id: number;
  employee_name?: string;
  calc_mode: string; // time | piece | mixed
  piece_rate_mode?: string;
  hourly_rate?: number;
  default_piece_rate?: number;
  base_salary?: number;
  effective_from?: string;
  effective_to?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by_name?: string;
  updated_by_name?: string;
}

export interface EmployeePerformanceConfigCreate {
  employee_id: number;
  employee_name?: string;
  calc_mode?: string;
  piece_rate_mode?: string;
  hourly_rate?: number;
  default_piece_rate?: number;
  base_salary?: number;
  effective_from?: string;
  effective_to?: string;
  is_active?: boolean;
}

export interface EmployeePerformanceConfigUpdate {
  employee_name?: string;
  calc_mode?: string;
  piece_rate_mode?: string;
  hourly_rate?: number;
  default_piece_rate?: number;
  base_salary?: number;
  effective_from?: string;
  effective_to?: string;
  is_active?: boolean;
}

export interface HourlyRate {
  id: number;
  uuid: string;
  tenant_id?: number;
  department_id?: number;
  department_name?: string;
  position_id?: number;
  position_name?: string;
  rate: number;
  effective_from?: string;
  effective_to?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by_name?: string;
  updated_by_name?: string;
}

export interface HourlyRateCreate {
  department_id?: number;
  department_name?: string;
  position_id?: number;
  position_name?: string;
  rate: number;
  effective_from?: string;
  effective_to?: string;
  is_active?: boolean;
}

export interface HourlyRateUpdate {
  department_id?: number;
  department_name?: string;
  position_id?: number;
  position_name?: string;
  rate?: number;
  effective_from?: string;
  effective_to?: string;
  is_active?: boolean;
}

export interface KPIDefinition {
  id: number;
  uuid: string;
  tenant_id?: number;
  code: string;
  name: string;
  weight: number;
  calc_type: string;
  formula_json?: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by_name?: string;
  updated_by_name?: string;
}

export interface KPIDefinitionCreate {
  code: string;
  name: string;
  weight?: number;
  calc_type: string;
  formula_json?: any;
  is_active?: boolean;
}

export interface KPIDefinitionUpdate {
  name?: string;
  weight?: number;
  calc_type?: string;
  formula_json?: any;
  is_active?: boolean;
}

export interface PerformanceSummary {
  id: number;
  uuid: string;
  tenant_id?: number;
  employee_id: number;
  employee_name?: string;
  period: string;
  total_hours: number;
  total_pieces: number;
  total_unqualified: number;
  time_amount: number;
  piece_amount: number;
  total_amount: number;
  kpi_score?: number;
  kpi_coefficient?: number;
  status: string;
  created_at: string;
  updated_at: string;
  created_by_name?: string;
  updated_by_name?: string;
}

export interface PerformanceDetailItem {
  reporting_record_id: number;
  work_order_code: string;
  operation_name: string;
  reported_at: string;
  reported_quantity: number;
  qualified_quantity: number;
  unqualified_quantity: number;
  work_hours: number;
  piece_rate?: number;
  piece_amount?: number;
  time_amount?: number;
}

export interface PerformanceDetail {
  employee_id: number;
  employee_name?: string;
  period: string;
  summary?: PerformanceSummary;
  items: PerformanceDetailItem[];
  kpi_scores?: Array<{ kpi_code: string; score: number; source_data_json?: Record<string, unknown> }>;
}

export interface Shift {
  id: number;
  uuid: string;
  tenantId: number;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  crossesMidnight: boolean;
  standardHours: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdByName?: string;
  updatedByName?: string;
}

export interface ShiftCreate {
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  crossesMidnight?: boolean;
  standardHours?: number;
  isActive?: boolean;
}

export interface ShiftUpdate {
  code?: string;
  name?: string;
  startTime?: string;
  endTime?: string;
  crossesMidnight?: boolean;
  standardHours?: number;
  isActive?: boolean;
}

export interface ShiftAssignment {
  id?: number;
  employeeId: number;
  employeeName?: string;
  workDate: string;
  shiftId?: number | null;
  shiftCode?: string;
  shiftName?: string;
}

export interface ShiftRoster {
  id: number;
  uuid: string;
  tenantId: number;
  scopeType: 'work_group' | 'employee';
  workGroupId?: number | null;
  workGroupCode?: string;
  workGroupName?: string;
  employeeId?: number | null;
  employeeName?: string;
  periodStart: string;
  periodEnd: string;
  status: 'draft' | 'published';
  publishedAt?: string;
  remarks?: string;
  assignments?: ShiftAssignment[];
  createdAt: string;
  updatedAt: string;
  createdByName?: string;
  updatedByName?: string;
}

export interface ShiftRosterCreate {
  scopeType?: 'work_group' | 'employee';
  workGroupId?: number;
  employeeId?: number;
  periodStart: string;
  remarks?: string;
}
