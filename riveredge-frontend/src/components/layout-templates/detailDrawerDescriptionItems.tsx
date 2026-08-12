/**
 * 将 ProDescriptions 列配置转为 Ant Design Descriptions items（详情抽屉「基本信息」区复用）
 * 关联单号列与 UniTable 同一约定：自动挂嵌套抽屉链接。
 */

import type { Key, ReactNode } from 'react';
import type { DescriptionsProps } from 'antd';
import type { ProDescriptionsItemProps } from '@ant-design/pro-components';
import { formatDateBySiteSetting, formatDateTimeBySiteSetting } from '../../utils/format';
import { resolveLinkedDocumentColumn } from '../../apps/kuaizhizao/utils/linkedDocumentAutoLink';
import { LinkedDocumentAutoCell } from '../linked-document-code/LinkedDocumentAutoCell';

export function detailDrawerDescriptionItems<T extends Record<string, any>>(
  columns: ProDescriptionsItemProps<T>[],
  dataSource: T | null | undefined
): NonNullable<DescriptionsProps['items']> {
  return columns.map((col: ProDescriptionsItemProps<T>, index: number) => {
    const di = col.dataIndex as string | string[] | undefined;
    const lookupKey =
      typeof di === 'string' ? di : Array.isArray(di) ? di.join('.') : undefined;
    const value =
      dataSource && lookupKey != null ? (dataSource as Record<string, unknown>)[lookupKey] : undefined;

    const itemKey =
      col.key ??
      (typeof di === 'string' || typeof di === 'number' ? di : Array.isArray(di) ? di.join('.') : index);

    const skipLinked = Boolean((col as { skipLinkedDocumentLink?: boolean }).skipLinkedDocumentLink);
    const linkedBinding =
      !skipLinked && typeof lookupKey === 'string' ? resolveLinkedDocumentColumn(lookupKey) : null;
    if (linkedBinding && dataSource) {
      return {
        key: itemKey as Key,
        label: col.title as ReactNode,
        children: (
          <LinkedDocumentAutoCell
            binding={linkedBinding}
            record={dataSource as Record<string, unknown>}
          />
        ),
        span: col.span ?? 1,
      };
    }

    let content: ReactNode = value as ReactNode;

    if (col.valueType === 'dateTime' && value) {
      content = formatDateTimeBySiteSetting(value as string);
    } else if (col.valueType === 'date' && value) {
      content = formatDateBySiteSetting(value as string);
    } else if (col.valueEnum && value != null && value !== '') {
      const vk = String(value);
      const rawEnum = col.valueEnum as Record<string, { text?: ReactNode } | undefined>;
      const enumItem = rawEnum[vk];
      content =
        typeof enumItem === 'object' && enumItem && 'text' in enumItem
          ? enumItem.text ?? vk
          : (enumItem as ReactNode | undefined) ?? vk;
    }

    if (col.render && dataSource != null) {
      content = (col.render as (dom: ReactNode, entity: T, i: number) => ReactNode)(
        content,
        dataSource,
        index,
      );
    }

    return {
      key: itemKey as Key,
      label: col.title as ReactNode,
      children: content !== undefined && content !== null ? content : '-',
      span: col.span ?? 1,
    };
  });
}
