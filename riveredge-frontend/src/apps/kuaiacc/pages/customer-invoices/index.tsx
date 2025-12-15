/**
 * 客户发票管理页面
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormDatePicker, ProFormDigit, ProFormInstance, ProDescriptions } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni_table';
import { customerInvoiceApi } from '../../services/process';
import type { CustomerInvoice, CustomerInvoiceCreate } from '../../types/process';

const CustomerInvoicesPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentUuid, setCurrentUuid] = useState<string | null>(null);
  const [detail, setDetail] = useState<CustomerInvoice | null>(null);
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
      invoiceType: '增值税专用发票',
      taxRate: 0.13,
      status: '待开票',
    });
  };

  const handleEdit = async (record: CustomerInvoice) => {
    try {
      setIsEdit(true);
      setCurrentUuid(record.uuid);
      setModalVisible(true);
      const data = await customerInvoiceApi.get(record.uuid);
      formRef.current?.setFieldsValue(data);
    } catch (error: any) {
      messageApi.error(error.message || '获取详情失败');
    }
  };

  const handleDelete = async (record: CustomerInvoice) => {
    try {
      await customerInvoiceApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  const handleOpenDetail = async (record: CustomerInvoice) => {
    try {
      setCurrentUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      const data = await customerInvoiceApi.get(record.uuid);
      setDetail(data);
    } catch (error: any) {
      messageApi.error(error.message || '获取详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSubmit = async (values: CustomerInvoiceCreate) => {
    try {
      setFormLoading(true);
      if (isEdit && currentUuid) {
        await customerInvoiceApi.update(currentUuid, values);
        messageApi.success('更新成功');
      } else {
        await customerInvoiceApi.create(values);
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

  const columns: ProColumns<CustomerInvoice>[] = [
    {
      title: '发票编号',
      dataIndex: 'invoiceNo',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.invoiceNo}</a>
      ),
    },
    {
      title: '发票代码',
      dataIndex: 'invoiceCode',
      width: 120,
    },
    {
      title: '发票号码',
      dataIndex: 'invoiceNumber',
      width: 120,
    },
    {
      title: '发票类型',
      dataIndex: 'invoiceType',
      width: 120,
    },
    {
      title: '含税金额',
      dataIndex: 'amountIncludingTax',
      width: 120,
      valueType: 'money',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '待开票': { text: <Tag color="default">待开票</Tag> },
        '已开票': { text: <Tag color="green">已开票</Tag> },
        '已作废': { text: <Tag color="red">已作废</Tag> },
        '已红冲': { text: <Tag color="orange">已红冲</Tag> },
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
      <UniTable<CustomerInvoice>
        headerTitle="客户发票管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await customerInvoiceApi.list({ skip, limit: pageSize, ...rest });
          return { data, success: true, total: data.length };
        }}
        rowKey="uuid"
        search={{ labelWidth: 'auto' }}
        toolBarRender={() => [
          <Button type="primary" key="primary" icon={<PlusOutlined />} onClick={handleCreate}>新建客户发票</Button>,
        ]}
        rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
      />
      <Modal title={isEdit ? '编辑客户发票' : '新建客户发票'} open={modalVisible} onCancel={() => setModalVisible(false)} footer={null} width={800}>
        <ProForm formRef={formRef} onFinish={handleSubmit} submitter={{ searchConfig: { submitText: isEdit ? '更新' : '创建' }, submitButtonProps: { loading: formLoading } }}>
          <ProFormText name="invoiceNo" label="发票编号" rules={[{ required: true }]} />
          <ProFormText name="invoiceCode" label="发票代码" />
          <ProFormText name="invoiceNumber" label="发票号码" />
          <ProFormSelect name="invoiceType" label="发票类型" options={[{ label: '增值税专用发票', value: '增值税专用发票' }, { label: '增值税普通发票', value: '增值税普通发票' }, { label: '普通发票', value: '普通发票' }]} rules={[{ required: true }]} />
          <ProFormDatePicker name="invoiceDate" label="开票日期" rules={[{ required: true }]} />
          <ProFormDigit name="customerId" label="客户ID" rules={[{ required: true }]} />
          <ProFormDigit name="taxRate" label="税率" rules={[{ required: true }]} min={0} max={1} fieldProps={{ precision: 4 }} />
          <ProFormDigit name="amountExcludingTax" label="不含税金额" rules={[{ required: true }]} min={0} fieldProps={{ precision: 2 }} />
          <ProFormDigit name="taxAmount" label="税额" rules={[{ required: true }]} min={0} fieldProps={{ precision: 2 }} />
          <ProFormDigit name="amountIncludingTax" label="含税金额" rules={[{ required: true }]} min={0} fieldProps={{ precision: 2 }} />
        </ProForm>
      </Modal>
      <Drawer title="客户发票详情" open={drawerVisible} onClose={() => setDrawerVisible(false)} width={600}>
        {detailLoading ? <div>加载中...</div> : detail ? <ProDescriptions<CustomerInvoice> column={1} dataSource={detail} /> : null}
      </Drawer>
    </div>
  );
};

export default CustomerInvoicesPage;
