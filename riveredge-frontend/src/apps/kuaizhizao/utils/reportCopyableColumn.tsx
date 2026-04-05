import React from 'react';
import { Typography } from 'antd';
import type { ProColumns } from '@ant-design/pro-components';

/**
 * 报表 UniTable：编码/单号/批号等列一键复制（对齐 UI_Standard 列表关键字段）
 */
export function copyableCodeColumn<T = Record<string, unknown>>(
  title: string,
  dataIndex: string,
  width?: number
): ProColumns<T> {
  return {
    title,
    dataIndex,
    width,
    render: (_, r) => {
      const row = r as Record<string, unknown>;
      const v = row[dataIndex];
      const text = v == null || v === '' ? '-' : String(v);
      return (
        <Typography.Text copyable={{ text: v == null || v === '' ? '' : String(v) }} ellipsis>
          {text}
        </Typography.Text>
      );
    },
  };
}
