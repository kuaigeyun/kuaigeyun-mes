import { rowActionKind } from '../../../../../components/uni-action';
/**
 * FMEA 记录（Phase2）
 */

import React, { useRef, useState, useCallback } from 'react';
import { ActionType, ProColumns, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { useSearchParams } from 'react-router-dom';
import { App, Button, Tag, Alert } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate } from '../../../../../components/layout-templates';
import {
  listFmeaRecords,
  createFmeaRecord,
  deleteFmeaRecord,
  type RdFmeaRecord,
} from '../../../services/phase2';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';

const RISK_COLOR: Record<string, string> = {
  高: 'red',
  中: 'orange',
  低: 'green',
};

const FmeaPage: React.FC = () => {
  const { message: messageApi, modal: modalApi } = App.useApp();
  const [searchParams] = useSearchParams();
  const filterProjectId = searchParams.get('project_id')
    ? Number(searchParams.get('project_id'))
    : undefined;
  const actionRef = useRef<ActionType>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const handleCreate = useCallback(() => setCreateOpen(true), []);
  useNewShortcut(handleCreate);

  const columns: ProColumns<RdFmeaRecord>[] = [
    { title: 'FMEA 编号', dataIndex: 'fmea_code', width: 140 },
    { title: '标题', dataIndex: 'title', ellipsis: true },
    { title: '类型', dataIndex: 'fmea_type', width: 100 },
    { title: '状态', dataIndex: 'status', width: 90 },
    {
      title: '风险等级',
      dataIndex: 'risk_level',
      width: 100,
      render: (_, row) =>
        row.risk_level ? <Tag color={RISK_COLOR[row.risk_level] ?? 'default'}>{row.risk_level}</Tag> : '-',
    },
    { title: '负责人', dataIndex: 'owner_name', width: 100, hideInSearch: true },
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
      render: (_, row) => [
            <Button {...rowActionKind('delete')}
              key="del"
              type="link"
              size="small"
              danger
              onClick={() => {
                modalApi.confirm({
                  title: '删除该 FMEA 记录？',
                  onOk: async () => {
                    await deleteFmeaRecord(row.id!);
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
      <UniTable<RdFmeaRecord>
        headerTitle="FMEA"
        actionRef={actionRef}
        columns={columns}
        columnPersistenceId="apps.kuaiplm.pages.phase2.fmea"
        request={async (params) => {
          const { current, pageSize } = params;
          try {
            const res = await listFmeaRecords({
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
          <Button {...rowActionKind('create')} key="create" type="primary" onClick={handleCreate}>
            {'新建 FMEA' + NEW_SHORTCUT_HINT}
          </Button>,
        ]}
      />

      <FormModalTemplate
        title="新建 FMEA"
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onFinish={async (values) => {
          await createFmeaRecord(values);
          messageApi.success('创建成功');
          setCreateOpen(false);
          actionRef.current?.reload();
        }}
      >
        <ProFormText name="title" label="标题" rules={[{ required: true }]} />
        <ProFormSelect
          name="fmea_type"
          label="FMEA 类型"
          options={[
            { value: 'DFMEA', label: 'DFMEA' },
            { value: 'PFMEA', label: 'PFMEA' },
          ]}
        />
        <ProFormSelect
          name="risk_level"
          label="风险等级"
          options={[
            { value: '高', label: '高' },
            { value: '中', label: '中' },
            { value: '低', label: '低' },
          ]}
        />
        <ProFormText name="owner_name" label="负责人" />
        <ProFormTextArea name="description" label="说明" />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default FmeaPage;
