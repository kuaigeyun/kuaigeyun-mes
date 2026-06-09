import { rowActionKind } from '../../../../../components/uni-action';
/**
 * 研发需求（Phase2）
 */

import React, { useRef, useState, useCallback } from 'react';
import { ActionType, ProColumns, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { ProFormDigit } from '@ant-design/pro-components';
import { App, Button, Alert } from 'antd';
import { PlusOutlined, LinkOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useSearchParams } from 'react-router-dom';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate } from '../../../../../components/layout-templates';
import {
  listRequirements,
  createRequirement,
  deleteRequirement,
  type RdRequirement,
} from '../../../services/phase2';
import { renderRowActionsOverflow } from '../../../../../utils/renderRowActionsOverflow';
import { buildPurchaseInquiryUrl } from '../../../services/master-data-links';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';

const RequirementsPage: React.FC = () => {
  const { message: messageApi, modal: modalApi } = App.useApp();
  const [searchParams] = useSearchParams();
  const projectIdFilter = searchParams.get('project_id');
  const filterProjectId = projectIdFilter ? Number(projectIdFilter) : undefined;
  const actionRef = useRef<ActionType>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const handleCreate = useCallback(() => setCreateOpen(true), []);
  useNewShortcut(handleCreate);

  const columns: ProColumns<RdRequirement>[] = [
    { title: '需求编号', dataIndex: 'requirement_code', width: 140 },
    { title: '标题', dataIndex: 'title', ellipsis: true },
    { title: '关联项目', dataIndex: 'project_name', width: 140, hideInSearch: true },
    { title: '优先级', dataIndex: 'priority', width: 90 },
    { title: '状态', dataIndex: 'status', width: 90 },
    {
      title: '来源',
      dataIndex: 'source_type',
      width: 140,
      hideInSearch: true,
      render: (_, row) => {
        if (row.source_type === 'purchase_inquiry' && row.source_id) {
          return (
            <Button
              type="link"
              size="small"
              icon={<LinkOutlined />}
              onClick={() => window.open(buildPurchaseInquiryUrl(row.source_id!), '_blank')}
            >
              采购询价 #{row.source_id}
            </Button>
          );
        }
        return row.source_type || '-';
      },
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 168,
      hideInSearch: true,
      render: (_, row) => (row.updated_at ? dayjs(row.updated_at).format('YYYY-MM-DD HH:mm') : '-'),
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
                  title: '删除该需求？',
                  onOk: async () => {
                    await deleteRequirement(row.id!);
                    messageApi.success('已删除');
                    actionRef.current?.reload();
                  },
                });
              }}
            >
              删除
            </Button>,
          ],
          `req-${row.id}`,
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
      <UniTable<RdRequirement>
        headerTitle="研发需求"
        actionRef={actionRef}
        columns={columns}
        columnPersistenceId="apps.kuaiplm.pages.phase2.requirements"
        request={async (params) => {
          const { current, pageSize } = params;
          try {
            const res = await listRequirements({
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
            {'新建需求' + NEW_SHORTCUT_HINT}
          </Button>,
        ]}
      />

      <FormModalTemplate
        title="新建研发需求"
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onFinish={async (values) => {
          await createRequirement(values);
          messageApi.success('创建成功');
          setCreateOpen(false);
          actionRef.current?.reload();
        }}
      >
        <ProFormText name="title" label="标题" rules={[{ required: true }]} />
        <ProFormSelect
          name="priority"
          label="优先级"
          initialValue="normal"
          options={[
            { value: 'high', label: '高' },
            { value: 'normal', label: '中' },
            { value: 'low', label: '低' },
          ]}
        />
        <ProFormSelect
          name="source_type"
          label="来源类型"
          options={[
            { value: 'customer', label: '客户需求' },
            { value: 'purchase_inquiry', label: '采购询价' },
            { value: 'internal', label: '内部' },
          ]}
        />
        <ProFormDigit name="source_id" label="来源单据 ID（如询价单）" min={1} fieldProps={{ precision: 0 }} />
        <ProFormTextArea name="description" label="描述" />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default RequirementsPage;
