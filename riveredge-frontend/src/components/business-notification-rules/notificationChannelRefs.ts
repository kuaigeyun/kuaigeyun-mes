/** 规则预设/历史数据中的站内信占位 ID，与租户库内真实 message_config.uuid 可能不一致 */
export const BUILTIN_IN_APP_CHANNEL_UUID = '__builtin_internal_channel__';
export const IN_APP_CHANNEL_CODE = 'IN_APP_DEFAULT';

export type NotificationChannelOption = {
  value: string;
  label: string;
  code: string;
  type: string;
};

export function findInAppChannelOption(
  options: NotificationChannelOption[],
): NotificationChannelOption | undefined {
  return options.find(
    (o) =>
      o.value === BUILTIN_IN_APP_CHANNEL_UUID ||
      o.code === IN_APP_CHANNEL_CODE ||
      o.type === 'internal',
  );
}

/** 将占位符归一为下拉选项中的 value，避免 Select 显示原始 __builtin_* */
export function normalizeNotificationChannelRefs(
  refs: string[],
  options: NotificationChannelOption[],
): string[] {
  const inApp = findInAppChannelOption(options);
  const canonical = inApp?.value ?? BUILTIN_IN_APP_CHANNEL_UUID;
  const aliases = new Set([BUILTIN_IN_APP_CHANNEL_UUID, IN_APP_CHANNEL_CODE]);
  const normalized = refs.map((r) => (aliases.has(String(r)) ? canonical : String(r)));
  return [...new Set(normalized)];
}

export function getDefaultNotificationChannelRefs(options: NotificationChannelOption[]): string[] {
  const inApp = findInAppChannelOption(options);
  return [inApp?.value ?? BUILTIN_IN_APP_CHANNEL_UUID];
}
