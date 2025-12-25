/**
 * 期末结账管理页面
 * 
 * 提供期末结账的 CRUD 功能，按照中国财务规范：月结、年结流程。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormDatePicker, ProFormInstance, ProDescriptions } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Drawer, message } from 'antd';
import { PlusOutlined, CheckOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { periodClosingApi } from '../../services/process';
import type { PeriodClosing, PeriodClosingCreate } from '../../types/process';

const PeriodClosingsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentUuid, setCurrentUuid] = useState<string | null>(null);
  const [detail, setDetail] = useState<PeriodClosing | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  const handleCreate = () => {
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      closingType: '月结',
      status: '待结账',
    });
  };

  const handleOpenDetail = async (record: PeriodClosing) => {
    try {
      setCurrentUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      const data = await periodClosingApi.get(record.uuid);
      setDetail(data);
    } catch (error: any) {
      messageApi.error(error.message || '获取详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCheck = async (record: PeriodClosing) => {
    try {
      const result = await periodClosingApi.check(record.closingPeriod);
      if (result.canClose) {
        messageApi.success('结账前检查通过');
      } else {
        messageApi.warning(`结账前检查不通过：未审核凭证${result.unreviewedVouchers}个，未过账凭证${result.unpostedVouchers}个`);
      }
    } catch (error: any) {
      messageApi.error(error.message || '检查失败');
    }
  };

  const handleExecute = async (record: PeriodClosing) => {
    try {
      await periodClosingApi.execute(record.uuid);
      messageApi.success('结账成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '结账失败');
    }
  };

  const handleSubmit = async (values: PeriodClosingCreate) => {
    try {
      setFormLoading(true);
      await periodClosingApi.create(values);
      messageApi.success('创建成功');
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '创建失败');
    } finally {
      setFormLoading(false);
    }
  };

  const columns: ProColumns<PeriodClosing>[] = [
    {
      title: '结账编号',
      dataIndex: 'closingNo',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.closingNo}</a>
      ),
    },
    {
      title: '结账类型',
      dataIndex: 'closingType',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '月结': { text: '月结' },
        '年结': { text: '年结' },
      },
    },
    {
      title: '结账期间',
      dataIndex: 'closingPeriod',
      width: 120,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '待结账': { text: <Tag color="default">待结账</Tag> },
        '结账中': { text: <Tag color="blue">结账中</Tag> },
        '已结账': { text: <Tag color="green">已结账</Tag> },
        '已反结账': { text: <Tag color="red">已反结账</Tag> },
      },
    },
    {
      title: '操作',
      valueType: 'option',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          {record.status === '待结账' && (
            <>
              <Button type="link" size="small" onClick={() => handleCheck(record)}>检查</Button>
              <Button type="link" size="small" icon={<CheckOutlined />} onClick={() => handleExecute(record)}>执行结账</Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>
      <UniTable<PeriodClosing>
        headerTitle="期末结账管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await periodClosingApi.list({ skip, limit: pageSize, ...rest });
          return { data, success: true, total: data.length };
        }}
        rowKey="uuid"
        search={{ labelWidth: 'auto' }}
        toolBarRender={() => [
          <Button type="primary" key="primary" icon={<PlusOutlined />} onClick={handleCreate}>新建结账</Button>,
        ]}
        rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
      />
      <Modal title="新建期末结账" open={modalVisible} onCancel={() => setModalVisible(false)} footer={null} width={800}>
        <ProForm formRef={formRef} onFinish={handleSubmit} submitter={{ searchConfig: { submitText: '创建' }, submitButtonProps: { loading: formLoading } }}>
          <ProFormText name="closingNo" label="结账编号" rules={[{ required: true }]} />
          <ProFormSelect name="closingType" label="结账类型" options={[{ label: '月结', value: '月结' }, { label: '年结', value: '年结' }]} rules={[{ required: true }]} />
          <ProFormText name="closingPeriod" label="结账期间" rules={[{ required: true }]} placeholder="格式：2024-01、2024" />
          <ProFormDatePicker name="closingDate" label="结账日期" rules={[{ required: true }]} />
        </ProForm>
      </Modal>
      <Drawer title="期末结账详情" open={drawerVisible} onClose={() => setDrawerVisible(false)} width={600}>
        {detailLoading ? <div>加载中...</div> : detail ? <ProDescriptions<PeriodClosing> column={1} dataSource={detail} /> : null}
      </Drawer>
    </div>
  );
};

export default PeriodClosingsPage;
