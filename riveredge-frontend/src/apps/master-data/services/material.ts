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
  BOMBatchImport,
  BOMHierarchy,
  BOMQuantityResult,
  BOMVersionCreate,
  BOMVersionCompare,
  BOMVersionCompareResult,
  BOMCycleDetectionResult,
  MaterialCodeMapping,
  MaterialCodeMappingCreate,
  MaterialCodeMappingUpdate,
  MaterialCodeMappingListParams,
  MaterialCodeMappingListResponse,
  MaterialCodeConvertRequest,
  MaterialCodeConvertResponse,
  MaterialCodeMappingBatchImportResult,
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

  /**
   * 生成物料二维码
   */
  generateQRCode: async (materialUuid: string, materialCode: string, materialName: string): Promise<any> => {
    const { qrcodeApi } = await import('../../../services/qrcode');
    return qrcodeApi.generateMaterial({
      material_uuid: materialUuid,
      material_code: materialCode,
      material_name: materialName,
    });
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
  
  /**
   * 批量导入BOM（支持部门编码）
   * 
   * 根据《工艺路线和标准作业流程优化设计规范.md》设计。
   */
  batchImport: async (data: BOMBatchImport): Promise<BOM[]> => {
    return api.post('/apps/master-data/materials/bom/batch-import', data);
  },
  
  /**
   * 生成BOM层级结构
   * 
   * 根据《工艺路线和标准作业流程优化设计规范.md》设计。
   */
  getHierarchy: async (
    materialId: number,
    version?: string
  ): Promise<BOMHierarchy> => {
    return api.get(`/apps/master-data/materials/bom/material/${materialId}/hierarchy`, {
      params: { version },
    });
  },
  
  /**
   * 计算BOM用量（考虑损耗率）
   * 
   * 根据《工艺路线和标准作业流程优化设计规范.md》设计。
   */
  calculateQuantity: async (
    materialId: number,
    parentQuantity: number = 1.0,
    version?: string
  ): Promise<BOMQuantityResult> => {
    return api.get(`/apps/master-data/materials/bom/material/${materialId}/quantity`, {
      params: { parent_quantity: parentQuantity, version },
    });
  },
  
  /**
   * 创建BOM新版本
   * 
   * 根据《工艺路线和标准作业流程优化设计规范.md》设计。
   */
  createVersion: async (
    materialId: number,
    data: BOMVersionCreate
  ): Promise<BOM[]> => {
    return api.post(`/apps/master-data/materials/bom/material/${materialId}/version`, data);
  },
  
  /**
   * 对比BOM版本
   * 
   * 根据《工艺路线和标准作业流程优化设计规范.md》设计。
   */
  compareVersions: async (
    materialId: number,
    data: BOMVersionCompare
  ): Promise<BOMVersionCompareResult> => {
    return api.post(`/apps/master-data/materials/bom/material/${materialId}/compare-versions`, data);
  },
  
  /**
   * 检测BOM循环依赖
   * 
   * 根据《工艺路线和标准作业流程优化设计规范.md》设计。
   */
  detectCycle: async (
    materialId: number,
    componentId: number
  ): Promise<BOMCycleDetectionResult> => {
    return api.get('/apps/master-data/materials/bom/detect-cycle', {
      params: { material_id: materialId, component_id: componentId },
    });
  },
};

/**
 * 物料编码映射 API 服务
 */
export const materialCodeMappingApi = {
  /**
   * 创建物料编码映射
   */
  create: async (data: MaterialCodeMappingCreate): Promise<MaterialCodeMapping> => {
    return api.post('/apps/master-data/materials/mapping', data);
  },

  /**
   * 获取物料编码映射列表
   */
  list: async (params?: MaterialCodeMappingListParams): Promise<MaterialCodeMappingListResponse> => {
    return api.get('/apps/master-data/materials/mapping', { params });
  },

  /**
   * 获取物料编码映射详情
   */
  get: async (uuid: string): Promise<MaterialCodeMapping> => {
    return api.get(`/apps/master-data/materials/mapping/${uuid}`);
  },

  /**
   * 更新物料编码映射
   */
  update: async (uuid: string, data: MaterialCodeMappingUpdate): Promise<MaterialCodeMapping> => {
    return api.put(`/apps/master-data/materials/mapping/${uuid}`, data);
  },

  /**
   * 删除物料编码映射
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/master-data/materials/mapping/${uuid}`);
  },

  /**
   * 编码转换（外部编码 -> 内部编码）
   */
  convert: async (request: MaterialCodeConvertRequest): Promise<MaterialCodeConvertResponse> => {
    return api.post('/apps/master-data/materials/mapping/convert', request);
  },

  /**
   * 批量导入物料编码映射
   */
  batchImport: async (mappingsData: MaterialCodeMappingCreate[]): Promise<MaterialCodeMappingBatchImportResult> => {
    return api.post('/apps/master-data/materials/mapping/batch-import', mappingsData);
  },
};

/**
 * 物料批号 API 服务
 */
