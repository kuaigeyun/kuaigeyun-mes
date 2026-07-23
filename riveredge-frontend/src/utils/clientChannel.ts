/**
 * 客户端渠道身份（与后端 core.utils.client_channel 对齐）
 *
 * 各端在请求头携带 X-Client-Channel，供登录日志「登录设备」落库。
 */

export const CLIENT_CHANNEL_HEADER = 'X-Client-Channel';

export type ClientChannel =
  | 'pc'
  | 'station'
  | 'android'
  | 'ios'
  | 'mobile_h5'
  | 'miniprogram';

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
