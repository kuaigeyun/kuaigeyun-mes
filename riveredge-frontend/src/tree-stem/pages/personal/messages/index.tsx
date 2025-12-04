/**
 * 我的消息页面
 * 
 * 用于用户查看和管理自己的消息。
 * 支持消息列表、消息详情、标记已读等功能。
 */

import React, { useState, useEffect } from 'react';
import { ProTable, ProColumns } from '@ant-design/pro-components';
import { App, Card, Badge, Tag, Button, Space, message, Modal, Tabs } from 'antd';
import { BellOutlined, CheckOutlined, EyeOutlined, AppstoreOutlined, UnorderedListOutlined } from '@ant-design/icons';
import CardView from './card-view';
import {
  getUserMessages,
  getUserMessageStats,
  markMessagesRead,
  UserMessage,
  UserMessageListResponse,
  UserMessageStats,
} from '../../../services/userMessage';

/**
 * 我的消息页面组件
 */
const UserMessagesPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const [stats, setStats] = useState<UserMessageStats | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');

  /**
   * 加载消息统计
   */
  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await getUserMessageStats();
      setStats(data);
    } catch (error: any) {
      messageApi.error(error.message || '加载消息统计失败');
    }
  };

  /**
   * 标记选中消息为已读
   */
  const handleMarkRead = async () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning('请选择要标记的消息');
      return;
    }

    try {
      await markMessagesRead({
        message_uuids: selectedRowKeys as string[],
      });
      messageApi.success('标记成功');
      setSelectedRowKeys([]);
      // 重新加载数据
      loadStats();
    } catch (error: any) {
      messageApi.error(error.message || '标记失败');
    }
  };

  /**
   * 消息状态标签
   */
  const getStatusTag = (status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      pending: { color: 'default', text: '待发送' },
      sending: { color: 'processing', text: '发送中' },
      success: { color: 'processing', text: '已发送' },
      read: { color: 'success', text: '已读' },
      failed: { color: 'error', text: '失败' },
    };
    const statusInfo = statusMap[status] || { color: 'default', text: status };
    return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
  };

  /**
   * 消息渠道标签
   */
  const getChannelTag = (channel: string) => {
    const channelMap: Record<string, { color: string; text: string }> = {
      email: { color: 'blue', text: '邮件' },
      sms: { color: 'green', text: '短信' },
      internal: { color: 'purple', text: '站内信' },
      push: { color: 'orange', text: '推送' },
    };
    const channelInfo = channelMap[channel] || { color: 'default', text: channel };
    return <Tag color={channelInfo.color}>{channelInfo.text}</Tag>;
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<UserMessage>[] = [
    {
      title: '主题',
      dataIndex: 'subject',
      key: 'subject',
      ellipsis: true,
      render: (text: string, record: UserMessage) => {
        const isUnread = record.status === 'pending' || record.status === 'sending' || record.status === 'success';
        return (
          <Space>
            {isUnread && <Badge dot />}
            <span style={{ fontWeight: isUnread ? 'bold' : 'normal' }}>
              {text || '(无主题)'}
            </span>
          </Space>
        );
      },
    },
    {
      title: '内容',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '渠道',
      dataIndex: 'type',
      key: 'type',
      valueEnum: {
        email: { text: '邮件' },
        sms: { text: '短信' },
        internal: { text: '站内信' },
        push: { text: '推送' },
      },
      render: (_: any, record: UserMessage) => getChannelTag(record.type),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      valueEnum: {
        pending: { text: '待发送' },
        sending: { text: '发送中' },
        success: { text: '已发送' },
        read: { text: '已读' },
        failed: { text: '失败' },
      },
      render: (_: any, record: UserMessage) => getStatusTag(record.status),
    },
    {
      title: '发送时间',
      dataIndex: 'sent_at',
      key: 'sent_at',
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: '操作',
      key: 'action',
      hideInSearch: true,
      render: (_: any, record: UserMessage) => {
        const isUnread = record.status === 'pending' || record.status === 'sending' || record.status === 'success';
        return (
          <Space>
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => {
                Modal.info({
                  title: record.subject || '(无主题)',
                  width: 600,
                  content: (
                    <div>
                      <p><strong>渠道：</strong>{getChannelTag(record.type)}</p>
                      <p><strong>状态：</strong>{getStatusTag(record.status)}</p>
                      <p><strong>内容：</strong></p>
                      <div style={{ 
                        padding: '12px', 
                        background: '#f5f5f5', 
                        borderRadius: '4px',
                        whiteSpace: 'pre-wrap',
                      }}>
                        {record.content}
                      </div>
                      {record.error_message && (
                        <p style={{ color: 'red', marginTop: '12px' }}>
                          <strong>错误信息：</strong>{record.error_message}
                        </p>
                      )}
                    </div>
                  ),
                  onOk: async () => {
                    if (isUnread) {
                      try {
                        await markMessagesRead({
                          message_uuids: [record.uuid],
                        });
                        messageApi.success('已标记为已读');
                        loadStats();
                      } catch (error: any) {
                        messageApi.error(error.message || '标记失败');
                      }
                    }
                  },
                });
              }}
            >
              查看
            </Button>
            {isUnread && (
              <Button
                type="link"
                size="small"
                icon={<CheckOutlined />}
                onClick={async () => {
                  try {
                    await markMessagesRead({
                      message_uuids: [record.uuid],
                    });
                    messageApi.success('已标记为已读');
                    loadStats();
                  } catch (error: any) {
                    messageApi.error(error.message || '标记失败');
                  }
                }}
              >
                标记已读
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
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
        <>
          {/* 统计卡片 */}
          {stats && (
        <div style={{ marginBottom: '16px', display: 'flex', gap: '16px' }}>
          <Card style={{ flex: 1 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff' }}>
                {stats.total}
              </div>
              <div style={{ color: '#666', marginTop: '8px' }}>总消息数</div>
            </div>
          </Card>
          <Card style={{ flex: 1 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ff4d4f' }}>
                {stats.unread}
              </div>
              <div style={{ color: '#666', marginTop: '8px' }}>未读消息</div>
            </div>
          </Card>
          <Card style={{ flex: 1 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>
                {stats.read}
              </div>
              <div style={{ color: '#666', marginTop: '8px' }}>已读消息</div>
            </div>
          </Card>
          <Card style={{ flex: 1 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#faad14' }}>
                {stats.failed}
              </div>
              <div style={{ color: '#666', marginTop: '8px' }}>失败消息</div>
            </div>
          </Card>
        </div>
      )}

      {/* 消息列表 */}
      <Card>
        <ProTable<UserMessage>
          columns={columns}
          request={async (params, sorter, filter) => {
            const response = await getUserMessages({
              page: params.current || 1,
              page_size: params.pageSize || 20,
              status: params.status as string | undefined,
              channel: params.type as string | undefined,
            });
            return {
              data: response.items,
              success: true,
              total: response.total,
            };
          }}
          rowKey="uuid"
          search={{
            labelWidth: 'auto',
            defaultCollapsed: false,
          }}
          pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
          }}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          toolBarRender={() => [
            <Button
              key="markRead"
              type="primary"
              icon={<CheckOutlined />}
              onClick={handleMarkRead}
              disabled={selectedRowKeys.length === 0}
            >
              标记已读
            </Button>,
          ]}
          headerTitle="我的消息"
          />
        </Card>
        </>
      )}
      </div>
  );
};

export default UserMessagesPage;

