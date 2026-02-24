/**
 * 我的消息页面
 * 
 * 用于用户查看和管理自己的消息。
 * 支持消息列表、消息详情、标记已读等功能。
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Badge, Tag, Button, Space, message, Card, Typography } from 'antd';
import { CheckOutlined, EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../components/uni-table';
import { ListPageTemplate, DetailDrawerTemplate, DRAWER_CONFIG } from '../../../components/layout-templates';
import { theme } from 'antd';
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
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token: themeToken } = theme.useToken();
  const actionRef = useRef<ActionType>(null);
  const [stats, setStats] = useState<UserMessageStats | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<UserMessage | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

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
      messageApi.error(error.message || t('pages.personal.messages.loadStatsFailed'));
    }
  };

  /**
   * 标记选中消息为已读
   */
  const handleMarkRead = async () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('pages.personal.messages.selectToMark'));
      return;
    }

    try {
      await markMessagesRead({
        message_uuids: selectedRowKeys as string[],
      });
      messageApi.success(t('pages.personal.messages.markSuccess'));
      setSelectedRowKeys([]);
      // 重新加载数据
      loadStats();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.personal.messages.markFailed'));
    }
  };

  /**
   * 处理查看详情
   */
  const handleView = async (record: UserMessage) => {
    try {
      setDetailLoading(true);
      setDrawerVisible(true);
      setDetailData(record);
      
      // 如果是未读消息，自动标记为已读
      const isUnread = record.status === 'pending' || record.status === 'sending' || record.status === 'success';
      if (isUnread) {
        try {
          await markMessagesRead({
            message_uuids: [record.uuid],
          });
          loadStats();
          actionRef.current?.reload();
        } catch (error: any) {
          // 标记失败不影响查看
        }
      }
    } catch (error: any) {
      messageApi.error(error.message || t('pages.personal.messages.getDetailFailed'));
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 渲染消息卡片
   */
  const renderMessageCard = (message: UserMessage, index: number) => {
    const isUnread = message.status === 'pending' || message.status === 'sending' || message.status === 'success';
    const statusInfo = getStatusTag(message.status);
    const channelInfo = getChannelTag(message.type);

    return (
      <Card
        key={message.uuid}
        hoverable
        style={{
          height: '100%',
          borderRadius: themeToken.borderRadiusLG,
          border: isUnread ? `2px solid ${themeToken.colorPrimary}` : undefined,
        }}
        actions={[
          <Button
            key="view"
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleView(message)}
          >
            {t('pages.personal.messages.view')}
          </Button>,
          isUnread && (
            <Button
              key="mark"
              type="link"
              icon={<CheckOutlined />}
              onClick={async () => {
                try {
                  await markMessagesRead({
                    message_uuids: [message.uuid],
                  });
                  messageApi.success(t('pages.personal.messages.markedRead'));
                  loadStats();
                  actionRef.current?.reload();
                } catch (error: any) {
                  messageApi.error(error.message || t('pages.personal.messages.markFailed'));
                }
              }}
            >
              {t('pages.personal.messages.markRead')}
            </Button>
          ),
        ].filter(Boolean)}
      >
        <Card.Meta
          title={
            <Space>
              {isUnread && <Badge dot />}
              <Typography.Text strong={isUnread}>
                {message.subject || t('common.noSubject')}
              </Typography.Text>
            </Space>
          }
          description={
            <div>
              <Typography.Paragraph
                ellipsis={{ rows: 2, expandable: false }}
                style={{ marginBottom: 8, fontSize: 12, color: themeToken.colorTextSecondary }}
              >
                {message.content}
              </Typography.Paragraph>
              <Space size="small" style={{ fontSize: 12 }}>
                {channelInfo}
                {statusInfo}
              </Space>
            </div>
          }
        />
      </Card>
    );
  };

  /**
   * 消息状态标签
   */
  const getStatusTag = (status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      pending: { color: 'default', text: t('pages.personal.messages.statusPending') },
      sending: { color: 'processing', text: t('pages.personal.messages.statusSending') },
      success: { color: 'processing', text: t('pages.personal.messages.statusSuccess') },
      read: { color: 'success', text: t('pages.personal.messages.statusRead') },
      failed: { color: 'error', text: t('pages.personal.messages.statusFailed') },
    };
    const statusInfo = statusMap[status] || { color: 'default', text: status };
    return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
  };

  /**
   * 消息渠道标签
   */
  const getChannelTag = (channel: string) => {
    const channelMap: Record<string, { color: string; text: string }> = {
      email: { color: 'blue', text: t('pages.personal.messages.channelEmail') },
      sms: { color: 'green', text: t('pages.personal.messages.channelSms') },
      internal: { color: 'purple', text: t('pages.personal.messages.channelInternal') },
      push: { color: 'orange', text: t('pages.personal.messages.channelPush') },
    };
    const channelInfo = channelMap[channel] || { color: 'default', text: channel };
    return <Tag color={channelInfo.color}>{channelInfo.text}</Tag>;
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<UserMessage>[] = [
    {
      title: t('pages.personal.messages.subject'),
      dataIndex: 'subject',
      key: 'subject',
      ellipsis: true,
      render: (text: string, record: UserMessage) => {
        const isUnread = record.status === 'pending' || record.status === 'sending' || record.status === 'success';
        return (
          <Space>
            {isUnread && <Badge dot />}
            <span style={{ fontWeight: isUnread ? 'bold' : 'normal' }}>
              {text || t('common.noSubject')}
            </span>
          </Space>
        );
      },
    },
    {
      title: t('pages.personal.messages.content'),
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('pages.personal.messages.channel'),
      dataIndex: 'type',
      key: 'type',
      valueEnum: {
        email: { text: t('pages.personal.messages.channelEmail') },
        sms: { text: t('pages.personal.messages.channelSms') },
        internal: { text: t('pages.personal.messages.channelInternal') },
        push: { text: t('pages.personal.messages.channelPush') },
      },
      render: (_: any, record: UserMessage) => getChannelTag(record.type),
    },
    {
      title: t('pages.personal.messages.status'),
      dataIndex: 'status',
      key: 'status',
      valueEnum: {
        pending: { text: t('pages.personal.messages.statusPending') },
        sending: { text: t('pages.personal.messages.statusSending') },
        success: { text: t('pages.personal.messages.statusSuccess') },
        read: { text: t('pages.personal.messages.statusRead') },
        failed: { text: t('pages.personal.messages.statusFailed') },
      },
      render: (_: any, record: UserMessage) => getStatusTag(record.status),
    },
    {
      title: t('pages.personal.messages.sentAt'),
      dataIndex: 'sent_at',
      key: 'sent_at',
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('pages.personal.messages.createdAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('pages.personal.messages.actions'),
      valueType: 'option',
      width: 200,
      fixed: 'right',
      render: (_: any, record: UserMessage) => {
        const isUnread = record.status === 'pending' || record.status === 'sending' || record.status === 'success';
        return (
          <Space>
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleView(record)}
            >
              {t('pages.personal.messages.view')}
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
                    messageApi.success(t('pages.personal.messages.markedRead'));
                    loadStats();
                    actionRef.current?.reload();
                  } catch (error: any) {
                    messageApi.error(error.message || t('pages.personal.messages.markFailed'));
                  }
                }}
              >
                {t('pages.personal.messages.markRead')}
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  /**
   * 详情列定义
   */
  const detailColumns = [
    { title: t('pages.personal.messages.subject'), dataIndex: 'subject' },
    { title: t('pages.personal.messages.content'), dataIndex: 'content', span: 2 },
    {
      title: t('pages.personal.messages.channel'),
      dataIndex: 'type',
      render: (value: string) => getChannelTag(value),
    },
    {
      title: t('pages.personal.messages.status'),
      dataIndex: 'status',
      render: (value: string) => getStatusTag(value),
    },
    { title: t('pages.personal.messages.sentAt'), dataIndex: 'sent_at', valueType: 'dateTime' },
    { title: t('pages.personal.messages.createdAt'), dataIndex: 'created_at', valueType: 'dateTime' },
    {
      title: t('pages.personal.messages.errorInfo'),
      dataIndex: 'error_message',
      span: 2,
      render: (value: string) => value ? (
        <Typography.Text type="danger">{value}</Typography.Text>
      ) : '-',
    },
  ];

  return (
    <>
      <ListPageTemplate
        statCards={
          stats
            ? [
                {
                  title: t('pages.personal.messages.totalMessages'),
                  value: stats.total,
                  valueStyle: { color: '#1890ff' },
                },
                {
                  title: t('pages.personal.messages.unreadMessages'),
                  value: stats.unread,
                  valueStyle: { color: '#ff4d4f' },
                },
                {
                  title: t('pages.personal.messages.readMessages'),
                  value: stats.read,
                  valueStyle: { color: '#52c41a' },
                },
                {
                  title: t('pages.personal.messages.failedMessages'),
                  value: stats.failed,
                  valueStyle: { color: '#faad14' },
                },
              ]
            : undefined
        }
      >
        <UniTable<UserMessage>
          headerTitle={t('pages.personal.messages.headerTitle')}
          actionRef={actionRef}
          columns={columns}
          request={async (params, sort, _filter, searchFormValues) => {
            try {
              const response = await getUserMessages({
                page: params.current || 1,
                page_size: params.pageSize || 20,
                status: searchFormValues?.status as string | undefined,
                channel: searchFormValues?.type as string | undefined,
              });
              return {
                data: response.items,
                success: true,
                total: response.total,
              };
            } catch (error: any) {
              messageApi.error(error?.message || t('pages.personal.messages.getListFailed'));
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          rowKey="uuid"
          showAdvancedSearch={true}
          enableRowSelection
          onRowSelectionChange={setSelectedRowKeys}
          showImportButton={false}
          showExportButton={true}
          onExport={async (type, keys, pageData) => {
            try {
              const res = await getUserMessages({ page: 1, page_size: 10000 });
              let items = res.items || [];
              if (type === 'currentPage' && pageData?.length) {
                items = pageData;
              } else if (type === 'selected' && keys?.length) {
                items = items.filter((d) => keys.includes(d.uuid));
              }
              if (items.length === 0) {
                messageApi.warning(t('common.exportNoData'));
                return;
              }
              const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `my-messages-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
              messageApi.success(t('common.exportSuccess', { count: items.length }));
            } catch (error: any) {
              messageApi.error(error?.message || t('common.updateFailed'));
            }
          }}
          pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
          }}
          toolBarRender={() => [
            <Button
              key="markRead"
              type="primary"
              icon={<CheckOutlined />}
              onClick={handleMarkRead}
              disabled={selectedRowKeys.length === 0}
            >
              {t('pages.personal.messages.markRead')}
            </Button>,
          ]}
          viewTypes={['table', 'help']}
          defaultViewType="table"
          cardViewConfig={{
            renderCard: renderMessageCard,
            columns: { xs: 1, sm: 2, md: 3, lg: 4, xl: 4 },
          }}
        />
      </ListPageTemplate>

      {/* 详情 Drawer */}
      <DetailDrawerTemplate<UserMessage>
        title={t('pages.personal.messages.detailTitle')}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        dataSource={detailData || {}}
        columns={detailColumns}
        column={1}
        customContent={
          detailData && (
            <div>
              <Typography.Paragraph
                style={{
                  padding: '12px',
                  background: '#f5f5f5',
                  borderRadius: '4px',
                  whiteSpace: 'pre-wrap',
                  marginBottom: 0,
                }}
              >
                {detailData.content}
              </Typography.Paragraph>
            </div>
          )
        }
      />
    </>
  );
};

export default UserMessagesPage;

