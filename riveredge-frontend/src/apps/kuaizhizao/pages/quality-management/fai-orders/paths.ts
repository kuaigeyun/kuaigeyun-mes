export const FAI_BALLOON_LIST_PATH = '/apps/kuaizhizao/quality-management/fai-orders';

export function faiBalloonPath(orderId: number | string): string {
  return `${FAI_BALLOON_LIST_PATH}/${orderId}/balloon`;
}
