/**
 * 计件单价配置页面
 */

import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns, ProFormInstance } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { ProFormSelect, ProFormDigit, ProFormSwitch } from '@ant-design/pro-components';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { employeePerformanceApi, operationApi } from '../../../services/performance';
import type { PieceRate } from '../../../types/performance';

const PieceRatesPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [modalVisible, setModalVisible] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [operations, setOperations] = useState<{ id: number; code: string; name: string }[]>([]);

  useEffect(() => {
    operationApi.list({ limit: 1000, is_active: true }).then((list) => {
      setOperations(list.map((o) => ({ id: o.id, code: o.code, name: o.name })));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!modalVisible) return;
    formRef.current?.resetFields();
    if (!editId) {
      formRef.current?.setFieldsValue({ is_active: true });
      return;
    }
    employeePerformanceApi.getPieceRate(editId).then((r) => {
      formRef.current?.setFieldsValue({
        operation_id: r.operation_id,
        rate: r.rate,
        is_active: r.is_active !== false,
      });
    }).catch((e: any) => messageApi.error(e?.message || '加载失败'));
  }, [modalVisible, editId]);

  const handleCreate = () => { setEditId(null); setModalVisible(true); };
  const handleEdit = (r: PieceRate) => { setEditId(r.id); setModalVisible(true); };
  const handleDelete = async (r: PieceRate) => {
    try {
      await employeePerformanceApi.deletePieceRate(r.id);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || '删除失败');
    }
  };

  const columns: ProColumns<PieceRate>[] = [
    { title: '工序', dataIndex: 'operation_name', width: 150, ellipsis: true },
    { title: '单价（元/件）', dataIndex: 'rate', width: 120, align: 'right' },
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
        <UniTable<PieceRate>
          headerTitle="计件单价"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          request={async (params) => {
            try {
              const result = await employeePerformanceApi.listPieceRates({
                skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                limit: params.pageSize || 20,
              });
              return { data: result, success: true, total: result.length };
            } catch (e: any) {
              messageApi.error(e?.message || '加载失败');
              return { data: [], success: false, total: 0 };
            }
          }}
          toolBarRender={() => [
            <Button key="create" type="primary" icon={<PlusOutlined />} onClick={handleCreate}>新建</Button>,
          ]}
        />
      </ListPageTemplate>

      <FormModalTemplate
        title={editId ? '编辑计件单价' : '新建计件单价'}
        open={modalVisible}
        onClose={() => { setModalVisible(false); setEditId(null); }}
        formRef={formRef as React.RefObject<ProFormInstance>}
        onFinish={async (values) => {
          const payload = { operation_id: values.operation_id, rate: values.rate, is_active: values.is_active !== false };
          if (editId) {
            await employeePerformanceApi.updatePieceRate(editId, payload);
            messageApi.success('更新成功');
          } else {
            await employeePerformanceApi.createPieceRate(payload);
            messageApi.success('创建成功');
          }
          setModalVisible(false);
          setEditId(null);
          actionRef.current?.reload();
        }}
        isEdit={!!editId}
        width={MODAL_CONFIG.STANDARD_WIDTH}
      >
        <ProFormSelect
          name="operation_id"
          label="工序"
          rules={[{ required: true }]}
          options={operations.map((o) => ({ label: `${o.code} - ${o.name}`, value: o.id }))}
          colProps={{ span: 12 }}
          disabled={!!editId}
        />
        <ProFormDigit name="rate" label="单价（元/件）" rules={[{ required: true }]} min={0} fieldProps={{ precision: 4 }} colProps={{ span: 12 }} />
        <ProFormSwitch name="is_active" label="启用" colProps={{ span: 12 }} />
      </FormModalTemplate>
    </>
  );
};

export default PieceRatesPage;
