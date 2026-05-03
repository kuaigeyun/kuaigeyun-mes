/**
 * 将 ProDescriptions 列配置转为 Ant Design Descriptions items（详情抽屉「基本信息」区复用）
 */

import type { ReactNode } from 'react';
import type { DescriptionsProps } from 'antd';
import type { ProDescriptionsItemProps } from '@ant-design/pro-components';
import dayjs from 'dayjs';

export function detailDrawerDescriptionItems<T extends Record<string, any>>(
  columns: ProDescriptionsItemProps<T>[],
  dataSource: T | null | undefined
): NonNullable<DescriptionsProps['items']> {
  return columns.map((col: ProDescriptionsItemProps<T> & { key?: React.Key }, index: number) => {
    const di = col.dataIndex as string | undefined;
    const value = dataSource && di ? (dataSource as Record<string, unknown>)[di] : undefined;

    let content: ReactNode = value as ReactNode;

    if (col.valueType === 'dateTime' && value) {
      content = dayjs(value as string).format('YYYY-MM-DD HH:mm:ss');
    } else if (col.valueType === 'date' && value) {
      content = dayjs(value as string).format('YYYY-MM-DD');
    } else if (col.valueEnum && value != null && value !== '') {
      const enumItem = col.valueEnum[value as string] as { text?: string } | undefined;
      content = enumItem?.text || enumItem || value;
    }

    if (col.render && dataSource != null) {
      content = col.render(content, dataSource, index, {}, col);
    }

    return {
      key: col.key ?? col.dataIndex ?? index,
      label: col.title as ReactNode,
      children: content !== undefined && content !== null ? content : '-',
      span: col.span ?? 1,
    };
  });
}
