/**
 * 我的消息 — Outlook 式主从布局（左侧列表 + 右侧详情）
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  App,
  Badge,
  Button,
  Empty,
  Input,
  Pagination,
  Segmented,
  Space,
  Spin,
  Typography,
  theme,
} from 'antd';
import {
  CheckOutlined,
  ClearOutlined,
  MailOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { ListPageTemplate } from '../../../components/layout-templates';
import { formatDateTime } from '../../../utils/format';
import {
  getUserMessages,
  getUserMessageStats,
  markMessagesRead,
  type UserMessage,
  type UserMessageStats,
} from '../../../services/userMessage';
import {
  getChannelTag,
  getStatusTag,
  isUnreadMessage,
  messageSnippet,
} from './messageHelpers';

const { Text, Title, Paragraph } = Typography;

type StatusFilter = 'all' | 'unread' | 'read' | 'failed';

const LIST_WIDTH = 380;

type FilterBadgeVariant = 'all' | 'unread' | 'read' | 'failed';

function filterSegmentBadgeStyle(
  variant: FilterBadgeVariant,
  token: ReturnType<typeof theme.useToken>['token'],
): { backgroundColor: string; color: string } {
  switch (variant) {
    case 'unread':
      return {
        backgroundColor: token.colorError,
        color: token.colorTextLightSolid,
      };
    case 'read':
      return {
        backgroundColor: token.colorSuccessBg,
        color: token.colorSuccess,
      };
    case 'failed':
      return {
        backgroundColor: token.colorWarningBg,
        color: token.colorWarning,
      };
    case 'all':
    default:
      return {
        backgroundColor: token.colorPrimaryBg,
        color: token.colorPrimary,
      };
  }
}

function filterSegmentLabel(
  text: string,
  count: number,
  variant: FilterBadgeVariant,
  token: ReturnType<typeof theme.useToken>['token'],
) {
  const badgeColors = filterSegmentBadgeStyle(variant, token);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {text}
      {count > 0 ? (
        <Badge
          count={count}
          size="small"
          overflowCount={999}
          styles={{
            indicator: {
              backgroundColor: badgeColors.backgroundColor,
              color: badgeColors.color,
              boxShadow: 'none',
              fontWeight: 600,
            },
          }}
        />
      ) : null}
    </span>
  );
}

function formatListTime(sentAt: string | undefined, createdAt: string | undefined, t: (key: string) => string): string {
  const ts = sentAt || createdAt;
  if (!ts) return '';
  const d = dayjs(ts);
  const now = dayjs();
  if (d.isSame(now, 'day')) return d.format('HH:mm');
  if (d.isSame(now.subtract(1, 'day'), 'day')) return `${t('pages.personal.messages.yesterday')} ${d.format('HH:mm')}`;
  if (d.isSame(now, 'year')) return d.format('MM-DD HH:mm');
  return d.format('YYYY-MM-DD');
}

function groupLabel(sentAt: string | undefined, createdAt: string | undefined, t: (key: string) => string): string {
  const ts = sentAt || createdAt;
  if (!ts) return '';
  const d = dayjs(ts);
  const now = dayjs();
  if (d.isSame(now, 'day')) return t('pages.personal.messages.today');
  if (d.isSame(now.subtract(1, 'day'), 'day')) return t('pages.personal.messages.yesterday');
  if (d.isSame(now, 'week')) return t('pages.personal.messages.thisWeek');
  if (d.isSame(now, 'month')) return t('pages.personal.messages.thisMonth');
  return d.format(t('pages.personal.messages.yearMonthFormat'));
}

const OutlookMessagesView: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = theme.useToken();

  /** 与自定义字段管理等双栏页一致，使用 colorBorder 而非更浅的 colorBorderSecondary */
  const paneBorderColor = token.colorBorder;

  /** 左栏 B 端分层：顶栏容器白底，列表区浅灰底，与右侧详情白底区分 */
  const leftPaneHeaderBg = token.colorBgContainer;
  const leftPaneListBg = token.colorFillAlter;
  const listItemActiveBg = token.colorBgContainer;
  const leftPaneGroupGlassStyle: React.CSSProperties = {
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 600,
    color: token.colorTextSecondary,
    position: 'sticky',
    top: 0,
    zIndex: 1,
    background: `color-mix(in srgb, ${leftPaneListBg} 55%, ${token.colorBgContainer})`,
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    borderBottom: `1px solid ${paneBorderColor}`,
  };

  const [stats, setStats] = useState<UserMessageStats | null>(null);
  const [messages, setMessages] = useState<UserMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [listLoading, setListLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchText, setSearchText] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');

  const [selectedUuid, setSelectedUuid] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<UserMessage | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const data = await getUserMessageStats();
      setStats(data);
    } catch (error: unknown) {
      messageApi.error((error as Error).message || t('pages.personal.messages.loadStatsFailed'));
    }
  }, [messageApi, t]);

  const statusParam = useMemo(() => {
    if (statusFilter === 'read') return 'read';
    if (statusFilter === 'failed') return 'failed';
    return undefined;
  }, [statusFilter]);

  const loadMessages = useCallback(async () => {
    setListLoading(true);
    try {
      const response = await getUserMessages({
        page,
        page_size: pageSize,
        status: statusParam,
        unread_only: statusFilter === 'unread' ? true : undefined,
      });
      let items = response.items || [];
      const kw = appliedKeyword.trim().toLowerCase();
      if (kw) {
        items = items.filter(
          (m) =>
            (m.subject || '').toLowerCase().includes(kw) ||
            (m.content || '').toLowerCase().includes(kw) ||
            (m.recipient || '').toLowerCase().includes(kw),
        );
      }
      setMessages(items);
      setTotal(kw ? items.length : response.total);
      if (selectedUuid && !items.some((m) => m.uuid === selectedUuid)) {
        setSelectedUuid(null);
        setSelectedMessage(null);
      }
    } catch (error: unknown) {
      messageApi.error((error as Error).message || t('pages.personal.messages.getListFailed'));
      setMessages([]);
      setTotal(0);
    } finally {
      setListLoading(false);
    }
  }, [appliedKeyword, messageApi, page, pageSize, selectedUuid, statusFilter, statusParam, t]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  const handleSelect = async (record: UserMessage) => {
    setSelectedUuid(record.uuid);
    setSelectedMessage(record);
    if (isUnreadMessage(record)) {
      try {
        await markMessagesRead({ message_uuids: [record.uuid] });
        setSelectedMessage({ ...record, status: 'read' });
        setMessages((prev) =>
          prev.map((m) => (m.uuid === record.uuid ? { ...m, status: 'read' } : m)),
        );
        void loadStats();
      } catch {
        /* 标记失败不影响查看 */
      }
    }
  };

  const handleMarkCurrentRead = async () => {
    if (!selectedMessage || !isUnreadMessage(selectedMessage)) return;
    try {
      await markMessagesRead({ message_uuids: [selectedMessage.uuid] });
      messageApi.success(t('pages.personal.messages.markedRead'));
      setSelectedMessage({ ...selectedMessage, status: 'read' });
      setMessages((prev) =>
        prev.map((m) => (m.uuid === selectedMessage.uuid ? { ...m, status: 'read' } : m)),
      );
      void loadStats();
    } catch (error: unknown) {
      messageApi.error((error as Error).message || t('pages.personal.messages.markFailed'));
    }
  };

  const handleMarkAllUnreadOnPage = async () => {
    const unreadIds = messages.filter(isUnreadMessage).map((m) => m.uuid);
    if (!unreadIds.length) {
      messageApi.warning(t('pages.personal.messages.selectToMark'));
      return;
    }
    try {
      await markMessagesRead({ message_uuids: unreadIds });
      messageApi.success(t('pages.personal.messages.markSuccess'));
      void loadStats();
      void loadMessages();
      if (selectedMessage && unreadIds.includes(selectedMessage.uuid)) {
        setSelectedMessage({ ...selectedMessage, status: 'read' });
      }
    } catch (error: unknown) {
      messageApi.error((error as Error).message || t('pages.personal.messages.markFailed'));
    }
  };

  const groupedMessages = useMemo(() => {
    const groups: { label: string; items: UserMessage[] }[] = [];
    const map = new Map<string, UserMessage[]>();
    for (const m of messages) {
      const label = groupLabel(m.sent_at, m.created_at, t) || t('common.dash');
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(m);
    }
    for (const [label, items] of map) {
      groups.push({ label, items });
    }
    return groups;
  }, [messages]);

  const statusSegmentOptions = useMemo(
    () => [
      {
        label: filterSegmentLabel(
          t('pages.personal.messages.filterAll'),
          stats?.total ?? 0,
          'all',
          token,
        ),
        value: 'all' as const,
      },
      {
        label: filterSegmentLabel(
          t('pages.personal.messages.filterUnread'),
          stats?.unread ?? 0,
          'unread',
          token,
        ),
        value: 'unread' as const,
      },
      {
        label: filterSegmentLabel(
          t('pages.personal.messages.filterRead'),
          stats?.read ?? 0,
          'read',
          token,
        ),
        value: 'read' as const,
      },
      {
        label: filterSegmentLabel(
          t('pages.personal.messages.filterFailed'),
          stats?.failed ?? 0,
          'failed',
          token,
        ),
        value: 'failed' as const,
      },
    ],
    [stats, t, token],
  );

  const paneStyle: React.CSSProperties = {
    display: 'flex',
    flex: 1,
    minHeight: 0,
    border: `1px solid ${paneBorderColor}`,
    borderRadius: token.borderRadiusLG,
    overflow: 'hidden',
    background: token.colorBgContainer,
    boxSizing: 'border-box',
  };

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
      }}
    >
    <ListPageTemplate fillMain>
      <div style={paneStyle}>
        {/* 左侧：消息列表 */}
        <div
          style={{
            width: LIST_WIDTH,
            minWidth: LIST_WIDTH,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            borderRight: `1px solid ${paneBorderColor}`,
            background: leftPaneListBg,
          }}
        >
          <div
            style={{
              padding: '12px 12px 8px',
              borderBottom: `1px solid ${paneBorderColor}`,
              background: leftPaneHeaderBg,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Input
                allowClear
                prefix={<SearchOutlined style={{ color: token.colorTextQuaternary }} />}
                placeholder={t('pages.personal.messages.searchPlaceholder')}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onClear={() => {
                  setSearchText('');
                  setAppliedKeyword('');
                  setPage(1);
                }}
                onPressEnter={() => {
                  setAppliedKeyword(searchText);
                  setPage(1);
                }}
                style={{ flex: 1, minWidth: 0 }}
              />
              <Button
                type="default"
                icon={<ReloadOutlined />}
                onClick={() => {
                  void loadStats();
                  void loadMessages();
                }}
                aria-label={t('pages.personal.messages.refresh')}
              />
              <Button
                type="default"
                icon={<ClearOutlined />}
                onClick={() => void handleMarkAllUnreadOnPage()}
              >
                {t('pages.personal.messages.markAllRead', { defaultValue: '全部已读' })}
              </Button>
            </div>
            <Segmented<StatusFilter>
              block
              value={statusFilter}
              onChange={(v) => {
                setStatusFilter(v);
                setPage(1);
              }}
              options={statusSegmentOptions}
            />
          </div>

          <div style={{ flex: 1, overflow: 'auto' }}>
            <Spin spinning={listLoading}>
              {messages.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={appliedKeyword ? t('pages.personal.messages.noMatch') : t('common.noMessages')}
                  style={{ marginTop: 48 }}
                />
              ) : (
                groupedMessages.map((group) => (
                  <div key={group.label}>
                    <div style={leftPaneGroupGlassStyle}>
                      {group.label}
                    </div>
                    {group.items.map((item) => {
                      const unread = isUnreadMessage(item);
                      const active = selectedUuid === item.uuid;
                      return (
                        <div
                          key={item.uuid}
                          role="button"
                          tabIndex={0}
                          onClick={() => void handleSelect(item)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') void handleSelect(item);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'stretch',
                            cursor: 'pointer',
                            borderBottom: `1px solid ${paneBorderColor}`,
                              background: active ? listItemActiveBg : 'transparent',
                              transition: 'background 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              if (!active) {
                                e.currentTarget.style.background = token.colorFillTertiary;
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!active) {
                                e.currentTarget.style.background = 'transparent';
                              }
                            }}
                          >
                          <div
                            style={{
                              width: 3,
                              flexShrink: 0,
                              background: active
                                ? token.colorPrimary
                                : unread
                                  ? token.colorTextSecondary
                                  : 'transparent',
                              opacity: active ? 1 : unread ? 0.45 : 0,
                            }}
                          />
                          <div style={{ flex: 1, minWidth: 0, padding: '10px 12px 10px 10px' }}>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                justifyContent: 'space-between',
                                gap: 8,
                                marginBottom: 4,
                              }}
                            >
                              <Text
                                ellipsis
                                style={{
                                  flex: 1,
                                  fontSize: 13,
                                  lineHeight: 1.35,
                                  fontWeight: unread ? 600 : 500,
                                  color: unread ? token.colorText : token.colorTextSecondary,
                                }}
                              >
                                {item.subject || t('common.noSubject')}
                              </Text>
                              <Text type="secondary" style={{ fontSize: 11, flexShrink: 0, whiteSpace: 'nowrap' }}>
                                {formatListTime(item.sent_at, item.created_at, t)}
                              </Text>
                            </div>
                            <Paragraph
                              type="secondary"
                              ellipsis={{ rows: 2 }}
                              style={{ marginBottom: 0, fontSize: 12, lineHeight: 1.4 }}
                            >
                              {messageSnippet(item.content)}
                            </Paragraph>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </Spin>
          </div>

          <div
            style={{
              padding: '8px 12px',
              borderTop: `1px solid ${paneBorderColor}`,
              background: leftPaneHeaderBg,
              display: 'flex',
              justifyContent: 'flex-end',
            }}
          >
            <Pagination
              size="small"
              simple
              current={page}
              pageSize={pageSize}
              total={total}
              showSizeChanger
              pageSizeOptions={[10, 20, 50]}
              onChange={(p, ps) => {
                setPage(p);
                setPageSize(ps);
              }}
            />
          </div>
        </div>

        {/* 右侧：消息详情 */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            background: token.colorBgContainer,
          }}
        >
          {!selectedMessage ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: token.colorTextQuaternary,
              }}
            >
              <MailOutlined style={{ fontSize: 48, marginBottom: 16 }} />
              <Text type="secondary">{t('pages.personal.messages.selectToView')}</Text>
            </div>
          ) : (
            <>
              <div
                style={{
                  padding: '16px',
                  borderBottom: `1px solid ${paneBorderColor}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <Title level={4} style={{ margin: 0, flex: 1 }}>
                    {selectedMessage.subject || t('common.noSubject')}
                  </Title>
                  {isUnreadMessage(selectedMessage) && (
                    <Button
                      type="primary"
                      size="small"
                      icon={<CheckOutlined />}
                      onClick={() => void handleMarkCurrentRead()}
                    >
                      {t('pages.personal.messages.markRead')}
                    </Button>
                  )}
                </div>
                <Space wrap size={[8, 4]} style={{ marginTop: 12 }}>
                  {getChannelTag(selectedMessage.type, t)}
                  {getStatusTag(selectedMessage.status, t)}
                  {selectedMessage.sent_at && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {t('pages.personal.messages.sentAt')}：
                      {formatDateTime(selectedMessage.sent_at, 'YYYY-MM-DD HH:mm:ss')}
                    </Text>
                  )}
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {t('pages.personal.messages.createdAt')}：
                    {formatDateTime(selectedMessage.created_at, 'YYYY-MM-DD HH:mm:ss')}
                  </Text>
                </Space>
              </div>
              <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
                <div
                  style={{
                    padding: 16,
                    borderRadius: token.borderRadius,
                    background: token.colorFillAlter,
                    border: `1px solid ${paneBorderColor}`,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    lineHeight: 1.65,
                    fontSize: 14,
                    color: token.colorText,
                  }}
                >
                  {selectedMessage.content}
                </div>
                {selectedMessage.error_message && (
                  <div
                    style={{
                      marginTop: 16,
                      padding: 12,
                      borderRadius: token.borderRadius,
                      background: token.colorErrorBg,
                      border: `1px solid ${token.colorErrorBorder}`,
                      color: token.colorErrorText,
                      fontSize: 13,
                    }}
                  >
                    <Text strong>{t('pages.personal.messages.errorInfo')}：</Text>
                    {selectedMessage.error_message}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </ListPageTemplate>
    </div>
  );
};

export default OutlookMessagesView;
