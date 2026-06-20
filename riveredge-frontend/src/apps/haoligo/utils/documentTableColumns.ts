import type { ProColumns } from '@ant-design/pro-components';
import { formatDateTimeBySiteSetting } from '../../../utils/format';

type WithCreatedAt = { created_at?: string | null };

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
