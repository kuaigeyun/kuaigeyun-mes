/**
 * 成本中心管理页面
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormDigit, ProFormInstance, ProDescriptions } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni_table';
import { costCenterApi } from '../../services/process';
import type { CostCenter, CostCenterCreate } from '../../types/process';

const CostCentersPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentUuid, setCurrentUuid] = useState<string | null>(null);
  const [detail, setDetail] = useState<CostCenter | null>(null);
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
      level: 1,
      status: '启用',
    });
  };

  const handleEdit = async (record: CostCenter) => {
    try {
      setIsEdit(true);
      setCurrentUuid(record.uuid);
      setModalVisible(true);
      const data = await costCenterApi.get(record.uuid);
      formRef.current?.setFieldsValue(data);
    } catch (error: any) {
      messageApi.error(error.message || '获取详情失败');
    }
  };

  const handleDelete = async (record: CostCenter) => {
    try {
      await costCenterApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  const handleOpenDetail = async (record: CostCenter) => {
    try {
      setCurrentUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      const data = await costCenterApi.get(record.uuid);
      setDetail(data);
    } catch (error: any) {
      messageApi.error(error.message || '获取详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSubmit = async (values: CostCenterCreate) => {
    try {
      setFormLoading(true);
      if (isEdit && currentUuid) {
        await costCenterApi.update(currentUuid, values);
        messageApi.success('更新成功');
      } else {
        await costCenterApi.create(values);
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

  const columns: ProColumns<CostCenter>[] = [
    {
      title: '成本中心编码',
      dataIndex: 'centerCode',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.centerCode}</a>
      ),
    },
    {
      title: '成本中心名称',
      dataIndex: 'centerName',
      width: 200,
    },
    {
      title: '成本中心类型',
      dataIndex: 'centerType',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '生产中心': { text: '生产中心' },
        '服务中心': { text: '服务中心' },
        '管理中心': { text: '管理中心' },
        '其他': { text: '其他' },
      },
    },
    {
      title: '层级',
      dataIndex: 'level',
      width: 80,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '启用': { text: <Tag color="green">启用</Tag> },
        '停用': { text: <Tag color="default">停用</Tag> },
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
      <UniTable<CostCenter>
        headerTitle="成本中心管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await costCenterApi.list({ skip, limit: pageSize, ...rest });
          return { data, success: true, total: data.length };
        }}
        rowKey="uuid"
        search={{ labelWidth: 'auto' }}
        toolBarRender={() => [
          <Button type="primary" key="primary" icon={<PlusOutlined />} onClick={handleCreate}>新建成本中心</Button>,
        ]}
        rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
      />
      <Modal title={isEdit ? '编辑成本中心' : '新建成本中心'} open={modalVisible} onCancel={() => setModalVisible(false)} footer={null} width={800}>
        <ProForm formRef={formRef} onFinish={handleSubmit} submitter={{ searchConfig: { submitText: isEdit ? '更新' : '创建' }, submitButtonProps: { loading: formLoading } }}>
          <ProFormText name="centerCode" label="成本中心编码" rules={[{ required: true }]} />
          <ProFormText name="centerName" label="成本中心名称" rules={[{ required: true }]} />
          <ProFormSelect name="centerType" label="成本中心类型" options={[{ label: '生产中心', value: '生产中心' }, { label: '服务中心', value: '服务中心' }, { label: '管理中心', value: '管理中心' }, { label: '其他', value: '其他' }]} rules={[{ required: true }]} />
          <ProFormDigit name="departmentId" label="部门ID" />
          <ProFormDigit name="parentId" label="父成本中心ID" />
          <ProFormDigit name="level" label="成本中心层级" min={1} />
          <ProFormSelect name="status" label="状态" options={[{ label: '启用', value: '启用' }, { label: '停用', value: '停用' }]} rules={[{ required: true }]} />
        </ProForm>
      </Modal>
      <Drawer title="成本中心详情" open={drawerVisible} onClose={() => setDrawerVisible(false)} width={600}>
        {detailLoading ? <div>加载中...</div> : detail ? <ProDescriptions<CostCenter> column={1} dataSource={detail} /> : null}
      </Drawer>
    </div>
  );
};

export default CostCentersPage;
