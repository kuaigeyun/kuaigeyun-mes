/**
 * UniTable 标准「主从堆叠列」：上行主信息（正常字号、略加重）、下行次信息（小号 + 次要色，可复制）。
 *
 * 与 UniTable 列宽策略配合：
 * - 列上设 `uniTablePrimaryFlex: true` + `minWidth`（勿写死 width），由主列吃剩余横向空间；
 * - 原 secondary 字段列 `hideInTable: true`，搜索/导出仍保留独立 dataIndex；
 * - 日期/金额等结构化列加 `uniTableKeepWidth: true` 或依赖 valueType 自动保护。
 */

import React from 'react';
import { CopyOutlined } from '@ant-design/icons';
import { Typography, theme } from 'antd';

/** 文档文件夹风格复制图标色（固定淡黄，不随主题色漂移） */
const DOC_FOLDER_COPY_ICON_COLOR = '#d48806';

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
  /** @deprecated 请用 secondaryExtra；复制按钮前的插槽（历史兼容） */
  secondaryLeadingExtra?: React.ReactNode;
  /** 次行末尾附加内容（如逾期标签） */
  secondaryExtra?: React.ReactNode;
  /** 主行末尾附加内容（如拆分工单标签） */
  primaryExtra?: React.ReactNode;
  /** 两行使用相同字号与字重（如计划开始/结束时间） */
  uniformText?: boolean;
  /** 主行是否强调字重（非 uniformText 时生效），默认 true */
  primaryBold?: boolean;
  /** 主行行前徽章（如“开始”） */
  primaryBadge?: React.ReactNode;
  /** 次行行前徽章（如“结束”） */
  secondaryBadge?: React.ReactNode;
}

export function UniTableStackedPrimaryCell({
  primary,
  secondary,
  secondaryCopyable = true,
  secondaryLeadingExtra,
  secondaryExtra,
  primaryExtra,
  uniformText = false,
  primaryBold = true,
  primaryBadge,
  secondaryBadge,
}: UniTableStackedPrimaryCellProps) {
  const { token } = theme.useToken();
  const primaryText = primary?.trim() ? primary.trim() : '-';
  const secondaryText = secondary?.trim() ? secondary.trim() : '-';
  const rowGap = 6;
  const copyIconStyle: React.CSSProperties = { color: DOC_FOLDER_COPY_ICON_COLOR, fontSize: 11 };
  const primaryLineStyle: React.CSSProperties = uniformText
    ? { fontSize: token.fontSize, fontWeight: 400, lineHeight: 1.25, maxWidth: '100%' }
    : { fontSize: token.fontSize, fontWeight: primaryBold ? 500 : 400, lineHeight: 1.25, maxWidth: '100%' };
  const primaryRowHeight = Math.round(token.fontSize * 1.25);
  const secondaryLineStyle: React.CSSProperties = uniformText
    ? { fontSize: token.fontSize, fontWeight: 400, lineHeight: 1.25, whiteSpace: 'nowrap' }
    : { fontSize: token.fontSizeSM, lineHeight: 1.2, whiteSpace: 'nowrap' };
  const lineBadgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 6px',
    width: 36,
    borderRadius: 10,
    border: `1px solid ${token.colorBorderSecondary}`,
    color: token.colorTextSecondary,
    background: token.colorFillTertiary,
    fontSize: 10,
    lineHeight: '16px',
    height: 16,
    flexShrink: 0,
  };

  const primaryTextStyle: React.CSSProperties = {
    ...primaryLineStyle,
    margin: 0,
    lineHeight: `${primaryRowHeight}px`,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    ...(primaryExtra
      ? { flex: '0 1 auto', maxWidth: '100%' }
      : { flex: '1 1 auto', width: '100%' }),
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minWidth: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          columnGap: rowGap,
          flexWrap: 'nowrap',
          maxWidth: '100%',
          minWidth: 0,
          minHeight: primaryRowHeight,
          width: '100%',
        }}
      >
        {primaryBadge ? <span style={lineBadgeStyle}>{primaryBadge}</span> : null}
        <span title={primaryText} style={primaryTextStyle}>
          {primaryText}
        </span>
        {primaryExtra}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          columnGap: rowGap,
          maxWidth: '100%',
          minWidth: 0,
          marginTop: 1,
          flexWrap: 'nowrap',
        }}
      >
        {secondaryBadge ? <span style={lineBadgeStyle}>{secondaryBadge}</span> : null}
        <Typography.Text
          {...(uniformText ? {} : { type: 'secondary' as const })}
          style={secondaryLineStyle}
        >
          {secondaryText}
        </Typography.Text>
        {secondaryLeadingExtra}
        {secondaryCopyable && secondaryText !== '-' ? (
          <Typography.Text
            copyable={{
              text: secondaryText,
              icon: [
                <CopyOutlined key="copy" style={copyIconStyle} />,
                <CopyOutlined key="copied" style={{ ...copyIconStyle, color: '#52c41a' }} />,
              ],
              tooltips: ['复制', '已复制'],
            }}
            style={{ margin: 0 }}
          />
        ) : null}
        {secondaryExtra}
      </div>
    </div>
  );
}

/** 物料次行：编号 · 规格（无规格则仅编号） */
export function formatMaterialCodeSpecLine(code?: string | null, spec?: string | null): string {
  const c = code?.trim() ?? '';
  const s = spec?.trim() ?? '';
  if (c && s) return `${c} · ${s}`;
  return c || s || '-';
}

export interface MaterialStackedCellProps {
  material_name?: string | null;
  material_code?: string | null;
  material_spec?: string | null;
  secondaryCopyable?: boolean;
}

/** 物料主从堆叠单元格：名称 / 编号·规格 */
export function MaterialStackedCell({
  material_name,
  material_code,
  material_spec,
  secondaryCopyable = true,
}: MaterialStackedCellProps) {
  return (
    <UniTableStackedPrimaryCell
      primary={String(material_name ?? '')}
      secondary={formatMaterialCodeSpecLine(material_code, material_spec)}
      secondaryCopyable={secondaryCopyable}
    />
  );
}
