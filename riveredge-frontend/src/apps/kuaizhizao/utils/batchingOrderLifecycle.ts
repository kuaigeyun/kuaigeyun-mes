/**
 * 配料单生命周期：草稿→配料中→已完成→已取消
 */

const STATUS_TO_STAGE: Record<string, string> = {
  draft: '草稿',
  picking: '配料中',
  completed: '已完成',
  cancelled: '已取消',
};

export function getBatchingOrderStageName(status: string | undefined): string {
  if (!status) return '草稿';
  return STATUS_TO_STAGE[status] ?? status;
}
