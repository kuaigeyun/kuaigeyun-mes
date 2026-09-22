import React from 'react';
import { Tag } from 'antd';
import type { TFunction } from 'i18next';
import type { UserMessage } from '../../../services/userMessage';

export function isUnreadMessage(message: UserMessage): boolean {
  return message.status === 'pending' || message.status === 'sending' || message.status === 'success';
}

/** 站内信是否属于审批类（与在线消息「审批」分类 / 个人消息审批箱一致） */
export function isApprovalUserMessage(message: UserMessage): boolean {
  const vars = message.variables || {};
  const category = String(vars.message_category || '').trim().toLowerCase();
  if (category === 'approval') {
    return true;
  }
  const action = String(vars.trigger_action || '').trim().toLowerCase();
  // 平台 pending + 好力 GO / 业务配置 submitted（提交待审）等
  if (
    action === 'pending' ||
    action === 'submitted' ||
    action === 'rejected' ||
    action === 'urge' ||
    action === 'cc' ||
    action === 'revoked'
  ) {
    return true;
  }
  const subject = String(message.subject || '').trim();
  if (
    /^待审批[:：]/.test(subject) ||
    subject.includes('待审批') ||
    subject.includes('待审核') ||
    /【[^】]*待审/.test(subject)
  ) {
    return true;
  }
  return false;
}

/** 会话标题是否像站内信主题（不应出现在「个人」私聊列表） */
export function looksLikeSystemNotifyTitle(title: string | null | undefined): boolean {
  const text = String(title || '').trim();
  if (!text) return false;
  // 【厂内维保单·已通过】WX… / 【待审批】…
  return /^【[^】]{1,40}】/.test(text);
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
