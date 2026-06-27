import { rowActionKind } from '../../../../components/uni-action';
/**
 * ECR/ECO 变更工作台
 */

import React, { useRef, useState, useCallback, useMemo } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Space, Tag } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { UniTable } from '../../../../components/uni-table';
import { UniBatchMenuButton } from '../../../../components/uni-batch';
import { UniWorkflowActions } from '../../../../components/uni-workflow-actions';
import { ListPageTemplate } from '../../../../components/layout-templates';
import { useAuditRequired } from '../../../../hooks/useAuditRequired';
import {
  listBomChanges,
  listRouteChanges,
  listUnifiedChanges,
  auditNodeKeyForRow,
  batchApproveChanges,
  batchDeleteChanges,
  batchExecuteChanges,
  executeChange,
  type UnifiedChangeRow,
  type ChangeDeskCategory,
} from '../../services/change-desk';
import { buildBomChangeCreateUrl, buildRouteChangeCreateUrl } from '../../services/master-data-links';
import { useNewShortcut } from '../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../utils/globalNewShortcut';
import { getKuaiplmChangeCategoryText, getKuaiplmChangeStatusText, getKuaiplmChangeTypeText } from '../../components/kuaiplmMeta';
import { formatDateTime } from '../../../../utils/format';

type TabKey = 'all' | 'bom' | 'route';

const STATUS_COLOR: Record<string, string> = {
  draft: 'default',
  pending: 'processing',
  approved: 'success',
  executed: 'default',
  rejected: 'error',
  cancelled: 'default',
};

const ChangeManagementPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi, modal: modalApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const bomAuditEnabled = useAuditRequired('bom_change');
  const routeAuditEnabled = useAuditRequired('process_route_change');
  const auditEnabled = bomAuditEnabled || routeAuditEnabled;
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [rowsByUuid, setRowsByUuid] = useState<Record<string, UnifiedChangeRow>>({});

  const handleCreateBomChange = useCallback(() => {
    window.open(buildBomChangeCreateUrl(), '_blank');
  }, []);
  useNewShortcut(handleCreateBomChange);

  const fetchList = async (
    params: { current?: number; pageSize?: number },
    category: TabKey,
    status?: string,
  ) => {
    const skip = ((params.current || 1) - 1) * (params.pageSize || 20);
    const limit = params.pageSize || 20;
    const base = { skip, limit, status };
    if (category === 'bom') return listBomChanges(base);
    if (category === 'route') return listRouteChanges(base);
    return listUnifiedChanges({ ...base, change_category: undefined });
  };

  const handleExecute = useCallback(
    (row: UnifiedChangeRow) => {
      const uuid = row.uuid;
      if (!uuid || !row.change_category) return;
      modalApi.confirm({
        title: t('app.kuaiplm.change.executeConfirm'),
        onOk: async () => {
          await executeChange(row.change_category as ChangeDeskCategory, uuid);
          messageApi.success(t('app.kuaiplm.common.messages.executeSuccess'));
          actionRef.current?.reload();
        },
      });
    },
    [modalApi, messageApi, t],
  );

  const selectedBatchItems = selectedRowKeys
    .map((key) => rowsByUuid[String(key)])
    .filter((row): row is UnifiedChangeRow => !!row?.uuid && !!row?.change_category)
    .map((row) => ({
      change_uuid: String(row.uuid),
      change_type: row.change_category === 'route' ? 'process_route' : 'bom',
    }));

  const handleBatchApprove = useCallback(async () => {
    if (!selectedBatchItems.length) {
      messageApi.warning(t('app.kuaiplm.change.messages.selectFirst'));
      return;
    }
    const result = await batchApproveChanges(selectedBatchItems, true);
    const successCount = Number(result?.success_count || 0);
    if (successCount > 0) {
      messageApi.success(t('app.kuaiplm.common.messages.batchApproveSuccess', { count: successCount }));
      setSelectedRowKeys([]);
      actionRef.current?.reload();
      return;
    }
    messageApi.error(t('app.kuaiplm.common.messages.batchUpdateFailed'));
  }, [messageApi, selectedBatchItems, t]);

  const handleBatchExecute = useCallback(async () => {
    if (!selectedBatchItems.length) {
      messageApi.warning(t('app.kuaiplm.change.messages.selectFirst'));
      return;
    }
    const result = await batchExecuteChanges(selectedBatchItems);
    const successCount = Number(result?.success_count || 0);
    if (successCount > 0) {
      messageApi.success(t('app.kuaiplm.common.messages.batchExecuteSuccess', { count: successCount }));
      setSelectedRowKeys([]);
      actionRef.current?.reload();
      return;
    }
    messageApi.error(t('app.kuaiplm.common.messages.batchUpdateFailed'));
  }, [messageApi, selectedBatchItems, t]);

  const handleBatchDelete = useCallback(
    async (keys: React.Key[]) => {
      const items = keys
        .map((key) => rowsByUuid[String(key)])
        .filter((row): row is UnifiedChangeRow => !!row?.uuid && !!row?.change_category)
        .map((row) => ({
          change_uuid: String(row.uuid),
          change_type: row.change_category === 'route' ? 'process_route' : 'bom',
        }));
      if (!items.length) {
        messageApi.warning(t('app.kuaiplm.change.messages.selectFirst'));
        return;
      }
      const result = await batchDeleteChanges(items);
      const successCount = Number(result?.success_count || 0);
      if (successCount > 0) {
        messageApi.success(t('app.kuaiplm.common.messages.batchDeleteSuccess', { count: successCount }));
        setSelectedRowKeys([]);
        actionRef.current?.reload();
        return;
      }
      messageApi.error(t('app.kuaiplm.common.messages.batchDeleteFailed'));
    },
    [messageApi, rowsByUuid, t],
  );

  const columns: ProColumns<UnifiedChangeRow>[] = useMemo(
    () => [
      {
        title: t('app.kuaiplm.common.columns.category'),
        dataIndex: 'change_category',
        width: 90,
        render: (_, row) => (
          <Tag color={row.change_category === 'bom' ? 'blue' : 'purple'}>
            {getKuaiplmChangeCategoryText(t, row.change_category)}
          </Tag>
        ),
      },
      { title: t('app.kuaiplm.common.columns.changeCode'), dataIndex: 'change_code', width: 140 },
      {
        title: t('app.kuaiplm.common.columns.changeType'),
        dataIndex: 'change_type',
        width: 120,
        render: (_, row) =>
          getKuaiplmChangeTypeText(t, row.change_type, row.change_category),
      },
      { title: t('app.kuaiplm.common.columns.target'), dataIndex: 'target_name', ellipsis: true },
      {
        title: t('app.kuaiplm.common.columns.status'),
        dataIndex: 'status',
        width: 100,
        render: (_, row) => (
          <Tag color={STATUS_COLOR[(row.status ?? '').toLowerCase()] ?? 'default'}>
            {getKuaiplmChangeStatusText(t, row.status)}
          </Tag>
        ),
      },
      {
        title: t('app.kuaiplm.common.columns.changeReason'),
        dataIndex: 'change_reason',
        ellipsis: true,
        hideInSearch: true,
      },
      {
        title: t('app.kuaiplm.common.columns.createdAt'),
        dataIndex: 'created_at',
        width: 168,
        hideInSearch: true,
        render: (_, row) => (row.created_at ? formatDateTime(row.created_at, 'YYYY-MM-DD HH:mm') : '-'),
      },
      {
        title: t('app.kuaiplm.common.columns.actions'),
        valueType: 'option',
        fixed: 'right',
        width: 200,
        render: (_, row) => {
          const status = (row.status ?? '').toLowerCase();
          const rowAuditEnabled =
            row.change_category === 'route' ? routeAuditEnabled : bomAuditEnabled;
          return [
            <UniWorkflowActions
              {...rowActionKind('skip')}
              key="audit"
              record={row}
              rowKey="id"
                unifiedAudit
                auditNodeKey={auditNodeKeyForRow(row)}
                entityType={row.audit?.entity_type || auditNodeKeyForRow(row)}
                resourcePrefix="kuaiplm:change"
                pendingStatuses={['pending', 'pending_review', '待审批']}
                approvedStatuses={['approved', '已审批']}
                draftStatuses={['draft', '草稿']}
                entityName={t('app.kuaiplm.change.entityName')}
                onSuccess={() => actionRef.current?.reload()}
                theme="link"
                size="small"
              />,
            status === 'approved' || row.status === '已审批' ? (
              <Button
                {...rowActionKind('execute')}
                key="execute"
                type="link"
                size="small"
                icon={<PlayCircleOutlined />}
                onClick={() => handleExecute(row)}
              >
                {t('app.kuaiplm.common.actions.execute')}
              </Button>
            ) : null,
          ].filter(Boolean) as React.ReactNode[];
        },
      },
    ],
    [handleExecute, routeAuditEnabled, bomAuditEnabled, t],
  );

  const toolbarMenuItems = useMemo(
    () => [
      { key: 'all', label: t('app.kuaiplm.change.tab.all') },
      { key: 'bom', label: t('app.kuaiplm.change.tab.bom') },
      { key: 'route', label: t('app.kuaiplm.change.tab.route') },
    ],
    [t],
  );

  return (
    <ListPageTemplate>
      <UniTable<UnifiedChangeRow>
        headerTitle={t('app.kuaiplm.change.pageTitle')}
        actionRef={actionRef}
        rowKey="uuid"
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        columns={columns}
        columnPersistenceId={`apps.kuaiplm.pages.change-management.${activeTab}`}
        scroll={{ x: 1200 }}
        showCreateButton
        createButtonText={t('app.kuaiplm.change.createBomButton') + NEW_SHORTCUT_HINT}
        onCreate={handleCreateBomChange}
        showDeleteButton
        onDelete={handleBatchDelete}
        deleteConfirmTitle={(count) => t('app.kuaiplm.change.deleteConfirm', { count })}
        toolBarActionsAfterDelete={[
          <UniBatchMenuButton
            key="change-desk-batch-actions"
            buttonText={t('app.kuaiplm.common.actions.batchActions')}
            selectedRowKeys={selectedRowKeys}
            menuItems={[
              ...(auditEnabled
                ? [
                    {
                      key: 'batch-approve',
                      label: t('app.kuaiplm.common.actions.approve'),
                      requireConfirm: true,
                      confirmTitle: (count: number) =>
                        t('app.kuaiplm.change.batchApproveConfirm', { count }),
                      onClick: () => {
                        void handleBatchApprove();
                      },
                    },
                  ]
                : []),
              {
                key: 'batch-execute',
                label: t('app.kuaiplm.common.actions.execute'),
                requireConfirm: true,
                confirmTitle: (count) => t('app.kuaiplm.change.batchExecuteConfirm', { count }),
                onClick: () => {
                  void handleBatchExecute();
                },
              },
            ]}
          />,
        ]}
        params={{ tab: activeTab }}
        request={async (params, _sort, _filter, searchFormValues) => {
          try {
            const res = await fetchList(
              params,
              activeTab,
              searchFormValues?.status as string | undefined,
            );
            const map: Record<string, UnifiedChangeRow> = {};
            for (const row of res.items) {
              if (row.uuid) map[String(row.uuid)] = row;
            }
            setRowsByUuid(map);
            return { data: res.items, total: res.total, success: true };
          } catch (e: any) {
            messageApi.error(e?.message || t('app.kuaiplm.common.messages.loadFailed'));
            return { data: [], total: 0, success: false };
          }
        }}
        toolbar={{
          menu: {
            type: 'tab',
            activeKey: activeTab,
            items: toolbarMenuItems,
            onChange: (key) => {
              setActiveTab((key as TabKey) || 'all');
              setSelectedRowKeys([]);
              actionRef.current?.reload();
            },
          },
        }}
        toolBarRender={() => [
          <Space key="create">
            <Button onClick={() => window.open(buildRouteChangeCreateUrl(), '_blank')}>
              {t('app.kuaiplm.change.createRouteButton')}
            </Button>
          </Space>,
        ]}
      />
    </ListPageTemplate>
  );
};

export default ChangeManagementPage;
