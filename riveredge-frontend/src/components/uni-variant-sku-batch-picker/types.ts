import type { Material } from '../../apps/master-data/types/material';

export interface UniVariantSkuBatchPickerProps {
  open: boolean;
  onCancel: () => void;
  /** 主物料 UUID（已开启属性管理且已维护 SKU 组合） */
  masterMaterialUuid?: string | null;
  /** 已加入价格本的属性组合键（JSON 字符串），用于默认勾选过滤 */
  excludeAttrKeys?: Set<string>;
  onConfirm: (skus: Material[]) => void;
  zIndex?: number;
  width?: number;
  /** 单选（单据行）或多选（价格本等），默认 multiple */
  selectionMode?: 'single' | 'multiple';
}
