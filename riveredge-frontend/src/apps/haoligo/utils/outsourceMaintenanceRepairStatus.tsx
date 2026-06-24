import React from 'react';
import { Tag } from 'antd';

export const OUTSOURCE_MAINTENANCE_REPAIR_STATUS_ENUM: Record<string, { text: string }> = {
  维修中: { text: '维修中' },
  完修待审: { text: '完修待审' },
  维修完成: { text: '维修完成' },
};

export function outsourceMaintenanceRepairStatusTag(
  status: string | null | undefined,
): React.ReactNode {
  const s = (status || '').trim();
  if (!s || !(s in OUTSOURCE_MAINTENANCE_REPAIR_STATUS_ENUM)) return '—';
  const color = s === '维修完成' ? 'success' : s === '完修待审' ? 'processing' : 'blue';
  return <Tag color={color}>{s}</Tag>;
}
