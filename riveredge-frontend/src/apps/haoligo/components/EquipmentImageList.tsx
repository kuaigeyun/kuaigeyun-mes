/**
 * 设备图片列表（带鉴权预览，供台账详情/列表等使用）
 */

import React from 'react';
import { Image, Space } from 'antd';
import { SecureImage } from '../../../components/secure-image';

type Props = {
  uuids?: string[] | null;
  width?: number;
  height?: number;
  /** 无图时展示（如 —） */
  fallback?: React.ReactNode;
};

export function EquipmentImageList({ uuids, width = 56, height = 56, fallback = null }: Props) {
  const list = (uuids ?? []).filter((u) => typeof u === 'string' && u.trim());
  if (!list.length) {
    return fallback ? <>{fallback}</> : null;
  }
  return (
    <Image.PreviewGroup>
      <Space size={8} wrap>
        {list.map((uuid) => (
          <SecureImage key={uuid} fileUuid={uuid} width={width} height={height} alt="" />
        ))}
      </Space>
    </Image.PreviewGroup>
  );
}
