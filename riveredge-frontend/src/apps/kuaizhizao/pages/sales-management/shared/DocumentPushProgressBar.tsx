import React from 'react';
import { Progress, Tooltip } from 'antd';
import type { ProgressProps } from 'antd';

export function clampPushProgressPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function ratioToPushProgressPercent(pushed: number, total: number): number {
  const totalQty = Number(total);
  if (!Number.isFinite(totalQty) || totalQty <= 0) return 0;
  const pushedQty = Number(pushed);
  if (!Number.isFinite(pushedQty) || pushedQty <= 0) return 0;
  return clampPushProgressPercent((pushedQty / totalQty) * 100);
}

export type DocumentPushProgressBarProps = {
  percent: number;
  tooltip?: React.ReactNode;
  status?: ProgressProps['status'];
  width?: number | string;
};

const BAR_HEIGHT = 20;
const BAR_FONT_SIZE = 11;
export const DOCUMENT_PROGRESS_COLUMN_WIDTH = 120;

export const DocumentPushProgressBar: React.FC<DocumentPushProgressBarProps> = ({
  percent,
  tooltip,
  status,
  width = '100%',
}) => {
  const displayPercent = clampPushProgressPercent(percent);
  const bar = (
    <div style={{ position: 'relative', width, minWidth: 56, height: BAR_HEIGHT }}>
      <Progress
        percent={displayPercent}
        showInfo={false}
        status={status}
        strokeWidth={BAR_HEIGHT}
        strokeLinecap="round"
        style={{ margin: 0, height: BAR_HEIGHT, lineHeight: `${BAR_HEIGHT}px` }}
      />
      <span
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: BAR_HEIGHT,
          fontSize: BAR_FONT_SIZE,
          lineHeight: `${BAR_HEIGHT}px`,
          fontWeight: 500,
          color: displayPercent >= 50 ? '#fff' : 'var(--ant-color-text)',
          textShadow: displayPercent >= 50 ? '0 0 2px rgba(0, 0, 0, 0.45)' : undefined,
          pointerEvents: 'none',
        }}
      >
        {displayPercent}%
      </span>
    </div>
  );

  if (tooltip != null && tooltip !== '') {
    return <Tooltip title={tooltip}>{bar}</Tooltip>;
  }
  return bar;
};
