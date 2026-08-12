/**
 * 售后服务列表展示：流程状态 solid；类型/方式/阶段等 filled。
 */
import { MarkerTag, StatusTag } from '../../../../../constants/statusBadges';

/** 售后工单 */
export const AFTER_SALES_TICKET_STATUS_COLOR: Record<string, string> = {
  待处理: 'processing',
  处理中: 'warning',
  待回访: 'orange',
  已关闭: 'success',
};

/** 安装执行 */
export const AFTER_SALES_INSTALL_STATUS_COLOR: Record<string, string> = {
  待派工: 'default',
  进行中: 'processing',
  待验收: 'warning',
  已关闭: 'success',
};

/** 维修单 */
export const AFTER_SALES_REPAIR_STATUS_COLOR: Record<string, string> = {
  待派工: 'default',
  维修中: 'processing',
  待验收: 'warning',
  已关闭: 'success',
};

/** 服务派工 */
export const AFTER_SALES_DISPATCH_STATUS_COLOR: Record<string, string> = {
  待接单: 'default',
  已接单: 'processing',
  到场: 'warning',
  完工: 'success',
  已取消: 'error',
};

/** 备件申领 / 服务结算（审核流） */
export const AFTER_SALES_REVIEW_STATUS_COLOR: Record<string, string> = {
  草稿: 'default',
  待审核: 'warning',
  已审核: 'success',
  已驳回: 'error',
};

/** 装机档案 */
export const AFTER_SALES_ASSET_STATUS_COLOR: Record<string, string> = {
  在用: 'success',
  停用: 'default',
  报废: 'error',
};

export function renderAfterSalesStatusTag(
  status?: string | null,
  colorMap: Record<string, string> = {},
) {
  const text = String(status ?? '').trim();
  if (!text) return '-';
  return <StatusTag color={colorMap[text] || 'default'}>{text}</StatusTag>;
}

export function renderAfterSalesTypeMarker(text?: string | null) {
  const value = String(text ?? '').trim();
  if (!value || value === '—' || value === '-') return value || '-';
  return <MarkerTag color="processing">{value}</MarkerTag>;
}
