import { rowActionKind } from '../../../../components/uni-action';
/**
 * ECR/ECO 变更工作台
 */

import React, { useRef, useState, useCallback } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Space, Tag } from 'antd';
import { CheckOutlined, PlayCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../components/uni-table';
import { UniBatchMenuButton } from '../../../../components/uni-batch';
import { ListPageTemplate } from '../../../../components/layout-templates';
import {
  listBomChanges,
  listRouteChanges,
  listUnifiedChanges,
  approveChange,
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

type TabKey = 'all' | 'bom' | 'route';

const STATUS_COLOR: Record<string, string> = {
  pending: 'processing',
  approved: 'success',
  executed: 'default',
  rejected: 'error',
};

const ChangeManagementPage: React.FC = () => {
  const { message: messageApi, modal: modalApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
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

  const handleApprove = (row: UnifiedChangeRow) => {
    const uuid = row.uuid;
    if (!uuid || !row.change_category) return;
    modalApi.confirm({
      title: '审批通过该变更？',
      onOk: async () => {
        await approveChange(row.change_category as ChangeDeskCategory, uuid);
        messageApi.success('已审批');
        actionRef.current?.reload();
      },
    });
  };

  const handleExecute = (row: UnifiedChangeRow) => {
    const uuid = row.uuid;
    if (!uuid || !row.change_category) return;
    modalApi.confirm({
      title: '执行该变更？执行后将写入正式工程数据。',
      onOk: async () => {
        await executeChange(row.change_category as ChangeDeskCategory, uuid);
        messageApi.success('已执行');
        actionRef.current?.reload();
      },
    });
  };

  const selectedBatchItems = selectedRowKeys
    .map((key) => rowsByUuid[String(key)])
    .filter((row): row is UnifiedChangeRow => !!row?.uuid && !!row?.change_category)
    .map((row) => ({
      change_uuid: String(row.uuid),
      change_type: row.change_category === 'route' ? 'process_route' : 'bom',
    }));

  const handleBatchApprove = async () => {
    if (!selectedBatchItems.length) {
      messageApi.warning('请先选择变更记录');
      return;
    }
    const result = await batchApproveChanges(selectedBatchItems, true);
    const successCount = Number(result?.success_count || 0);
    if (successCount > 0) {
      messageApi.success(`已审批 ${successCount} 条变更`);
      setSelectedRowKeys([]);
      actionRef.current?.reload();
      return;
    }
    messageApi.error('批量审批失败');
  };

  const handleBatchExecute = async () => {
    if (!selectedBatchItems.length) {
      messageApi.warning('请先选择变更记录');
      return;
    }
    const result = await batchExecuteChanges(selectedBatchItems);
    const successCount = Number(result?.success_count || 0);
    if (successCount > 0) {
      messageApi.success(`已执行 ${successCount} 条变更`);
      setSelectedRowKeys([]);
      actionRef.current?.reload();
      return;
    }
    messageApi.error('批量执行失败');
  };

  const handleBatchDelete = async (keys: React.Key[]) => {
    const items = keys
      .map((key) => rowsByUuid[String(key)])
      .filter((row): row is UnifiedChangeRow => !!row?.uuid && !!row?.change_category)
      .map((row) => ({
        change_uuid: String(row.uuid),
        change_type: row.change_category === 'route' ? 'process_route' : 'bom',
      }));
    if (!items.length) {
      messageApi.warning('请先选择变更记录');
      return;
    }
    const result = await batchDeleteChanges(items);
    const successCount = Number(result?.success_count || 0);
    if (successCount > 0) {
      messageApi.success(`已删除 ${successCount} 条变更`);
      setSelectedRowKeys([]);
      actionRef.current?.reload();
      return;
    }
    messageApi.error('批量删除失败');
  };

  const columns: ProColumns<UnifiedChangeRow>[] = [
    {
      title: '类别',
      dataIndex: 'change_category',
      width: 90,
      render: (_, row) => (
        <Tag color={row.change_category === 'bom' ? 'blue' : 'purple'}>
          {row.change_category === 'bom' ? 'BOM' : '工艺'}
        </Tag>
      ),
    },
    { title: '变更编号', dataIndex: 'change_code', width: 140 },
    { title: '变更类型', dataIndex: 'change_type', width: 120 },
    { title: '对象', dataIndex: 'target_name', ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (_, row) => (
        <Tag color={STATUS_COLOR[(row.status ?? '').toLowerCase()] ?? 'default'}>{row.status}</Tag>
      ),
    },
    { title: '变更原因', dataIndex: 'change_reason', ellipsis: true, hideInSearch: true },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 168,
      hideInSearch: true,
      render: (_, row) => (row.created_at ? dayjs(row.created_at).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '操作',
      valueType: 'option',
      fixed: 'right',
      width: 200,
      render: (_, row) => {
        const pending = (row.status ?? '').toLowerCase().includes('pending') || row.status === '待审批';
        return [
            pending ? (
              <Button {...rowActionKind('audit')}
                key="approve"
                type="link"
                size="small"
                icon={<CheckOutlined />}
                onClick={() => handleApprove(row)}
              >
                审批
              </Button>
            ) : null,
            row.status === 'approved' || row.status === '已审批' ? (
              <Button {...rowActionKind('execute')}
                key="execute"
                type="link"
                size="small"
                icon={<PlayCircleOutlined />}
                onClick={() => handleExecute(row)}
              >
                执行
              </Button>
            ) : null,
          ].filter(Boolean) as React.ReactNode[];
      },
    },
  ];

  return (
    <ListPageTemplate>
      <UniTable<UnifiedChangeRow>
        headerTitle="设计变更"
        actionRef={actionRef}
        rowKey="uuid"
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        columns={columns}
        columnPersistenceId={`apps.kuaiplm.pages.change-management.${activeTab}`}
        scroll={{ x: 1200 }}
        showCreateButton
        createButtonText={'在主数据新建 BOM 变更' + NEW_SHORTCUT_HINT}
        onCreate={handleCreateBomChange}
        showDeleteButton
        onDelete={handleBatchDelete}
        deleteConfirmTitle={(count) => `确定要删除选中的 ${count} 条变更记录吗？`}
        toolBarActionsAfterDelete={[
          <UniBatchMenuButton
            key="change-desk-batch-actions"
            buttonText="批量操作"
            selectedRowKeys={selectedRowKeys}
            menuItems={[
              {
                key: 'batch-approve',
                label: '批量审批',
                requireConfirm: true,
                confirmTitle: (count) => `确定审批选中的 ${count} 条变更吗？`,
                onClick: () => {
                  void handleBatchApprove();
                },
              },
              {
                key: 'batch-execute',
                label: '批量执行',
                requireConfirm: true,
                confirmTitle: (count) => `确定执行选中的 ${count} 条变更吗？`,
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
            messageApi.error(e?.message || '加载失败');
            return { data: [], total: 0, success: false };
          }
        }}
        toolbar={{
          menu: {
            type: 'tab',
            activeKey: activeTab,
            items: [
              { key: 'all', label: '全部变更' },
              { key: 'bom', label: 'BOM 变更' },
              { key: 'route', label: '工艺路线变更' },
            ],
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
              在主数据新建工艺变更
            </Button>
          </Space>,
        ]}
      />
    </ListPageTemplate>
  );
};

export default ChangeManagementPage;
