import React from 'react';
import { Progress, Tooltip } from 'antd';
import type { ProgressProps } from 'antd';
import { UNI_TABLE_PROGRESS_COLUMN_WIDTH } from '../../../../../utils/uniTableLayoutColumns';

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

/** 下推进度 hover 中展示的下游单据 */
export type PushProgressDocument = {
  label: string;
  code: string;
};

const DEFAULT_MAX_CODES_PER_TYPE = 8;

/**
 * 组装下推进度 Tooltip：首行进度摘要 + 按单据类型分组的单号列表。
 */
export function buildPushProgressTooltip(options: {
  percentLine: string;
  documents?: PushProgressDocument[];
  maxCodesPerType?: number;
  /** 超出上限时的后缀，如「等 3 单」 */
  formatMore?: (hidden: number) => string;
}): React.ReactNode {
  const { percentLine, documents, maxCodesPerType = DEFAULT_MAX_CODES_PER_TYPE, formatMore } = options;
  const groups = new Map<string, string[]>();
  for (const doc of documents ?? []) {
    const label = String(doc.label || '').trim();
    const code = String(doc.code || '').trim();
    if (!label || !code) continue;
    const list = groups.get(label) ?? [];
    if (!list.includes(code)) list.push(code);
    groups.set(label, list);
  }

  if (groups.size === 0) {
    return percentLine;
  }

  return (
    <div style={{ maxWidth: 320 }}>
      <div>{percentLine}</div>
      {Array.from(groups.entries()).map(([label, codes]) => {
        const shown = codes.slice(0, maxCodesPerType);
        const hidden = codes.length - shown.length;
        const codesText =
          hidden > 0 && formatMore
            ? `${shown.join('、')}${formatMore(hidden)}`
            : hidden > 0
              ? `${shown.join('、')}…+${hidden}`
              : shown.join('、');
        return (
          <div key={label} style={{ marginTop: 4 }}>
            {label}：{codesText}
          </div>
        );
      })}
    </div>
  );
}

export type DocumentPushProgressBarProps = {
  percent: number;
  /**
   * 完整 Tooltip（兼容旧用法）。
   * 若同时传 documents，则作为首行摘要并拼接下推单据列表。
   */
  tooltip?: React.ReactNode;
  /** 首行摘要；未传 tooltip 时默认用「percent%」 */
  tooltipSummary?: string;
  /** 已下推下游单据（hover 展示） */
  documents?: PushProgressDocument[];
  formatMoreDocs?: (hidden: number) => string;
  status?: ProgressProps['status'];
  width?: number | string;
};

const BAR_HEIGHT = 20;
const BAR_FONT_SIZE = 11;
/**
 * 进度条列的整套列属性：宽度真源 `UNI_TABLE_PROGRESS_COLUMN_WIDTH`（80）。
 *
 * 只导出成套默认值、不导出裸宽度数字——裸数字会被非进度列顺手借用（销售员、预测周期
 * 都曾借过），之后调整进度列宽就会把不相干的列一起改窄。
 */
export const DOCUMENT_PROGRESS_COLUMN_DEFAULTS = {
  uniTableProgressColumn: true,
  width: UNI_TABLE_PROGRESS_COLUMN_WIDTH,
  minWidth: UNI_TABLE_PROGRESS_COLUMN_WIDTH,
  align: 'center' as const,
  resizable: false,
  uniTableKeepWidth: true,
  hideInSearch: true,
} as const;

/**
 * 明细表格进度列：右固定，与全局进度列同宽，紧邻执行状态（lifecycle）左侧。
 * 须右固定，否则宽视口下中间滚动区会把末列撑宽。
 */
export const DETAIL_TABLE_PROGRESS_COLUMN_DEFAULTS = {
  uniTableDetailProgressColumn: true,
  /** 须走 ProTable columnsMap，否则 noNeedPro 列不参与 order 契约 */
  valueType: 'text' as const,
  width: UNI_TABLE_PROGRESS_COLUMN_WIDTH,
  minWidth: UNI_TABLE_PROGRESS_COLUMN_WIDTH,
  fixed: 'right' as const,
  align: 'center' as const,
  uniTableKeepWidth: true,
  resizable: false,
  hideInSearch: true,
} as const;

export const DocumentPushProgressBar: React.FC<DocumentPushProgressBarProps> = ({
  percent,
  tooltip,
  tooltipSummary,
  documents,
  formatMoreDocs,
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

  const hasDocuments = Array.isArray(documents) && documents.length > 0;
  let title: React.ReactNode = null;
  if (hasDocuments) {
    const percentLine =
      typeof tooltip === 'string' && tooltip
        ? tooltip
        : tooltipSummary || `${displayPercent}%`;
    title = buildPushProgressTooltip({
      percentLine,
      documents,
      formatMore: formatMoreDocs,
    });
  } else if (tooltip != null && tooltip !== '') {
    title = tooltip;
  } else if (tooltipSummary) {
    title = tooltipSummary;
  }

  if (title != null && title !== '') {
    return <Tooltip title={title}>{bar}</Tooltip>;
  }
  return bar;
};
