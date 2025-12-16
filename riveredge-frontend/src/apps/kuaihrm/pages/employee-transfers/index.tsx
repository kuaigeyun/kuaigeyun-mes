/**
 * 员工异动管理页面
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormInstance, ProDescriptions, ProFormDatePicker, ProFormTextArea, ProFormDigit } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni-table';
import { employeeTransferApi } from '../../services/process';
import type { EmployeeTransfer, EmployeeTransferCreate, EmployeeTransferUpdate } from '../../types/process';

const EmployeeTransfersPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentUuid, setCurrentUuid] = useState<string | null>(null);
  const [detail, setDetail] = useState<EmployeeTransfer | null>(null);
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

  const handleEdit = async (record: EmployeeTransfer) => {
    try {
      setIsEdit(true);
      setCurrentUuid(record.uuid);
      setModalVisible(true);
      const data = await employeeTransferApi.get(record.uuid);
      formRef.current?.setFieldsValue(data);
    } catch (error: any) {
      messageApi.error(error.message || '获取详情失败');
    }
  };

  const handleDelete = async (record: EmployeeTransfer) => {
    try {
      await employeeTransferApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  const handleOpenDetail = async (record: EmployeeTransfer) => {
    try {
      setCurrentUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      const data = await employeeTransferApi.get(record.uuid);
      setDetail(data);
    } catch (error: any) {
      messageApi.error(error.message || '获取详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSubmit = async (values: EmployeeTransferCreate | EmployeeTransferUpdate) => {
    try {
      setFormLoading(true);
      if (isEdit && currentUuid) {
        await employeeTransferApi.update(currentUuid, values as EmployeeTransferUpdate);
        messageApi.success('更新成功');
      } else {
        await employeeTransferApi.create(values as EmployeeTransferCreate);
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

  const columns: ProColumns<EmployeeTransfer>[] = [
    {
      title: '异动编号',
      dataIndex: 'transferNo',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.transferNo}</a>
      ),
    },
    {
      title: '员工姓名',
      dataIndex: 'employeeName',
      width: 120,
    },
    {
      title: '异动类型',
      dataIndex: 'transferType',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '调岗': { text: <Tag color="blue">调岗</Tag> },
        '晋升': { text: <Tag color="green">晋升</Tag> },
        '降职': { text: <Tag color="orange">降职</Tag> },
        '其他': { text: <Tag color="default">其他</Tag> },
      },
    },
    {
      title: '异动日期',
      dataIndex: 'transferDate',
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
      <UniTable<EmployeeTransfer>
        headerTitle="员工异动管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await employeeTransferApi.list({ skip, limit: pageSize, ...rest });
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
          <ProFormText name="transferNo" label="异动编号" rules={[{ required: true }]} disabled={isEdit} />
          <ProFormDigit name="employeeId" label="员工ID" rules={[{ required: true }]} />
          <ProFormText name="employeeName" label="员工姓名" rules={[{ required: true }]} />
          <ProFormSelect name="transferType" label="异动类型" options={[
            { label: '调岗', value: '调岗' },
            { label: '晋升', value: '晋升' },
            { label: '降职', value: '降职' },
            { label: '其他', value: '其他' },
          ]} rules={[{ required: true }]} />
          <ProFormDigit name="oldDepartmentId" label="原部门ID" />
          <ProFormDigit name="oldPositionId" label="原岗位ID" />
          <ProFormDigit name="newDepartmentId" label="新部门ID" />
          <ProFormDigit name="newPositionId" label="新岗位ID" />
          <ProFormDatePicker name="transferDate" label="异动日期" rules={[{ required: true }]} />
          <ProFormTextArea name="transferReason" label="异动原因" />
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
        {detailLoading ? <div>加载中...</div> : detail ? <ProDescriptions<EmployeeTransfer> column={1} dataSource={detail} /> : null}
      </Drawer>
    </div>
  );
};

export default EmployeeTransfersPage;

