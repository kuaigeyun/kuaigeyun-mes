/**
 * 我的消息页面
 * 
 * 用于用户查看和管理自己的消息。
 * 支持消息列表、消息详情、标记已读等功能。
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
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
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '标记失败');
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
      messageApi.error(error.message || '获取消息详情失败');
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
            查看
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
                  messageApi.success('已标记为已读');
                  loadStats();
                  actionRef.current?.reload();
                } catch (error: any) {
                  messageApi.error(error.message || '标记失败');
                }
              }}
            >
              标记已读
            </Button>
          ),
        ].filter(Boolean)}
      >
        <Card.Meta
          title={
            <Space>
              {isUnread && <Badge dot />}
              <Typography.Text strong={isUnread}>
                {message.subject || '(无主题)'}
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
                    actionRef.current?.reload();
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

  /**
   * 详情列定义
   */
  const detailColumns = [
    { title: '主题', dataIndex: 'subject' },
    { title: '内容', dataIndex: 'content', span: 2 },
    {
      title: '渠道',
      dataIndex: 'type',
      render: (value: string) => getChannelTag(value),
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (value: string) => getStatusTag(value),
    },
    { title: '发送时间', dataIndex: 'sent_at', valueType: 'dateTime' },
    { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime' },
    {
      title: '错误信息',
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
                  title: '总消息数',
                  value: stats.total,
                  valueStyle: { color: '#1890ff' },
                },
                {
                  title: '未读消息',
                  value: stats.unread,
                  valueStyle: { color: '#ff4d4f' },
                },
                {
                  title: '已读消息',
                  value: stats.read,
                  valueStyle: { color: '#52c41a' },
                },
                {
                  title: '失败消息',
                  value: stats.failed,
                  valueStyle: { color: '#faad14' },
                },
              ]
            : undefined
        }
      >
        <UniTable<UserMessage>
          headerTitle="我的消息"
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
              messageApi.error(error?.message || '获取消息列表失败');
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
                messageApi.warning('暂无数据可导出');
                return;
              }
              const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `my-messages-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
              messageApi.success(`已导出 ${items.length} 条记录`);
            } catch (error: any) {
              messageApi.error(error?.message || '导出失败');
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
              标记已读
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
        title="消息详情"
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

