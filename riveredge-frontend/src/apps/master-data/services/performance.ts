/**
 * 绩效数据 API 服务
 * 
 * 提供假期、技能的 API 调用方法
 */

import { api } from '@/services/api';
import type {
  Holiday,
  HolidayCreate,
  HolidayUpdate,
  HolidayListParams,
  Skill,
  SkillCreate,
  SkillUpdate,
  SkillListParams,
} from '../types/performance';

/**
 * 假期 API 服务
 */
export const holidayApi = {
  /**
   * 创建假期
   */
  create: async (data: HolidayCreate): Promise<Holiday> => {
    return api.post('/apps/master-data/performance/holidays', data);
  },

  /**
   * 获取假期列表
   */
  list: async (params?: HolidayListParams): Promise<Holiday[]> => {
    return api.get('/apps/master-data/performance/holidays', { params });
  },

  /**
   * 获取假期详情
   */
  get: async (uuid: string): Promise<Holiday> => {
    return api.get(`/apps/master-data/performance/holidays/${uuid}`);
  },

  /**
   * 更新假期
   */
  update: async (uuid: string, data: HolidayUpdate): Promise<Holiday> => {
    return api.put(`/apps/master-data/performance/holidays/${uuid}`, data);
  },

  /**
   * 删除假期
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/master-data/performance/holidays/${uuid}`);
  },
};

/**
 * 技能 API 服务
 */
export const skillApi = {
  /**
   * 创建技能
   */
  create: async (data: SkillCreate): Promise<Skill> => {
    return api.post('/apps/master-data/performance/skills', data);
  },

  /**
   * 获取技能列表
   */
  list: async (params?: SkillListParams): Promise<Skill[]> => {
    return api.get('/apps/master-data/performance/skills', { params });
  },

  /**
   * 获取技能详情
   */
  get: async (uuid: string): Promise<Skill> => {
    return api.get(`/apps/master-data/performance/skills/${uuid}`);
  },

  /**
   * 更新技能
   */
  update: async (uuid: string, data: SkillUpdate): Promise<Skill> => {
    return api.put(`/apps/master-data/performance/skills/${uuid}`, data);
  },

  /**
   * 删除技能
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/master-data/performance/skills/${uuid}`);
  },
};

