/**
 * 数据备份页面
 * 
 * 用于查看和管理系统数据备份。
 * 支持创建备份、恢复备份、删除备份等功能。
 */

import React, { useState, useMemo } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormInstance } from '@ant-design/pro-components';
import SafeProFormSelect from '../../../components/safe-pro-form-select';
import { App, Card, Tag, Space, message, Modal, Descriptions, Popconfirm, Button, Badge, Typography, Alert, Progress, Tooltip } from 'antd';
import { EyeOutlined, PlusOutlined, ReloadOutlined, DeleteOutlined } from '@ant-design/icons';
import { UniTable } from '../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../components/layout-templates';
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

const { Text } = Typography;

/**
 * 格式化文件大小
 */
const formatFileSize = (bytes?: number): string => {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

/**
 * 获取备份状态显示
 */
const getStatusInfo = (status: string): { 
  status: 'success' | 'error' | 'processing' | 'default'; 
  text: string;
} => {
  const statusMap: Record<string, { status: 'success' | 'error' | 'processing' | 'default'; text: string }> = {
    pending: { status: 'default', text: '待执行' },
    running: { status: 'processing', text: '执行中' },
    success: { status: 'success', text: '成功' },
    failed: { status: 'error', text: '失败' },
  };
  return statusMap[status] || { status: 'default', text: status };
};

/**
 * 获取备份范围文本
 */
const getBackupScopeText = (scope: string): string => {
  const scopeMap: Record<string, string> = {
    all: '全部',
    tenant: '组织',
    table: '表',
  };
  return scopeMap[scope] || scope;
};

/**
 * 数据备份页面组件
 */
const DataBackupsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const { currentUser } = useGlobalStore();
  const actionRef = React.useRef<ActionType>(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentBackup, setCurrentBackup] = useState<DataBackup | null>(null);
  const [formRef] = ProForm.useForm();
  const [allBackups, setAllBackups] = useState<DataBackup[]>([]); // 用于统计

  /**
   * 查看备份详情
   */
  const handleViewDetail = async (record: DataBackup) => {
    try {
      const detail = await getBackupDetail(record.uuid);
      setCurrentBackup(detail);
      setDetailDrawerVisible(true);
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
      actionRef.current?.reload();
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
        actionRef.current?.reload();
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
      actionRef.current?.reload();
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
   * 计算统计信息
   */
  const statCards = useMemo(() => {
    if (allBackups.length === 0) return undefined;
    
    const stats = {
      total: allBackups.length,
      success: allBackups.filter((b) => b.status === 'success').length,
      failed: allBackups.filter((b) => b.status === 'failed').length,
      running: allBackups.filter((b) => b.status === 'running').length,
      totalSize: allBackups.reduce((sum, b) => sum + (b.file_size || 0), 0),
    };

    return [
      {
        title: '总备份数',
        value: stats.total,
        valueStyle: { color: '#1890ff' },
      },
      {
        title: '成功备份',
        value: stats.success,
        valueStyle: { color: '#52c41a' },
      },
      {
        title: '失败备份',
        value: stats.failed,
        valueStyle: { color: '#ff4d4f' },
      },
      {
        title: '执行中',
        value: stats.running,
        valueStyle: { color: '#1890ff' },
      },
      {
        title: '总备份大小',
        value: formatFileSize(stats.totalSize),
        valueStyle: { color: '#722ed1' },
      },
    ];
  }, [allBackups]);

  /**
   * 卡片渲染函数
   */
  const renderCard = (backup: DataBackup, index: number) => {
    const typeInfo = getBackupTypeTag(backup.backup_type);
    const statusInfo = getStatusInfo(backup.status);
    
    return (
      <Card
        key={backup.uuid}
        hoverable
        style={{ height: '100%' }}
        actions={[
          <Tooltip key="view" title="查看详情">
            <EyeOutlined
              onClick={() => handleViewDetail(backup)}
              style={{ fontSize: 16 }}
            />
          </Tooltip>,
          backup.status === 'success' ? (
            <Tooltip key="restore" title="恢复备份">
              <ReloadOutlined
                onClick={() => {
                  Modal.confirm({
                    title: '确定要恢复此备份吗？',
                    content: '此操作将覆盖当前数据库数据，请谨慎操作！',
                    okText: '确定',
                    cancelText: '取消',
                    onOk: () => handleRestore(backup),
                  });
                }}
                style={{ fontSize: 16, color: '#1890ff' }}
              />
            </Tooltip>
          ) : null,
          <Popconfirm
            key="delete"
            title="确定要删除这个备份吗？"
            onConfirm={() => handleDelete(backup)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <DeleteOutlined
                style={{ fontSize: 16, color: '#ff4d4f' }}
              />
            </Tooltip>
          </Popconfirm>,
        ].filter(Boolean)}
      >
        <div style={{ marginBottom: 16 }}>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text strong style={{ fontSize: 16 }}>
                {backup.name}
              </Text>
              <Tag color={typeInfo.color}>
                {typeInfo.text}
              </Tag>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>备份范围：</Text>
              <Text style={{ fontSize: 12 }}>{getBackupScopeText(backup.backup_scope)}</Text>
            </div>
          </Space>
        </div>
        
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>状态：</Text>
              <Badge
                status={statusInfo.status}
                text={statusInfo.text}
              />
            </div>
            
            {backup.file_size && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>文件大小：</Text>
                <Text style={{ fontSize: 12 }}>{formatFileSize(backup.file_size)}</Text>
              </div>
            )}
            
            {backup.started_at && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>开始时间：</Text>
                <Text style={{ fontSize: 12 }}>
                  {dayjs(backup.started_at).format('MM-DD HH:mm')}
                </Text>
              </div>
            )}
            
            {backup.completed_at && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>完成时间：</Text>
                <Text style={{ fontSize: 12 }}>
                  {dayjs(backup.completed_at).format('MM-DD HH:mm')}
                </Text>
              </div>
            )}
            
            {backup.status === 'running' && (
              <Progress percent={50} status="active" size="small" />
            )}
            
            {backup.error_message && (
              <Alert
                message={backup.error_message}
                type="error"
                showIcon
                style={{ fontSize: 11, marginTop: 8 }}
                closable={false}
              />
            )}
          </Space>
        </div>
      </Card>
    );
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
      render: (_: any, record: DataBackup) => formatFileSize(record.file_size),
      width: 120,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      valueType: 'dateTime',
      sorter: true,
      search: false,
      width: 180,
    },
  ];

  /**
   * 详情列定义
   */
  const detailColumns = [
    {
      title: '备份名称',
      dataIndex: 'name',
    },
    {
      title: '备份类型',
      dataIndex: 'backup_type',
      render: (value: string) => getBackupTypeTag(value),
    },
    {
      title: '备份范围',
      dataIndex: 'backup_scope',
      render: (value: string) => getBackupScopeText(value),
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (value: string) => getStatusTag(value),
    },
    {
      title: '文件路径',
      dataIndex: 'file_path',
      render: (value: string) => value || '-',
    },
    {
      title: '文件大小',
      dataIndex: 'file_size',
      render: (value: number) => formatFileSize(value),
    },
    {
      title: '开始时间',
      dataIndex: 'started_at',
      valueType: 'dateTime',
    },
    {
      title: '完成时间',
      dataIndex: 'completed_at',
      valueType: 'dateTime',
    },
    {
      title: '错误信息',
      dataIndex: 'error_message',
      render: (value: string) => value || '-',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      valueType: 'dateTime',
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      valueType: 'dateTime',
    },
  ];

  return (
    <>
      <ListPageTemplate statCards={statCards}>
        <UniTable<DataBackup>
          actionRef={actionRef}
          columns={columns}
          request={async (params, sort, _filter, searchFormValues) => {
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
              // 获取当前页数据
              const response = await getBackups({
                page: current || 1,
                page_size: pageSize || 20,
                backup_type: backup_type as string | undefined,
                backup_scope: backup_scope as string | undefined,
                status: status as string | undefined,
              });
              
              // 同时获取所有数据用于统计（如果当前页是第一页，获取所有数据）
              if ((current || 1) === 1) {
                try {
                  const allResponse = await getBackups({
                    page: 1,
                    page_size: 1000,
                  });
                  setAllBackups(allResponse.items);
                } catch (e) {
                  // 忽略统计数据的错误
                }
              }
              
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
          showCreateButton
          onCreate={() => setCreateModalVisible(true)}
          viewTypes={['table', 'card']}
          defaultViewType="table"
          cardViewConfig={{
            renderCard,
          }}
        />
      </ListPageTemplate>

      {/* 创建备份 Modal */}
      <FormModalTemplate
        title="创建备份"
        open={createModalVisible}
        onClose={() => {
          setCreateModalVisible(false);
          formRef.resetFields();
        }}
        onFinish={handleCreate}
        isEdit={false}
        loading={false}
      >
        <ProFormText
          name="name"
          label="备份名称"
          rules={[{ required: true, message: '请输入备份名称' }]}
          placeholder="请输入备份名称"
        />
        <SafeProFormSelect
          name="backup_type"
          label="备份类型"
          rules={[{ required: true, message: '请选择备份类型' }]}
          options={[
            { label: '全量备份', value: 'full' },
            { label: '增量备份', value: 'incremental' },
          ]}
          placeholder="请选择备份类型"
        />
        <SafeProFormSelect
          name="backup_scope"
          label="备份范围"
          rules={[{ required: true, message: '请选择备份范围' }]}
          options={[
            ...(currentUser?.is_infra_admin ? [{ label: '全部 (系统级)', value: 'all' }] : []),
            { label: '组织 (租户级)', value: 'tenant' },
            { label: '表 (特定数据)', value: 'table' },
          ]}
          placeholder="请选择备份范围"
        />
      </FormModalTemplate>

      {/* 备份详情 Drawer */}
      <DetailDrawerTemplate<DataBackup>
        title="备份详情"
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setCurrentBackup(null);
        }}
        dataSource={currentBackup || {}}
        columns={detailColumns}
      />
    </>
  );
};

export default DataBackupsPage;
