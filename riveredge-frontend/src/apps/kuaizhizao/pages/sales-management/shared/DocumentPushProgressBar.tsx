import React from 'react';
import { Progress, Tooltip } from 'antd';
import type { ProgressProps } from 'antd';
import { UNI_TABLE_STATUS_BADGE_COLUMN_WIDTH } from '../../../../../utils/uniTableLayoutColumns';

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
/**
 * 进度条列的整套列属性：与状态徽章列（审核状态 / 执行状态）同宽，宽度真源在
 * `uniTableLayoutColumns`。
 *
 * 只导出成套默认值、不导出裸宽度数字——裸数字会被非进度列顺手借用（销售员、预测周期
 * 都曾借过），之后调整进度列宽就会把不相干的列一起改窄。
 */
export const DOCUMENT_PROGRESS_COLUMN_DEFAULTS = {
  width: UNI_TABLE_STATUS_BADGE_COLUMN_WIDTH,
  uniTableKeepWidth: true,
  hideInSearch: true,
} as const;

/**
 * 明细表格进度列：右固定 96px，紧邻执行状态（lifecycle）左侧。
 * 须右固定，否则宽视口下中间滚动区会把末列撑宽。
 */
export const DETAIL_TABLE_PROGRESS_COLUMN_DEFAULTS = {
  uniTableDetailProgressColumn: true,
  /** 须走 ProTable columnsMap，否则 noNeedPro 列不参与 order 契约 */
  valueType: 'text' as const,
  width: UNI_TABLE_STATUS_BADGE_COLUMN_WIDTH,
  minWidth: UNI_TABLE_STATUS_BADGE_COLUMN_WIDTH,
  fixed: 'right' as const,
  align: 'center' as const,
  uniTableKeepWidth: true,
  resizable: false,
  hideInSearch: true,
} as const;

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
