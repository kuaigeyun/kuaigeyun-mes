/**
 * 批号规则管理页面
 *
 * 提供批号规则的 CRUD 功能，用于配置批号生成规则。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProFormText, ProFormTextArea, ProFormSelect, ProFormDigit } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { batchRuleApi } from '../../../services/batchSerialRules';
import type { BatchRule, BatchRuleCreate, BatchRuleUpdate } from '../../../services/batchSerialRules';

const SEQ_RESET_OPTIONS = [
  { label: '不重置', value: 'never' },
  { label: '按日', value: 'daily' },
  { label: '按月', value: 'monthly' },
  { label: '按年', value: 'yearly' },
];

const BatchRulesPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<any>();
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentUuid, setCurrentUuid] = useState<string | null>(null);

  const handleCreate = () => {
    setIsEdit(false);
    setCurrentUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({ seqStart: 1, seqStep: 1, isActive: true });
  };

  const handleEdit = async (record: BatchRule) => {
    setIsEdit(true);
    setCurrentUuid(record.uuid);
    setModalVisible(true);
    try {
      const detail = await batchRuleApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        name: detail.name,
        code: detail.code,
        description: detail.description,
        seqStart: detail.seqStart,
        seqStep: detail.seqStep,
        seqResetRule: detail.seqResetRule,
        isActive: detail.isActive,
      });
    } catch (e: any) {
      messageApi.error(e?.message || '获取详情失败');
    }
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    try {
      if (isEdit && currentUuid) {
        await batchRuleApi.update(currentUuid, {
          name: values.name as string,
          code: values.code as string,
          description: values.description as string,
          seqStart: values.seqStart as number,
          seqStep: values.seqStep as number,
          seqResetRule: values.seqResetRule as string,
          isActive: values.isActive as boolean,
        });
        messageApi.success('更新成功');
      } else {
        await batchRuleApi.create({
          name: values.name as string,
          code: values.code as string,
          description: values.description as string,
          seqStart: (values.seqStart as number) ?? 1,
          seqStep: (values.seqStep as number) ?? 1,
          seqResetRule: values.seqResetRule as string,
          isActive: (values.isActive as boolean) ?? true,
        });
        messageApi.success('创建成功');
      }
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || '操作失败');
      throw e;
    }
  };

  const handleDelete = async (record: BatchRule) => {
    try {
      await batchRuleApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || '删除失败');
    }
  };

  const columns: ProColumns<BatchRule>[] = [
    { title: '规则名称', dataIndex: 'name', width: 150, ellipsis: true, fixed: 'left' },
    { title: '规则代码', dataIndex: 'code', width: 120 },
    { title: '描述', dataIndex: 'description', width: 200, ellipsis: true },
    {
      title: '序号重置',
      dataIndex: 'seqResetRule',
      width: 100,
      render: (_, r) => SEQ_RESET_OPTIONS.find((o) => o.value === r.seqResetRule)?.label || r.seqResetRule || '-',
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      width: 80,
      render: (_, r) => (
        <Tag color={r.isActive ? 'success' : 'default'}>{r.isActive ? '启用' : '停用'}</Tag>
      ),
    },
    {
      title: '操作',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            disabled={record.isSystem}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除此规则？"
            onConfirm={() => handleDelete(record)}
            disabled={record.isSystem}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />} disabled={record.isSystem}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <ListPageTemplate>
      <UniTable<BatchRule>
        headerTitle="批号规则"
        actionRef={actionRef}
        rowKey="uuid"
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20 } = params;
          const res = await batchRuleApi.list({
            page: current,
            pageSize,
          });
          return { data: res.items, success: true, total: res.total };
        }}
        toolBarRender={() => [
          <Button key="create" type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新建
          </Button>,
        ]}
      />

      <FormModalTemplate
        title={isEdit ? '编辑批号规则' : '新建批号规则'}
        open={modalVisible}
        onClose={() => setModalVisible(false)}
        onFinish={handleSubmit}
        isEdit={isEdit}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
      >
        <ProFormText name="name" label="规则名称" rules={[{ required: true }]} colProps={{ span: 12 }} />
        <ProFormText name="code" label="规则代码" rules={[{ required: true }]} colProps={{ span: 12 }} />
        <ProFormTextArea name="description" label="描述" colProps={{ span: 24 }} />
        <ProFormDigit name="seqStart" label="序号起始值" initialValue={1} colProps={{ span: 12 }} />
        <ProFormDigit name="seqStep" label="序号步长" initialValue={1} colProps={{ span: 12 }} />
        <ProFormSelect
          name="seqResetRule"
          label="序号重置规则"
          options={SEQ_RESET_OPTIONS}
          colProps={{ span: 12 }}
        />
        <ProFormSelect
          name="isActive"
          label="状态"
          options={[
            { label: '启用', value: true },
            { label: '停用', value: false },
          ]}
          initialValue={true}
          colProps={{ span: 12 }}
        />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default BatchRulesPage;
