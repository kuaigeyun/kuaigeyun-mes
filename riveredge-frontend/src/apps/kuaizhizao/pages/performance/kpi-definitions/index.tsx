/**
 * KPI 指标定义页面
 */

import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns, ProFormInstance } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { ProFormText, ProFormDigit, ProFormSelect, ProFormSwitch } from '@ant-design/pro-components';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { employeePerformanceApi } from '../../../services/performance';
import type { KPIDefinition } from '../../../types/performance';

const CALC_TYPE_OPTIONS = [
  { label: '质量', value: 'quality' },
  { label: '效率', value: 'efficiency' },
  { label: '出勤', value: 'attendance' },
  { label: '产量', value: 'output' },
];

const KpiDefinitionsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [modalVisible, setModalVisible] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  useEffect(() => {
    if (!modalVisible) return;
    formRef.current?.resetFields();
    if (!editId) {
      formRef.current?.setFieldsValue({ is_active: true, weight: 1 });
      return;
    }
    employeePerformanceApi.getKpiDefinition(editId).then((r) => {
      formRef.current?.setFieldsValue({
        code: r.code,
        name: r.name,
        weight: r.weight,
        calc_type: r.calc_type,
        is_active: r.is_active !== false,
      });
    }).catch((e: any) => messageApi.error(e?.message || '加载失败'));
  }, [modalVisible, editId]);

  const handleCreate = () => { setEditId(null); setModalVisible(true); };
  const handleEdit = (r: KPIDefinition) => { setEditId(r.id); setModalVisible(true); };
  const handleDelete = async (r: KPIDefinition) => {
    try {
      await employeePerformanceApi.deleteKpiDefinition(r.id);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || '删除失败');
    }
  };

  const columns: ProColumns<KPIDefinition>[] = [
    { title: '编码', dataIndex: 'code', width: 120, fixed: 'left' },
    { title: '名称', dataIndex: 'name', width: 150, ellipsis: true },
    { title: '权重', dataIndex: 'weight', width: 80, align: 'right' },
    { title: '计算类型', dataIndex: 'calc_type', width: 100, render: (_, r) => CALC_TYPE_OPTIONS.find((o) => o.value === r.calc_type)?.label || r.calc_type },
    { title: '启用', dataIndex: 'is_active', width: 80, render: (_, r) => <Tag color={r.is_active ? 'success' : 'default'}>{r.is_active ? '是' : '否'}</Tag> },
    {
      title: '操作',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<KPIDefinition>
          headerTitle="KPI 指标定义"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          request={async (params) => {
            try {
              const result = await employeePerformanceApi.listKpiDefinitions({
                skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                limit: params.pageSize || 20,
              });
              return { data: result, success: true, total: result.length };
            } catch (e: any) {
              messageApi.error(e?.message || '加载失败');
              return { data: [], success: false, total: 0 };
            }
          }}
          enableRowSelection={true}
          showDeleteButton={true}
          onDelete={async (keys) => {
            Modal.confirm({
              title: '确认批量删除',
              content: `确定要删除选中的 ${keys.length} 条KPI定义吗？`,
              onOk: async () => {
                try {
                  for (const id of keys) {
                    await employeePerformanceApi.deleteKpiDefinition(Number(id));
                  }
                  messageApi.success(`成功删除 ${keys.length} 条记录`);
                  actionRef.current?.reload();
                } catch (error: any) {
                  messageApi.error(error?.message || '删除失败');
                }
              },
            });
          }}
          showCreateButton
          createButtonText="新建KPI定义"
          onCreate={handleCreate}
        />
      </ListPageTemplate>

      <FormModalTemplate
        title={editId ? '编辑KPI指标' : '新建KPI指标'}
        open={modalVisible}
        onClose={() => { setModalVisible(false); setEditId(null); }}
        formRef={formRef as React.RefObject<ProFormInstance>}
        onFinish={async (values) => {
          const payload = { code: values.code, name: values.name, weight: values.weight || 1, calc_type: values.calc_type, is_active: values.is_active !== false };
          if (editId) {
            await employeePerformanceApi.updateKpiDefinition(editId, payload);
            messageApi.success('更新成功');
          } else {
            await employeePerformanceApi.createKpiDefinition(payload);
            messageApi.success('创建成功');
          }
          setModalVisible(false);
          setEditId(null);
          actionRef.current?.reload();
        }}
        isEdit={!!editId}
        width={MODAL_CONFIG.STANDARD_WIDTH}
      >
        <ProFormText name="code" label="编码" rules={[{ required: true }]} colProps={{ span: 12 }} disabled={!!editId} />
        <ProFormText name="name" label="名称" rules={[{ required: true }]} colProps={{ span: 12 }} />
        <ProFormDigit name="weight" label="权重" min={0} fieldProps={{ precision: 2 }} colProps={{ span: 12 }} />
        <ProFormSelect name="calc_type" label="计算类型" rules={[{ required: true }]} options={CALC_TYPE_OPTIONS} colProps={{ span: 12 }} />
        <ProFormSwitch name="is_active" label="启用" colProps={{ span: 12 }} />
      </FormModalTemplate>
    </>
  );
};

export default KpiDefinitionsPage;
