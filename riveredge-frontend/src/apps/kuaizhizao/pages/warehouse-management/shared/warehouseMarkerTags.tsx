import React from 'react';
import type { TFunction } from 'i18next';
import { MarkerTag } from '../../../../../constants/statusBadges';
import type { InboundReceiptType } from '../inbound/inboundHubTypes';
import { inboundReceiptTypeLabel } from '../inbound/inboundHubTypes';
import type { OutboundIssueType } from '../outbound/outboundHubTypes';
import { getOutboundIssueTypeLabel } from '../outbound/outboundHubTypes';

const WAREHOUSE_REASON_TYPE_COLORS: Record<string, string> = {
  盘盈: 'success',
  盘亏: 'warning',
  调拨: 'processing',
  样品: 'geekblue',
  报废: 'error',
  其他: 'default',
};

const INBOUND_RECEIPT_TYPE_COLORS: Record<InboundReceiptType, string> = {
  purchase: 'blue',
  finished_goods: 'success',
  semi_finished_goods: 'cyan',
  production_return: 'warning',
  customer_material: 'geekblue',
  sales_return: 'orange',
  outsource_receipt: 'purple',
  outsource_material_return: 'volcano',
  outsource_product_return: 'magenta',
  other_inbound: 'gold',
  material_return: 'lime',
};

const OUTBOUND_ISSUE_TYPE_COLORS: Record<OutboundIssueType, string> = {
  production_picking: 'processing',
  sales_delivery: 'success',
  outsource_issue: 'warning',
  other_outbound: 'gold',
  material_borrow: 'geekblue',
};

export function resolveWarehouseReasonTypeTagColor(value: string): string {
  return WAREHOUSE_REASON_TYPE_COLORS[value] ?? 'default';
}

export function renderWarehouseReasonTypeMarkerTag(label: string, value?: string): React.ReactNode {
  const raw = (value ?? label ?? '').trim();
  if (!raw || label === '-') return '-';
  return <MarkerTag color={resolveWarehouseReasonTypeTagColor(raw)}>{label}</MarkerTag>;
}

export function renderInboundReceiptTypeMarkerTag(t: TFunction, type?: string): React.ReactNode {
  if (!type) return '-';
  const key = type as InboundReceiptType;
  return (
    <MarkerTag color={INBOUND_RECEIPT_TYPE_COLORS[key] ?? 'default'}>
      {inboundReceiptTypeLabel(t, key)}
    </MarkerTag>
  );
}

export function renderOutboundIssueTypeMarkerTag(t: TFunction, type?: string): React.ReactNode {
  if (!type) return '-';
  const key = type as OutboundIssueType;
  return (
    <MarkerTag color={OUTBOUND_ISSUE_TYPE_COLORS[key] ?? 'default'}>
      {getOutboundIssueTypeLabel(t, key)}
    </MarkerTag>
  );
}

export function inboundReceiptTypeMarkerValueEnum(
  t: TFunction,
): Record<string, { text: string; status: string }> {
  return Object.fromEntries(
    (Object.keys(INBOUND_RECEIPT_TYPE_COLORS) as InboundReceiptType[]).map((key) => [
      key,
      { text: inboundReceiptTypeLabel(t, key), status: INBOUND_RECEIPT_TYPE_COLORS[key] },
    ]),
  );
}

export function outboundIssueTypeMarkerValueEnum(
  t: TFunction,
): Record<string, { text: string; status: string }> {
  return Object.fromEntries(
    (Object.keys(OUTBOUND_ISSUE_TYPE_COLORS) as OutboundIssueType[]).map((key) => [
      key,
      { text: getOutboundIssueTypeLabel(t, key), status: OUTBOUND_ISSUE_TYPE_COLORS[key] },
    ]),
  );
}
