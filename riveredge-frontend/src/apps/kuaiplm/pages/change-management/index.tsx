import { rowActionKind } from '../../../../components/uni-action';
/**
 * ECR/ECO 变更工作台
 */

import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Space } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { UniTable } from '../../../../components/uni-table';
import { UniBatchMenuButton } from '../../../../components/uni-batch';
import { UniWorkflowActions } from '../../../../components/uni-workflow-actions';
import { ListPageTemplate } from '../../../../components/layout-templates';
import { useAuditRequired } from '../../../../hooks/useAuditRequired';
import { useResourcePermissions } from '../../../../hooks/useResourcePermissions';
import {
  listBomChanges,
  listRouteChanges,
  listDrawingChanges,
  listUnifiedChanges,
  auditNodeKeyForRow,
  batchApproveChanges,
  batchDeleteChanges,
  batchExecuteChanges,
  deskApiChangeType,
  executeChange,
  type UnifiedChangeRow,
  type ChangeDeskCategory,
} from '../../services/change-desk';
import { buildBomChangeCreateUrl, buildRouteChangeCreateUrl } from '../../services/master-data-links';
import DrawingChangeFormModal from '../../components/DrawingChangeFormModal';
import { useNewShortcut } from '../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../utils/globalNewShortcut';
import { getKuaiplmChangeStatusText } from '../../components/kuaiplmMeta';
import { alignProColumns, GLOBAL_DOC_LIST_FIELD_RANK } from '../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import {
  changeDeskSearchColumns,
  PLM_CHANGE_PINNED_STATUS_FIELD,
  plmCreatedUpdatedColumns,
  plmListActionColumn,
  resolveChangeDeskListParams,
} from '../../utils/plmListCore';
import {
  renderPlmChangeCategoryMarker,
  renderPlmChangeStatusTag,
  renderPlmChangeTypeMarker,
} from '../../utils/plmListPresentation';
import ChangeDetailDrawer from '../../components/ChangeDetailDrawer';

type TabKey = 'all' | 'bom' | 'route' | 'drawing';

const ChangeManagementPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { message: messageApi, modal: modalApi } = App.useApp();
  const changePerms = useResourcePermissions('kuaiplm.change');
  const actionRef = useRef<ActionType>(null);
  const lastListParamsRef = useRef<Record<string, string | number | boolean | undefined>>({});
  const bomAuditEnabled = useAuditRequired('bom_change');
  const routeAuditEnabled = useAuditRequired('process_route_change');
  const drawingAuditEnabled = useAuditRequired('drawing_change');
  const auditEnabled = bomAuditEnabled || routeAuditEnabled || drawingAuditEnabled;
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [rowsByUuid, setRowsByUuid] = useState<Record<string, UnifiedChangeRow>>({});
  const [detailRow, setDetailRow] = useState<UnifiedChangeRow | null>(null);
  const [drawingCreateOpen, setDrawingCreateOpen] = useState(false);
  const [drawingCreateUuid, setDrawingCreateUuid] = useState<string | undefined>();

  const handleCreateBomChange = useCallback(() => {
    navigate(buildBomChangeCreateUrl());
  }, [navigate]);
  const handleCreateRouteChange = useCallback(() => {
    navigate(buildRouteChangeCreateUrl());
  }, [navigate]);
  const handleCreateDrawingChange = useCallback((uuid?: string) => {
    setDrawingCreateUuid(uuid);
    setDrawingCreateOpen(true);
  }, []);
  useEffect(() => {
    if (searchParams.get('create') !== 'drawing') return;
    handleCreateDrawingChange(searchParams.get('drawingUuid') || undefined);
    const next = new URLSearchParams(searchParams);
    next.delete('create');
    next.delete('drawingUuid');
    setSearchParams(next, { replace: true });
  }, [handleCreateDrawingChange, searchParams, setSearchParams]);
  useNewShortcut(handleCreateBomChange);

  const fetchList = async (
    params: { current?: number; pageSize?: number },
    category: TabKey,
    listParams: Record<string, string | number | boolean | undefined>,
  ) => {
    const skip = ((params.current || 1) - 1) * (params.pageSize || 20);
    const limit = params.pageSize || 20;
    const base = { skip, limit, ...listParams };
    if (category === 'bom') return listBomChanges(base);
    if (category === 'route') return listRouteChanges(base);
    if (category === 'drawing') return listDrawingChanges(base);
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
      change_type: deskApiChangeType(row.change_category),
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
          change_type: deskApiChangeType(row.change_category),
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
      ...changeDeskSearchColumns({
        changeCode: t('app.kuaiplm.common.columns.changeCode'),
        targetName: t('app.kuaiplm.common.columns.target'),
      }),
      {
        title: t('app.kuaiplm.common.columns.category'),
        dataIndex: 'change_category',
        width: 90,
        minWidth: 90,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        render: (_, row) => renderPlmChangeCategoryMarker(t, row.change_category),
      },
      {
        title: t('app.kuaiplm.common.columns.changeCode'),
        dataIndex: 'change_code',
        width: 140,
        minWidth: 140,
        uniTableKeepWidth: true,
        resizable: false,
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t('app.kuaiplm.common.columns.changeType'),
        dataIndex: 'change_type',
        width: 120,
        minWidth: 120,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        render: (_, row) => renderPlmChangeTypeMarker(t, row.change_type, row.change_category),
      },
      {
        title: t('app.kuaiplm.common.columns.target'),
        dataIndex: 'target_name',
        sorter: true,
        hideInSearch: true,
        ellipsis: true,
      },
      {
        title: t('app.kuaiplm.common.columns.changeReason'),
        dataIndex: 'change_reason',
        ellipsis: true,
        hideInSearch: true,
      },
      ...plmCreatedUpdatedColumns<UnifiedChangeRow>(t),
      {
        title: t('app.kuaiplm.common.columns.status'),
        key: 'lifecycle',
        dataIndex: 'status',
        width: 100,
        minWidth: 100,
        uniTableKeepWidth: true,
        resizable: false,
        fixed: 'right',
        valueEnum: {
          draft: { text: getKuaiplmChangeStatusText(t, 'draft') },
          pending: { text: getKuaiplmChangeStatusText(t, 'pending') },
          approved: { text: getKuaiplmChangeStatusText(t, 'approved') },
          executed: { text: getKuaiplmChangeStatusText(t, 'executed') },
          rejected: { text: getKuaiplmChangeStatusText(t, 'rejected') },
          cancelled: { text: getKuaiplmChangeStatusText(t, 'cancelled') },
        },
        render: (_, row) => renderPlmChangeStatusTag(t, row.status),
      },
      plmListActionColumn<UnifiedChangeRow>(t, (_, row) => {
        const status = (row.status ?? '').toLowerCase();
        return [
          <Button
            {...rowActionKind('read')}
            key="detail"
            type="link"
            size="small"
            onClick={() => setDetailRow(row)}
          >
            {t('common.detail')}
          </Button>,
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
              disabled={!changePerms.canUpdate}
              onClick={() => handleExecute(row)}
            >
              {t('app.kuaiplm.common.actions.execute')}
            </Button>
          ) : null,
        ].filter(Boolean) as React.ReactNode[];
      }, 200),
    ],
    [handleExecute, t, changePerms.canUpdate],
  );

  const toolbarMenuItems = useMemo(
    () => [
      { key: 'all', label: t('app.kuaiplm.change.tab.all') },
      { key: 'bom', label: t('app.kuaiplm.change.tab.bom') },
      { key: 'route', label: t('app.kuaiplm.change.tab.route') },
      { key: 'drawing', label: t('app.kuaiplm.change.tab.drawing') },
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
        columns={alignProColumns(columns, GLOBAL_DOC_LIST_FIELD_RANK)}
        columnPersistenceId={`apps.kuaiplm.pages.change-management.${activeTab}.list-v1`}
        showAdvancedSearch
        skipFuzzyPinyinClientFilter
        pinnedTabsField={PLM_CHANGE_PINNED_STATUS_FIELD}
        showCreateButton={changePerms.canCreate}
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
            const listParams = resolveChangeDeskListParams(searchFormValues);
            lastListParamsRef.current = listParams;
            const res = await fetchList(params, activeTab, listParams);
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
            <Button onClick={handleCreateRouteChange}>
              {t('app.kuaiplm.change.createRouteButton')}
            </Button>
            {changePerms.canCreate ? (
              <Button onClick={() => handleCreateDrawingChange()}>
                {t('app.kuaiplm.change.createDrawingButton')}
              </Button>
            ) : null}
          </Space>,
        ]}
      />
      <ChangeDetailDrawer row={detailRow} onClose={() => setDetailRow(null)} />
      <DrawingChangeFormModal
        open={drawingCreateOpen}
        drawingUuid={drawingCreateUuid}
        onClose={() => {
          setDrawingCreateOpen(false);
          setDrawingCreateUuid(undefined);
        }}
        onSuccess={() => actionRef.current?.reload()}
      />
    </ListPageTemplate>
  );
};

export default ChangeManagementPage;
