/**
 * 客户端渠道身份（与后端 core.utils.client_channel 对齐）
 *
 * 各端在请求头携带 X-Client-Channel，供登录日志「登录设备」与报工来源落库。
 */

export const CLIENT_CHANNEL_HEADER = 'X-Client-Channel';

export type ClientChannel =
  | 'pc'
  | 'station'
  | 'android'
  | 'ios'
  | 'mobile_h5'
  | 'miniprogram';

export type ReportingReportMode = 'self' | 'proxy' | 'team';

/** PC Web / 工位：由 Vite 注入，缺省为 pc */
export function resolveWebClientChannel(): ClientChannel {
  const fromEnv = String(import.meta.env.VITE_CLIENT_CHANNEL || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
  if (fromEnv === 'station') return 'station';
  if (fromEnv === 'pc') return 'pc';
  return 'pc';
}

export function webClientChannelHeaders(): Record<string, string> {
  return { [CLIENT_CHANNEL_HEADER]: resolveWebClientChannel() };
}

/** 报工来源口语聚合（与后端 REPORTING_CLIENT_CHANNEL_SOURCE_LABELS 一致） */
export function reportingClientChannelSourceKey(
  channel: string | null | undefined,
): 'miniprogram' | 'app' | 'station' | 'pc' | null {
  const code = String(channel ?? '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
  if (!code) return null;
  if (code === 'miniprogram' || code === 'wechat' || code === 'weixin' || code === 'mp') {
    return 'miniprogram';
  }
  if (code === 'station' || code === 'touch' || code === 'kiosk') return 'station';
  if (code === 'pc' || code === 'web' || code === 'desktop') return 'pc';
  if (
    code === 'android' ||
    code === 'ios' ||
    code === 'mobile_h5' ||
    code === 'mobile' ||
    code === 'h5'
  ) {
    return 'app';
  }
  return null;
}

/** 报工来源 i18n key（无码时返回 null，禁止猜） */
export function reportingClientChannelSourceI18nKey(
  channel: string | null | undefined,
): string | null {
  const sourceKey = reportingClientChannelSourceKey(channel);
  if (!sourceKey) return null;
  return `app.kuaizhizao.workReporting.clientChannel.${sourceKey}`;
}
