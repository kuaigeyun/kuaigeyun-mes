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
}

export function UniTableStackedPrimaryCell({
  primary,
  secondary,
  secondaryCopyable = true,
}: UniTableStackedPrimaryCellProps) {
  const { token } = theme.useToken();
  const primaryText = primary?.trim() ? primary.trim() : '-';
  const secondaryText = secondary?.trim() ? secondary.trim() : '-';
  const copyIconStyle: React.CSSProperties = { color: DOC_FOLDER_COPY_ICON_COLOR, fontSize: 11 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minWidth: 0 }}>
      <Typography.Text
        ellipsis={{ tooltip: primaryText }}
        style={{
          fontSize: token.fontSize,
          fontWeight: 500,
          lineHeight: 1.25,
          maxWidth: '100%',
        }}
      >
        {primaryText}
      </Typography.Text>
      <Space size={2} align="center" style={{ maxWidth: '100%', minWidth: 0, marginTop: 1 }}>
        <Typography.Text
          type="secondary"
          style={{ fontSize: token.fontSizeSM, lineHeight: 1.2, whiteSpace: 'nowrap' }}
        >
          {secondaryText}
        </Typography.Text>
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
      </Space>
    </div>
  );
}
