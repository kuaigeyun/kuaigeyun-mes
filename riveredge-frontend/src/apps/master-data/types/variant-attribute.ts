/**
 * 变体属性定义类型定义
 *
 * Author: Luigi Lu
 * Date: 2026-01-08
 */

/**
 * 变体属性类型
 */
export type VariantAttributeType = 'enum' | 'text' | 'number' | 'date' | 'boolean';

/**
 * 验证规则
 */
export interface ValidationRules {
  max_length?: number;
  min_length?: number;
  min?: number;
  max?: number;
  pattern?: string;
  [key: string]: any;
}

/**
 * 依赖关系
 */
export interface AttributeDependency {
  depends_on?: string;
  rules?: Record<string, any>;
  [key: string]: any;
}

/**
 * 变体属性定义基础接口
 */
export interface VariantAttributeDefinitionBase {
  attribute_name: string;
  attribute_type: VariantAttributeType;
  display_name: string;
  description?: string;
  is_required: boolean;
  display_order: number;
  enum_values?: string[];
  validation_rules?: ValidationRules;
  default_value?: string;
  dependencies?: AttributeDependency;
  is_active: boolean;
}

/**
 * 创建变体属性定义请求
 */
export interface VariantAttributeDefinitionCreate extends VariantAttributeDefinitionBase {}

/**
 * 更新变体属性定义请求
 */
export interface VariantAttributeDefinitionUpdate extends Partial<VariantAttributeDefinitionBase> {}

/**
 * 变体属性定义响应
 */
export interface VariantAttributeDefinition extends VariantAttributeDefinitionBase {
  uuid: string;
  tenant_id: number;
  version: number;
  created_at: string;
  updated_at: string;
  created_by?: number;
  updated_by?: number;
}

/**
 * 变体属性定义列表查询参数
 */
export interface VariantAttributeDefinitionListParams {
  page?: number;
  pageSize?: number;
  is_active?: boolean;
  attribute_type?: VariantAttributeType;
}

/**
 * 变体属性定义版本历史
 */
export interface VariantAttributeDefinitionHistory {
  uuid: string;
  tenant_id: number;
  attribute_definition_id: number;
  version: number;
  attribute_config: Record<string, any>;
  change_description?: string;
  changed_by?: number;
  changed_at?: string;
  created_at: string;
  updated_at: string;
}

/**
 * 属性验证请求
 */
export interface VariantAttributeValidationRequest {
  attribute_name: string;
  attribute_value: any;
}

/**
 * 属性验证响应
 */
export interface VariantAttributeValidationResponse {
  is_valid: boolean;
  error_message?: string;
}
