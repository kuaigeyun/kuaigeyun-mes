/**
 * 收款管理页面
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormDatePicker, ProFormDigit, ProFormInstance, ProDescriptions } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { receiptApi } from '../../services/process';
import type { Receipt, ReceiptCreate } from '../../types/process';

const ReceiptsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentUuid, setCurrentUuid] = useState<string | null>(null);
  const [detail, setDetail] = useState<Receipt | null>(null);
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
      receiptType: '应收款',
      paymentMethod: '银行转账',
      currency: 'CNY',
      exchangeRate: 1,
      status: '待核销',
    });
  };

  const handleEdit = async (record: Receipt) => {
    try {
      setIsEdit(true);
      setCurrentUuid(record.uuid);
      setModalVisible(true);
      const data = await receiptApi.get(record.uuid);
      formRef.current?.setFieldsValue(data);
    } catch (error: any) {
      messageApi.error(error.message || '获取详情失败');
    }
  };

  const handleDelete = async (record: Receipt) => {
    try {
      await receiptApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  const handleOpenDetail = async (record: Receipt) => {
    try {
      setCurrentUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      const data = await receiptApi.get(record.uuid);
      setDetail(data);
    } catch (error: any) {
      messageApi.error(error.message || '获取详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSubmit = async (values: ReceiptCreate) => {
    try {
      setFormLoading(true);
      if (isEdit && currentUuid) {
        await receiptApi.update(currentUuid, values);
        messageApi.success('更新成功');
      } else {
        await receiptApi.create(values);
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

  const columns: ProColumns<Receipt>[] = [
    {
      title: '收款单编号',
      dataIndex: 'receiptNo',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.receiptNo}</a>
      ),
    },
    {
      title: '收款日期',
      dataIndex: 'receiptDate',
      width: 120,
      valueType: 'date',
    },
    {
      title: '收款类型',
      dataIndex: 'receiptType',
      width: 100,
    },
    {
      title: '收款方式',
      dataIndex: 'paymentMethod',
      width: 120,
    },
    {
      title: '收款金额',
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
        '待核销': { text: <Tag color="default">待核销</Tag> },
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
      <UniTable<Receipt>
        headerTitle="收款管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await receiptApi.list({ skip, limit: pageSize, ...rest });
          return { data, success: true, total: data.length };
        }}
        rowKey="uuid"
        search={{ labelWidth: 'auto' }}
        toolBarRender={() => [
          <Button type="primary" key="primary" icon={<PlusOutlined />} onClick={handleCreate}>新建收款</Button>,
        ]}
        rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
      />
      <Modal title={isEdit ? '编辑收款' : '新建收款'} open={modalVisible} onCancel={() => setModalVisible(false)} footer={null} width={800}>
        <ProForm formRef={formRef} onFinish={handleSubmit} submitter={{ searchConfig: { submitText: isEdit ? '更新' : '创建' }, submitButtonProps: { loading: formLoading } }}>
          <ProFormText name="receiptNo" label="收款单编号" rules={[{ required: true }]} />
          <ProFormDatePicker name="receiptDate" label="收款日期" rules={[{ required: true }]} />
          <ProFormDigit name="customerId" label="客户ID" rules={[{ required: true }]} />
          <ProFormSelect name="receiptType" label="收款类型" options={[{ label: '预收款', value: '预收款' }, { label: '应收款', value: '应收款' }, { label: '其他', value: '其他' }]} rules={[{ required: true }]} />
          <ProFormSelect name="paymentMethod" label="收款方式" options={[{ label: '现金', value: '现金' }, { label: '银行转账', value: '银行转账' }, { label: '支票', value: '支票' }, { label: '汇票', value: '汇票' }]} rules={[{ required: true }]} />
          <ProFormDigit name="amount" label="收款金额" rules={[{ required: true }]} min={0} fieldProps={{ precision: 2 }} />
          <ProFormText name="currency" label="币种" />
          <ProFormDigit name="exchangeRate" label="汇率" min={0} fieldProps={{ precision: 6 }} />
        </ProForm>
      </Modal>
      <Drawer title="收款详情" open={drawerVisible} onClose={() => setDrawerVisible(false)} width={600}>
        {detailLoading ? <div>加载中...</div> : detail ? <ProDescriptions<Receipt> column={1} dataSource={detail} /> : null}
      </Drawer>
    </div>
  );
};

export default ReceiptsPage;
