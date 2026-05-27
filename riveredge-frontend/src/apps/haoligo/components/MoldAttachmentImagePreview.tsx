import React from 'react';
import { Typography } from 'antd';

import { EquipmentImageList } from './EquipmentImageList';

type MoldAttachmentImagePreviewProps = {
  uuids?: string[] | null;
  width?: number;
  height?: number;
  emptyText?: React.ReactNode;
};

/** 模具单据只读附件：Ant Design Image 预览组 + 带 token 缩略图 */
export function MoldAttachmentImagePreview({
  uuids,
  width = 104,
  height = 104,
  emptyText = '无',
}: MoldAttachmentImagePreviewProps) {
  const list = (uuids ?? []).filter((u) => typeof u === 'string' && u.trim());
  if (!list.length) {
    return typeof emptyText === 'string' ? (
      <Typography.Text type="secondary">{emptyText}</Typography.Text>
    ) : (
      <>{emptyText}</>
    );
  }
  return <EquipmentImageList uuids={list} width={width} height={height} />;
}
