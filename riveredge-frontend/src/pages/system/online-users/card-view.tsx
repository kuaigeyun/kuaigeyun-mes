/**
 * 在线用户 - 卡片视图组件
 * 
 * 提供卡片布局的在线用户展示界面
 */

import React, { useState, useEffect, useRef } from 'react';
import { App, Card, Avatar, Tag, Space, Button, Modal, Descriptions, Popconfirm, Statistic, Row, Col, Badge, Typography, Empty, Tooltip } from 'antd';
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

/**
 * 卡片视图组件
 */
const CardView: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const { currentUser } = useGlobalStore();
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
        handleError(error, '加载在线用户列表失败');
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
        handleError(error, '加载统计信息失败');
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
      handleSuccess('强制下线成功');
      loadUsers();
      loadStats();
    } catch (error: any) {
      handleError(error, '强制下线失败');
    }
  };

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

  return (
    <>
      <PageContainer
        title="在线用户"
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
            刷新
          </Button>,
        ]}
      >
        {/* 统计卡片 */}
        {stats && (
          <Card style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col xs={24} sm={12} md={8}>
                <Statistic
                  title="总在线用户数"
                  value={stats.total}
                  prefix={<UserOutlined />}
                  styles={{ content: { color: '#1890ff' } }}
                />
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Statistic
                  title="活跃用户数（最近5分钟）"
                  value={stats.active}
                  prefix={<ClockCircleOutlined />}
                  styles={{ content: { color: '#52c41a' } }}
                />
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Statistic
                  title="组织数量"
                  value={Object.keys(stats.by_tenant).length}
                  prefix={<GlobalOutlined />}
                  styles={{ content: { color: '#faad14' } }}
                />
              </Col>
            </Row>
            {Object.keys(stats.by_tenant).length > 0 && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
                <Text type="secondary" style={{ marginRight: 8 }}>按组织统计：</Text>
                <Space wrap>
                  {Object.entries(stats.by_tenant).map(([tenantId, count]) => (
                    <Tag key={tenantId} color="blue">
                      组织 {tenantId}: {count} 人
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
                        <Tooltip title="查看详情">
                          <EyeOutlined
                            key="view"
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
                      
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
                        <Space direction="vertical" size="small" style={{ width: '100%' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>状态：</Text>
                            <Tag color={statusInfo.status === 'success' ? 'success' : statusInfo.status === 'warning' ? 'warning' : 'default'}>
                              {statusInfo.text}
                            </Tag>
                          </div>
                          
                          {user.login_time && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text type="secondary" style={{ fontSize: 12 }}>在线时长：</Text>
                              <Text style={{ fontSize: 12 }}>{getOnlineDuration(user)}</Text>
                            </div>
                          )}
                          
                          {user.last_activity_time && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text type="secondary" style={{ fontSize: 12 }}>最后活动：</Text>
                              <Text style={{ fontSize: 12 }}>{getLastActivityDisplay(user)}</Text>
                            </div>
                          )}
                          
                          {user.login_ip && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text type="secondary" style={{ fontSize: 12 }}>登录IP：</Text>
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
            <Empty description="暂无在线用户" />
          )}
        </Card>
      </PageContainer>

      {/* 用户详情 Modal */}
      <Modal
        title="在线用户详情"
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
            <Descriptions.Item label="用户ID">
              {currentUserInfo.user_id}
            </Descriptions.Item>
            <Descriptions.Item label="用户名">
              {currentUserInfo.username}
            </Descriptions.Item>
            <Descriptions.Item label="用户全名">
              {currentUserInfo.full_name || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="邮箱">
              {currentUserInfo.email || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="组织ID">
              {currentUserInfo.tenant_id}
            </Descriptions.Item>
            <Descriptions.Item label="登录IP">
              {currentUserInfo.login_ip || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="登录时间">
              {currentUserInfo.login_time
                ? dayjs(currentUserInfo.login_time).format('YYYY-MM-DD HH:mm:ss')
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="最后活动时间">
              {currentUserInfo.last_activity_time
                ? dayjs(currentUserInfo.last_activity_time).format('YYYY-MM-DD HH:mm:ss')
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="在线时长">
              {getOnlineDuration(currentUserInfo)}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={getUserStatus(currentUserInfo).status === 'success' ? 'success' : getUserStatus(currentUserInfo).status === 'warning' ? 'warning' : 'default'}>
                {getUserStatus(currentUserInfo).text}
              </Tag>
            </Descriptions.Item>
            {currentUserInfo.session_id && (
              <Descriptions.Item label="会话ID">
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

