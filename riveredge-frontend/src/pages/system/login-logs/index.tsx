/**
 * 登录日志页面
 * 
 * 用于查看和管理系统登录日志。
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
  getLoginLogs,
  getLoginLogStats,
  LoginLog,
  LoginLogListResponse,
  LoginLogStats,
} from '../../../services/loginLog';
import { useGlobalStore } from '../../../stores';
import dayjs from 'dayjs';

/**
 * 登录日志页面组件
 */
const LoginLogsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const { currentUser } = useGlobalStore();
  const actionRef = useRef<ActionType>(null);
  const [stats, setStats] = useState<LoginLogStats | null>(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentLog, setCurrentLog] = useState<LoginLog | null>(null);

  /**
   * 加载统计信息
   */
  const loadStats = React.useCallback(async () => {
    // 检查 currentUser，确保在调用 API 前用户已登录
    if (!currentUser) {
      return;
    }
    
    try {
      const data = await getLoginLogStats();
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
  const handleViewDetail = (record: LoginLog) => {
    setCurrentLog(record);
    setDetailDrawerVisible(true);
  };

  /**
   * 登录状态标签
   */
  const getLoginStatusTag = (status: string) => {
    if (status === 'success') {
      return <Tag color="success">成功</Tag>;
    } else if (status === 'failed') {
      return <Tag color="error">失败</Tag>;
    } else {
      return <Tag>{status}</Tag>;
    }
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
      title: '用户名',
      dataIndex: 'username',
      render: (value: string) => value || '-',
    },
    {
      title: '用户ID',
      dataIndex: 'user_id',
      render: (value: number) => value || '-',
    },
    {
      title: '组织ID',
      dataIndex: 'tenant_id',
      render: (value: number) => value || '-',
    },
    {
      title: '登录IP',
      dataIndex: 'login_ip',
      render: (value: string) => value || '-',
    },
    {
      title: '登录地点',
      dataIndex: 'login_location',
      render: (value: string) => value || '-',
    },
    {
      title: '登录设备',
      dataIndex: 'login_device',
      render: (value: string) => value || '-',
    },
    {
      title: '登录浏览器',
      dataIndex: 'login_browser',
      render: (value: string) => value || '-',
    },
    {
      title: '登录状态',
      dataIndex: 'login_status',
      render: (value: string) => getLoginStatusTag(value),
    },
    {
      title: '失败原因',
      dataIndex: 'failure_reason',
      render: (value: string) => value || '-',
    },
    {
      title: '登录时间',
      dataIndex: 'created_at',
      render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm:ss'),
    },
  ];

  // 构建统计卡片数据
  const statCards = stats ? [
    {
      title: '总登录数',
      value: stats.total,
      valueStyle: { color: '#1890ff' },
    },
    {
      title: '成功登录',
      value: stats.success_count,
      valueStyle: { color: '#52c41a' },
    },
    {
      title: '失败登录',
      value: stats.failed_count,
      valueStyle: { color: '#ff4d4f' },
    },
  ] : [];

  /**
   * 表格列定义
   */
  const columns: ProColumns<LoginLog>[] = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      ellipsis: true,
      width: 150,
    },
    {
      title: '登录IP',
      dataIndex: 'login_ip',
      key: 'login_ip',
      ellipsis: true,
      width: 120,
    },
    {
      title: '登录地点',
      dataIndex: 'login_location',
      key: 'login_location',
      ellipsis: true,
      search: false,
      width: 150,
    },
    {
      title: '登录设备',
      dataIndex: 'login_device',
      key: 'login_device',
      ellipsis: true,
      search: false,
      width: 120,
    },
    {
      title: '登录浏览器',
      dataIndex: 'login_browser',
      key: 'login_browser',
      ellipsis: true,
      search: false,
      width: 150,
    },
    {
      title: '登录状态',
      dataIndex: 'login_status',
      key: 'login_status',
      valueType: 'select',
      valueEnum: {
        success: { text: '成功' },
        failed: { text: '失败' },
      },
      width: 100,
      render: (_: any, record: LoginLog) => getLoginStatusTag(record.login_status),
    },
    {
      title: '失败原因',
      dataIndex: 'failure_reason',
      key: 'failure_reason',
      ellipsis: true,
      search: false,
      width: 200,
      render: (value: string) => value || '-',
    },
    {
      title: '登录时间',
      dataIndex: 'created_at',
      key: 'created_at',
      valueType: 'dateTimeRange',
      sorter: true,
      render: (_: any, record: LoginLog) => dayjs(record.created_at).format('YYYY-MM-DD HH:mm:ss'),
      width: 180,
    },
  ];

  return (
    <>
      <ListPageTemplate statCards={statCards}>
        <UniTable<LoginLog>
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
              const response = await getLoginLogs({
                page: current || 1,
                page_size: pageSize || 20,
                login_status: searchParams.login_status as string | undefined,
                username: searchParams.username as string | undefined,
                user_id: searchParams.user_id ? Number(searchParams.user_id) : undefined,
                login_ip: searchParams.login_ip as string | undefined,
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
              messageApi.error(error.message || '加载登录日志列表失败');
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
          headerTitle="登录日志"
        />
      </ListPageTemplate>

      {/* 日志详情 Drawer */}
      <DetailDrawerTemplate<LoginLog>
        title="登录日志详情"
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

export default LoginLogsPage;
