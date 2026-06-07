/**
 * 将 ISO 8601 UTC 时间按指定时区格式化为 YYYY-MM-DD HH:mm（与悬浮迭代按钮一致）
 */
export function formatTimeInTimezone(isoUtc: string | undefined, timezone: string): string {
  if (!isoUtc || isoUtc === '暂无') return '-';
  try {
    const d = new Date(isoUtc);
    const parts = new Intl.DateTimeFormat('zh-CN', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(d);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
  } catch {
    return isoUtc;
  }
}
