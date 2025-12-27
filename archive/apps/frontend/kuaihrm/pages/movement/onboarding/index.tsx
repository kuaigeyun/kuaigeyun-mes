/**
 * 员工入职管理页面
 * 
 * 提供员工入职的 CRUD 功能。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormInstance, ProDescriptions, ProFormDatePicker, ProFormDigit } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { employeeOnboardingApi } from '../../../services/process';
import type { EmployeeOnboarding, EmployeeOnboardingCreate, EmployeeOnboardingUpdate } from '../../../types/process';

const EmployeeOnboardingsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentUuid, setCurrentUuid] = useState<string | null>(null);
  const [detail, setDetail] = useState<EmployeeOnboarding | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  const handleCreate = () => {
    setIsEdit(false);
    setCurrentUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({ status: '待申请' });
  };

  const handleEdit = async (record: EmployeeOnboarding) => {
    try {
      setIsEdit(true);
      setCurrentUuid(record.uuid);
      setModalVisible(true);
      const data = await employeeOnboardingApi.get(record.uuid);
      formRef.current?.setFieldsValue(data);
    } catch (error: any) {
      messageApi.error(error.message || '获取详情失败');
    }
  };

  const handleDelete = async (record: EmployeeOnboarding) => {
    try {
      await employeeOnboardingApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  const handleOpenDetail = async (record: EmployeeOnboarding) => {
    try {
      setCurrentUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      const data = await employeeOnboardingApi.get(record.uuid);
      setDetail(data);
    } catch (error: any) {
      messageApi.error(error.message || '获取详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSubmit = async (values: EmployeeOnboardingCreate | EmployeeOnboardingUpdate) => {
    try {
      setFormLoading(true);
      if (isEdit && currentUuid) {
        await employeeOnboardingApi.update(currentUuid, values as EmployeeOnboardingUpdate);
        messageApi.success('更新成功');
      } else {
        await employeeOnboardingApi.create(values as EmployeeOnboardingCreate);
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

  const columns: ProColumns<EmployeeOnboarding>[] = [
    {
      title: '入职编号',
      dataIndex: 'onboardingNo',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.onboardingNo}</a>
      ),
    },
    {
      title: '员工姓名',
      dataIndex: 'employeeName',
      width: 120,
    },
    {
      title: '入职日期',
      dataIndex: 'onboardingDate',
      width: 120,
      valueType: 'date',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '待申请': { text: <Tag color="default">待申请</Tag> },
        '待审批': { text: <Tag color="orange">待审批</Tag> },
        '待办理': { text: <Tag color="blue">待办理</Tag> },
        '办理中': { text: <Tag color="processing">办理中</Tag> },
        '已确认': { text: <Tag color="green">已确认</Tag> },
        '已取消': { text: <Tag color="red">已取消</Tag> },
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
      <UniTable<EmployeeOnboarding>
        headerTitle="员工入职管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await employeeOnboardingApi.list({ skip, limit: pageSize, ...rest });
          return { data, success: true, total: data.length };
        }}
        rowKey="uuid"
        search={{ labelWidth: 'auto' }}
        toolBarRender={() => [
          <Button type="primary" key="primary" icon={<PlusOutlined />} onClick={handleCreate}>新建</Button>,
        ]}
        rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
      />
      <Modal title={isEdit ? '编辑' : '新建'} open={modalVisible} onCancel={() => setModalVisible(false)} footer={null} width={800}>
        <ProForm formRef={formRef} onFinish={handleSubmit} submitter={{ searchConfig: { submitText: isEdit ? '更新' : '创建' }, submitButtonProps: { loading: formLoading } }}>
          <ProFormText name="onboardingNo" label="入职编号" rules={[{ required: true }]} disabled={isEdit} />
          <ProFormDigit name="employeeId" label="员工ID" rules={[{ required: true }]} />
          <ProFormText name="employeeName" label="员工姓名" rules={[{ required: true }]} />
          <ProFormDigit name="departmentId" label="部门ID" />
          <ProFormDigit name="positionId" label="岗位ID" />
          <ProFormDatePicker name="onboardingDate" label="入职日期" rules={[{ required: true }]} />
          <ProFormSelect name="status" label="状态" options={[
            { label: '待申请', value: '待申请' },
            { label: '待审批', value: '待审批' },
            { label: '待办理', value: '待办理' },
            { label: '办理中', value: '办理中' },
            { label: '已确认', value: '已确认' },
            { label: '已取消', value: '已取消' },
          ]} />
        </ProForm>
      </Modal>
      <Drawer title="详情" open={drawerVisible} onClose={() => setDrawerVisible(false)} width={600}>
        {detailLoading ? <div>加载中...</div> : detail ? <ProDescriptions<EmployeeOnboarding> column={1} dataSource={detail} /> : null}
      </Drawer>
    </div>
  );
};

export default EmployeeOnboardingsPage;

