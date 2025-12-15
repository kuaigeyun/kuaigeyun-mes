/**
 * PDM 数据 API 服务
 * 
 * 提供设计变更、工程变更、设计评审、研发流程、知识管理等的 API 调用方法
 */

import { api } from '@/services/api';
import type {
  DesignChange,
  DesignChangeCreate,
  DesignChangeUpdate,
  EngineeringChange,
  EngineeringChangeCreate,
  EngineeringChangeUpdate,
  DesignReview,
  DesignReviewCreate,
  DesignReviewUpdate,
  ResearchProcess,
  ResearchProcessCreate,
  ResearchProcessUpdate,
  Knowledge,
  KnowledgeCreate,
  KnowledgeUpdate,
} from '../types/process';

/**
 * 设计变更 API 服务
 */
export const designChangeApi = {
  /**
   * 创建设计变更
   */
  create: async (data: DesignChangeCreate): Promise<DesignChange> => {
    return api.post('/apps/kuaipdm/design-changes', data);
  },

  /**
   * 获取设计变更列表
   */
  list: async (params?: { skip?: number; limit?: number; status?: string; change_type?: string }): Promise<DesignChange[]> => {
    return api.get('/apps/kuaipdm/design-changes', { params });
  },

  /**
   * 获取设计变更详情
   */
  get: async (uuid: string): Promise<DesignChange> => {
    return api.get(`/apps/kuaipdm/design-changes/${uuid}`);
  },

  /**
   * 更新设计变更
   */
  update: async (uuid: string, data: DesignChangeUpdate): Promise<DesignChange> => {
    return api.put(`/apps/kuaipdm/design-changes/${uuid}`, data);
  },

  /**
   * 删除设计变更
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaipdm/design-changes/${uuid}`);
  },

  /**
   * 提交设计变更审批
   */
  submitApproval: async (uuid: string, processCode: string): Promise<DesignChange> => {
    return api.post(`/apps/kuaipdm/design-changes/${uuid}/submit-approval`, null, {
      params: { process_code: processCode },
    });
  },
};

/**
 * 工程变更 API 服务
 */
export const engineeringChangeApi = {
  /**
   * 创建工程变更
   */
  create: async (data: EngineeringChangeCreate): Promise<EngineeringChange> => {
    return api.post('/apps/kuaipdm/engineering-changes', data);
  },

  /**
   * 获取工程变更列表
   */
  list: async (params?: { skip?: number; limit?: number; status?: string; change_type?: string }): Promise<EngineeringChange[]> => {
    return api.get('/apps/kuaipdm/engineering-changes', { params });
  },

  /**
   * 获取工程变更详情
   */
  get: async (uuid: string): Promise<EngineeringChange> => {
    return api.get(`/apps/kuaipdm/engineering-changes/${uuid}`);
  },

  /**
   * 更新工程变更
   */
  update: async (uuid: string, data: EngineeringChangeUpdate): Promise<EngineeringChange> => {
    return api.put(`/apps/kuaipdm/engineering-changes/${uuid}`, data);
  },

  /**
   * 删除工程变更
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaipdm/engineering-changes/${uuid}`);
  },
};

/**
 * 设计评审 API 服务
 */
export const designReviewApi = {
  /**
   * 创建设计评审
   */
  create: async (data: DesignReviewCreate): Promise<DesignReview> => {
    return api.post('/apps/kuaipdm/design-reviews', data);
  },

  /**
   * 获取设计评审列表
   */
  list: async (params?: { skip?: number; limit?: number; status?: string; review_type?: string }): Promise<DesignReview[]> => {
    return api.get('/apps/kuaipdm/design-reviews', { params });
  },

  /**
   * 获取设计评审详情
   */
  get: async (uuid: string): Promise<DesignReview> => {
    return api.get(`/apps/kuaipdm/design-reviews/${uuid}`);
  },

  /**
   * 更新设计评审
   */
  update: async (uuid: string, data: DesignReviewUpdate): Promise<DesignReview> => {
    return api.put(`/apps/kuaipdm/design-reviews/${uuid}`, data);
  },

  /**
   * 删除设计评审
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaipdm/design-reviews/${uuid}`);
  },
};

/**
 * 研发流程 API 服务
 */
export const researchProcessApi = {
  /**
   * 创建研发流程
   */
  create: async (data: ResearchProcessCreate): Promise<ResearchProcess> => {
    return api.post('/apps/kuaipdm/research-processes', data);
  },

  /**
   * 获取研发流程列表
   */
  list: async (params?: { skip?: number; limit?: number; status?: string; process_type?: string }): Promise<ResearchProcess[]> => {
    return api.get('/apps/kuaipdm/research-processes', { params });
  },

  /**
   * 获取研发流程详情
   */
  get: async (uuid: string): Promise<ResearchProcess> => {
    return api.get(`/apps/kuaipdm/research-processes/${uuid}`);
  },

  /**
   * 更新研发流程
   */
  update: async (uuid: string, data: ResearchProcessUpdate): Promise<ResearchProcess> => {
    return api.put(`/apps/kuaipdm/research-processes/${uuid}`, data);
  },

  /**
   * 删除研发流程
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaipdm/research-processes/${uuid}`);
  },
};

/**
 * 知识管理 API 服务
 */
export const knowledgeApi = {
  /**
   * 创建知识
   */
  create: async (data: KnowledgeCreate): Promise<Knowledge> => {
    return api.post('/apps/kuaipdm/knowledges', data);
  },

  /**
   * 获取知识列表
   */
  list: async (params?: { skip?: number; limit?: number; knowledge_type?: string; category?: string; is_public?: boolean }): Promise<Knowledge[]> => {
    return api.get('/apps/kuaipdm/knowledges', { params });
  },

  /**
   * 获取知识详情
   */
  get: async (uuid: string): Promise<Knowledge> => {
    return api.get(`/apps/kuaipdm/knowledges/${uuid}`);
  },

  /**
   * 更新知识
   */
  update: async (uuid: string, data: KnowledgeUpdate): Promise<Knowledge> => {
    return api.put(`/apps/kuaipdm/knowledges/${uuid}`, data);
  },

  /**
   * 删除知识
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaipdm/knowledges/${uuid}`);
  },

  /**
   * 点赞知识
   */
  like: async (uuid: string): Promise<Knowledge> => {
    return api.post(`/apps/kuaipdm/knowledges/${uuid}/like`);
  },
};
