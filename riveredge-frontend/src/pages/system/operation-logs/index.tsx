/**
 * 操作日志页面
 * 
 * 用于查看和管理系统操作日志。
 * 支持多维度查询、统计等功能。
 */

import React, { useState, useEffect } from 'react';
import { ProTable, ProColumns } from '@ant-design/pro-components';
import { App, Card, Tag, Space, message, Modal, Descriptions } from 'antd';
import { EyeOutlined, BarChartOutlined } from '@ant-design/icons';
import {
  getOperationLogs,
  getOperationLogStats,
  OperationLog,
  OperationLogListResponse,
  OperationLogStats,
} from '../../../services/operationLog';
import { useGlobalStore } from '../../../stores';
import dayjs from 'dayjs';

/**
 * 操作日志页面组件
 */
const OperationLogsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const { currentUser } = useGlobalStore();
  const [stats, setStats] = useState<OperationLogStats | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [currentLog, setCurrentLog] = useState<OperationLog | null>(null);

  /**
   * 加载统计信息
   */
  const loadStats = React.useCallback(async () => {
    // 检查 currentUser，确保在调用 API 前用户已登录
    if (!currentUser) {
      return;
    }
    
    try {
      const data = await getOperationLogStats();
      setStats(data);
    } catch (error: any) {
      // 如果是 401 错误，不显示错误消息（可能是用户未登录）
      if (error?.response?.status !== 401) {
        messageApi.error(error.message || '加载统计信息失败');
      }
    }
  }, [currentUser, messageApi]);

  useEffect(() => {
    // 只有在用户已登录（currentUser 存在）时才加载统计数据
    if (currentUser) {
      loadStats();
    }
  }, [currentUser, loadStats]);

  /**
   * 查看日志详情
   */
  const handleViewDetail = (record: OperationLog) => {
    setCurrentLog(record);
    setDetailModalVisible(true);
  };

  /**
   * 操作类型标签
   */
  const getOperationTypeTag = (type: string) => {
    const typeMap: Record<string, { color: string; text: string }> = {
      create: { color: 'success', text: '创建' },
      update: { color: 'processing', text: '更新' },
      delete: { color: 'error', text: '删除' },
      view: { color: 'default', text: '查看' },
      error: { color: 'error', text: '错误' },
      unknown: { color: 'default', text: '未知' },
    };
    const typeInfo = typeMap[type] || { color: 'default', text: type };
    return <Tag color={typeInfo.color}>{typeInfo.text}</Tag>;
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<OperationLog>[] = [
    {
      title: '操作类型',
      dataIndex: 'operation_type',
      key: 'operation_type',
      valueEnum: {
        create: { text: '创建' },
        update: { text: '更新' },
        delete: { text: '删除' },
        view: { text: '查看' },
        error: { text: '错误' },
        unknown: { text: '未知' },
      },
      render: (_: any, record: OperationLog) => getOperationTypeTag(record.operation_type),
      width: 100,
    },
    {
      title: '操作模块',
      dataIndex: 'operation_module',
      key: 'operation_module',
      ellipsis: true,
      width: 150,
    },
    {
      title: '操作对象',
      dataIndex: 'operation_object_type',
      key: 'operation_object_type',
      ellipsis: true,
      width: 120,
    },
    {
      title: '操作内容',
      dataIndex: 'operation_content',
      key: 'operation_content',
      ellipsis: true,
      search: false,
      width: 200,
    },
    {
      title: '用户ID',
      dataIndex: 'user_id',
      key: 'user_id',
      valueType: 'digit',
      width: 100,
    },
    {
      title: 'IP地址',
      dataIndex: 'ip_address',
      key: 'ip_address',
      ellipsis: true,
      search: false,
      width: 120,
    },
    {
      title: '请求方法',
      dataIndex: 'request_method',
      key: 'request_method',
      valueEnum: {
        GET: { text: 'GET' },
        POST: { text: 'POST' },
        PUT: { text: 'PUT' },
        PATCH: { text: 'PATCH' },
        DELETE: { text: 'DELETE' },
      },
      width: 100,
    },
    {
      title: '请求路径',
      dataIndex: 'request_path',
      key: 'request_path',
      ellipsis: true,
      search: false,
      width: 200,
    },
    {
      title: '操作时间',
      dataIndex: 'created_at',
      key: 'created_at',
      valueType: 'dateTimeRange',
      sorter: true,
      search: {
        transform: (value: any) => {
          return {
            start_time: value[0],
            end_time: value[1],
          };
        },
      },
      render: (_: any, record: OperationLog) =>
        dayjs(record.created_at).format('YYYY-MM-DD HH:mm:ss'),
      width: 180,
    },
    {
      title: '操作',
      key: 'action',
      hideInSearch: true,
      width: 100,
      render: (_: any, record: OperationLog) => (
        <Space>
          <a onClick={() => handleViewDetail(record)}>
            <EyeOutlined /> 查看
          </a>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '16px' }}>
      {/* 统计卡片 */}
      {stats && (
        <div style={{ marginBottom: '16px', display: 'flex', gap: '16px' }}>
          <Card style={{ flex: 1 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff' }}>
                {stats.total}
              </div>
              <div style={{ color: '#666', marginTop: '8px' }}>总操作数</div>
            </div>
          </Card>
          <Card style={{ flex: 1 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#52c41a', marginBottom: '8px' }}>
                按类型统计
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                {Object.entries(stats.by_type).map(([type, count]) => {
                  const typeMap: Record<string, { color: string; text: string }> = {
                    create: { color: 'success', text: '创建' },
                    update: { color: 'processing', text: '更新' },
                    delete: { color: 'error', text: '删除' },
                    view: { color: 'default', text: '查看' },
                    error: { color: 'error', text: '错误' },
                    unknown: { color: 'default', text: '未知' },
                  };
                  const typeInfo = typeMap[type] || { color: 'default', text: type };
                  return (
                    <Tag key={type} color={typeInfo.color}>
                      {typeInfo.text}: {count}
                    </Tag>
                  );
                })}
              </div>
            </div>
          </Card>
          <Card style={{ flex: 1 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#faad14', marginBottom: '8px' }}>
                按模块统计
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                {Object.entries(stats.by_module).slice(0, 5).map(([module, count]) => (
                  <Tag key={module}>
                    {module}: {count}
                  </Tag>
                ))}
                {Object.keys(stats.by_module).length > 5 && (
                  <Tag>...</Tag>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* 操作日志列表 */}
      <Card>
        <ProTable<OperationLog>
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
            
            const { current, pageSize, operation_type, operation_module, operation_object_type, user_id, created_at, ...rest } = params;
            
            // 处理时间范围
            let start_time: string | undefined;
            let end_time: string | undefined;
            if (created_at && Array.isArray(created_at) && created_at.length === 2) {
              start_time = dayjs(created_at[0]).toISOString();
              end_time = dayjs(created_at[1]).toISOString();
            }
            
            try {
              const response = await getOperationLogs({
                page: current || 1,
                page_size: pageSize || 20,
                operation_type: operation_type as string | undefined,
                operation_module: operation_module as string | undefined,
                operation_object_type: operation_object_type as string | undefined,
                user_id: user_id ? Number(user_id) : undefined,
                start_time,
                end_time,
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
              throw error;
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
            <a key="stats" onClick={loadStats}>
              <BarChartOutlined /> 刷新统计
            </a>,
          ]}
          headerTitle="操作日志"
        />
      </Card>

      {/* 日志详情 Modal */}
      <Modal
        title="操作日志详情"
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setCurrentLog(null);
        }}
        footer={null}
        width={800}
      >
        {currentLog && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="操作类型">
              {getOperationTypeTag(currentLog.operation_type)}
            </Descriptions.Item>
            <Descriptions.Item label="操作模块">
              {currentLog.operation_module || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="操作对象类型">
              {currentLog.operation_object_type || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="操作对象ID">
              {currentLog.operation_object_id || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="操作对象UUID">
              {currentLog.operation_object_uuid || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="操作内容">
              {currentLog.operation_content || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="用户ID">
              {currentLog.user_id}
            </Descriptions.Item>
            <Descriptions.Item label="IP地址">
              {currentLog.ip_address || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="用户代理">
              <div style={{ wordBreak: 'break-word', maxHeight: '100px', overflow: 'auto' }}>
                {currentLog.user_agent || '-'}
              </div>
            </Descriptions.Item>
            <Descriptions.Item label="请求方法">
              {currentLog.request_method || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="请求路径">
              <div style={{ wordBreak: 'break-word' }}>
                {currentLog.request_path || '-'}
              </div>
            </Descriptions.Item>
            <Descriptions.Item label="操作时间">
              {dayjs(currentLog.created_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default OperationLogsPage;

