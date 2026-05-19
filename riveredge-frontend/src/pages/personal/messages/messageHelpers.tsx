import React from 'react';
import { Tag } from 'antd';
import type { TFunction } from 'i18next';
import type { UserMessage } from '../../../services/userMessage';

export function isUnreadMessage(message: UserMessage): boolean {
  return message.status === 'pending' || message.status === 'sending' || message.status === 'success';
}

export function getStatusTag(status: string, t: TFunction) {
  const statusMap: Record<string, { color: string; text: string }> = {
    pending: { color: 'default', text: t('pages.personal.messages.statusPending') },
    sending: { color: 'processing', text: t('pages.personal.messages.statusSending') },
    success: { color: 'processing', text: t('pages.personal.messages.statusSuccess') },
    read: { color: 'success', text: t('pages.personal.messages.statusRead') },
    failed: { color: 'error', text: t('pages.personal.messages.statusFailed') },
  };
  const statusInfo = statusMap[status] || { color: 'default', text: status };
  return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
}

export function getChannelTag(channel: string, t: TFunction) {
  const channelMap: Record<string, { color: string; text: string }> = {
    email: { color: 'blue', text: t('pages.personal.messages.channelEmail') },
    sms: { color: 'green', text: t('pages.personal.messages.channelSms') },
    internal: { color: 'purple', text: t('pages.personal.messages.channelInternal') },
    push: { color: 'orange', text: t('pages.personal.messages.channelPush') },
  };
  const channelInfo = channelMap[channel] || { color: 'default', text: channel };
  return <Tag color={channelInfo.color}>{channelInfo.text}</Tag>;
}

export function messageSnippet(content: string | undefined, maxLen = 120): string {
  const raw = (content || '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';
  return raw.length > maxLen ? `${raw.slice(0, maxLen)}…` : raw;
}
