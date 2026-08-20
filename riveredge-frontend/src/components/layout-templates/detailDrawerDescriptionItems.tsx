/**
 * 将 ProDescriptions 列配置转为 Ant Design Descriptions items（详情抽屉「基本信息」区复用）
 * 关联单号列与 UniTable 同一约定：自动挂嵌套抽屉链接。
 */

import { useMemo, type Key, type ReactNode } from 'react';
import type { DescriptionsProps } from 'antd';
import type { ProDescriptionsItemProps } from '@ant-design/pro-components';
import { formatDateBySiteSetting, formatDateTimeBySiteSetting } from '../../utils/format';
import {
  resolveLinkedDocumentColumn,
  shouldInjectLinkedDocumentRender,
} from '../../apps/kuaizhizao/utils/linkedDocumentAutoLink';
import { LinkedDocumentAutoCell } from '../linked-document-code/LinkedDocumentAutoCell';
import { useDetailDrawerFeatures } from '../../hooks/useDetailDrawerFeatures';
import {
  isDetailTimeFieldHidden,
  resolveColumnDataIndex,
} from '../../apps/kuaizhizao/constants/detailDrawerTimeFields';

function isUpdatedAtBasicColumn<T extends Record<string, any>>(col: ProDescriptionsItemProps<T>): boolean {
  const di = col.dataIndex as string | string[] | undefined;
  const fromIndex = typeof di === 'string' ? di : Array.isArray(di) ? String(di[di.length - 1] ?? '') : '';
  const fromKey = col.key != null ? String(col.key) : '';
  return fromIndex === 'updated_at' || fromIndex === 'updatedAt' || fromKey === 'updated_at' || fromKey === 'updatedAt';
}

export type DetailDrawerDescriptionItemsOptions = {
  showUpdatedAt?: boolean;
  documentType?: string;
  timeFieldHidden?: Record<string, boolean>;
};

export function filterDetailDrawerBasicColumns<T extends Record<string, any>>(
  columns: ProDescriptionsItemProps<T>[],
  showUpdatedAt: boolean,
  options?: Pick<DetailDrawerDescriptionItemsOptions, 'documentType' | 'timeFieldHidden'>,
): ProDescriptionsItemProps<T>[] {
  const hidden = options?.timeFieldHidden ?? {};
  const documentType = options?.documentType;
  return columns.filter((col) => {
    const fieldKey = resolveColumnDataIndex(col);
    if (isDetailTimeFieldHidden(fieldKey, documentType, hidden, showUpdatedAt)) return false;
    if (!showUpdatedAt && isUpdatedAtBasicColumn(col)) return false;
    return true;
  });
}

export function detailDrawerDescriptionItems<T extends Record<string, any>>(
  columns: ProDescriptionsItemProps<T>[],
  dataSource: T | null | undefined,
  options?: DetailDrawerDescriptionItemsOptions,
): NonNullable<DescriptionsProps['items']> {
  const visibleColumns = filterDetailDrawerBasicColumns(columns, options?.showUpdatedAt !== false, {
    documentType: options?.documentType,
    timeFieldHidden: options?.timeFieldHidden,
  });
  return visibleColumns.map((col: ProDescriptionsItemProps<T>, index: number) => {
    const di = col.dataIndex as string | string[] | undefined;
    const lookupKey =
      typeof di === 'string' ? di : Array.isArray(di) ? di.join('.') : undefined;
    const value =
      dataSource && lookupKey != null ? (dataSource as Record<string, unknown>)[lookupKey] : undefined;

    const itemKey =
      col.key ??
      (typeof di === 'string' || typeof di === 'number' ? di : Array.isArray(di) ? di.join('.') : index);

    const linkedBinding = shouldInjectLinkedDocumentRender({
      skipLinkedDocumentLink: Boolean((col as { skipLinkedDocumentLink?: boolean }).skipLinkedDocumentLink),
      render: col.render,
      dataIndex: lookupKey,
    })
      ? resolveLinkedDocumentColumn(lookupKey)
      : null;
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

/** 详情抽屉基本信息：按业务配置过滤更新时间后转 Descriptions items */
export function useDetailDrawerDescriptionItems<T extends Record<string, any>>(
  columns: ProDescriptionsItemProps<T>[],
  dataSource: T | null | undefined,
  documentType?: string,
): NonNullable<DescriptionsProps['items']> {
  const { basicUpdatedAtEnabled, timeFieldHidden } = useDetailDrawerFeatures();
  return useMemo(
    () =>
      detailDrawerDescriptionItems(columns, dataSource, {
        showUpdatedAt: basicUpdatedAtEnabled,
        documentType,
        timeFieldHidden,
      }),
    [basicUpdatedAtEnabled, columns, dataSource, documentType, timeFieldHidden],
  );
}
