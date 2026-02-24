/**
 * 在线用户 - 卡片视图组件
 * 
 * 提供卡片布局的在线用户展示界面
 */

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { App, Card, Avatar, Tag, Space, Button, Modal, Descriptions, Popconfirm, Statistic, Row, Col, Badge, Typography, Empty, Tooltip, theme } from 'antd';
import { EyeOutlined, LogoutOutlined, ReloadOutlined, UserOutlined, ClockCircleOutlined, GlobalOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import {
  getOnlineUsers,
  getOnlineUserStats,
  forceLogout,
  OnlineUser,
  OnlineUserListResponse,
  OnlineUserStats,
} from '../../../services/onlineUser';
import { useGlobalStore } from '../../../stores';
// 注意：OnlineUser 接口中没有 avatar 字段，如果需要显示头像，需要从用户服务获取完整用户信息
import { handleError, handleSuccess } from '../../../utils/errorHandler';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Text, Paragraph } = Typography;
const { useToken } = theme;

/**
 * 卡片视图组件
 */
const CardView: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = useToken();
  const currentUser = useGlobalStore((s) => s.currentUser);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<OnlineUser[]>([]);
  const [stats, setStats] = useState<OnlineUserStats | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [currentUserInfo, setCurrentUserInfo] = useState<OnlineUser | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * 加载在线用户列表
   */
  const loadUsers = async () => {
    if (!currentUser) {
      return;
    }
    
    setLoading(true);
    try {
      const response: OnlineUserListResponse = await getOnlineUsers();
      setUsers(response.items);
    } catch (error: any) {
      if (error?.response?.status !== 401) {
        handleError(error, t('pages.system.onlineUsers.loadListFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * 加载统计信息
   */
  const loadStats = async () => {
    if (!currentUser) {
      return;
    }
    
    try {
      const data = await getOnlineUserStats();
      setStats(data);
    } catch (error: any) {
      if (error?.response?.status !== 401) {
        handleError(error, t('pages.system.onlineUsers.loadStatsFailed'));
      }
    }
  };

  /**
   * 初始化加载
   */
  useEffect(() => {
    if (currentUser) {
      loadUsers();
      loadStats();
    }
  }, [currentUser]);

  /**
   * 设置自动刷新
   */
  useEffect(() => {
    if (currentUser) {
      // 每30秒自动刷新一次
      refreshIntervalRef.current = setInterval(() => {
        loadUsers();
        loadStats();
      }, 30000);
      
      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
      };
    }
  }, [currentUser]);

  /**
   * 查看用户详情
   */
  const handleViewDetail = (user: OnlineUser) => {
    setCurrentUserInfo(user);
    setDetailModalVisible(true);
  };

  /**
   * 强制用户下线
   */
  const handleForceLogout = async (user: OnlineUser) => {
    try {
      await forceLogout(user.user_id);
      handleSuccess(t('pages.system.onlineUsers.forceLogoutSuccess'));
      loadUsers();
      loadStats();
    } catch (error: any) {
      handleError(error, t('pages.system.onlineUsers.forceLogoutFailed'));
    }
  };

  /**
   * 获取用户状态
   */
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
    if (!user.last_activity_time) return '-';
    const lastActivity = dayjs(user.last_activity_time);
    const now = dayjs();
    const minutesAgo = now.diff(lastActivity, 'minute');
    if (minutesAgo < 1) return t('pages.system.onlineUsers.justNow');
    if (minutesAgo < 60) return t('pages.system.onlineUsers.minutesAgo', { count: minutesAgo });
    return lastActivity.format('YYYY-MM-DD HH:mm:ss');
  };

  return (
    <>
      <PageContainer
        title={t('pages.system.onlineUsers.headerTitle')}
        extra={[
          <Button
            key="refresh"
            icon={<ReloadOutlined />}
            onClick={() => {
              loadUsers();
              loadStats();
            }}
            loading={loading}
          >
            {t('pages.system.onlineUsers.refresh')}
          </Button>,
        ]}
      >
        {/* 统计卡片 */}
        {stats && (
          <Card style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col xs={24} sm={12} md={8}>
                <Statistic
                  title={t('pages.system.onlineUsers.statTotal')}
                  value={stats.total}
                  prefix={<UserOutlined />}
                  styles={{ content: { color: '#1890ff' } }}
                />
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Statistic
                  title={t('pages.system.onlineUsers.statActive')}
                  value={stats.active}
                  prefix={<ClockCircleOutlined />}
                  styles={{ content: { color: '#52c41a' } }}
                />
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Statistic
                  title={t('pages.system.onlineUsers.statTenantCount')}
                  value={Object.keys(stats.by_tenant).length}
                  prefix={<GlobalOutlined />}
                  styles={{ content: { color: '#faad14' } }}
                />
              </Col>
            </Row>
            {Object.keys(stats.by_tenant).length > 0 && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${token.colorBorder}` }}>
                <Text type="secondary" style={{ marginRight: 8 }}>{t('pages.system.onlineUsers.statByTenantLabel')}：</Text>
                <Space wrap>
                  {Object.entries(stats.by_tenant).map(([tenantId, count]) => (
                    <Tag key={tenantId} color="blue">
                      {t('pages.system.onlineUsers.tenantCountLabel', { id: tenantId, count })}
                    </Tag>
                  ))}
                </Space>
              </div>
            )}
          </Card>
        )}

        {/* 用户卡片列表 */}
        <Card loading={loading}>
          {users.length > 0 ? (
            <Row gutter={[16, 16]}>
              {users.map((user) => {
                const statusInfo = getUserStatus(user);
                
                return (
                  <Col key={user.user_id} xs={24} sm={12} md={8} lg={6} xl={6}>
                    <Card
                      hoverable
                      style={{ height: '100%' }}
                      actions={[
                        <Tooltip title={t('pages.system.onlineUsers.viewDetail')}>
                          <EyeOutlined
                            key="view"
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
                      <div style={{ textAlign: 'center', marginBottom: 16 }}>
                        <Badge
                          dot
                          status={statusInfo.status}
                          offset={[-5, 5]}
                        >
                          <Avatar
                            size={64}
                            icon={<UserOutlined />}
                          >
                            {(user.full_name || user.username || '').charAt(0).toUpperCase()}
                          </Avatar>
                        </Badge>
                      </div>
                      
                      <div style={{ textAlign: 'center', marginBottom: 8 }}>
                        <Text strong style={{ fontSize: 16 }}>
                          {user.full_name || user.username}
                        </Text>
                      </div>
                      
                      <div style={{ textAlign: 'center', marginBottom: 8 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          @{user.username}
                        </Text>
                      </div>
                      
                      {user.email && (
                        <div style={{ textAlign: 'center', marginBottom: 8 }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {user.email}
                          </Text>
                        </div>
                      )}
                      
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${token.colorBorder}` }}>
                        <Space direction="vertical" size="small" style={{ width: '100%' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>{t('pages.system.onlineUsers.statusLabel')}：</Text>
                            <Tag color={statusInfo.status === 'success' ? 'success' : statusInfo.status === 'warning' ? 'warning' : 'default'}>
                              {statusInfo.text}
                            </Tag>
                          </div>
                          
                          {user.login_time && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text type="secondary" style={{ fontSize: 12 }}>{t('pages.system.onlineUsers.onlineDuration')}：</Text>
                              <Text style={{ fontSize: 12 }}>{getOnlineDuration(user)}</Text>
                            </div>
                          )}
                          
                          {user.last_activity_time && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text type="secondary" style={{ fontSize: 12 }}>{t('pages.system.onlineUsers.lastActivity')}：</Text>
                              <Text style={{ fontSize: 12 }}>{getLastActivityDisplay(user)}</Text>
                            </div>
                          )}
                          
                          {user.login_ip && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text type="secondary" style={{ fontSize: 12 }}>{t('pages.system.onlineUsers.loginIp')}：</Text>
                              <Text style={{ fontSize: 12 }}>{user.login_ip}</Text>
                            </div>
                          )}
                        </Space>
                      </div>
                    </Card>
                  </Col>
                );
              })}
            </Row>
          ) : (
            <Empty description={t('pages.system.onlineUsers.emptyOnlineUsers')} />
          )}
        </Card>
      </PageContainer>

      {/* 用户详情 Modal */}
      <Modal
        title={t('pages.system.onlineUsers.detailTitle')}
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setCurrentUserInfo(null);
        }}
        footer={null}
        size={800}
      >
        {currentUserInfo && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label={t('pages.system.onlineUsers.userId')}>
              {currentUserInfo.user_id}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.onlineUsers.username')}>
              {currentUserInfo.username}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.onlineUsers.fullName')}>
              {currentUserInfo.full_name || '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.onlineUsers.email')}>
              {currentUserInfo.email || '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.onlineUsers.tenantId')}>
              {currentUserInfo.tenant_id}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.onlineUsers.loginIp')}>
              {currentUserInfo.login_ip || '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.onlineUsers.loginTime')}>
              {currentUserInfo.login_time
                ? dayjs(currentUserInfo.login_time).format('YYYY-MM-DD HH:mm:ss')
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.onlineUsers.lastActivityTime')}>
              {currentUserInfo.last_activity_time
                ? dayjs(currentUserInfo.last_activity_time).format('YYYY-MM-DD HH:mm:ss')
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.onlineUsers.onlineDuration')}>
              {getOnlineDuration(currentUserInfo)}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.onlineUsers.statusLabel')}>
              <Tag color={getUserStatus(currentUserInfo).status === 'success' ? 'success' : getUserStatus(currentUserInfo).status === 'warning' ? 'warning' : 'default'}>
                {getUserStatus(currentUserInfo).text}
              </Tag>
            </Descriptions.Item>
            {currentUserInfo.session_id && (
              <Descriptions.Item label={t('pages.system.onlineUsers.sessionId')}>
                {currentUserInfo.session_id}
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </>
  );
};

export default CardView;

