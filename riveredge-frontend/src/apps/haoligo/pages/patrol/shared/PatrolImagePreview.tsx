/**
 * 巡查/隐患现场图片预览（只读详情用 Ant Design Image.PreviewGroup + 鉴权 SecureImage）
 */

import React from 'react';
import { Typography } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { EquipmentImageList } from '../../../components/EquipmentImageList';
import { normUploadUuids } from './uploadHelpers';

const { Text } = Typography;

type Props = {
  files: UploadFile[];
  width?: number;
  height?: number;
  emptyText?: React.ReactNode;
};

export function PatrolImagePreview({
  files,
  width = 104,
  height = 104,
  emptyText = '—',
}: Props) {
  const uuids = normUploadUuids(files);
  return (
    <EquipmentImageList
      uuids={uuids}
      width={width}
      height={height}
      fallback={<Text type="secondary">{emptyText}</Text>}
    />
  );
}
