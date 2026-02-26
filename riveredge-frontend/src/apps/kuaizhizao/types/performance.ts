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
  startDate?: string; // ISO date string (YYYY-MM-DD)
  endDate?: string; // ISO date string (YYYY-MM-DD)
  isActive?: boolean;
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

export interface PieceRate {
  id: number;
  uuid: string;
  tenant_id?: number;
  operation_id: number;
  operation_code?: string;
  operation_name?: string;
  material_id?: number;
  material_code?: string;
  rate: number;
  effective_from?: string;
  effective_to?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PieceRateCreate {
  operation_id: number;
  operation_code?: string;
  operation_name?: string;
  material_id?: number;
  material_code?: string;
  rate: number;
  effective_from?: string;
  effective_to?: string;
  is_active?: boolean;
}

export interface PieceRateUpdate {
  operation_code?: string;
  operation_name?: string;
  material_id?: number;
  material_code?: string;
  rate?: number;
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
}

/** 工序（用于计件单价选择，从主数据 process API 获取） */
export interface Operation {
  id: number;
  uuid: string;
  code: string;
  name: string;
  isActive?: boolean;
  is_active?: boolean;
}
