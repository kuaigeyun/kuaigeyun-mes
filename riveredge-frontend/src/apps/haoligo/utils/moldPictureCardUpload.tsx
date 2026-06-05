import { CloseOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';

import '../styles/mold-picture-card-upload.css';

/** picture-card 上传根节点 class：预览居中、删除为右上角红色叉 */
export const MOLD_PICTURE_CARD_UPLOAD_CLASS = 'haoligo-mold-picture-card-upload';

const moldUploadRemoveIcon = (
  <span className="haoligo-mold-upload-remove-icon" aria-label="删除">
    <CloseOutlined />
  </span>
);

function mergeShowUploadList(prev: UploadProps['showUploadList']): UploadProps['showUploadList'] {
  if (prev === false) return false;
  if (prev && typeof prev === 'object') {
    return { ...prev, removeIcon: prev.removeIcon ?? moldUploadRemoveIcon };
  }
  return { showPreviewIcon: true, showRemoveIcon: true, removeIcon: moldUploadRemoveIcon };
}

export function withMoldPictureCardUploadClass(props?: Partial<UploadProps>): Partial<UploadProps> {
  const prev = (props?.className ?? '').trim();
  const className = prev ? `${prev} ${MOLD_PICTURE_CARD_UPLOAD_CLASS}` : MOLD_PICTURE_CARD_UPLOAD_CLASS;
  return {
    ...props,
    multiple: props?.multiple ?? true,
    className,
    showUploadList: mergeShowUploadList(props?.showUploadList),
  };
}
