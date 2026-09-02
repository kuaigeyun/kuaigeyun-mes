import React from 'react';
import { Popover, theme } from 'antd';
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

const POPOVER_BODY_STYLE: React.CSSProperties = {
  padding: '8px 10px',
};

const SUMMARY_STYLE: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  lineHeight: '18px',
  color: 'var(--ant-color-text)',
};

const DOC_LIST_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr)',
  columnGap: 10,
  rowGap: 2,
  marginTop: 6,
  maxWidth: 360,
};

const DOC_LABEL_STYLE: React.CSSProperties = {
  fontSize: 12,
  lineHeight: '20px',
  color: 'var(--ant-color-text-secondary)',
  whiteSpace: 'nowrap',
};

const DOC_CODE_STYLE: React.CSSProperties = {
  fontSize: 12,
  lineHeight: '20px',
  fontVariantNumeric: 'tabular-nums',
  wordBreak: 'break-all',
  color: 'var(--ant-color-text)',
};

const DOC_MORE_STYLE: React.CSSProperties = {
  gridColumn: '1 / -1',
  fontSize: 12,
  lineHeight: '20px',
  color: 'var(--ant-color-text-secondary)',
};

/**
 * 下推进度 Popover：首行摘要，下游单据一行一张。
 */
export function buildPushProgressPopoverContent(options: {
  percentLine: string;
  documents?: PushProgressDocument[];
  maxCodesPerType?: number;
  /** 超出上限时单独一行，如「等 3 单」 */
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
    return <div style={SUMMARY_STYLE}>{percentLine}</div>;
  }

  const rows: Array<{ key: string; label: string; code: string } | { key: string; more: string }> = [];
  for (const [label, codes] of groups.entries()) {
    const shown = codes.slice(0, maxCodesPerType);
    const hidden = codes.length - shown.length;
    for (const code of shown) {
      rows.push({ key: `${label}:${code}`, label, code });
    }
    if (hidden > 0) {
      rows.push({
        key: `${label}:more`,
        more: formatMore ? formatMore(hidden) : `…+${hidden}`,
      });
    }
  }

  return (
    <div>
      <div style={SUMMARY_STYLE}>{percentLine}</div>
      <div style={DOC_LIST_STYLE}>
        {rows.map((row) =>
          'more' in row ? (
            <div key={row.key} style={DOC_MORE_STYLE}>
              {row.more}
            </div>
          ) : (
            <React.Fragment key={row.key}>
              <span style={DOC_LABEL_STYLE}>{row.label}</span>
              <span style={DOC_CODE_STYLE}>{row.code}</span>
            </React.Fragment>
          ),
        )}
      </div>
    </div>
  );
}

/** @deprecated 使用 buildPushProgressPopoverContent */
export const buildPushProgressTooltip = buildPushProgressPopoverContent;

export type DocumentPushProgressBarProps = {
  percent: number;
  /**
   * 完整浮层内容（兼容旧用法）。
   * 若同时传 documents，则作为首行摘要并拼接下推单据列表。
   */
  tooltip?: React.ReactNode;
  /** 首行摘要；未传 tooltip 时默认用「percent%」 */
  tooltipSummary?: string;
  /** 已下推下游单据（hover 展示） */
  documents?: PushProgressDocument[];
  formatMoreDocs?: (hidden: number) => string;
  /** success | exception | normal | active（与旧 Progress status 对齐） */
  status?: 'success' | 'exception' | 'normal' | 'active';
  width?: number | string;
};

const BAR_FONT_SIZE = 11;

/** 与列表 StatusTag（antd Tag solid）外盒高度对齐：line-height + 上下边框 */
function resolveListBadgeHeight(token: ReturnType<typeof theme.useToken>['token']): number {
  const lineHeightPx = Math.round(Number(token.lineHeightSM) * Number(token.fontSizeSM));
  return lineHeightPx + Number(token.lineWidth) * 2;
}

function resolvePushBarFillColor(
  status: DocumentPushProgressBarProps['status'],
  percent: number,
): string {
  if (status === 'exception') return 'var(--ant-color-error)';
  if (status === 'success' || percent >= 100) return 'var(--ant-color-success)';
  return 'var(--ant-color-primary)';
}

/** 已完成（100% / success）不叠加条内数字，避免完结单据仍像待办提示。 */
function shouldShowPushProgressNumericLabel(
  status: DocumentPushProgressBarProps['status'],
  displayPercent: number,
): boolean {
  if (status === 'success' || displayPercent >= 100) return false;
  return true;
}

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

/** 列表进度条：纯 CSS，避免每行挂载 antd Progress（低配机主因之一） */
export const DocumentPushProgressBar: React.FC<DocumentPushProgressBarProps> = React.memo(({
  percent,
  tooltip,
  tooltipSummary,
  documents,
  formatMoreDocs,
  status,
  width = '100%',
}) => {
  const { token } = theme.useToken();
  const barHeight = resolveListBadgeHeight(token);
  const displayPercent = clampPushProgressPercent(percent);
  const fillColor = resolvePushBarFillColor(status, displayPercent);
  const showNumericLabel = shouldShowPushProgressNumericLabel(status, displayPercent);
  const bar = (
    <div
      style={{ position: 'relative', width, minWidth: 56, height: barHeight, cursor: 'default' }}
      aria-label={showNumericLabel ? undefined : `${displayPercent}%`}
    >
      <div
        style={{
          width: '100%',
          height: barHeight,
          borderRadius: barHeight / 2,
          background: 'var(--ant-color-fill-secondary)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${displayPercent}%`,
            height: '100%',
            borderRadius: barHeight / 2,
            background: fillColor,
            transition: 'width 0.2s ease',
          }}
        />
      </div>
      {showNumericLabel ? (
        <span
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: barHeight,
            fontSize: BAR_FONT_SIZE,
            lineHeight: `${barHeight}px`,
            fontWeight: 500,
            fontVariantNumeric: 'tabular-nums',
            color: displayPercent >= 50 ? '#fff' : 'var(--ant-color-text)',
            textShadow: displayPercent >= 50 ? '0 0 2px rgba(0, 0, 0, 0.45)' : undefined,
            pointerEvents: 'none',
          }}
        >
          {displayPercent}%
        </span>
      ) : null}
    </div>
  );

  const hasDocuments = Array.isArray(documents) && documents.length > 0;
  // 仅文案提示：原生 title，避免每行 Popover（低配机滚动卡顿）
  if (!hasDocuments) {
    if (typeof tooltip === 'string' && tooltip) {
      return <div title={tooltip}>{bar}</div>;
    }
    if (tooltipSummary) {
      return <div title={tooltipSummary}>{bar}</div>;
    }
    if (tooltip != null && tooltip !== '') {
      return (
        <Popover
          trigger="hover"
          placement="top"
          mouseEnterDelay={0.15}
          styles={{ body: POPOVER_BODY_STYLE }}
          content={tooltip}
        >
          {bar}
        </Popover>
      );
    }
    return bar;
  }

  const percentLine =
    typeof tooltip === 'string' && tooltip
      ? tooltip
      : tooltipSummary || `${displayPercent}%`;
  return (
    <Popover
      trigger="hover"
      placement="top"
      mouseEnterDelay={0.15}
      styles={{ body: POPOVER_BODY_STYLE }}
      content={buildPushProgressPopoverContent({
        percentLine,
        documents,
        formatMore: formatMoreDocs,
      })}
    >
      {bar}
    </Popover>
  );
});
DocumentPushProgressBar.displayName = 'DocumentPushProgressBar';
