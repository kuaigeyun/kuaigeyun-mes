import type { ProColumns } from '@ant-design/pro-components';
import type { TFunction } from 'i18next';
import type { AuditPhaseRecord } from '../../../../../components/uni-audit/AuditPhaseBadge';
import { isUniTableOperationColumn } from '../../../../../components/uni-action/operationColumn';
import {
  isUniTableLifecycleColumn,
  UNI_TABLE_STATUS_BADGE_COLUMN_WIDTH,
} from '../../../../../utils/uniTableLayoutColumns';
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
  const { t, title, width = UNI_TABLE_STATUS_BADGE_COLUMN_WIDTH, fixed = 'right' } = options;

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
  // 列身份只认 key / dataIndex（与 UniTable 同一真源）；按标题文案匹配会随文案改动失效
  const lifecycleIdx = columns.findIndex((c) => isUniTableLifecycleColumn(c));
  if (lifecycleIdx < 0) {
    const actionsIdx = columns.findIndex((c) => isUniTableOperationColumn(c));
    const insertAt = actionsIdx >= 0 ? actionsIdx : columns.length;
    return [...columns.slice(0, insertAt), auditColumn, ...columns.slice(insertAt)];
  }
  return [...columns.slice(0, lifecycleIdx), auditColumn, ...columns.slice(lifecycleIdx)];
}
