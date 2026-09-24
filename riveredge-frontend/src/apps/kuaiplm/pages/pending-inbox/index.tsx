/**
 * 跨项目待办（优先一联调收口）
 * 聚合 R-15 / R-08 / R-04 待审单据；路由 /apps/kuaiplm/pending-inbox
 */

import React, { useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ProColumns } from '@ant-design/pro-components';
import { ActionType } from '@ant-design/pro-components';
import { App, Button } from 'antd';
import { UniTable } from '../../../../components/uni-table';
import { rowActionKind } from '../../../../components/uni-action';
import { ListPageTemplate } from '../../../../components/layout-templates';
import { MarkerTag } from '../../../../constants/statusBadges';
import { renderDocumentStatusTag } from '../../../../utils/documentLifecycleStatusTag';
import { formatDateTimeBySiteSetting } from '../../../../utils/format';
import {
  alignProColumns,
  GLOBAL_DOC_LIST_FIELD_RANK,
} from '../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import { UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS } from '../../../../utils/uniTableLayoutColumns';
import { getApiErrorMessage } from '../../../../utils/errorHandler';
import {
  pendingInboxApi,
  type PendingInboxDocType,
  type PendingInboxItem,
} from '../../services/pending-inbox';

const DOC_TYPE_KEYS: PendingInboxDocType[] = [
  'product_firmware',
  'sample_process',
  'material_review',
  'bom_collab',
  'project_proposal',
  'mold_sample',
  'trial_flow',
  'engineering_change',
];

const PendingInboxPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message: messageApi } = App.useApp();
  const [searchParams] = useSearchParams();
  const filterProjectId = searchParams.get('project_id')
    ? Number(searchParams.get('project_id'))
    : undefined;

  const actionRef = useRef<ActionType>(null);

  const docTypeLabel = useCallback(
    (s: string) => t(`app.kuaiplm.pendingInbox.docType.${s}`, { defaultValue: s }),
    [t],
  );
  const statusLabel = useCallback(
    (s: string) => t(`app.kuaiplm.pendingInbox.status.${s}`, { defaultValue: s }),
    [t],
  );

  const openDoc = useCallback(
    (row: PendingInboxItem) => {
      const path = row.list_path || '/apps/kuaiplm/dashboard';
      if (row.project_id && !path.includes('project_id=')) {
        const sep = path.includes('?') ? '&' : '?';
        navigate(`${path}${sep}project_id=${row.project_id}`);
        return;
      }
      navigate(path);
    },
    [navigate],
  );

  const columns = useMemo<ProColumns<PendingInboxItem>[]>(() => {
    const cols: ProColumns<PendingInboxItem>[] = [
      {
        title: t('app.kuaiplm.pendingInbox.fields.docType'),
        dataIndex: 'doc_type',
        key: 'document_type',
        width: 130,
        uniTableKeepWidth: true,
        valueEnum: Object.fromEntries(DOC_TYPE_KEYS.map((k) => [k, { text: docTypeLabel(k) }])),
        render: (_, r) => <MarkerTag>{docTypeLabel(r.doc_type)}</MarkerTag>,
      },
      {
        title: t('app.kuaiplm.pendingInbox.fields.code'),
        dataIndex: 'doc_code',
        key: 'document_code',
        width: 140,
        minWidth: 140,
        copyable: true,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
      },
      {
        title: t('app.kuaiplm.pendingInbox.fields.title'),
        dataIndex: 'title',
        key: 'title',
        minWidth: 160,
        uniTablePrimaryFlex: true,
        uniTableRemainderFlex: true,
        ellipsis: true,
      },
      {
        title: t('app.kuaiplm.pendingInbox.fields.project'),
        dataIndex: 'project_name',
        key: 'project_name',
        width: 180,
        minWidth: 180,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        render: (_, r) =>
          r.project_name
            ? `${r.project_name}${r.project_code ? ` (${r.project_code})` : ''}`
            : '—',
      },
      {
        ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
        title: t('common.status'),
        dataIndex: 'status',
        key: 'lifecycle',
        fixed: 'right',
        hideInSearch: true,
        render: (_, r) => renderDocumentStatusTag(statusLabel(r.status), r.status),
      },
      {
        title: t('common.updatedAt'),
        dataIndex: 'updated_at',
        key: 'updated_at',
        width: 160,
        search: false,
        uniTableKeepWidth: true,
        render: (_, r) => formatDateTimeBySiteSetting(r.updated_at) || '—',
      },
      {
        title: t('common.action'),
        valueType: 'option',
        key: 'option',
        fixed: 'right',
        render: (_, row) => [
          <Button
            key="open"
            type="link"
            size="small"
            {...rowActionKind('read')}
            onClick={() => openDoc(row)}
          >
            {t('app.kuaiplm.pendingInbox.actions.open')}
          </Button>,
        ],
      },
    ];
    return cols;
  }, [t, docTypeLabel, statusLabel, openDoc]);

  return (
    <ListPageTemplate>
      <UniTable<PendingInboxItem>
        headerTitle={t('app.kuaiplm.pendingInbox.title')}
        actionRef={actionRef}
        rowKey={(r) => `${r.doc_type}-${r.doc_id}`}
        permissionResource="kuaiplm:dashboard"
        enableRowSelection={false}
        columns={alignProColumns(columns, GLOBAL_DOC_LIST_FIELD_RANK)}
        columnPersistenceId="apps.kuaiplm.pages.pending-inbox.width-v2"
        showCreateButton={false}
        showDeleteButton={false}
        request={async (params) => {
          try {
            const res = await pendingInboxApi.list({
              skip: ((params.current || 1) - 1) * (params.pageSize || 20),
              limit: params.pageSize || 20,
              doc_type: params.doc_type as string | undefined,
              project_id: filterProjectId,
            });
            return { data: res.items, total: res.total, success: true };
          } catch (e) {
            messageApi.error(getApiErrorMessage(e));
            return { data: [], total: 0, success: false };
          }
        }}
      />
    </ListPageTemplate>
  );
};

export default PendingInboxPage;
