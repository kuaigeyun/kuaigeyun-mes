/**
 * 在线用户页面
 * 
 * 用于查看和管理系统在线用户。
 * 支持查看在线用户列表、统计、强制下线等功能。
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Card, Avatar, Tag, Space, message, Popconfirm, Button, Badge, Typography, Tooltip } from 'antd';
import { EyeOutlined, BarChartOutlined, LogoutOutlined, UserOutlined, ClockCircleOutlined, GlobalOutlined } from '@ant-design/icons';
import { UniTable } from '../../../components/uni-table';
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
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Text } = Typography;

/**
 * 获取用户状态
 */
const getUserStatus = (user: OnlineUser): { status: 'success' | 'warning' | 'default'; text: string } => {
  if (!user.last_activity_time) {
    return { status: 'default', text: '未知' };
  }
  
  const lastActivity = dayjs(user.last_activity_time);
  const now = dayjs();
  const minutesAgo = now.diff(lastActivity, 'minute');
  
  if (minutesAgo <= 5) {
    return { status: 'success', text: '活跃' };
  } else if (minutesAgo <= 15) {
    return { status: 'warning', text: '空闲' };
  } else {
    return { status: 'default', text: '离线' };
  }
};

/**
 * 获取在线时长
 */
const getOnlineDuration = (user: OnlineUser): string => {
  if (!user.login_time) {
    return '-';
  }
  
  const loginTime = dayjs(user.login_time);
  const now = dayjs();
  return dayjs.duration(now.diff(loginTime)).humanize();
};

/**
 * 获取最后活动时间显示
 */
const getLastActivityDisplay = (user: OnlineUser): string => {
  if (!user.last_activity_time) {
    return '-';
  }
  
  const lastActivity = dayjs(user.last_activity_time);
  const now = dayjs();
  const minutesAgo = now.diff(lastActivity, 'minute');
  
  if (minutesAgo < 1) {
    return '刚刚';
  } else if (minutesAgo < 60) {
    return `${minutesAgo} 分钟前`;
  } else {
    return lastActivity.format('YYYY-MM-DD HH:mm:ss');
  }
};

/**
 * 在线用户页面组件
 */
const OnlineUsersPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const { currentUser } = useGlobalStore();
  const actionRef = useRef<ActionType>(null);
  const [stats, setStats] = useState<OnlineUserStats | null>(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentUserInfo, setCurrentUserInfo] = useState<OnlineUser | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
   * 设置自动刷新（每30秒刷新一次）
   */
  useEffect(() => {
    if (currentUser) {
      refreshIntervalRef.current = setInterval(() => {
        loadStats();
        actionRef.current?.reload();
      }, 30000);
      
      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
      };
    }
  }, [currentUser, loadStats]);

  /**
   * 查看用户详情
   */
  const handleViewDetail = (record: OnlineUser) => {
    setCurrentUserInfo(record);
    setDetailDrawerVisible(true);
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
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '强制下线失败');
    }
  };

  /**
   * 构建统计卡片数据
   */
  const statCards = useMemo(() => {
    if (!stats) return undefined;
    
    return [
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
    ];
  }, [stats]);

  /**
   * 卡片渲染函数
   */
  const renderCard = (user: OnlineUser, index: number) => {
    const userStatus = getUserStatus(user);
    
    return (
      <Card
        key={user.user_id}
        hoverable
        style={{ height: '100%' }}
        actions={[
          <Tooltip key="view" title="查看详情">
            <EyeOutlined
              onClick={() => handleViewDetail(user)}
              style={{ fontSize: 16 }}
            />
          </Tooltip>,
          <Popconfirm
            key="logout"
            title="确定要强制该用户下线吗？"
            onConfirm={() => handleForceLogout(user)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="强制下线">
              <LogoutOutlined
                style={{ fontSize: 16, color: '#ff4d4f' }}
              />
            </Tooltip>
          </Popconfirm>,
        ]}
      >
        <div style={{ marginBottom: 16 }}>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar size={48} icon={<UserOutlined />} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text strong style={{ fontSize: 16 }}>
                    {user.username}
                  </Text>
                  <Badge
                    status={userStatus.status}
                    text={userStatus.text}
                  />
                </div>
                {user.full_name && (
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                    {user.full_name}
                  </Text>
                )}
              </div>
            </div>
          </Space>
        </div>
        
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            {user.email && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>邮箱：</Text>
                <Text style={{ fontSize: 12 }} ellipsis={{ tooltip: user.email }}>
                  {user.email}
                </Text>
              </div>
            )}
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                <GlobalOutlined /> IP：
              </Text>
              <Text style={{ fontSize: 12 }}>{user.login_ip || '-'}</Text>
            </div>
            
            {user.login_time && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  <ClockCircleOutlined /> 登录时间：
                </Text>
                <Text style={{ fontSize: 12 }}>
                  {dayjs(user.login_time).format('MM-DD HH:mm')}
                </Text>
              </div>
            )}
            
            {user.last_activity_time && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>最后活动：</Text>
                <Text style={{ fontSize: 12 }}>
                  {getLastActivityDisplay(user)}
                </Text>
              </div>
            )}
            
            {user.login_time && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>在线时长：</Text>
                <Text style={{ fontSize: 12 }}>
                  {getOnlineDuration(user)}
                </Text>
              </div>
            )}
          </Space>
        </div>
      </Card>
    );
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
  ];

  /**
   * 详情列定义
   */
  const detailColumns = [
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
      valueType: 'dateTime',
    },
    {
      title: '最后活动时间',
      dataIndex: 'last_activity_time',
      valueType: 'dateTime',
    },
  ];

  return (
    <>
      <ListPageTemplate statCards={statCards}>
        <UniTable<OnlineUser>
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
          showAdvancedSearch={true}
          toolBarActions={[
            <Button key="refresh" onClick={loadStats}>
              <BarChartOutlined /> 刷新统计
            </Button>,
          ]}
          headerTitle="在线用户"
          viewTypes={['table', 'card']}
          defaultViewType="table"
          cardViewConfig={{
            renderCard,
          }}
        />
      </ListPageTemplate>

      {/* 用户详情 Drawer */}
      <DetailDrawerTemplate<OnlineUser>
        title="在线用户详情"
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setCurrentUserInfo(null);
        }}
        width={DRAWER_CONFIG.LARGE_WIDTH}
        dataSource={currentUserInfo || {}}
        columns={detailColumns}
      />
    </>
  );
};

export default OnlineUsersPage;
