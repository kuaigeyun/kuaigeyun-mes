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

