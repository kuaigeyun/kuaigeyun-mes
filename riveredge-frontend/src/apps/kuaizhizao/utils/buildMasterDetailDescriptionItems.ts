import type { DescriptionsProps } from 'antd';
import type { ProDescriptionsItemProps } from '@ant-design/pro-components';
import type { ReactNode } from 'react';
import { formatDateBySiteSetting, formatDateTimeBySiteSetting } from '../../../utils/format';

/**
 * 主数据详情：将 ProDescriptions 列配置转为 Ant Design Descriptions items（与设备台账等页一致）
 */
export function buildMasterDetailDescriptionItems<T extends Record<string, any>>(
  dataSource: T,
  cols: ProDescriptionsItemProps<T>[]
): NonNullable<DescriptionsProps['items']> {
  return cols.map((col, index) => {
    const dataIndex = col.dataIndex as keyof T | undefined;
    const value = dataIndex != null ? dataSource[dataIndex] : undefined;
    let content: ReactNode = value as ReactNode;
    if (col.valueType === 'date' && value) {
      content = formatDateBySiteSetting(value as string);
    }
    if (col.valueType === 'dateTime' && value) {
      content = formatDateTimeBySiteSetting(value as string);
    }
    if (col.render && dataSource != null) {
      content = (col.render as (dom: ReactNode, entity: T, i: number) => ReactNode)(content, dataSource, index);
    }
    return {
      key: String(col.key ?? col.dataIndex ?? index),
      label: col.title as React.ReactNode,
      children: content !== undefined && content !== null ? content : '-',
      span: col.span ?? 1,
    };
  });
}
