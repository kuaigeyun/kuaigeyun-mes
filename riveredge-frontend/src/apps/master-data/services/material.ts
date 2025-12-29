/**
 * 物料数据 API 服务
 * 
 * 提供物料分组、物料、BOM的 API 调用方法
 */

import { api } from '../../../services/api';
import type {
  MaterialGroup,
  MaterialGroupCreate,
  MaterialGroupUpdate,
  MaterialGroupListParams,
  Material,
  MaterialCreate,
  MaterialUpdate,
  MaterialListParams,
  BOM,
  BOMCreate,
  BOMUpdate,
  BOMListParams,
} from '../types/material';

/**
 * 物料分组 API 服务
 */
export const materialGroupApi = {
  /**
   * 创建物料分组
   */
  create: async (data: MaterialGroupCreate): Promise<MaterialGroup> => {
    return api.post('/apps/master-data/materials/groups', data);
  },

  /**
   * 获取物料分组列表
   */
  list: async (params?: MaterialGroupListParams): Promise<MaterialGroup[]> => {
    return api.get('/apps/master-data/materials/groups', { params });
  },

  /**
   * 获取物料分组详情
   */
  get: async (uuid: string): Promise<MaterialGroup> => {
    return api.get(`/apps/master-data/materials/groups/${uuid}`);
  },

  /**
   * 更新物料分组
   */
  update: async (uuid: string, data: MaterialGroupUpdate): Promise<MaterialGroup> => {
    return api.put(`/apps/master-data/materials/groups/${uuid}`, data);
  },

  /**
   * 删除物料分组
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/master-data/materials/groups/${uuid}`);
  },

  /**
   * 获取物料分组树形结构
   */
  tree: async (): Promise<any[]> => {
    return api.get('/apps/master-data/materials/groups/tree');
  },
};

/**
 * 物料 API 服务
 */
export const materialApi = {
  /**
   * 创建物料
   */
  create: async (data: MaterialCreate): Promise<Material> => {
    return api.post('/apps/master-data/materials', data);
  },

  /**
   * 获取物料列表
   */
  list: async (params?: MaterialListParams): Promise<Material[]> => {
    return api.get('/apps/master-data/materials', { params });
  },

  /**
   * 获取物料详情
   */
  get: async (uuid: string): Promise<Material> => {
    return api.get(`/apps/master-data/materials/${uuid}`);
  },

  /**
   * 更新物料
   */
  update: async (uuid: string, data: MaterialUpdate): Promise<Material> => {
    return api.put(`/apps/master-data/materials/${uuid}`, data);
  },

  /**
   * 删除物料
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/master-data/materials/${uuid}`);
  },
};

/**
 * BOM API 服务
 */
export const bomApi = {
  /**
   * 创建BOM（支持批量创建）
   */
  create: async (data: BOMBatchCreate): Promise<BOM[]> => {
    return api.post('/apps/master-data/materials/bom', data);
  },
  
  /**
   * 创建单个BOM（兼容旧接口）
   */
  createSingle: async (data: BOMCreate): Promise<BOM> => {
    // 转换为批量创建格式
    const batchData: BOMBatchCreate = {
      materialId: data.materialId,
      items: [{
        componentId: data.componentId,
        quantity: data.quantity,
        unit: data.unit,
        isAlternative: data.isAlternative,
        alternativeGroupId: data.alternativeGroupId,
        priority: data.priority,
        description: data.description,
      }],
      isActive: data.isActive,
    };
    const result = await api.post('/apps/master-data/materials/bom', batchData);
    return result[0];
  },

  /**
   * 获取BOM列表
   */
  list: async (params?: BOMListParams): Promise<BOM[]> => {
    return api.get('/apps/master-data/materials/bom', { params });
  },

  /**
   * 获取BOM详情
   */
  get: async (uuid: string): Promise<BOM> => {
    return api.get(`/apps/master-data/materials/bom/${uuid}`);
  },

  /**
   * 更新BOM
   */
  update: async (uuid: string, data: BOMUpdate): Promise<BOM> => {
    return api.put(`/apps/master-data/materials/bom/${uuid}`, data);
  },

  /**
   * 删除BOM
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/master-data/materials/bom/${uuid}`);
  },
  
  /**
   * 审核BOM
   */
  approve: async (uuid: string, approved: boolean, approvalComment?: string): Promise<BOM> => {
    const params: Record<string, any> = { approved };
    if (approvalComment) {
      params.approval_comment = approvalComment;
    }
    return api.post(`/apps/master-data/materials/bom/${uuid}/approve`, null, { params });
  },
  
  /**
   * 复制BOM（创建新版本）
   */
  copy: async (uuid: string, newVersion?: string): Promise<BOM> => {
    const params: Record<string, any> = {};
    if (newVersion) {
      params.new_version = newVersion;
    }
    return api.post(`/apps/master-data/materials/bom/${uuid}/copy`, null, { params });
  },
  
  /**
   * 根据主物料获取BOM列表
   */
  getByMaterial: async (materialId: number, version?: string, onlyActive?: boolean): Promise<BOM[]> => {
    return api.get(`/apps/master-data/materials/bom/material/${materialId}`, {
      params: { version, only_active: onlyActive },
    });
  },
  
  /**
   * 获取BOM所有版本
   */
  getVersions: async (bomCode: string): Promise<BOM[]> => {
    return api.get(`/apps/master-data/materials/bom/versions/${bomCode}`);
  },
};

