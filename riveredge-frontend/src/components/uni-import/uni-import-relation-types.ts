/** 高级关联导入类型（UI 配置在自定义导入弹窗中完成） */

export type UniRelationImportEntity = 'material' | 'processRoute' | 'operation' | 'performance';
export type UniRelationImportWriteStrategy = 'upsert' | 'create_only' | 'link_only' | 'strict_fail';

export interface UniRelationImportSummary {
  created?: number;
  updated?: number;
  linked?: number;
  failed?: number;
}

export interface UniRelationImportResult {
  success?: boolean;
  message?: string;
  summary?: UniRelationImportSummary;
  errors?: string[];
  warnings?: string[];
}

export interface UniRelationImportConfig {
  entities?: UniRelationImportEntity[];
  defaultWriteStrategy?: UniRelationImportWriteStrategy;
  supportedStrategies?: UniRelationImportWriteStrategy[];
  /**
   * 关联导入矩阵必填字段（field key，与 importFieldMap 值一致）。
   * 未传时默认 BOM 核心列：parentCode / componentCode / quantity。
   */
  requiredFieldKeys?: string[];
  /** 各实体额外必填字段；未传则不做实体级列校验 */
  entityRequiredFieldKeys?: Partial<Record<UniRelationImportEntity, string[]>>;
}