export const materialBatchApi = {
  /**
   * 创建物料批号
   */
  create: async (data: MaterialBatchCreate): Promise<MaterialBatch> => {
    return api.post('/apps/master-data/materials/batches', data);
  },

  /**
   * 获取物料批号列表
   */
  list: async (params?: MaterialBatchListParams): Promise<MaterialBatchListResponse> => {
    return api.get('/apps/master-data/materials/batches', { params });
  },

  /**
   * 获取物料批号详情
   */
  get: async (uuid: string): Promise<MaterialBatch> => {
    return api.get(`/apps/master-data/materials/batches/${uuid}`);
  },

  /**
   * 更新物料批号
   */
  update: async (uuid: string, data: MaterialBatchUpdate): Promise<MaterialBatch> => {
    return api.put(`/apps/master-data/materials/batches/${uuid}`, data);
  },

  /**
   * 删除物料批号
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/master-data/materials/batches/${uuid}`);
  },

  /**
   * 生成批号
   */
  generate: async (materialUuid: string, rule?: string): Promise<{ batch_no: string }> => {
    return api.post('/apps/master-data/materials/batches/generate', null, {
      params: { material_uuid: materialUuid, rule },
    });
  },

  /**
   * 批号追溯
   */
  trace: async (uuid: string): Promise<any> => {
    return api.get(`/apps/master-data/materials/batches/${uuid}/trace`);
  },
};

/**
 * 物料序列号 API 服务
 */
export const materialSerialApi = {
  /**
   * 创建物料序列号
   */
  create: async (data: MaterialSerialCreate): Promise<MaterialSerial> => {
    return api.post('/apps/master-data/materials/serials', data);
  },

  /**
   * 获取物料序列号列表
   */
  list: async (params?: MaterialSerialListParams): Promise<MaterialSerialListResponse> => {
    return api.get('/apps/master-data/materials/serials', { params });
  },

  /**
   * 获取物料序列号详情
   */
  get: async (uuid: string): Promise<MaterialSerial> => {
    return api.get(`/apps/master-data/materials/serials/${uuid}`);
  },

  /**
   * 更新物料序列号
   */
  update: async (uuid: string, data: MaterialSerialUpdate): Promise<MaterialSerial> => {
    return api.put(`/apps/master-data/materials/serials/${uuid}`, data);
  },

  /**
   * 删除物料序列号
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/master-data/materials/serials/${uuid}`);
  },

  /**
   * 生成序列号（批量）
   */
  generate: async (materialUuid: string, count: number = 1, rule?: string): Promise<{ serial_nos: string[]; count: number }> => {
    return api.post('/apps/master-data/materials/serials/generate', null, {
      params: { material_uuid: materialUuid, count, rule },
    });
  },

  /**
   * 序列号追溯
   */
  trace: async (uuid: string): Promise<any> => {
    return api.get(`/apps/master-data/materials/serials/${uuid}/trace`);
  },
};

/**
 * 物料来源控制 API 服务
 */
export const materialSourceApi = {
  /**
   * 验证物料来源配置
   */
  validate: async (materialUuid: string): Promise<{
    is_valid: boolean;
    errors: string[];
    warnings: string[];
  }> => {
    return api.get(`/apps/master-data/materials/${materialUuid}/source/validate`);
  },

  /**
   * 批量验证物料来源配置
   */
  validateBatch: async (materialUuids: string[]): Promise<Record<string, {
    is_valid: boolean;
    errors: string[];
    warnings: string[];
  }>> => {
    return api.post('/apps/master-data/materials/source/validate-batch', materialUuids);
  },

  /**
   * 检查物料来源类型变更影响
   */
  checkChangeImpact: async (materialUuid: string, newSourceType: string): Promise<{
    can_change: boolean;
    impact: {
      work_orders: Array<{ uuid: string; code: string; status: string }>;
      purchase_orders: Array<{ uuid: string; code: string; status: string }>;
      warnings: string[];
    };
  }> => {
    return api.get(`/apps/master-data/materials/${materialUuid}/source/change-impact`, {
      params: { new_source_type: newSourceType },
    });
  },

  /**
   * 变更物料来源类型
   */
  change: async (
    materialUuid: string,
    newSourceType: string,
    newSourceConfig?: Record<string, any>
  ): Promise<Material> => {
    return api.put(`/apps/master-data/materials/${materialUuid}/source/change`, null, {
      params: {
        new_source_type: newSourceType,
        new_source_config: newSourceConfig ? JSON.stringify(newSourceConfig) : undefined,
      },
    });
  },

  /**
   * 建议物料来源类型
   */
  suggest: async (materialUuid: string): Promise<{
    suggested_type: string | null;
    confidence: number;
    reasons: string[];
    all_suggestions: Array<{
      source_type: string;
      confidence: number;
      reason: string;
    }>;
  }> => {
    return api.get(`/apps/master-data/materials/${materialUuid}/source/suggest`);
  },

  /**
   * 检查物料来源配置完整性
   */
  checkCompleteness: async (materialUuid: string): Promise<{
    is_complete: boolean;
    missing_configs: string[];
    warnings: string[];
  }> => {
    return api.get(`/apps/master-data/materials/${materialUuid}/source/check-completeness`);
  },
};
