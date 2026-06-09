import type { Material } from '../../apps/master-data/types/material';

export interface UniMaterialBatchPickerProps {
  open: boolean;
  onCancel: () => void;
  /** 确认返回已选物料（按确认时 Map 迭代顺序） */
  onConfirm: (materials: Material[]) => void;
  /** 嵌套在已抬升的表单 Modal 内时传入更高 zIndex */
  zIndex?: number;
  /** 弹窗宽度，默认 960 */
  width?: number;
  /** 宿主 {app}:{module}，供隐式 display 鉴权 */
  hostResource?: string;
}
