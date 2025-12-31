/**
 * 在线用户页面
 * 
 * 用于查看和管理系统在线用户。
 * 支持查看在线用户列表、统计、强制下线等功能。
 */

import React, { useState, useEffect } from 'react';
import { ProTable, ProColumns } from '@ant-design/pro-components';
import { App, Card, Tag, Space, message, Modal, Descriptions, Popconfirm, Button, Tabs } from 'antd';
import { EyeOutlined, BarChartOutlined, LogoutOutlined, AppstoreOutlined, UnorderedListOutlined } from '@ant-design/icons';
import CardView from './card-view';
import { ListPageTemplate, DetailDrawerTemplate, DRAWER_CONFIG } from '../../../components/layout-templates';
import {
  getOnlineUsers,
  getOnlineUserStats,
  forceLogout,
  OnlineUser,
  OnlineUserListResponse,
  OnlineUserStats,
} from '../../../services/onlineUser';
import { useGlobalStore } from '../../../stores';
import dayjs from 'dayjs';

/**
 * 在线用户页面组件
 */
const OnlineUsersPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const { currentUser } = useGlobalStore();
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [stats, setStats] = useState<OnlineUserStats | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [currentUserInfo, setCurrentUserInfo] = useState<OnlineUser | null>(null);

  /**
   * 加载统计信息
   */
  const loadStats = React.useCallback(async () => {
    // 检查 currentUser，确保在调用 API 前用户已登录
    if (!currentUser) {
      return;
    }
    
    try {
      const data = await getOnlineUserStats();
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
   * 查看用户详情
   */
  const handleViewDetail = (record: OnlineUser) => {
    setCurrentUserInfo(record);
    setDetailModalVisible(true);
  };

  /**
   * 强制用户下线
   */
  const handleForceLogout = async (record: OnlineUser) => {
    try {
      await forceLogout(record.user_id);
      messageApi.success('强制下线成功');
      // 刷新列表和统计
      loadStats();
      // 触发表格刷新（通过 key 或手动刷新）
      window.location.reload();
    } catch (error: any) {
      messageApi.error(error.message || '强制下线失败');
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<OnlineUser>[] = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      ellipsis: true,
      width: 150,
    },
    {
      title: '用户全名',
      dataIndex: 'full_name',
      key: 'full_name',
      ellipsis: true,
      search: false,
      width: 150,
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      ellipsis: true,
      search: false,
      width: 200,
    },
    {
      title: '登录IP',
      dataIndex: 'login_ip',
      key: 'login_ip',
      ellipsis: true,
      width: 120,
    },
    {
      title: '登录时间',
      dataIndex: 'login_time',
      key: 'login_time',
      valueType: 'dateTime',
      sorter: true,
      search: false,
      render: (_: any, record: OnlineUser) =>
        record.login_time ? dayjs(record.login_time).format('YYYY-MM-DD HH:mm:ss') : '-',
      width: 180,
    },
    {
      title: '最后活动时间',
      dataIndex: 'last_activity_time',
      key: 'last_activity_time',
      valueType: 'dateTime',
      sorter: true,
      search: false,
      render: (_: any, record: OnlineUser) =>
        record.last_activity_time ? dayjs(record.last_activity_time).format('YYYY-MM-DD HH:mm:ss') : '-',
      width: 180,
    },
    {
      title: '操作',
      key: 'action',
      hideInSearch: true,
      width: 150,
      render: (_: any, record: OnlineUser) => (
        <Space>
          <a onClick={() => handleViewDetail(record)}>
            <EyeOutlined /> 查看
          </a>
          <Popconfirm
            title="确定要强制该用户下线吗？"
            onConfirm={() => handleForceLogout(record)}
            okText="确定"
            cancelText="取消"
          >
            <a style={{ color: '#ff4d4f' }}>
              <LogoutOutlined /> 强制下线
            </a>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 构建统计卡片数据（仅用于列表视图）
  const statCards = stats ? [
    {
      title: '总在线用户数',
      value: stats.total,
      valueStyle: { color: '#1890ff' },
    },
    {
      title: '活跃用户数（最近5分钟）',
      value: stats.active,
      valueStyle: { color: '#52c41a' },
    },
    ...(Object.keys(stats.by_tenant).length > 0 ? [{
      title: '按组织统计',
      value: (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
          {Object.entries(stats.by_tenant).map(([tenantId, count]) => (
            <Tag key={tenantId} color="blue">
              组织 {tenantId}: {count}
            </Tag>
          ))}
        </div>
      ),
    }] : []),
  ] : undefined;

  return (
    <div style={{ padding: '16px' }}>
      {/* 视图切换 */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Tabs
          activeKey={viewMode}
          onChange={(key) => setViewMode(key as 'card' | 'list')}
          items={[
            { key: 'card', label: '卡片视图', icon: <AppstoreOutlined /> },
            { key: 'list', label: '列表视图', icon: <UnorderedListOutlined /> },
          ]}
        />
      </div>

      {/* 卡片视图 */}
      {viewMode === 'card' && <CardView />}

      {/* 列表视图 */}
      {viewMode === 'list' && (
        <ListPageTemplate statCards={statCards}>
          <Card>
            <ProTable<OnlineUser>
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
            
            try {
              const response = await getOnlineUsers();
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
              messageApi.error(error.message || '加载在线用户列表失败');
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          rowKey="user_id"
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
            <Button key="refresh" onClick={loadStats}>
              <BarChartOutlined /> 刷新统计
            </Button>,
          ]}
          headerTitle="在线用户"
        />
          </Card>
        </ListPageTemplate>
      )}

      {/* 用户详情 Drawer */}
      <DetailDrawerTemplate
        title="在线用户详情"
        open={detailModalVisible}
        onClose={() => {
          setDetailModalVisible(false);
          setCurrentUserInfo(null);
        }}
        width={DRAWER_CONFIG.LARGE_WIDTH}
        dataSource={currentUserInfo}
        columns={[
          {
            title: '用户ID',
            dataIndex: 'user_id',
            render: (value: number) => value,
          },
          {
            title: '用户名',
            dataIndex: 'username',
            render: (value: string) => value,
          },
          {
            title: '用户全名',
            dataIndex: 'full_name',
            render: (value: string) => value || '-',
          },
          {
            title: '邮箱',
            dataIndex: 'email',
            render: (value: string) => value || '-',
          },
          {
            title: '组织ID',
            dataIndex: 'tenant_id',
            render: (value: number) => value,
          },
          {
            title: '登录IP',
            dataIndex: 'login_ip',
            render: (value: string) => value || '-',
          },
          {
            title: '登录时间',
            dataIndex: 'login_time',
            render: (value: string) => value
              ? dayjs(value).format('YYYY-MM-DD HH:mm:ss')
              : '-',
          },
          {
            title: '最后活动时间',
            dataIndex: 'last_activity_time',
            render: (value: string) => value
              ? dayjs(value).format('YYYY-MM-DD HH:mm:ss')
              : '-',
          },
        ]}
      />
    </div>
  );
};

export default OnlineUsersPage;

