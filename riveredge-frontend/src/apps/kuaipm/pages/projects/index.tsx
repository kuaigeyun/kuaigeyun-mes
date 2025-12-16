/**
 * 项目管理页面
 * 
 * 提供项目的 CRUD 功能。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormInstance, ProFormDatePicker, ProFormDigit } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni-table';
import { projectApi } from '../../services/process';
import type { Project, ProjectCreate, ProjectUpdate } from '../../types/process';

const ProjectsPage: React.FC = () => {
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
    formRef.current?.setFieldsValue({
      status: '草稿',
      priority: '中',
      progress: 0,
    });
  };

  const handleEdit = async (record: Project) => {
    try {
      setIsEdit(true);
      setCurrentUuid(record.uuid);
      setModalVisible(true);
      const data = await projectApi.get(record.uuid);
      formRef.current?.setFieldsValue(data);
    } catch (error: any) {
      messageApi.error(error.message || '获取详情失败');
    }
  };

  const handleDelete = async (record: Project) => {
    try {
      await projectApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  const handleSubmit = async (values: ProjectCreate | ProjectUpdate) => {
    try {
      setFormLoading(true);
      if (isEdit && currentUuid) {
        await projectApi.update(currentUuid, values as ProjectUpdate);
        messageApi.success('更新成功');
      } else {
        await projectApi.create(values as ProjectCreate);
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

  const columns: ProColumns<Project>[] = [
    {
      title: '项目编号',
      dataIndex: 'projectNo',
      key: 'projectNo',
      width: 150,
    },
    {
      title: '项目名称',
      dataIndex: 'projectName',
      key: 'projectName',
      width: 200,
    },
    {
      title: '项目类型',
      dataIndex: 'projectType',
      key: 'projectType',
      width: 120,
    },
    {
      title: '项目经理',
      dataIndex: 'managerName',
      key: 'managerName',
      width: 120,
    },
    {
      title: '进度',
      dataIndex: 'progress',
      key: 'progress',
      width: 100,
      render: (text: number) => `${text}%`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (text: string) => {
        const colorMap: Record<string, string> = {
          '草稿': 'default',
          '待审批': 'processing',
          '已审批': 'processing',
          '进行中': 'processing',
          '已暂停': 'warning',
          '已完成': 'success',
          '已取消': 'error',
        };
        return <Tag color={colorMap[text] || 'default'}>{text}</Tag>;
      },
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (text: string) => {
        const colorMap: Record<string, string> = {
          '低': 'default',
          '中': 'processing',
          '高': 'warning',
          '紧急': 'error',
        };
        return <Tag color={colorMap[text] || 'default'}>{text}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_: any, record: Project) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除吗？"
            onConfirm={() => handleDelete(record)}
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>
      <UniTable<Project>
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { skip = 0, limit = 20, ...filters } = params;
          const data = await projectApi.list({
            skip,
            limit,
            ...filters,
          });
          return {
            data,
            success: true,
            total: data.length,
          };
        }}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            新建
          </Button>,
        ]}
      />
      
      <Modal
        title={isEdit ? '编辑项目' : '新建项目'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={800}
      >
        <ProForm
          formRef={formRef}
          onFinish={handleSubmit}
          submitter={{
            searchConfig: {
              submitText: '确定',
            },
            submitButtonProps: {
              loading: formLoading,
            },
          }}
        >
          <ProFormText
            name="projectNo"
            label="项目编号"
            rules={[{ required: true, message: '请输入项目编号' }]}
          />
          <ProFormText
            name="projectName"
            label="项目名称"
            rules={[{ required: true, message: '请输入项目名称' }]}
          />
          <ProFormSelect
            name="projectType"
            label="项目类型"
            options={[
              { label: '研发项目', value: '研发项目' },
              { label: '生产项目', value: '生产项目' },
              { label: '客户项目', value: '客户项目' },
            ]}
            rules={[{ required: true, message: '请选择项目类型' }]}
          />
          <ProFormText
            name="managerName"
            label="项目经理"
            rules={[{ required: true, message: '请输入项目经理' }]}
          />
          <ProFormDatePicker
            name="startDate"
            label="计划开始日期"
          />
          <ProFormDatePicker
            name="endDate"
            label="计划结束日期"
          />
          <ProFormDigit
            name="progress"
            label="项目进度"
            min={0}
            max={100}
            fieldProps={{ suffix: '%' }}
          />
          <ProFormSelect
            name="status"
            label="状态"
            options={[
              { label: '草稿', value: '草稿' },
              { label: '待审批', value: '待审批' },
              { label: '已审批', value: '已审批' },
              { label: '进行中', value: '进行中' },
              { label: '已暂停', value: '已暂停' },
              { label: '已完成', value: '已完成' },
              { label: '已取消', value: '已取消' },
            ]}
          />
          <ProFormSelect
            name="priority"
            label="优先级"
            options={[
              { label: '低', value: '低' },
              { label: '中', value: '中' },
              { label: '高', value: '高' },
              { label: '紧急', value: '紧急' },
            ]}
          />
        </ProForm>
      </Modal>
    </div>
  );
};

export default ProjectsPage;

