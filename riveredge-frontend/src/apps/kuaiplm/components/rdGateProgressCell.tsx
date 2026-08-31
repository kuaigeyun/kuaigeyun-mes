/**
 * 研发项目阶段进度单元格：色条 + 阶段名 + 评审人（与交付项目节点进度同构）
 */
import React from 'react';
import type { TFunction } from 'i18next';
import type { RdProjectGate } from '../services/rd-project';
import { getKuaiplmGateStatusText, getKuaiplmGateText } from './kuaiplmMeta';

export const RD_GATE_PROGRESS_REMAINDER_COLUMN_DEFAULTS = {
  minWidth: 200,
  uniTableRemainderFlex: true,
  uniTablePrimaryFlex: true,
  resizable: false,
  ellipsis: false,
} as const;

function gateColor(status?: string) {
  const normalized = String(status ?? '').toUpperCase();
  if (normalized === 'PASSED') return '#52c41a';
  if (normalized === 'FAILED') return '#ff4d4f';
  if (normalized === 'IN_PROGRESS') return '#1677ff';
  return '#d9d9d9';
}

export function renderRdGateProgressCell(
  t: TFunction,
  gates?: RdProjectGate[] | null,
): React.ReactNode {
  const list = [...(gates ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  if (!list.length) return '-';
  return (
    <div style={{ display: 'flex', gap: 8, width: '100%', overflow: 'auto' }}>
      {list.map((gate, index) => {
        const name = getKuaiplmGateText(t, gate.gate_key, gate.gate_name);
        const statusText = getKuaiplmGateStatusText(t, gate.status);
        return (
          <div
            key={gate.id ?? gate.gate_key ?? index}
            style={{
              flex: '1 1 72px',
              minWidth: 64,
              maxWidth: 120,
              lineHeight: 1.35,
              fontSize: 11,
              color: 'var(--ant-color-text-secondary)',
            }}
            title={`${name}: ${statusText}`}
          >
            <div
              style={{
                height: 8,
                borderRadius: 2,
                background: gateColor(gate.status),
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
              {name}
            </div>
            <div
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {gate.reviewer_name || '-'}
            </div>
          </div>
        );
      })}
    </div>
  );
}
