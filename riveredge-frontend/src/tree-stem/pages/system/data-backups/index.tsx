/**
 * 数据备份页面
 * 
 * 用于查看和管理系统数据备份。
 * 支持创建备份、恢复备份、删除备份等功能。
 */

import React, { useState } from 'react';
import { ProTable, ProColumns, ProForm, ProFormText, ProFormSelect } from '@ant-design/pro-components';
import { App, Card, Tag, Space, message, Modal, Descriptions, Popconfirm, Button } from 'antd';
import { EyeOutlined, PlusOutlined, ReloadOutlined, DeleteOutlined } from '@ant-design/icons';
import {
  getBackups,
  createBackup,
  getBackupDetail,
  restoreBackup,
  deleteBackup,
  DataBackup,
  DataBackupListResponse,
  CreateDataBackupData,
} from '../../../services/dataBackup';
import { useGlobalStore } from '../../../stores';
import dayjs from 'dayjs';

/**
 * 数据备份页面组件
 */
const DataBackupsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const { currentUser } = useGlobalStore();
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [currentBackup, setCurrentBackup] = useState<DataBackup | null>(null);
  const [formRef] = ProForm.useForm();

  /**
   * 查看备份详情
   */
  const handleViewDetail = async (record: DataBackup) => {
    try {
      const detail = await getBackupDetail(record.uuid);
      setCurrentBackup(detail);
      setDetailModalVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || '获取备份详情失败');
    }
  };

  /**
   * 创建备份
   */
  const handleCreate = async (values: CreateDataBackupData) => {
    try {
      await createBackup(values);
      messageApi.success('备份任务创建成功');
      setCreateModalVisible(false);
      formRef.resetFields();
      // 触发表格刷新
      window.location.reload();
    } catch (error: any) {
      messageApi.error(error.message || '创建备份任务失败');
    }
  };

  /**
   * 恢复备份
   */
  const handleRestore = async (record: DataBackup) => {
    try {
      const result = await restoreBackup(record.uuid, true);
      if (result.success) {
        messageApi.success(result.message || '备份恢复成功');
        // 触发表格刷新
        window.location.reload();
      } else {
        messageApi.error(result.error || '备份恢复失败');
      }
    } catch (error: any) {
      messageApi.error(error.message || '备份恢复失败');
    }
  };

  /**
   * 删除备份
   */
  const handleDelete = async (record: DataBackup) => {
    try {
      await deleteBackup(record.uuid);
      messageApi.success('备份删除成功');
      // 触发表格刷新
      window.location.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除备份失败');
    }
  };

  /**
   * 备份状态标签
   */
  const getStatusTag = (status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      pending: { color: 'default', text: '待执行' },
      running: { color: 'processing', text: '执行中' },
      success: { color: 'success', text: '成功' },
      failed: { color: 'error', text: '失败' },
    };
    const statusInfo = statusMap[status] || { color: 'default', text: status };
    return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
  };

  /**
   * 备份类型标签
   */
  const getBackupTypeTag = (type: string) => {
    const typeMap: Record<string, { color: string; text: string }> = {
      full: { color: 'blue', text: '全量' },
      incremental: { color: 'green', text: '增量' },
    };
    const typeInfo = typeMap[type] || { color: 'default', text: type };
    return <Tag color={typeInfo.color}>{typeInfo.text}</Tag>;
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<DataBackup>[] = [
    {
      title: '备份名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      width: 200,
    },
    {
      title: '备份类型',
      dataIndex: 'backup_type',
      key: 'backup_type',
      valueEnum: {
        full: { text: '全量' },
        incremental: { text: '增量' },
      },
      render: (_: any, record: DataBackup) => getBackupTypeTag(record.backup_type),
      width: 100,
    },
    {
      title: '备份范围',
      dataIndex: 'backup_scope',
      key: 'backup_scope',
      valueEnum: {
        all: { text: '全部' },
        tenant: { text: '组织' },
        table: { text: '表' },
      },
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      valueEnum: {
        pending: { text: '待执行' },
        running: { text: '执行中' },
        success: { text: '成功' },
        failed: { text: '失败' },
      },
      render: (_: any, record: DataBackup) => getStatusTag(record.status),
      width: 100,
    },
    {
      title: '文件大小',
      dataIndex: 'file_size',
      key: 'file_size',
      search: false,
      render: (_: any, record: DataBackup) => {
        if (!record.file_size) return '-';
        const size = record.file_size;
        if (size < 1024) return `${size} B`;
        if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
        if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`;
        return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
      },
      width: 120,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      valueType: 'dateTime',
      sorter: true,
      search: false,
      render: (_: any, record: DataBackup) =>
        dayjs(record.created_at).format('YYYY-MM-DD HH:mm:ss'),
      width: 180,
    },
    {
      title: '操作',
      key: 'action',
      hideInSearch: true,
      width: 200,
      render: (_: any, record: DataBackup) => (
        <Space>
          <a onClick={() => handleViewDetail(record)}>
            <EyeOutlined /> 查看
          </a>
          {record.status === 'success' && (
            <Popconfirm
              title="确定要恢复此备份吗？此操作将覆盖当前数据库数据！"
              onConfirm={() => handleRestore(record)}
              okText="确定"
              cancelText="取消"
            >
              <a style={{ color: '#1890ff' }}>
                <ReloadOutlined /> 恢复
              </a>
            </Popconfirm>
          )}
          <Popconfirm
            title="确定要删除此备份吗？"
            onConfirm={() => handleDelete(record)}
            okText="确定"
            cancelText="取消"
          >
            <a style={{ color: '#ff4d4f' }}>
              <DeleteOutlined /> 删除
            </a>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      {/* 备份列表 */}
      <Card>
        <ProTable<DataBackup>
          columns={columns}
          manualRequest={!currentUser}
          request={async (params, sorter, filter) => {
            // 检查 currentUser，如果用户未登录则直接返回空数据
            if (!currentUser) {
              return {
                data: [],
                success: true,
                total: 0,
              };
            }
            
            const { current, pageSize, backup_type, backup_scope, status, ...rest } = params;
            
            try {
              const response = await getBackups({
                page: current || 1,
                page_size: pageSize || 20,
                backup_type: backup_type as string | undefined,
                backup_scope: backup_scope as string | undefined,
                status: status as string | undefined,
              });
              return {
                data: response.items,
                success: true,
                total: response.total,
              };
            } catch (error: any) {
              // 如果是 401 错误，返回空数据而不是抛出错误
              if (error?.response?.status === 401) {
                return {
                  data: [],
                  success: true,
                  total: 0,
                };
              }
              messageApi.error(error.message || '加载备份列表失败');
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          rowKey="uuid"
          search={{
            labelWidth: 'auto',
            defaultCollapsed: false,
            filterType: 'query',
          }}
          pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
          }}
          toolBarRender={() => [
            <Button
              key="create"
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalVisible(true)}
            >
              创建备份
            </Button>,
          ]}
          headerTitle="数据备份"
        />
      </Card>

      {/* 创建备份 Modal */}
      <Modal
        title="创建备份"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          formRef.resetFields();
        }}
        footer={null}
        width={600}
      >
        <ProForm
          form={formRef}
          onFinish={handleCreate}
          layout="vertical"
          submitter={{
            searchConfig: {
              submitText: '创建',
            },
            resetButtonProps: {
              style: { display: 'none' },
            },
          }}
        >
          <ProFormText
            name="name"
            label="备份名称"
            rules={[{ required: true, message: '请输入备份名称' }]}
            placeholder="请输入备份名称"
          />
          <ProFormSelect
            name="backup_type"
            label="备份类型"
            rules={[{ required: true, message: '请选择备份类型' }]}
            options={[
              { label: '全量备份', value: 'full' },
              { label: '增量备份', value: 'incremental' },
            ]}
            placeholder="请选择备份类型"
          />
          <ProFormSelect
            name="backup_scope"
            label="备份范围"
            rules={[{ required: true, message: '请选择备份范围' }]}
            options={[
              { label: '全部', value: 'all' },
              { label: '组织', value: 'tenant' },
              { label: '表', value: 'table' },
            ]}
            placeholder="请选择备份范围"
          />
        </ProForm>
      </Modal>

      {/* 备份详情 Modal */}
      <Modal
        title="备份详情"
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setCurrentBackup(null);
        }}
        footer={null}
        width={800}
      >
        {currentBackup && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="备份名称">
              {currentBackup.name}
            </Descriptions.Item>
            <Descriptions.Item label="备份类型">
              {getBackupTypeTag(currentBackup.backup_type)}
            </Descriptions.Item>
            <Descriptions.Item label="备份范围">
              {currentBackup.backup_scope === 'all' ? '全部' :
               currentBackup.backup_scope === 'tenant' ? '组织' : '表'}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              {getStatusTag(currentBackup.status)}
            </Descriptions.Item>
            <Descriptions.Item label="文件路径">
              {currentBackup.file_path || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="文件大小">
              {currentBackup.file_size
                ? (() => {
                    const size = currentBackup.file_size!;
                    if (size < 1024) return `${size} B`;
                    if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
                    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`;
                    return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
                  })()
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="开始时间">
              {currentBackup.started_at
                ? dayjs(currentBackup.started_at).format('YYYY-MM-DD HH:mm:ss')
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="完成时间">
              {currentBackup.completed_at
                ? dayjs(currentBackup.completed_at).format('YYYY-MM-DD HH:mm:ss')
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="错误信息">
              {currentBackup.error_message || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {dayjs(currentBackup.created_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default DataBackupsPage;

