/**
 * 我的消息 - 卡片视图组件
 * 
 * 提供卡片布局的消息展示界面，按消息类型分组，支持消息详情抽屉和搜索功能
 */

import React, { useState, useEffect, useRef } from 'react';
import { App, Card, Tag, Space, Button, Drawer, Popconfirm, Statistic, Row, Col, Badge, Typography, Empty, Tooltip, Alert, Input, Collapse, Divider } from 'antd';
import { EyeOutlined, CheckOutlined, ReloadOutlined, BellOutlined, SearchOutlined, MailOutlined, MessageOutlined, NotificationOutlined, MobileOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import {
  getUserMessages,
  getUserMessageStats,
  getUserMessage,
  markMessagesRead,
  UserMessage,
  UserMessageListResponse,
  UserMessageStats,
} from '../../../services/userMessage';
import { handleError, handleSuccess } from '../../../utils/errorHandler';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Text, Paragraph } = Typography;
const { Search } = Input;
const { Panel } = Collapse;

/**
 * 卡片视图组件
 */
const CardView: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<UserMessage[]>([]);
  const [stats, setStats] = useState<UserMessageStats | null>(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentMessage, setCurrentMessage] = useState<UserMessage | null>(null);
  const [searchText, setSearchText] = useState<string>('');
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * 加载消息列表和统计
   */
  const loadMessages = async () => {
    setLoading(true);
    try {
      const [messagesResponse, statsData] = await Promise.all([
        getUserMessages({
          page: 1,
          page_size: 1000, // 加载所有消息
        }),
        getUserMessageStats(),
      ]);
      setMessages(messagesResponse.items);
      setStats(statsData);
    } catch (error: any) {
      handleError(error, '加载消息列表失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 初始化加载
   */
  useEffect(() => {
    loadMessages();
  }, []);

  /**
   * 设置自动刷新（每30秒刷新一次）
   */
  useEffect(() => {
    refreshIntervalRef.current = setInterval(() => {
      loadMessages();
    }, 30000);
    
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  /**
   * 查看消息详情
   */
  const handleViewDetail = async (message: UserMessage) => {
    try {
      const detail = await getUserMessage(message.uuid);
      setCurrentMessage(detail);
      setDetailDrawerVisible(true);
      
      // 如果是未读消息，自动标记为已读
      const isUnread = detail.status === 'pending' || detail.status === 'sending' || detail.status === 'success';
      if (isUnread) {
        try {
          await markMessagesRead({
            message_uuids: [detail.uuid],
          });
          loadMessages(); // 刷新列表和统计
        } catch (error: any) {
          // 标记失败不影响查看详情
          console.error('标记已读失败:', error);
        }
      }
    } catch (error: any) {
      handleError(error, '获取消息详情失败');
    }
  };

  /**
   * 标记消息为已读
   */
  const handleMarkRead = async (message: UserMessage) => {
    try {
      await markMessagesRead({
        message_uuids: [message.uuid],
      });
      handleSuccess('已标记为已读');
      loadMessages();
    } catch (error: any) {
      handleError(error, '标记失败');
    }
  };

  /**
   * 批量标记已读
   */
  const handleBatchMarkRead = async (messageUuids: string[]) => {
    if (messageUuids.length === 0) {
      messageApi.warning('请选择要标记的消息');
      return;
    }

    try {
      await markMessagesRead({
        message_uuids: messageUuids,
      });
      handleSuccess('标记成功');
      loadMessages();
    } catch (error: any) {
      handleError(error, '标记失败');
    }
  };

  /**
   * 获取消息渠道图标和颜色
   */
  const getChannelInfo = (channel: string): { color: string; text: string; icon: React.ReactNode } => {
    const channelMap: Record<string, { color: string; text: string; icon: React.ReactNode }> = {
      email: { 
        color: 'blue', 
        text: '邮件',
        icon: <MailOutlined />,
      },
      sms: { 
        color: 'green', 
        text: '短信',
        icon: <MobileOutlined />,
      },
      internal: { 
        color: 'purple', 
        text: '站内信',
        icon: <MessageOutlined />,
      },
      push: { 
        color: 'orange', 
        text: '推送',
        icon: <NotificationOutlined />,
      },
    };
    return channelMap[channel] || { color: 'default', text: channel, icon: <BellOutlined /> };
  };

  /**
   * 获取消息状态显示
   */
  const getStatusInfo = (status: string): { 
    status: 'success' | 'error' | 'processing' | 'default'; 
    text: string;
  } => {
    const statusMap: Record<string, { status: 'success' | 'error' | 'processing' | 'default'; text: string }> = {
      pending: { status: 'default', text: '待发送' },
      sending: { status: 'processing', text: '发送中' },
      success: { status: 'default', text: '已发送' },
      read: { status: 'success', text: '已读' },
      failed: { status: 'error', text: '失败' },
    };
    return statusMap[status] || { status: 'default', text: status };
  };

  /**
   * 判断消息是否未读
   */
  const isUnread = (message: UserMessage): boolean => {
    return message.status === 'pending' || message.status === 'sending' || message.status === 'success';
  };

  /**
   * 过滤消息（根据搜索文本）
   */
  const filteredMessages = messages.filter((message) => {
    if (!searchText) return true;
    const searchLower = searchText.toLowerCase();
    return (
      (message.subject || '').toLowerCase().includes(searchLower) ||
      (message.content || '').toLowerCase().includes(searchLower) ||
      (message.recipient || '').toLowerCase().includes(searchLower)
    );
  });

  /**
   * 按消息类型分组
   */
  const groupedByType = filteredMessages.reduce((acc, message) => {
    if (!acc[message.type]) {
      acc[message.type] = [];
    }
    acc[message.type].push(message);
    return acc;
  }, {} as Record<string, UserMessage[]>);

  /**
   * 类型顺序（用于排序）
   */
  const typeOrder = ['internal', 'email', 'sms', 'push'];

  return (
    <>
      <PageContainer
        title="我的消息"
        extra={[
          <Button
            key="refresh"
            icon={<ReloadOutlined />}
            onClick={loadMessages}
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
              <Col xs={24} sm={12} md={6}>
                <Statistic
                  title="总消息数"
                  value={stats.total}
                  prefix={<BellOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Statistic
                  title="未读消息"
                  value={stats.unread}
                  prefix={<BellOutlined />}
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Statistic
                  title="已读消息"
                  value={stats.read}
                  prefix={<CheckOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Statistic
                  title="失败消息"
                  value={stats.failed}
                  prefix={<BellOutlined />}
                  valueStyle={{ color: '#faad14' }}
                />
              </Col>
            </Row>
          </Card>
        )}

        {/* 搜索框 */}
        <Card style={{ marginBottom: 16 }}>
          <Search
            placeholder="搜索消息主题、内容或收件人"
            allowClear
            enterButton={<SearchOutlined />}
            size="large"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onSearch={(value) => setSearchText(value)}
          />
        </Card>

        {/* 按类型分组的消息卡片 */}
        <Card loading={loading}>
          {filteredMessages.length > 0 ? (
            <Collapse
              defaultActiveKey={typeOrder.filter((type) => groupedByType[type]?.length > 0)}
              style={{ background: 'transparent' }}
            >
              {typeOrder.map((type) => {
                const typeMessages = groupedByType[type] || [];
                if (typeMessages.length === 0) return null;
                
                const channelInfo = getChannelInfo(type);
                const typeStats = {
                  total: typeMessages.length,
                  unread: typeMessages.filter((m) => isUnread(m)).length,
                  read: typeMessages.filter((m) => m.status === 'read').length,
                };

                return (
                  <Panel
                    key={type}
                    header={
                      <Space>
                        <Tag color={channelInfo.color} icon={channelInfo.icon} style={{ margin: 0 }}>
                          {channelInfo.text}
                        </Tag>
                        <Text type="secondary">
                          {typeStats.total} 条消息
                        </Text>
                        <Divider orientation="vertical" />
                        <Badge count={typeStats.unread} showZero={false}>
                          <Text type="secondary">未读: {typeStats.unread}</Text>
                        </Badge>
                        <Badge status="success" text={`已读: ${typeStats.read}`} />
                      </Space>
                    }
                    extra={
                      typeStats.unread > 0 && (
                        <Button
                          type="link"
                          size="small"
                          icon={<CheckOutlined />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleBatchMarkRead(typeMessages.filter((m) => isUnread(m)).map((m) => m.uuid));
                          }}
                        >
                          全部标记已读
                        </Button>
                      )
                    }
                  >
                    <Row gutter={[16, 16]}>
                      {typeMessages.map((message) => {
                        const unread = isUnread(message);
                        const statusInfo = getStatusInfo(message.status);
                        
                        return (
                          <Col key={message.uuid} xs={24} sm={12} md={8} lg={6} xl={6}>
                            <Card
                              hoverable
                              style={{ 
                                height: '100%',
                                border: unread ? '2px solid #1890ff' : '1px solid #d9d9d9',
                              }}
                              actions={[
                                <Tooltip title="查看详情">
                                  <EyeOutlined
                                    key="view"
                                    onClick={() => handleViewDetail(message)}
                                    style={{ fontSize: 16 }}
                                  />
                                </Tooltip>,
                                {unread && (
                                  <Tooltip title="标记已读">
                                    <CheckOutlined
                                      key="mark"
                                      onClick={() => handleMarkRead(message)}
                                      style={{ fontSize: 16, color: '#52c41a' }}
                                    />
                                  </Tooltip>
                                )},
                              ].filter(Boolean)}
                            >
                              <div style={{ marginBottom: 16 }}>
                                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text strong style={{ fontSize: 16, fontWeight: unread ? 'bold' : 'normal' }}>
                                      {message.subject || '(无主题)'}
                                    </Text>
                                    {unread && <Badge dot />}
                                  </div>
                                  
                                  <Paragraph
                                    ellipsis={{ rows: 2, expandable: false }}
                                    style={{ marginBottom: 0, fontSize: 12 }}
                                  >
                                    {message.content}
                                  </Paragraph>
                                </Space>
                              </div>
                              
                              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
                                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text type="secondary" style={{ fontSize: 12 }}>渠道：</Text>
                                    <Tag color={channelInfo.color} icon={channelInfo.icon}>
                                      {channelInfo.text}
                                    </Tag>
                                  </div>
                                  
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text type="secondary" style={{ fontSize: 12 }}>状态：</Text>
                                    <Badge
                                      status={statusInfo.status}
                                      text={statusInfo.text}
                                    />
                                  </div>
                                  
                                  {message.sent_at && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <Text type="secondary" style={{ fontSize: 12 }}>发送时间：</Text>
                                      <Text style={{ fontSize: 12 }}>
                                        {dayjs(message.sent_at).fromNow()}
                                      </Text>
                                    </div>
                                  )}
                                  
                                  {message.error_message && (
                                    <Alert
                                      message={message.error_message}
                                      type="error"
                                      showIcon
                                      style={{ fontSize: 11, marginTop: 8 }}
                                      closable={false}
                                    />
                                  )}
                                </Space>
                              </div>
                            </Card>
                          </Col>
                        );
                      })}
                    </Row>
                  </Panel>
                );
              })}
            </Collapse>
          ) : (
            <Empty description={searchText ? '没有找到匹配的消息' : '暂无消息'} />
          )}
        </Card>
      </PageContainer>

      {/* 消息详情抽屉 */}
      <Drawer
        title={currentMessage?.subject || '(无主题)'}
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setCurrentMessage(null);
        }}
        width={600}
      >
        {currentMessage && (
          <div>
            <Descriptions column={1} bordered>
              <Descriptions.Item label="消息主题">
                {currentMessage.subject || '(无主题)'}
              </Descriptions.Item>
              <Descriptions.Item label="消息渠道">
                <Tag color={getChannelInfo(currentMessage.type).color} icon={getChannelInfo(currentMessage.type).icon}>
                  {getChannelInfo(currentMessage.type).text}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="收件人">
                {currentMessage.recipient}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Badge
                  status={getStatusInfo(currentMessage.status).status}
                  text={getStatusInfo(currentMessage.status).text}
                />
              </Descriptions.Item>
              <Descriptions.Item label="消息内容">
                <div style={{ 
                  padding: '12px', 
                  background: '#f5f5f5', 
                  borderRadius: '4px',
                  whiteSpace: 'pre-wrap',
                }}>
                  {currentMessage.content}
                </div>
              </Descriptions.Item>
              {currentMessage.variables && Object.keys(currentMessage.variables).length > 0 && (
                <Descriptions.Item label="变量">
                  <pre style={{
                    margin: 0,
                    padding: '8px',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '4px',
                    overflow: 'auto',
                    maxHeight: '200px',
                    fontSize: 12,
                  }}>
                    {JSON.stringify(currentMessage.variables, null, 2)}
                  </pre>
                </Descriptions.Item>
              )}
              {currentMessage.error_message && (
                <Descriptions.Item label="错误信息">
                  <Alert
                    message={currentMessage.error_message}
                    type="error"
                    showIcon
                    style={{ fontSize: 12 }}
                  />
                </Descriptions.Item>
              )}
              {currentMessage.sent_at && (
                <Descriptions.Item label="发送时间">
                  {dayjs(currentMessage.sent_at).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="创建时间">
                {dayjs(currentMessage.created_at).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Drawer>
    </>
  );
};

export default CardView;

