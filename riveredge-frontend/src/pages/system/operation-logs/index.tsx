/**
 * 操作日志页面
 * 
 * 用于查看和管理系统操作日志。
 * 支持多维度查询、统计等功能。
 *
 * @author Luigi Lu
 * @date 2025-01-11
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Tag, Space, message, Button } from 'antd';
import { EyeOutlined, BarChartOutlined } from '@ant-design/icons';
import { UniTable } from '../../../components/uni-table';
import { ListPageTemplate, DetailDrawerTemplate, DRAWER_CONFIG } from '../../../components/layout-templates';
import {
  getOperationLogs,
  getOperationLogStats,
  getOperationLogByUuid,
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
  const actionRef = useRef<ActionType>(null);
  const [stats, setStats] = useState<OperationLogStats | null>(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
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
  const handleViewDetail = async (record: OperationLog) => {
    try {
      // 从 API 获取最新的日志详情
      const logDetail = await getOperationLogByUuid(record.uuid);
      setCurrentLog(logDetail);
      setDetailDrawerVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || '加载日志详情失败');
    }
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
   * 详情列定义
   */
  const detailColumns = [
    {
      title: 'UUID',
      dataIndex: 'uuid',
      render: (value: string) => value,
    },
    {
      title: '组织ID',
      dataIndex: 'tenant_id',
      render: (value: number) => value || '-',
    },
    {
      title: '用户ID',
      dataIndex: 'user_id',
      render: (value: number) => value || '-',
    },
    {
      title: '操作类型',
      dataIndex: 'operation_type',
      render: (value: string) => getOperationTypeTag(value),
    },
    {
      title: '操作模块',
      dataIndex: 'operation_module',
      render: (value: string) => value || '-',
    },
    {
      title: '操作对象类型',
      dataIndex: 'operation_object_type',
      render: (value: string) => value || '-',
    },
    {
      title: '操作对象ID',
      dataIndex: 'operation_object_id',
      render: (value: number) => value || '-',
    },
    {
      title: '操作对象UUID',
      dataIndex: 'operation_object_uuid',
      render: (value: string) => value || '-',
    },
    {
      title: '操作内容',
      dataIndex: 'operation_content',
      span: 2,
      render: (value: string) => (
        <div style={{ wordBreak: 'break-word' }}>
          {value || '-'}
        </div>
      ),
    },
    {
      title: 'IP地址',
      dataIndex: 'ip_address',
      render: (value: string) => value || '-',
    },
    {
      title: '用户代理',
      dataIndex: 'user_agent',
      span: 2,
      render: (value: string) => (
        <div style={{ wordBreak: 'break-word', maxHeight: '100px', overflow: 'auto' }}>
          {value || '-'}
        </div>
      ),
    },
    {
      title: '请求方法',
      dataIndex: 'request_method',
      render: (value: string) => value || '-',
    },
    {
      title: '请求路径',
      dataIndex: 'request_path',
      span: 2,
      render: (value: string) => (
        <div style={{ wordBreak: 'break-word' }}>
          {value || '-'}
        </div>
      ),
    },
    {
      title: '操作时间',
      dataIndex: 'created_at',
      render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm:ss'),
    },
  ];

  // 构建统计卡片数据
  const statCards = stats ? [
    {
      title: '总操作数',
      value: stats.total,
      valueStyle: { color: '#1890ff' },
    },
    {
      title: '按类型统计',
      value: (
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
      ),
    },
    {
      title: '按模块统计',
      value: (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
          {Object.entries(stats.by_module)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([module, count]) => (
              <Tag key={module}>
                {module}: {count}
              </Tag>
            ))}
          {Object.keys(stats.by_module).length > 5 && (
            <Tag>...</Tag>
          )}
        </div>
      ),
    },
  ] : [];

  /**
   * 表格列定义
   */
  const columns: ProColumns<OperationLog>[] = [
    {
      title: '操作类型',
      dataIndex: 'operation_type',
      key: 'operation_type',
      valueType: 'select',
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
      title: '操作对象类型',
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
      render: (value: string) => value || '-',
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
      valueType: 'select',
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
      render: (_: any, record: OperationLog) => dayjs(record.created_at).format('YYYY-MM-DD HH:mm:ss'),
      width: 180,
    },
  ];

  return (
    <>
      <ListPageTemplate statCards={statCards}>
        <UniTable<OperationLog>
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
            
            // 从 params 和 searchFormValues 中获取搜索参数
            const { current, pageSize } = params;
            const searchParams = searchFormValues || {};
            
            // 处理时间范围（从 searchParams 中获取）
            let start_time: string | undefined;
            let end_time: string | undefined;
            if (searchParams.created_at && Array.isArray(searchParams.created_at) && searchParams.created_at.length === 2) {
              start_time = dayjs(searchParams.created_at[0]).toISOString();
              end_time = dayjs(searchParams.created_at[1]).toISOString();
            }
            
            try {
              const response = await getOperationLogs({
                page: current || 1,
                page_size: pageSize || 20,
                operation_type: searchParams.operation_type as string | undefined,
                operation_module: searchParams.operation_module as string | undefined,
                operation_object_type: searchParams.operation_object_type as string | undefined,
                user_id: searchParams.user_id ? Number(searchParams.user_id) : undefined,
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
              messageApi.error(error.message || '加载操作日志列表失败');
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          rowKey="uuid"
          showAdvancedSearch={true}
          toolBarActions={[
            <Button key="refresh" onClick={() => {
              loadStats();
              actionRef.current?.reload();
            }}>
              <BarChartOutlined /> 刷新统计
            </Button>,
          ]}
          headerTitle="操作日志"
          onDetail={async (keys: React.Key[]) => {
            if (keys.length === 1) {
              const uuid = String(keys[0]);
              try {
                const logDetail = await getOperationLogByUuid(uuid);
                setCurrentLog(logDetail);
                setDetailDrawerVisible(true);
              } catch (error: any) {
                messageApi.error(error.message || '加载日志详情失败');
              }
            }
          }}
        />
      </ListPageTemplate>

      {/* 日志详情 Drawer */}
      <DetailDrawerTemplate<OperationLog>
        title="操作日志详情"
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setCurrentLog(null);
        }}
        width={DRAWER_CONFIG.LARGE_WIDTH}
        dataSource={currentLog || {}}
        columns={detailColumns}
      />
    </>
  );
};

export default OperationLogsPage;
