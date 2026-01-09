/**
 * 变体属性定义 API 服务
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
  VariantAttributeDefinitionHistory,
  VariantAttributeValidationRequest,
  VariantAttributeValidationResponse,
} from '../types/variant-attribute';

/**
 * 变体属性定义 API
 */
export const variantAttributeApi = {
  /**
   * 创建变体属性定义
   */
  create: async (data: VariantAttributeDefinitionCreate): Promise<VariantAttributeDefinition> => {
    return api.post('/core/variant-attributes', data);
  },

  /**
   * 获取变体属性定义列表
   */
  list: async (params?: VariantAttributeDefinitionListParams): Promise<VariantAttributeDefinition[]> => {
    return api.get('/core/variant-attributes', { params });
  },

  /**
   * 根据UUID获取变体属性定义
   */
  get: async (uuid: string): Promise<VariantAttributeDefinition> => {
    return api.get(`/core/variant-attributes/${uuid}`);
  },

  /**
   * 更新变体属性定义
   */
  update: async (uuid: string, data: VariantAttributeDefinitionUpdate): Promise<VariantAttributeDefinition> => {
    return api.put(`/core/variant-attributes/${uuid}`, data);
  },

  /**
   * 删除变体属性定义
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/core/variant-attributes/${uuid}`);
  },

  /**
   * 获取变体属性定义版本历史
   */
  getHistory: async (uuid: string): Promise<VariantAttributeDefinitionHistory[]> => {
    return api.get(`/core/variant-attributes/${uuid}/history`);
  },

  /**
   * 验证属性值
   */
  validate: async (data: VariantAttributeValidationRequest): Promise<VariantAttributeValidationResponse> => {
    return api.post('/core/variant-attributes/validate', data);
  },
};
