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

/** 列表「更新时间」堆叠列：优先更新人+更新时间；无更新时间则创建人+创建时间。 */
export function resolveDocumentPreferredAudit(record: Dict): { operator: string; time: string } {
  const updatedTime = resolveTime(record, 'updated');
  if (updatedTime !== '-') {
    return {
      operator: resolveOperatorName(record, 'updated'),
      time: updatedTime,
    };
  }
  return {
    operator: resolveOperatorName(record, 'created'),
    time: resolveTime(record, 'created'),
  };
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
