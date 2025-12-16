/**
 * 付款管理页面
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormDatePicker, ProFormDigit, ProFormInstance, ProDescriptions } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni-table';
import { paymentApi } from '../../services/process';
import type { Payment, PaymentCreate } from '../../types/process';

const PaymentsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentUuid, setCurrentUuid] = useState<string | null>(null);
  const [detail, setDetail] = useState<Payment | null>(null);
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
      paymentType: '应付款',
      paymentMethod: '银行转账',
      currency: 'CNY',
      exchangeRate: 1,
      status: '待审批',
    });
  };

  const handleEdit = async (record: Payment) => {
    try {
      setIsEdit(true);
      setCurrentUuid(record.uuid);
      setModalVisible(true);
      const data = await paymentApi.get(record.uuid);
      formRef.current?.setFieldsValue(data);
    } catch (error: any) {
      messageApi.error(error.message || '获取详情失败');
    }
  };

  const handleDelete = async (record: Payment) => {
    try {
      await paymentApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  const handleOpenDetail = async (record: Payment) => {
    try {
      setCurrentUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      const data = await paymentApi.get(record.uuid);
      setDetail(data);
    } catch (error: any) {
      messageApi.error(error.message || '获取详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSubmit = async (values: PaymentCreate) => {
    try {
      setFormLoading(true);
      if (isEdit && currentUuid) {
        await paymentApi.update(currentUuid, values);
        messageApi.success('更新成功');
      } else {
        await paymentApi.create(values);
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

  const columns: ProColumns<Payment>[] = [
    {
      title: '付款单编号',
      dataIndex: 'paymentNo',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.paymentNo}</a>
      ),
    },
    {
      title: '付款日期',
      dataIndex: 'paymentDate',
      width: 120,
      valueType: 'date',
    },
    {
      title: '付款类型',
      dataIndex: 'paymentType',
      width: 100,
    },
    {
      title: '付款方式',
      dataIndex: 'paymentMethod',
      width: 120,
    },
    {
      title: '付款金额',
      dataIndex: 'amount',
      width: 120,
      valueType: 'money',
    },
    {
      title: '币种',
      dataIndex: 'currency',
      width: 80,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '待审批': { text: <Tag color="default">待审批</Tag> },
        '已审批': { text: <Tag color="blue">已审批</Tag> },
        '待核销': { text: <Tag color="orange">待核销</Tag> },
        '部分核销': { text: <Tag color="blue">部分核销</Tag> },
        '已核销': { text: <Tag color="green">已核销</Tag> },
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
      <UniTable<Payment>
        headerTitle="付款管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await paymentApi.list({ skip, limit: pageSize, ...rest });
          return { data, success: true, total: data.length };
        }}
        rowKey="uuid"
        search={{ labelWidth: 'auto' }}
        toolBarRender={() => [
          <Button type="primary" key="primary" icon={<PlusOutlined />} onClick={handleCreate}>新建付款</Button>,
        ]}
        rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
      />
      <Modal title={isEdit ? '编辑付款' : '新建付款'} open={modalVisible} onCancel={() => setModalVisible(false)} footer={null} width={800}>
        <ProForm formRef={formRef} onFinish={handleSubmit} submitter={{ searchConfig: { submitText: isEdit ? '更新' : '创建' }, submitButtonProps: { loading: formLoading } }}>
          <ProFormText name="paymentNo" label="付款单编号" rules={[{ required: true }]} />
          <ProFormDatePicker name="paymentDate" label="付款日期" rules={[{ required: true }]} />
          <ProFormDigit name="supplierId" label="供应商ID" rules={[{ required: true }]} />
          <ProFormSelect name="paymentType" label="付款类型" options={[{ label: '预付款', value: '预付款' }, { label: '应付款', value: '应付款' }, { label: '其他', value: '其他' }]} rules={[{ required: true }]} />
          <ProFormSelect name="paymentMethod" label="付款方式" options={[{ label: '现金', value: '现金' }, { label: '银行转账', value: '银行转账' }, { label: '支票', value: '支票' }, { label: '汇票', value: '汇票' }]} rules={[{ required: true }]} />
          <ProFormDigit name="amount" label="付款金额" rules={[{ required: true }]} min={0} fieldProps={{ precision: 2 }} />
          <ProFormText name="currency" label="币种" />
          <ProFormDigit name="exchangeRate" label="汇率" min={0} fieldProps={{ precision: 6 }} />
        </ProForm>
      </Modal>
      <Drawer title="付款详情" open={drawerVisible} onClose={() => setDrawerVisible(false)} width={600}>
        {detailLoading ? <div>加载中...</div> : detail ? <ProDescriptions<Payment> column={1} dataSource={detail} /> : null}
      </Drawer>
    </div>
  );
};

export default PaymentsPage;
