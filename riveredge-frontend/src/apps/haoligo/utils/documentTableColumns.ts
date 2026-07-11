import type { ProColumns } from '@ant-design/pro-components';
import { formatDateTimeBySiteSetting } from '../../../utils/format';

type WithCreatedAt = { created_at?: string | null };

export type WithCreatorFields = {
  creator_name?: string | null;
  applicant_name?: string | null;
  registrant_name?: string | null;
  trial_user_name?: string | null;
  created_by_name?: string | null;
};

export function resolveHaoligoDocumentCreatorName(row: WithCreatorFields | null | undefined): string {
  if (!row) return '—';
  const name = (
    row.creator_name ??
    row.applicant_name ??
    row.registrant_name ??
    row.trial_user_name ??
    row.created_by_name ??
    ''
  )
    .trim();
  return name || '—';
}

/** 好力 GO 单据列表通用「创建人」列 */
export function haoligoDocumentCreatorColumn<T extends WithCreatorFields>(): ProColumns<T> {
  return {
    title: '创建人',
    dataIndex: 'creator_name',
    key: 'creator_name',
    width: 100,
    ellipsis: true,
    hideInSearch: true,
    render: (_, r) => resolveHaoligoDocumentCreatorName(r),
  };
}

/** 模具单据列表通用「创建时间」列 */
export function moldDocumentCreatedAtColumn<T extends WithCreatedAt>(): ProColumns<T> {
  return {
    title: '创建时间',
    dataIndex: 'created_at',
    key: 'created_at',
    width: 168,
    hideInSearch: true,
    render: (_, r) => (r.created_at ? formatDateTimeBySiteSetting(r.created_at, '—') : '—'),
  };
}
