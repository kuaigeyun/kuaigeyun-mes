/**
 * 属性定义 API 服务
 *
 * Author: Luigi Lu
 * Date: 2026-01-08
 */

import { api } from '../../../services/api';
import type {
  VariantAttributeDefinition,
  VariantAttributeDefinitionCreate,
  VariantAttributeDefinitionUpdate,
  VariantAttributeDefinitionListParams,
  VariantAttributeValidationRequest,
  VariantAttributeValidationResponse,
} from '../types/variant-attribute';

/**
 * 属性定义 API
 */
export const variantAttributeApi = {
  /**
   * 创建属性定义
   */
  create: async (data: VariantAttributeDefinitionCreate): Promise<VariantAttributeDefinition> => {
    return api.post('/core/variant-attributes', data);
  },

  /**
   * 获取属性定义列表
   */
  list: async (params?: VariantAttributeDefinitionListParams): Promise<VariantAttributeDefinition[]> => {
    const q: Record<string, unknown> = {};
    if (params?.is_active !== undefined) q.is_active = params.is_active;
    if (params?.attribute_type) q.attribute_type = params.attribute_type;
    if (params?.keyword?.trim()) q.keyword = params.keyword.trim();
    if (params?.sort_by) q.sort_by = params.sort_by;
    if (params?.sort_order) q.sort_order = params.sort_order;
    return api.get('/core/variant-attributes', { params: q });
  },

  /**
   * 根据UUID获取属性定义
   */
  get: async (uuid: string): Promise<VariantAttributeDefinition> => {
    return api.get(`/core/variant-attributes/${uuid}`);
  },

  /**
   * 更新属性定义
   */
  update: async (uuid: string, data: VariantAttributeDefinitionUpdate): Promise<VariantAttributeDefinition> => {
    return api.put(`/core/variant-attributes/${uuid}`, data);
  },

  /**
   * 删除属性定义
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/core/variant-attributes/${uuid}`);
  },

  /**
   * 验证属性值
   */
  validate: async (data: VariantAttributeValidationRequest): Promise<VariantAttributeValidationResponse> => {
    return api.post('/core/variant-attributes/validate', data);
  },

  /**
   * 获取预设列表（用于预览与勾选）
   */
  getPresetPreview: async (): Promise<PresetAttributeItem[]> => {
    return api.get('/core/variant-attributes/preset-preview');
  },

  /**
   * 加载属性定义预设（可仅创建选中的 attribute_names）
   */
  loadPreset: async (attribute_names?: string[]): Promise<{ created: number; message: string }> => {
    return api.post('/core/variant-attributes/load-preset', attribute_names != null ? { attribute_names } : undefined);
  },
};

/** 预设项（与后端 PRESET_ATTRIBUTE_DEFINITIONS 结构一致） */
export interface PresetAttributeItem {
  attribute_name: string;
  display_name: string;
  attribute_type: string;
  enum_values?: string[];
  display_order?: number;
  is_required?: boolean;
  allow_multiple?: boolean;
  description?: string;
}
