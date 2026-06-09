import { rowActionKind } from '../../../../components/uni-action';
/**
 * ECR/ECO 变更工作台
 */

import React, { useRef, useState, useCallback } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Space, Tag } from 'antd';
import { PlusOutlined, CheckOutlined, PlayCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../components/uni-table';
import { ListPageTemplate } from '../../../../components/layout-templates';
import {
  listBomChanges,
  listRouteChanges,
  listUnifiedChanges,
  approveChange,
  executeChange,
  type UnifiedChangeRow,
  type ChangeDeskCategory,
} from '../../services/change-desk';
import { buildBomChangeCreateUrl, buildRouteChangeCreateUrl } from '../../services/master-data-links';
import { renderRowActionsOverflow } from '../../../../utils/renderRowActionsOverflow';
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
        return renderRowActionsOverflow(
          [
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
          ].filter(Boolean) as React.ReactNode[],
          `chg-${row.uuid}`,
        );
      },
    },
  ];

  return (
    <ListPageTemplate>
      <UniTable<UnifiedChangeRow>
        headerTitle="设计变更"
        actionRef={actionRef}
        columns={columns}
        columnPersistenceId={`apps.kuaiplm.pages.change-management.${activeTab}`}
        scroll={{ x: 1200 }}
        params={{ tab: activeTab }}
        request={async (params, _sort, _filter, searchFormValues) => {
          try {
            const res = await fetchList(
              params,
              activeTab,
              searchFormValues?.status as string | undefined,
            );
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
              actionRef.current?.reload();
            },
          },
        }}
        toolBarRender={() => [
          <Space key="create">
            <Button icon={<PlusOutlined />} onClick={handleCreateBomChange}>
              {'在主数据新建 BOM 变更' + NEW_SHORTCUT_HINT}
            </Button>
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
