/** 消息提醒：开单时由用户在单据上选择接收人（写入 recipient_scopes） */
export const USER_SPECIFIED_NOTIFICATION_SCOPE = 'user_specified';

export const USER_SPECIFIED_SCOPE_OPTION = {
  value: USER_SPECIFIED_NOTIFICATION_SCOPE,
  labelKey: 'pages.system.configCenter.notification.scope.user_specified',
  fallback: '开单用户指定',
} as const;
