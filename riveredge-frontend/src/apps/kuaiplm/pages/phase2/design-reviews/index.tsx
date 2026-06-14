import { rowActionKind } from '../../../../../components/uni-action';
/**
 * 设计评审（Phase2）
 */

import React, { useRef, useState, useCallback } from 'react';
import { ActionType, ProColumns, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { useSearchParams } from 'react-router-dom';
import { App, Button, Alert } from 'antd';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { UniBatchMenuButton } from '../../../../../components/uni-batch';
import { ListPageTemplate, FormModalTemplate } from '../../../../../components/layout-templates';
import {
  listDesignReviews,
  createDesignReview,
  deleteDesignReview,
  updateDesignReview,
  type RdDesignReview,
} from '../../../services/phase2';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';

const DesignReviewsPage: React.FC = () => {
  const { message: messageApi, modal: modalApi } = App.useApp();
  const [searchParams] = useSearchParams();
  const filterProjectId = searchParams.get('project_id')
    ? Number(searchParams.get('project_id'))
    : undefined;
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [createOpen, setCreateOpen] = useState(false);

  const handleCreate = useCallback(() => setCreateOpen(true), []);
  useNewShortcut(handleCreate);

  const toReviewIds = (keys: React.Key[]) =>
    keys.map((key) => Number(key)).filter((id) => Number.isFinite(id) && id > 0);

  const handleBatchDelete = async (keys: React.Key[]) => {
    const ids = toReviewIds(keys);
    if (!ids.length) {
      messageApi.warning('请先选择评审记录');
      return;
    }
    let successCount = 0;
    for (const id of ids) {
      try {
        await deleteDesignReview(id);
        successCount += 1;
      } catch {
        // continue processing remaining rows
      }
    }
    if (successCount > 0) {
      messageApi.success(`已删除 ${successCount} 条评审记录`);
      setSelectedRowKeys([]);
      actionRef.current?.reload();
      return;
    }
    messageApi.error('批量删除失败');
  };

  const handleBatchSetStatus = async (status: string, label: string) => {
    const ids = toReviewIds(selectedRowKeys);
    if (!ids.length) {
      messageApi.warning('请先选择评审记录');
      return;
    }
    let successCount = 0;
    for (const id of ids) {
      try {
        await updateDesignReview(id, { status });
        successCount += 1;
      } catch {
        // continue processing remaining rows
      }
    }
    if (successCount > 0) {
      messageApi.success(`已将 ${successCount} 条评审设为${label}`);
      actionRef.current?.reload();
      return;
    }
    messageApi.error('批量更新状态失败');
  };

  const columns: ProColumns<RdDesignReview>[] = [
    { title: '评审编号', dataIndex: 'review_code', width: 140 },
    { title: '标题', dataIndex: 'title', ellipsis: true },
    { title: '类型', dataIndex: 'review_type', width: 100 },
    { title: '状态', dataIndex: 'status', width: 90 },
    { title: '评审人', dataIndex: 'reviewer_name', width: 100, hideInSearch: true },
    {
      title: '计划时间',
      dataIndex: 'scheduled_at',
      width: 168,
      hideInSearch: true,
      render: (_, row) => (row.scheduled_at ? dayjs(row.scheduled_at).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '操作',
      valueType: 'option',
      width: 80,
      render: (_, row) => [
            <Button {...rowActionKind('delete')}
              key="del"
              type="link"
              size="small"
              danger
              onClick={() => {
                modalApi.confirm({
                  title: '删除该评审记录？',
                  onOk: async () => {
                    await deleteDesignReview(row.id!);
                    messageApi.success('已删除');
                    actionRef.current?.reload();
                  },
                });
              }}
            >
              删除
            </Button>,
          ],
    },
  ];

  return (
    <ListPageTemplate>
      {filterProjectId ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={`已按研发项目 #${filterProjectId} 筛选`}
        />
      ) : null}
      <UniTable<RdDesignReview>
        headerTitle="设计评审"
        actionRef={actionRef}
        rowKey="id"
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        columns={columns}
        columnPersistenceId="apps.kuaiplm.pages.phase2.design-reviews"
        request={async (params) => {
          const { current, pageSize } = params;
          try {
            const res = await listDesignReviews({
              skip: ((current || 1) - 1) * (pageSize || 20),
              limit: pageSize || 20,
              project_id: filterProjectId,
            });
            return { data: res.items, total: res.total, success: true };
          } catch (e: any) {
            messageApi.error(e?.message || '加载失败');
            return { data: [], total: 0, success: false };
          }
        }}
        showCreateButton
        createButtonText={'新建评审' + NEW_SHORTCUT_HINT}
        onCreate={handleCreate}
        showDeleteButton
        onDelete={handleBatchDelete}
        deleteConfirmTitle={(count) => `确定要删除选中的 ${count} 条设计评审吗？`}
        toolBarActionsAfterDelete={[
          <UniBatchMenuButton
            key="design-review-batch-actions"
            selectedRowKeys={selectedRowKeys}
            buttonText="批量操作"
            menuItems={[
              {
                key: 'batch-set-in-progress',
                label: '批量设为进行中',
                onClick: () => {
                  void handleBatchSetStatus('IN_PROGRESS', '进行中');
                },
              },
              {
                key: 'batch-set-completed',
                label: '批量设为已完成',
                onClick: () => {
                  void handleBatchSetStatus('COMPLETED', '已完成');
                },
              },
            ]}
          />,
        ]}
      />

      <FormModalTemplate
        title="新建设计评审"
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onFinish={async (values) => {
          await createDesignReview(values);
          messageApi.success('创建成功');
          setCreateOpen(false);
          actionRef.current?.reload();
        }}
      >
        <ProFormText name="title" label="标题" rules={[{ required: true }]} />
        <ProFormSelect
          name="review_type"
          label="评审类型"
          options={[
            { value: '初步设计', label: '初步设计' },
            { value: '详细设计', label: '详细设计' },
            { value: '试制评审', label: '试制评审' },
          ]}
        />
        <ProFormText name="reviewer_name" label="评审人" />
        <ProFormTextArea name="conclusion" label="结论" />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default DesignReviewsPage;
