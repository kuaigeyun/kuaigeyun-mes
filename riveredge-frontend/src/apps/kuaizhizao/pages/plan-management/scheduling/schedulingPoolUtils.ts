/** 可视排产待排区：可排产工单状态（不含已完成/已取消） */
export const SCHEDULABLE_WORK_ORDER_STATUSES = ['draft', 'released', 'in_progress'] as const;

export type SchedulableWorkOrderStatus = (typeof SCHEDULABLE_WORK_ORDER_STATUSES)[number];

export type PoolStatusFilter = 'all' | SchedulableWorkOrderStatus;

export function isSchedulableWorkOrderStatus(status: unknown): status is SchedulableWorkOrderStatus {
  return SCHEDULABLE_WORK_ORDER_STATUSES.includes(String(status || '') as SchedulableWorkOrderStatus);
}

export function matchesPoolKeyword(
  row: { code?: string; name?: string; product_name?: string },
  keyword: string
): boolean {
  const k = keyword.trim().toLowerCase();
  if (!k) return true;
  return [row.code, row.name, row.product_name].some((v) => String(v || '').toLowerCase().includes(k));
}
