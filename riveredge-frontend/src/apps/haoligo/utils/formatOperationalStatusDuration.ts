import dayjs from 'dayjs';

/** 根据状态起始时间计算已持续时长（中文展示）。 */
export function formatOperationalStatusDuration(
  sinceIso: string | null | undefined,
  nowMs: number = Date.now(),
): string {
  if (!sinceIso?.trim()) return '';
  const since = dayjs(sinceIso);
  if (!since.isValid()) return '';
  const diffSec = Math.floor((nowMs - since.valueOf()) / 1000);
  if (diffSec < 0) return '';
  const days = Math.floor(diffSec / 86400);
  const hours = Math.floor((diffSec % 86400) / 3600);
  const minutes = Math.floor((diffSec % 3600) / 60);
  if (days > 0) return `${days}天${hours}小时`;
  if (hours > 0) return `${hours}小时${minutes}分钟`;
  if (minutes > 0) return `${minutes}分钟`;
  return '不足1分钟';
}

export const HAOLIGO_EQUIPMENT_SHUTDOWN_STATUS = 'shutdown';

export function isShutdownOperationalStatus(status: string | null | undefined): boolean {
  return (status || '').trim().toLowerCase() === HAOLIGO_EQUIPMENT_SHUTDOWN_STATUS;
}
