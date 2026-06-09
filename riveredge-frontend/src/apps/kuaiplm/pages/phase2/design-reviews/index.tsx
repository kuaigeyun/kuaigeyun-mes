import { rowActionKind } from '../../../../../components/uni-action';
/**
 * 设计评审（Phase2）
 */

import React, { useRef, useState, useCallback } from 'react';
import { ActionType, ProColumns, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { useSearchParams } from 'react-router-dom';
import { App, Button, Alert } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate } from '../../../../../components/layout-templates';
import {
  listDesignReviews,
  createDesignReview,
  deleteDesignReview,
  type RdDesignReview,
} from '../../../services/phase2';
import { renderRowActionsOverflow } from '../../../../../utils/renderRowActionsOverflow';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';

const DesignReviewsPage: React.FC = () => {
  const { message: messageApi, modal: modalApi } = App.useApp();
  const [searchParams] = useSearchParams();
  const filterProjectId = searchParams.get('project_id')
    ? Number(searchParams.get('project_id'))
    : undefined;
  const actionRef = useRef<ActionType>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const handleCreate = useCallback(() => setCreateOpen(true), []);
  useNewShortcut(handleCreate);

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
      render: (_, row) =>
        renderRowActionsOverflow(
          [
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
          `dr-${row.id}`,
        ),
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
        toolBarRender={() => [
          <Button {...rowActionKind('create')} key="create" type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            {'新建评审' + NEW_SHORTCUT_HINT}
          </Button>,
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
