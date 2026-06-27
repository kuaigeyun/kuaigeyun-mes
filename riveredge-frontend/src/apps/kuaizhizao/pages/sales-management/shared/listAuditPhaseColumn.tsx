import type { ProColumns } from '@ant-design/pro-components';
import type { TFunction } from 'i18next';
import type { AuditPhaseRecord } from '../../../../../components/uni-audit/AuditPhaseBadge';
import { ListAuditPhaseCell } from './ListAuditPhaseCell';

export interface ListAuditPhaseColumnOptions {
  t: TFunction;
  /** @deprecated 列始终展示；false=自动通过模式，仍显示 phase */
  auditEnabled?: boolean;
  title?: string;
  width?: number;
  fixed?: 'left' | 'right';
}

export function createListAuditPhaseColumn<T extends AuditPhaseRecord>(
  options: ListAuditPhaseColumnOptions,
): ProColumns<T> {
  const { t, title, width = 96, fixed = 'right' } = options;

  return {
    key: 'audit_phase',
    title: title ?? t('components.uniAudit.colAuditStatus', { defaultValue: '审核状态' }),
    dataIndex: ['audit', 'phase'],
    width,
    fixed,
    align: 'center',
    hideInSearch: true,
    render: (_: unknown, record: T) => <ListAuditPhaseCell record={record} />,
  };
}

export function insertAuditPhaseColumnBeforeLifecycle<T extends AuditPhaseRecord>(
  columns: ProColumns<T>[],
  auditColumn: ProColumns<T> | null,
): ProColumns<T>[] {
  if (!auditColumn) return columns;
  const lifecycleIdx = columns.findIndex((c) => {
    if (c.dataIndex === 'lifecycle_stage') return true;
    const title = typeof c.title === 'string' ? c.title : '';
    return (
      title.includes('当前阶段') ||
      title.includes('生命周期') ||
      title.toLowerCase().includes('lifecycle')
    );
  });
  if (lifecycleIdx < 0) {
    const actionsIdx = columns.findIndex(
      (c) => c.valueType === 'option' || c.title === '操作' || c.title === 'Actions',
    );
    const insertAt = actionsIdx >= 0 ? actionsIdx : columns.length;
    return [...columns.slice(0, insertAt), auditColumn, ...columns.slice(insertAt)];
  }
  return [...columns.slice(0, lifecycleIdx), auditColumn, ...columns.slice(lifecycleIdx)];
}
