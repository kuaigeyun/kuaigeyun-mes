/** 变更类别枚举 → 中文（与后端 OrderChangeCategory 一致） */
export const ORDER_CHANGE_CATEGORY_LABELS: Record<string, string> = {
  QUANTITY: '数量',
  DELIVERY: '交期',
  PRICE: '价格',
  CANCEL: '取消',
  MIXED: '混合',
  OTHER: '其他',
};

export function formatOrderChangeCategory(value?: string | null): string {
  if (!value?.trim()) return '-';
  const key = value.trim().toUpperCase();
  return ORDER_CHANGE_CATEGORY_LABELS[key] ?? value;
}
