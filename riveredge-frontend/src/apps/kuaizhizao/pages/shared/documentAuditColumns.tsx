import React from 'react';
import type { ProColumns } from '@ant-design/pro-components';
import { UniTableStackedPrimaryCell } from '../../../../components/uni-table/stackedPrimaryColumn';
import { formatDateTime } from '../../../../utils/format';

type Dict = Record<string, unknown>;

function resolveOperatorName(record: Dict, key: 'created' | 'updated'): string {
  const nameCandidates =
    key === 'created'
      ? ['created_by_name', 'creator_name', 'created_user_name', 'createdByName', 'creatorName']
      : ['updated_by_name', 'updater_name', 'updated_user_name', 'updatedByName', 'updaterName'];
  for (const candidate of nameCandidates) {
    const value = String(record[candidate] ?? '').trim();
    if (value) return value;
  }
  return '-';
}

function resolveTime(record: Dict, key: 'created' | 'updated'): string {
  const value =
    key === 'created'
      ? (record.created_at ?? record.createdAt)
      : (record.updated_at ?? record.updatedAt);
  if (!value) return '-';
  return formatDateTime(value as string, 'YYYY-MM-DD HH:mm');
}

/** 列表「更新时间」堆叠列：有更新人则用更新人+更新时间；否则回落创建人+创建时间。 */
export function resolveDocumentPreferredAudit(record: Dict): { operator: string; time: string } {
  const updatedOperator = resolveOperatorName(record, 'updated');
  const updatedTime = resolveTime(record, 'updated');
  if (updatedOperator !== '-' && updatedTime !== '-') {
    return { operator: updatedOperator, time: updatedTime };
  }
  const createdOperator = resolveOperatorName(record, 'created');
  const createdTime = resolveTime(record, 'created');
  if (createdOperator !== '-' && createdTime !== '-') {
    return { operator: createdOperator, time: createdTime };
  }
  // 有更新时间但无更新人：用创建人配更新时间，避免出现「- / 时间」
  if (updatedTime !== '-' && createdOperator !== '-') {
    return { operator: createdOperator, time: updatedTime };
  }
  if (updatedTime !== '-') {
    return { operator: updatedOperator, time: updatedTime };
  }
  return { operator: createdOperator, time: createdTime };
}

export function buildDocumentAuditColumns<T extends Dict>(
  t: (key: string) => string,
): ProColumns<T>[] {
  return [
    {
      title: t('common.updatedAt'),
      dataIndex: 'updated_at',
      width: 148,
      uniTableKeepWidth: true,
      hideInSearch: true,
      render: (_, record) => {
        const preferred = resolveDocumentPreferredAudit(record as Dict);
        return (
          <UniTableStackedPrimaryCell
            primary={preferred.operator}
            secondary={preferred.time}
            secondaryCopyable={false}
            primaryBold={false}
          />
        );
      },
    },
  ];
}
