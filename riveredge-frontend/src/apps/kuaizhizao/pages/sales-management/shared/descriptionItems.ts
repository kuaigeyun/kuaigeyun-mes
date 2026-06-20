import type { DescriptionsProps } from 'antd';
import type { ProDescriptionsItemProps } from '@ant-design/pro-components';
import dayjs from 'dayjs';
import type React from 'react';
import { formatDateTime } from '../../../../../utils/format';

/**
 * 保证 Descriptions 每行 span 之和等于 column，避免 antd 告警。
 * 行末不足时扩展上一项 span；下一项放不下时先填满当前行再换行。
 */
export function normalizeDescriptionItemSpans(
  items: NonNullable<DescriptionsProps['items']>,
  column: number,
): NonNullable<DescriptionsProps['items']> {
  if (!items?.length || column <= 0) return items;

  const normalized = items.map((item) => ({
    ...item,
    span: Math.min(Math.max(item.span ?? 1, 1), column),
  }));

  let rowUsed = 0;

  for (let i = 0; i < normalized.length; i += 1) {
    const span = normalized[i].span ?? 1;

    if (span >= column && rowUsed > 0) {
      normalized[i - 1] = {
        ...normalized[i - 1],
        span: (normalized[i - 1].span ?? 1) + (column - rowUsed),
      };
      rowUsed = 0;
    }

    if (rowUsed > 0 && rowUsed + span > column) {
      normalized[i - 1] = {
        ...normalized[i - 1],
        span: (normalized[i - 1].span ?? 1) + (column - rowUsed),
      };
      rowUsed = 0;
    }

    rowUsed += span;
    if (rowUsed >= column) rowUsed = 0;
  }

  return normalized;
}

/** ProDescriptions 列配置 → Ant Design Descriptions items（含 span 归一化） */
export function buildDescriptionItemsFromColumns<T extends Record<string, unknown>>(
  dataSource: T,
  cols: ProDescriptionsItemProps<T>[],
  options?: { column?: number },
): NonNullable<DescriptionsProps['items']> {
  const column = options?.column ?? 3;

  const items = cols.map((col, index) => {
    const dataIndex = col.dataIndex as keyof T | undefined;
    const value = dataIndex != null ? dataSource[dataIndex] : undefined;
    let content: React.ReactNode = value as React.ReactNode;
    if (col.valueType === 'dateTime' && value) {
      content = formatDateTime(value as string, 'YYYY-MM-DD HH:mm:ss');
    } else if (col.valueType === 'date' && value) {
      content = formatDateTime(value as string, 'YYYY-MM-DD');
    }
    if (col.render && dataSource != null) {
      content = (
        col.render as (
          dom: React.ReactNode,
          entity: T,
          i: number,
        ) => React.ReactNode
      )(content, dataSource, index);
    }
    const rendered = content !== undefined && content !== null && content !== '' ? content : '-';
    return {
      key: String(col.key ?? col.dataIndex ?? index),
      label: col.title as React.ReactNode,
      children: rendered,
      span: col.span ?? 1,
    };
  });

  return normalizeDescriptionItemSpans(items, column);
}
