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
import { Space, Typography, theme } from 'antd';

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
}

export function UniTableStackedPrimaryCell({
  primary,
  secondary,
  secondaryCopyable = true,
  secondaryLeadingExtra,
  secondaryExtra,
  primaryExtra,
  uniformText = false,
}: UniTableStackedPrimaryCellProps) {
  const { token } = theme.useToken();
  const primaryText = primary?.trim() ? primary.trim() : '-';
  const secondaryText = secondary?.trim() ? secondary.trim() : '-';
  const copyIconStyle: React.CSSProperties = { color: DOC_FOLDER_COPY_ICON_COLOR, fontSize: 11 };
  const primaryLineStyle: React.CSSProperties = uniformText
    ? { fontSize: token.fontSize, fontWeight: 400, lineHeight: 1.25, maxWidth: '100%' }
    : { fontSize: token.fontSize, fontWeight: 500, lineHeight: 1.25, maxWidth: '100%' };
  const primaryRowHeight = Math.round(token.fontSize * 1.25);
  const secondaryLineStyle: React.CSSProperties = uniformText
    ? { fontSize: token.fontSize, fontWeight: 400, lineHeight: 1.25, whiteSpace: 'nowrap' }
    : { fontSize: token.fontSizeSM, lineHeight: 1.2, whiteSpace: 'nowrap' };

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
          columnGap: 6,
          flexWrap: 'nowrap',
          maxWidth: '100%',
          minWidth: 0,
          minHeight: primaryRowHeight,
          width: '100%',
        }}
      >
        <span title={primaryText} style={primaryTextStyle}>
          {primaryText}
        </span>
        {primaryExtra}
      </div>
      <Space size={2} align="center" style={{ maxWidth: '100%', minWidth: 0, marginTop: 1 }}>
        <Typography.Text
          {...(uniformText ? {} : { type: 'secondary' as const })}
          style={secondaryLineStyle}
        >
          {secondaryText}
        </Typography.Text>
        {secondaryLeadingExtra}
        {secondaryCopyable ? (
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
      </Space>
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
