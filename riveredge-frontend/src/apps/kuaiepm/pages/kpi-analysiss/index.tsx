/**
 * KPI分析管理页面
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormInstance } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni-table';
import { kpiAnalysisApi } from '../../services/process';
import type { KPIAnalysis, KPIAnalysisCreate, KPIAnalysisUpdate } from '../../types/process';

const KPIAnalysisPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [currentUuid, setCurrentUuid] = useState<string | null>(null);

  const handleCreate = () => {
    setIsEdit(false);
    setCurrentUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({ status: '待处理' });
  };

  const handleEdit = async (record: KPIAnalysis) => {
    try {
      setIsEdit(true);
      setCurrentUuid(record.uuid);
      setModalVisible(true);
      const data = await kpiAnalysisApi.get(record.uuid);
      formRef.current?.setFieldsValue(data);
    } catch (error: any) {
      messageApi.error(error.message || '获取详情失败');
    }
  };

  const handleDelete = async (record: KPIAnalysis) => {
    try {
      await kpiAnalysisApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  const handleSubmit = async (values: KPIAnalysisCreate | KPIAnalysisUpdate) => {
    try {
      setFormLoading(true);
      if (isEdit && currentUuid) {
        await kpiAnalysisApi.update(currentUuid, values as KPIAnalysisUpdate);
        messageApi.success('更新成功');
      } else {
        await kpiAnalysisApi.create(values as KPIAnalysisCreate);
        messageApi.success('创建成功');
      }
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
    } finally {
      setFormLoading(false);
    }
  };

  const columns: ProColumns<KPIAnalysis>[] = [
    {
      title: '分析编号',
      dataIndex: 'analysisNo',
      width: 200,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (text: string) => {
        const colorMap: Record<string, string> = {
          '待处理': 'default',
          '进行中': 'processing',
          '已完成': 'success',
          '已取消': 'error',
        };
        return <Tag color={colorMap[text] || 'default'}>{text}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_: any, record: KPIAnalysis) => (
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
      <UniTable<KPIAnalysis>
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...filters } = params;
          const skip = (current - 1) * pageSize;
          const data = await kpiAnalysisApi.list({ skip, limit: pageSize, ...filters });
          return { data, success: true, total: data.length };
        }}
        rowKey="uuid"
        toolBarRender={() => [
          <Button key="create" type="primary" icon={<PlusOutlined />} onClick={handleCreate}>新建</Button>,
        ]}
      />
      <Modal title={isEdit ? '编辑KPI分析' : '新建KPI分析'} open={modalVisible} onCancel={() => setModalVisible(false)} footer={null} width={600}>
        <ProForm formRef={formRef} onFinish={handleSubmit} submitter={{ searchConfig: { submitText: '确定' }, submitButtonProps: { loading: formLoading } }}>
          <ProFormText name="analysisNo" label="分析编号" rules={[{ required: true }]} disabled={isEdit} />
          <ProFormText name="status" label="状态" />
        </ProForm>
      </Modal>
    </div>
  );
};

export default KPIAnalysisPage;
