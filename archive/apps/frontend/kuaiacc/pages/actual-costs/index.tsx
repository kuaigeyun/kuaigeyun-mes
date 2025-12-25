/**
 * 实际成本管理页面
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormDigit, ProFormInstance, ProDescriptions } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { actualCostApi } from '../../services/process';
import type { ActualCost, ActualCostCreate } from '../../types/process';

const ActualCostsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentUuid, setCurrentUuid] = useState<string | null>(null);
  const [detail, setDetail] = useState<ActualCost | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  const handleCreate = () => {
    setIsEdit(false);
    setCurrentUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      status: '待核算',
      materialCost: 0,
      laborCost: 0,
      manufacturingCost: 0,
      reworkCost: 0,
      toolingCost: 0,
      totalCost: 0,
      quantity: 1,
      unitCost: 0,
    });
  };

  const handleEdit = async (record: ActualCost) => {
    try {
      setIsEdit(true);
      setCurrentUuid(record.uuid);
      setModalVisible(true);
      const data = await actualCostApi.get(record.uuid);
      formRef.current?.setFieldsValue(data);
    } catch (error: any) {
      messageApi.error(error.message || '获取详情失败');
    }
  };

  const handleDelete = async (record: ActualCost) => {
    try {
      await actualCostApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  const handleOpenDetail = async (record: ActualCost) => {
    try {
      setCurrentUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      const data = await actualCostApi.get(record.uuid);
      setDetail(data);
    } catch (error: any) {
      messageApi.error(error.message || '获取详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSubmit = async (values: ActualCostCreate) => {
    try {
      setFormLoading(true);
      if (isEdit && currentUuid) {
        await actualCostApi.update(currentUuid, values);
        messageApi.success('更新成功');
      } else {
        await actualCostApi.create(values);
        messageApi.success('创建成功');
      }
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || (isEdit ? '更新失败' : '创建失败'));
    } finally {
      setFormLoading(false);
    }
  };

  const columns: ProColumns<ActualCost>[] = [
    {
      title: '成本编号',
      dataIndex: 'costNo',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.costNo}</a>
      ),
    },
    {
      title: '物料编码',
      dataIndex: 'materialCode',
      width: 120,
    },
    {
      title: '物料名称',
      dataIndex: 'materialName',
      width: 200,
    },
    {
      title: '成本期间',
      dataIndex: 'costPeriod',
      width: 120,
    },
    {
      title: '总成本',
      dataIndex: 'totalCost',
      width: 120,
      valueType: 'money',
    },
    {
      title: '单位成本',
      dataIndex: 'unitCost',
      width: 120,
      valueType: 'money',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '待核算': { text: <Tag color="default">待核算</Tag> },
        '已核算': { text: <Tag color="blue">已核算</Tag> },
        '已确认': { text: <Tag color="green">已确认</Tag> },
      },
    },
    {
      title: '操作',
      valueType: 'option',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm title="确定要删除吗？" onConfirm={() => handleDelete(record)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>
      <UniTable<ActualCost>
        headerTitle="实际成本管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await actualCostApi.list({ skip, limit: pageSize, ...rest });
          return { data, success: true, total: data.length };
        }}
        rowKey="uuid"
        search={{ labelWidth: 'auto' }}
        toolBarRender={() => [
          <Button type="primary" key="primary" icon={<PlusOutlined />} onClick={handleCreate}>新建实际成本</Button>,
        ]}
        rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
      />
      <Modal title={isEdit ? '编辑实际成本' : '新建实际成本'} open={modalVisible} onCancel={() => setModalVisible(false)} footer={null} width={800}>
        <ProForm formRef={formRef} onFinish={handleSubmit} submitter={{ searchConfig: { submitText: isEdit ? '更新' : '创建' }, submitButtonProps: { loading: formLoading } }}>
          <ProFormText name="costNo" label="成本编号" rules={[{ required: true }]} />
          <ProFormDigit name="materialId" label="物料ID" rules={[{ required: true }]} />
          <ProFormText name="materialCode" label="物料编码" rules={[{ required: true }]} />
          <ProFormText name="materialName" label="物料名称" rules={[{ required: true }]} />
          <ProFormText name="costPeriod" label="成本期间" rules={[{ required: true }]} placeholder="格式：2024-01" />
          <ProFormDigit name="materialCost" label="材料成本" min={0} fieldProps={{ precision: 2 }} />
          <ProFormDigit name="laborCost" label="人工成本" min={0} fieldProps={{ precision: 2 }} />
          <ProFormDigit name="manufacturingCost" label="制造费用" min={0} fieldProps={{ precision: 2 }} />
          <ProFormDigit name="reworkCost" label="返修成本" min={0} fieldProps={{ precision: 2 }} />
          <ProFormDigit name="toolingCost" label="工装模具成本" min={0} fieldProps={{ precision: 2 }} />
          <ProFormDigit name="totalCost" label="总成本" rules={[{ required: true }]} min={0} fieldProps={{ precision: 2 }} />
          <ProFormText name="unit" label="单位" rules={[{ required: true }]} />
          <ProFormDigit name="quantity" label="数量" rules={[{ required: true }]} min={0} fieldProps={{ precision: 4 }} />
          <ProFormDigit name="unitCost" label="单位成本" rules={[{ required: true }]} min={0} fieldProps={{ precision: 2 }} />
        </ProForm>
      </Modal>
      <Drawer title="实际成本详情" open={drawerVisible} onClose={() => setDrawerVisible(false)} width={600}>
        {detailLoading ? <div>加载中...</div> : detail ? <ProDescriptions<ActualCost> column={1} dataSource={detail} /> : null}
      </Drawer>
    </div>
  );
};

export default ActualCostsPage;
