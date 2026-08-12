/**
 * 物流管理列表展示：状态 solid / 类型·归属·启用 filled；文案与颜色唯一入口。
 */
import type { TFunction } from 'i18next';
import { MarkerTag, StatusTag } from '../../../../../constants/statusBadges';

const FREIGHT_ORDER_STATUS_COLOR: Record<string, string> = {
  draft: 'default',
  scheduled: 'processing',
  shipped: 'blue',
  in_transit: 'cyan',
  arrived: 'orange',
  signed: 'success',
  cancelled: 'error',
};

const VEHICLE_STATUS_COLOR: Record<string, string> = {
  idle: 'success',
  in_transit: 'processing',
  maintenance: 'warning',
  disabled: 'default',
};

const REVIEW_STATUS_COLOR: Record<string, string> = {
  draft: 'default',
  pending: 'warning',
  approved: 'success',
  rejected: 'error',
};

export function freightOrderStatusLabel(t: TFunction, status?: string | null): string {
  const code = String(status ?? '').trim();
  if (!code) return '-';
  const key = `app.kuaizhizao.logistics.option.freightOrderStatus.${code}`;
  const label = t(key);
  return label === key ? code : label;
}

export function vehicleStatusLabel(t: TFunction, status?: string | null): string {
  const code = String(status ?? '').trim();
  if (!code) return '-';
  const camel =
    code === 'in_transit'
      ? 'inTransit'
      : code;
  const key = `app.kuaizhizao.logistics.option.vehicleStatus.${camel}`;
  const label = t(key);
  return label === key ? code : label;
}

export function freightBillReviewStatusLabel(t: TFunction, status?: string | null): string {
  const code = String(status ?? '').trim();
  if (!code) return '-';
  if (code === 'draft') return t('app.kuaizhizao.salesContract.statusDraft');
  if (code === 'pending') return t('reviewStatus.pending');
  if (code === 'approved') return t('reviewStatus.approved');
  if (code === 'rejected') return t('reviewStatus.rejected');
  return code;
}

export function renderFreightOrderStatusTag(t: TFunction, status?: string | null) {
  const code = String(status ?? '').trim();
  if (!code) return '-';
  return (
    <StatusTag color={FREIGHT_ORDER_STATUS_COLOR[code] || 'default'}>
      {freightOrderStatusLabel(t, code)}
    </StatusTag>
  );
}

export function renderVehicleStatusTag(t: TFunction, status?: string | null) {
  const code = String(status ?? '').trim();
  if (!code) return '-';
  return (
    <StatusTag color={VEHICLE_STATUS_COLOR[code] || 'default'}>
      {vehicleStatusLabel(t, code)}
    </StatusTag>
  );
}

export function renderFreightBillReviewStatusTag(t: TFunction, status?: string | null) {
  const code = String(status ?? '').trim();
  if (!code) return '-';
  return (
    <StatusTag color={REVIEW_STATUS_COLOR[code] || 'default'}>
      {freightBillReviewStatusLabel(t, code)}
    </StatusTag>
  );
}

export function renderLogisticsOwnershipTag(t: TFunction, ownership?: string | null) {
  const code = String(ownership ?? '').trim();
  const internal = code === 'internal';
  return (
    <MarkerTag color={internal ? 'processing' : 'purple'}>
      {internal
        ? t('app.kuaizhizao.logistics.option.ownership.internal')
        : t('app.kuaizhizao.logistics.option.ownership.external')}
    </MarkerTag>
  );
}

export function renderLogisticsEnabledTag(t: TFunction, isEnabled?: boolean | null) {
  return (
    <MarkerTag color={isEnabled ? 'success' : 'default'}>
      {isEnabled ? t('common.enabled') : t('common.disabled')}
    </MarkerTag>
  );
}

export function renderLogisticsCarrierTypeTag(t: TFunction, carrierType?: string | null) {
  const code = String(carrierType ?? '').trim();
  if (!code) return '-';
  const key = `app.kuaizhizao.logistics.option.carrierType.${code}`;
  const label = t(key);
  return <MarkerTag color="processing">{label === key ? code : label}</MarkerTag>;
}

export function renderLogisticsBusinessDirectionTag(t: TFunction, direction?: string | null) {
  const code = String(direction ?? '').trim();
  if (!code) return '-';
  const label =
    code === 'sales_outbound'
      ? t('app.kuaizhizao.logistics.option.direction.salesOutbound')
      : code === 'purchase_inbound'
        ? t('app.kuaizhizao.logistics.option.direction.purchaseInbound')
        : code;
  return <MarkerTag color="processing">{label}</MarkerTag>;
}
