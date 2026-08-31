/**
 * 交付项目节点进度单元格：色条 + 节点名 + 负责人（三行）
 */
import React from 'react';
import type { DeliveryProjectNode } from '../../../services/delivery-project';
import { DELIVERY_NODE_STATUS } from '../../../services/delivery-project';

const nodeColor = (status: string) => {
  if (status === 'completed') return '#52c41a';
  if (status === 'overdue') return '#ff4d4f';
  if (status === 'in_progress') return '#1677ff';
  return '#d9d9d9';
};

export function renderDeliveryNodeProgressCell(
  nodes?: DeliveryProjectNode[] | null,
): React.ReactNode {
  const list = nodes ?? [];
  if (!list.length) return '-';
  return (
    <div style={{ display: 'flex', gap: 8, width: '100%', overflow: 'auto' }}>
      {list.map((n) => (
        <div
          key={n.id}
          style={{
            flex: '1 1 72px',
            minWidth: 64,
            maxWidth: 120,
            lineHeight: 1.35,
            fontSize: 11,
            color: 'var(--ant-color-text-secondary)',
          }}
          title={`${n.node_name}: ${DELIVERY_NODE_STATUS[n.status] ?? n.status}`}
        >
          <div
            style={{
              height: 8,
              borderRadius: 2,
              background: nodeColor(n.status),
              marginBottom: 4,
            }}
          />
          <div
            style={{
              color: 'var(--ant-color-text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {n.node_name || '-'}
          </div>
          <div
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {n.owner_name || '-'}
          </div>
        </div>
      ))}
    </div>
  );
}
