import type { DescriptionsProps } from 'antd';
import type { ProDescriptionsItemProps } from '@ant-design/pro-components';
import type { ReactNode } from 'react';
import { formatDateBySiteSetting, formatDateTimeBySiteSetting } from '../../../utils/format';

/**
 * 主数据/单据详情：ProDescriptions 列配置 → Ant Design Descriptions items（与快制造等设备台账一致）
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
      // ProDescriptions 的 render 与 ProTable 列 render 共享复杂签名；此处仅传前三项即可
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
