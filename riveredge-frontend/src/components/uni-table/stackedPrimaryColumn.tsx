/**
 * UniTable 标准「主从堆叠列」：上行主信息（正常字号）、下行次信息（小号 + 次要色，可复制）。
 *
 * 与 UniTable 列宽策略配合：
 * - 列上设 `uniTablePrimaryFlex: true` + `minWidth`（勿写死 width），由主列吃剩余横向空间；
 * - 原 secondary 字段列 `hideInTable: true`，搜索/导出仍保留独立 dataIndex；
 * - 日期/金额等结构化列加 `uniTableKeepWidth: true` 或依赖 valueType 自动保护。
 */

import React from 'react';
import { Typography, theme } from 'antd';

/** 堆叠主列默认列属性（与 UniTable applyUniTableColumnWidthPolicy 配对） */
export const UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS = {
  minWidth: 200,
  uniTablePrimaryFlex: true,
  resizable: false,
  ellipsis: false,
} as const;

export interface UniTableStackedPrimaryCellProps {
  /** 上行主文案（如客户名、物料名） */
  primary: string;
  /** 下行次文案（如单号、编码） */
  secondary: string;
  /** 次行是否显示复制按钮，默认 true */
  secondaryCopyable?: boolean;
}

export function UniTableStackedPrimaryCell({
  primary,
  secondary,
  secondaryCopyable = true,
}: UniTableStackedPrimaryCellProps) {
  const { token } = theme.useToken();
  const primaryText = primary?.trim() ? primary.trim() : '-';
  const secondaryText = secondary?.trim() ? secondary.trim() : '-';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, lineHeight: 1.35 }}>
      <Typography.Text ellipsis={{ tooltip: primaryText }} style={{ fontSize: token.fontSize, maxWidth: '100%' }}>
        {primaryText}
      </Typography.Text>
      <Typography.Text
        type="secondary"
        {...(secondaryCopyable ? { copyable: { text: secondaryText } } : {})}
        style={{ fontSize: token.fontSizeSM, whiteSpace: 'nowrap' }}
      >
        {secondaryText}
      </Typography.Text>
    </div>
  );
}
