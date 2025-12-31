/**
 * 登录日志页面
 * 
 * 用于查看和管理系统登录日志。
 * 支持多维度查询、统计等功能。
 */

import React, { useState, useEffect } from 'react';
import { ProTable, ProColumns } from '@ant-design/pro-components';
import { App, Card, Tag, Space, message, Modal, Descriptions, Statistic } from 'antd';
import { EyeOutlined, BarChartOutlined } from '@ant-design/icons';
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
  const [stats, setStats] = useState<LoginLogStats | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
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
    setDetailModalVisible(true);
  };

  /**
   * 登录状态标签
   */
  const getLoginStatusTag = (status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      success: { color: 'success', text: '成功' },
      failed: { color: 'error', text: '失败' },
    };
    const statusInfo = statusMap[status] || { color: 'default', text: status };
    return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<LoginLog>[] = [
    {
      title: '登录状态',
      dataIndex: 'login_status',
      key: 'login_status',
      valueEnum: {
        success: { text: '成功' },
        failed: { text: '失败' },
      },
      render: (_: any, record: LoginLog) => getLoginStatusTag(record.login_status),
      width: 100,
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      ellipsis: true,
      width: 120,
    },
    {
      title: '用户ID',
      dataIndex: 'user_id',
      key: 'user_id',
      valueType: 'digit',
      width: 100,
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
      valueEnum: {
        PC: { text: 'PC' },
        Mobile: { text: '移动设备' },
        Tablet: { text: '平板' },
      },
      width: 100,
    },
    {
      title: '登录浏览器',
      dataIndex: 'login_browser',
      key: 'login_browser',
      ellipsis: true,
      search: false,
      width: 200,
    },
    {
      title: '失败原因',
      dataIndex: 'failure_reason',
      key: 'failure_reason',
      ellipsis: true,
      search: false,
      width: 200,
      render: (_: any, record: LoginLog) => record.failure_reason || '-',
    },
    {
      title: '登录时间',
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
      render: (_: any, record: LoginLog) =>
        dayjs(record.created_at).format('YYYY-MM-DD HH:mm:ss'),
      width: 180,
    },
    {
      title: '操作',
      key: 'action',
      hideInSearch: true,
      width: 100,
      render: (_: any, record: LoginLog) => (
        <Space>
          <a onClick={() => handleViewDetail(record)}>
            <EyeOutlined /> 查看
          </a>
        </Space>
      ),
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
    {
      title: '按状态统计',
      value: (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
          {Object.entries(stats.by_status).map(([status, count]) => {
            const statusMap: Record<string, { color: string; text: string }> = {
              success: { color: 'success', text: '成功' },
              failed: { color: 'error', text: '失败' },
            };
            const statusInfo = statusMap[status] || { color: 'default', text: status };
            return (
              <Tag key={status} color={statusInfo.color}>
                {statusInfo.text}: {count}
              </Tag>
            );
          })}
        </div>
      ),
    },
  ] : undefined;

  return (
    <>
      <ListPageTemplate statCards={statCards}>
        <Card>
          <ProTable<LoginLog>
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
                  
                  const { current, pageSize, login_status, username, user_id, login_ip, created_at, ...rest } = params;
                  
                  // 处理时间范围
                  let start_time: string | undefined;
                  let end_time: string | undefined;
                  if (created_at && Array.isArray(created_at) && created_at.length === 2) {
                    start_time = dayjs(created_at[0]).toISOString();
                    end_time = dayjs(created_at[1]).toISOString();
                  }
                  
                  try {
                    const response = await getLoginLogs({
                      page: current || 1,
                      page_size: pageSize || 20,
                      login_status: login_status as string | undefined,
                      username: username as string | undefined,
                      user_id: user_id ? Number(user_id) : undefined,
                      login_ip: login_ip as string | undefined,
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
          headerTitle="登录日志"
        />
        </Card>
      </ListPageTemplate>

      {/* 日志详情 Drawer */}
      <DetailDrawerTemplate
        title="登录日志详情"
        open={detailModalVisible}
        onClose={() => {
          setDetailModalVisible(false);
          setCurrentLog(null);
        }}
        width={DRAWER_CONFIG.LARGE_WIDTH}
        dataSource={currentLog}
        columns={[
          {
            title: '登录状态',
            dataIndex: 'login_status',
            render: (value: string) => getLoginStatusTag(value),
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
            render: (value: string) => (
              <div style={{ wordBreak: 'break-word', maxHeight: '100px', overflow: 'auto' }}>
                {value || '-'}
              </div>
            ),
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
        ]}
      />
    </>
  );
};

export default LoginLogsPage;

