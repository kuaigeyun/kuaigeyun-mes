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
  /** 与 files 二选一；优先使用 uuids */
  uuids?: string[] | null;
  files?: UploadFile[];
  width?: number;
  height?: number;
  emptyText?: React.ReactNode;
};

export function PatrolImagePreview({
  uuids,
  files,
  width = 104,
  height = 104,
  emptyText = '—',
}: Props) {
  const fromUuids = (uuids ?? []).filter((u) => typeof u === 'string' && u.trim());
  const resolved = fromUuids.length ? fromUuids : normUploadUuids(files);
  return (
    <EquipmentImageList
      uuids={resolved}
      width={width}
      height={height}
      fallback={<Text type="secondary">{emptyText}</Text>}
    />
  );
}
