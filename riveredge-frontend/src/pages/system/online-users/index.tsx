/**
 * 在线用户页面
 * 
 * 用于查看和管理系统在线用户。
 * 支持查看在线用户列表、统计、强制下线等功能。
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Card, Avatar, Tag, Space, message, Popconfirm, Button, Badge, Typography, Tooltip, theme } from 'antd';
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
const { useToken } = theme;

/**
 * 在线用户页面组件
 */
const OnlineUsersPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = useToken();
  const currentUser = useGlobalStore((s) => s.currentUser);
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
        messageApi.error(error.message || t('pages.system.onlineUsers.loadStatsFailed'));
      }
    }
  }, [currentUser, messageApi]);

  const getUserStatus = (user: OnlineUser): { status: 'success' | 'warning' | 'default'; text: string } => {
    if (!user.last_activity_time) {
      return { status: 'default', text: t('pages.system.onlineUsers.statusUnknown') };
    }
    const lastActivity = dayjs(user.last_activity_time);
    const now = dayjs();
    const minutesAgo = now.diff(lastActivity, 'minute');
    if (minutesAgo <= 5) return { status: 'success', text: t('pages.system.onlineUsers.statusActive') };
    if (minutesAgo <= 15) return { status: 'warning', text: t('pages.system.onlineUsers.statusIdle') };
    return { status: 'default', text: t('pages.system.onlineUsers.statusOffline') };
  };

  const getLastActivityDisplay = (user: OnlineUser): string => {
    if (!user.last_activity_time) return '-';
    const lastActivity = dayjs(user.last_activity_time);
    const now = dayjs();
    const minutesAgo = now.diff(lastActivity, 'minute');
    if (minutesAgo < 1) return t('pages.system.onlineUsers.justNow');
    if (minutesAgo < 60) return t('pages.system.onlineUsers.minutesAgo', { count: minutesAgo });
    return lastActivity.format('YYYY-MM-DD HH:mm:ss');
  };

  const getOnlineDuration = (user: OnlineUser): string => {
    if (!user.login_time) return '-';
    const loginTime = dayjs(user.login_time);
    const now = dayjs();
    return dayjs.duration(now.diff(loginTime)).humanize();
  };

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
      messageApi.success(t('pages.system.onlineUsers.forceLogoutSuccess'));
      // 刷新列表和统计
      loadStats();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.onlineUsers.forceLogoutFailed'));
    }
  };

  /**
   * 构建统计卡片数据
   */
  const statCards = useMemo(() => {
    if (!stats) return undefined;
    
    return [
      {
        title: t('pages.system.onlineUsers.statTotal'),
        value: stats.total,
        valueStyle: { color: '#1890ff' },
      },
      {
        title: t('pages.system.onlineUsers.statActive'),
        value: stats.active,
        valueStyle: { color: '#52c41a' },
      },
      ...(Object.keys(stats.by_tenant).length > 0 ? [{
        title: t('pages.system.onlineUsers.statByTenant'),
        value: (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
            {Object.entries(stats.by_tenant).map(([tenantId, count]) => (
              <Tag key={tenantId} color="blue">
                {t('pages.system.onlineUsers.tenantLabel', { id: tenantId })}: {count}
              </Tag>
            ))}
          </div>
        ),
      }] : []),
    ];
  }, [stats, t]);

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
          <Tooltip key="view" title={t('pages.system.onlineUsers.viewDetail')}>
            <EyeOutlined
              onClick={() => handleViewDetail(user)}
              style={{ fontSize: 16 }}
            />
          </Tooltip>,
          <Popconfirm
            key="logout"
            title={t('pages.system.onlineUsers.forceLogoutConfirm')}
            onConfirm={() => handleForceLogout(user)}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
          >
            <Tooltip title={t('pages.system.onlineUsers.forceLogout')}>
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
        
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${token.colorBorder}` }}>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            {user.email && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>{t('pages.system.onlineUsers.email')}：</Text>
                <Text style={{ fontSize: 12 }} ellipsis={{ tooltip: user.email }}>
                  {user.email}
                </Text>
              </div>
            )}
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                <GlobalOutlined /> {t('pages.system.onlineUsers.ip')}：
              </Text>
              <Text style={{ fontSize: 12 }}>{user.login_ip || '-'}</Text>
            </div>
            
            {user.login_time && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  <ClockCircleOutlined /> {t('pages.system.onlineUsers.loginTime')}：
                </Text>
                <Text style={{ fontSize: 12 }}>
                  {dayjs(user.login_time).format('MM-DD HH:mm')}
                </Text>
              </div>
            )}
            
            {user.last_activity_time && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>{t('pages.system.onlineUsers.lastActivity')}：</Text>
                <Text style={{ fontSize: 12 }}>
                  {getLastActivityDisplay(user)}
                </Text>
              </div>
            )}
            
            {user.login_time && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>{t('pages.system.onlineUsers.onlineDuration')}：</Text>
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
      title: t('pages.system.onlineUsers.username'),
      dataIndex: 'username',
      key: 'username',
      ellipsis: true,
      width: 150,
    },
    {
      title: t('pages.system.onlineUsers.fullName'),
      dataIndex: 'full_name',
      key: 'full_name',
      ellipsis: true,
      search: false,
      width: 150,
    },
    {
      title: t('pages.system.onlineUsers.email'),
      dataIndex: 'email',
      key: 'email',
      ellipsis: true,
      search: false,
      width: 200,
    },
    {
      title: t('pages.system.onlineUsers.loginIp'),
      dataIndex: 'login_ip',
      key: 'login_ip',
      ellipsis: true,
      width: 120,
    },
    {
      title: t('pages.system.onlineUsers.loginTime'),
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
      title: t('pages.system.onlineUsers.lastActivityTime'),
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
      title: t('pages.system.onlineUsers.userId'),
      dataIndex: 'user_id',
      render: (value: number) => value,
    },
    {
      title: t('pages.system.onlineUsers.username'),
      dataIndex: 'username',
      render: (value: string) => value,
    },
    {
      title: t('pages.system.onlineUsers.fullName'),
      dataIndex: 'full_name',
      render: (value: string) => value || '-',
    },
    {
      title: t('pages.system.onlineUsers.email'),
      dataIndex: 'email',
      render: (value: string) => value || '-',
    },
    {
      title: t('pages.system.onlineUsers.tenantId'),
      dataIndex: 'tenant_id',
      render: (value: number) => value,
    },
    {
      title: t('pages.system.onlineUsers.loginIp'),
      dataIndex: 'login_ip',
      render: (value: string) => value || '-',
    },
    {
      title: t('pages.system.onlineUsers.loginTime'),
      dataIndex: 'login_time',
      valueType: 'dateTime',
    },
    {
      title: t('pages.system.onlineUsers.lastActivityTime'),
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
              messageApi.error(error.message || t('pages.system.onlineUsers.loadListFailed'));
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          rowKey="user_id"
          showAdvancedSearch={true}
          showImportButton={false}
          showExportButton={true}
          onExport={async (type, keys, pageData) => {
            try {
              const res = await getOnlineUsers();
              let items = res.items || [];
              if (type === 'currentPage' && pageData?.length) {
                items = pageData;
              } else if (type === 'selected' && keys?.length) {
                items = items.filter((d) => keys.includes(d.user_id));
              }
              if (items.length === 0) {
                messageApi.warning(t('pages.system.onlineUsers.noDataExport'));
                return;
              }
              const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `online-users-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
              messageApi.success(t('pages.system.onlineUsers.exportSuccessCount', { count: items.length }));
            } catch (error: any) {
              messageApi.error(error?.message || t('pages.system.onlineUsers.exportFailed'));
            }
          }}
          toolBarRender={() => [
            <Button key="refresh" onClick={loadStats}>
              <BarChartOutlined /> {t('pages.system.onlineUsers.refreshStats')}
            </Button>,
          ]}
          headerTitle={t('pages.system.onlineUsers.headerTitle')}
          viewTypes={['table', 'help']}
          defaultViewType="table"
          cardViewConfig={{
            renderCard,
          }}
        />
      </ListPageTemplate>

      {/* 用户详情 Drawer */}
      <DetailDrawerTemplate<OnlineUser>
        title={t('pages.system.onlineUsers.detailTitle')}
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
