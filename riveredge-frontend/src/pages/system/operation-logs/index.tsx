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
import { CODE_FONT_FAMILY } from '../../../constants/fonts';
import dayjs from 'dayjs';

/**
 * 操作日志页面组件
 */
const OperationLogsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const currentUser = useGlobalStore((s) => s.currentUser);
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
   * 格式化操作模块名称（使其更友好）
   */
  const formatModuleName = (module: string | undefined): string => {
    if (!module) return '-';
    // 将技术性路径转换为友好名称
    const moduleMap: Record<string, string> = {
      'apps/master-data': '基础数据',
      'apps/master-data/factory': '工厂管理',
      'apps/master-data/warehouse': '仓库管理',
      'apps/master-data/material': '物料管理',
      'apps/master-data/product': '产品管理',
      'apps/master-data/customer': '客户管理',
      'apps/master-data/supplier': '供应商管理',
      'apps/master-data/process': '工艺管理',
      'apps/master-data/performance': '绩效管理',
      'core': '系统管理',
      'infra': '平台管理',
    };
    return moduleMap[module] || module;
  };

  /**
   * 格式化操作内容（使其更友好）
   */
  const formatOperationContent = (content: string | undefined, objectType: string | undefined): string => {
    if (content) return content;
    if (!objectType) return '-';
    // 如果没有操作内容，根据对象类型生成友好描述
    return `${objectType}相关操作`;
  };

  /**
   * 获取用户显示名称
   */
  const getUserDisplayName = (record: OperationLog): string => {
    if (record.user_full_name) return record.user_full_name;
    if (record.username) return record.username;
    return `用户${record.user_id}`;
  };

  /**
   * 详情列定义（优化：突出有用信息，技术性字段放在后面）
   */
  const detailColumns = [
    {
      title: '操作时间',
      dataIndex: 'created_at',
      render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作类型',
      dataIndex: 'operation_type',
      render: (value: string) => getOperationTypeTag(value),
    },
    {
      title: '操作模块',
      dataIndex: 'operation_module',
      render: (value: string) => formatModuleName(value),
    },
    {
      title: '操作对象类型',
      dataIndex: 'operation_object_type',
      render: (value: string) => value || '-',
    },
    {
      title: '操作内容',
      dataIndex: 'operation_content',
      span: 2,
      render: (value: string, record: OperationLog) => (
        <div style={{ wordBreak: 'break-word' }}>
          {formatOperationContent(value, record.operation_object_type)}
        </div>
      ),
    },
    {
      title: '操作人',
      dataIndex: 'user_id',
      render: (_: any, record: OperationLog) => getUserDisplayName(record),
    },
    {
      title: 'IP地址',
      dataIndex: 'ip_address',
      render: (value: string) => value || '-',
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
        <div style={{ wordBreak: 'break-word', fontFamily: CODE_FONT_FAMILY, fontSize: '12px' }}>
          {value || '-'}
        </div>
      ),
    },
    {
      title: '用户代理',
      dataIndex: 'user_agent',
      span: 2,
      render: (value: string) => (
        <div style={{ wordBreak: 'break-word', maxHeight: '100px', overflow: 'auto', fontSize: '12px', color: '#666' }}>
          {value || '-'}
        </div>
      ),
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
                {formatModuleName(module)}: {count}
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
   * 表格列定义（优化：突出对用户有用的信息）
   */
  const columns: ProColumns<OperationLog>[] = [
    {
      title: '操作时间',
      dataIndex: 'created_at',
      key: 'created_at',
      valueType: 'dateTimeRange',
      sorter: true,
      render: (_: any, record: OperationLog) => dayjs(record.created_at).format('YYYY-MM-DD HH:mm:ss'),
      width: 180,
      fixed: 'left',
    },
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
      width: 120,
      render: (value: string) => formatModuleName(value),
    },
    {
      title: '操作对象',
      dataIndex: 'operation_object_type',
      key: 'operation_object_type',
      ellipsis: true,
      width: 120,
      render: (value: string) => value || '-',
    },
    {
      title: '操作内容',
      dataIndex: 'operation_content',
      key: 'operation_content',
      ellipsis: true,
      search: false,
      width: 250,
      render: (value: string, record: OperationLog) => 
        formatOperationContent(value, record.operation_object_type),
    },
    {
      title: '操作人',
      dataIndex: 'user_id',
      key: 'user_id',
      valueType: 'digit',
      width: 120,
      render: (_: any, record: OperationLog) => getUserDisplayName(record),
    },
    {
      title: 'IP地址',
      dataIndex: 'ip_address',
      key: 'ip_address',
      ellipsis: true,
      search: false,
      width: 120,
      hideInTable: true, // 默认隐藏，详情中可见
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
      hideInTable: true, // 默认隐藏，详情中可见
    },
    {
      title: '请求路径',
      dataIndex: 'request_path',
      key: 'request_path',
      ellipsis: true,
      search: false,
      width: 200,
      hideInTable: true, // 默认隐藏，详情中可见
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
          showImportButton={false}
          showExportButton={true}
          onExport={async (type, keys, pageData) => {
            try {
              const res = await getOperationLogs({ page: 1, page_size: 10000 });
              let items = res.items || [];
              if (type === 'currentPage' && pageData?.length) {
                items = pageData;
              } else if (type === 'selected' && keys?.length) {
                items = items.filter((d) => keys.includes(d.uuid));
              }
              if (items.length === 0) {
                messageApi.warning('暂无数据可导出');
                return;
              }
              const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `operation-logs-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
              messageApi.success(`已导出 ${items.length} 条记录`);
            } catch (error: any) {
              messageApi.error(error?.message || '导出失败');
            }
          }}
          toolBarRender={() => [
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
