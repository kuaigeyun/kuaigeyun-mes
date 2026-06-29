/**
 * 将 OCR 识别结果写入销售订单新建表单
 */

import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import type { RefObject } from 'react';
import type { MessageInstance } from 'antd/es/message/interface';
import type { ProFormInstance } from '@ant-design/pro-components';
import { coerceFormDate } from '../../../../../../utils/formDate';
import { normalizeUserDisplayName } from '../../../../../../utils/userDisplay';
import type { SalesOrderOcrResult } from '../../../../services/sales-order-ocr';
import {
  materialCodeOf,
  resolveSalesOrderOcrMasters,
  type CustomerLike,
  type MaterialLike,
} from './salesOrderOcrMasters';

export type { CustomerLike, MaterialLike };

type UserLike = {
  id: number;
  full_name?: string;
  username?: string;
};

export interface ApplySalesOrderOcrOptions {
  formRef: RefObject<ProFormInstance | undefined>;
  result: SalesOrderOcrResult;
  customers: CustomerLike[];
  materials: MaterialLike[];
  users: UserLike[];
  message: MessageInstance;
  t: (key: string, options?: Record<string, unknown>) => string;
  onCustomersChange?: (customers: CustomerLike[]) => void;
  onMaterialsChange?: (materials: MaterialLike[]) => void;
  /** 用户在确认弹窗中已新建的客户 */
  createdCustomer?: CustomerLike;
  /** 用户在确认弹窗中已新建的物料 */
  createdMaterialsByDedupeKey?: Map<string, MaterialLike>;
}

function parseOcrDate(value?: string | null): Dayjs | undefined {
  if (!value) return undefined;
  const d = coerceFormDate(value) ?? coerceFormDate(dayjs(value));
  return d ?? undefined;
}

export async function applySalesOrderOcrResult(options: ApplySalesOrderOcrOptions): Promise<boolean> {
  const {
    formRef,
    result,
    users,
    message,
    t,
    onCustomersChange,
    onMaterialsChange,
    createdCustomer,
    createdMaterialsByDedupeKey,
  } = options;

  let resolved;
  try {
    resolved = await resolveSalesOrderOcrMasters({
      result,
      customers: options.customers,
      materials: options.materials,
      createdCustomer,
      createdMaterialsByDedupeKey,
    });
  } catch (err: unknown) {
    const code = err instanceof Error ? err.message : '';
    if (code === 'CUSTOMER_CODE_RULE_REQUIRED') {
      message.error(t('app.kuaizhizao.salesOrder.aiCreate.customerCodeRuleRequired'));
      return false;
    }
    if (code === 'CUSTOMER_NAME_REQUIRED' || code === 'MATERIAL_NAME_REQUIRED') {
      message.error(t('app.kuaizhizao.salesOrder.aiCreate.recognizeFailed'));
      return false;
    }
    message.error(err instanceof Error ? err.message : t('app.kuaizhizao.salesOrder.aiCreate.recognizeFailed'));
    return false;
  }

  if (resolved.createdCustomerCount > 0 || resolved.createdMaterialCount > 0) {
    onCustomersChange?.(resolved.customers);
    onMaterialsChange?.(resolved.materials);
  }

  const patch: Record<string, unknown> = {};
  const customer = resolved.customer;

  if (customer) {
    patch.customer_id = customer.id;
    patch.customer_name = customer.name ?? customer.customer_name;
  } else if (result.customerName) {
    patch.customer_name = result.customerName;
    if (resolved.unresolvedCustomer) {
      message.warning(t('app.kuaizhizao.salesOrder.aiCreate.customerNotMatched'));
    }
  }

  if (result.customerContact) patch.customer_contact = result.customerContact;
  if (result.customerPhone) patch.customer_phone = result.customerPhone;
  if (result.shippingAddress) patch.shipping_address = result.shippingAddress;
  if (result.shippingMethod) patch.shipping_method = result.shippingMethod;
  if (result.paymentTerms) patch.payment_terms = result.paymentTerms;
  if (result.currencyCode) patch.currency_code = result.currencyCode;
  if (result.notes) patch.notes = result.notes;

  const orderDate = parseOcrDate(result.orderDate);
  if (orderDate) patch.order_date = orderDate;
  const headerDelivery = parseOcrDate(result.deliveryDate);

  if (customer) {
    const c = customer as Record<string, unknown>;
    const sIdRaw = c.salesmanId ?? c.salesman_id;
    const sId =
      sIdRaw != null && sIdRaw !== '' && Number.isFinite(Number(sIdRaw)) ? Number(sIdRaw) : undefined;
    const salesman = sId != null ? users.find((u) => Number(u.id) === sId) : undefined;
    const sName =
      (c.salesmanName as string | undefined) ??
      (c.salesman_name as string | undefined) ??
      (salesman ? normalizeUserDisplayName(salesman.full_name || salesman.username) : '');
    if (sId != null) patch.salesman_id = sId;
    if (sName) patch.salesman_name = normalizeUserDisplayName(sName);
    if (!result.shippingAddress) {
      const addr =
        (c.deliveryAddress as string | undefined) ??
        (c.delivery_address as string | undefined) ??
        (c.address as string | undefined) ??
        (c.shipping_address as string | undefined);
      if (addr) patch.shipping_address = addr;
    }
  }

  const items = (result.items ?? []).map((row, index) => {
    const matched = resolved.lineMaterials[index];
    const lineDelivery = parseOcrDate(row.deliveryDate) ?? headerDelivery ?? orderDate ?? dayjs();
    return {
      material_id: matched?.id,
      material_code: row.materialCode ?? (matched ? materialCodeOf(matched) : ''),
      material_name: row.materialName ?? matched?.name ?? '',
      material_spec: row.materialSpec ?? matched?.specification ?? '',
      material_unit: row.materialUnit ?? matched?.base_unit ?? matched?.baseUnit ?? '',
      required_quantity: Number(row.requiredQuantity) > 0 ? Number(row.requiredQuantity) : 1,
      unit_price: row.unitPrice != null ? Number(row.unitPrice) : 0,
      tax_rate: row.taxRate != null ? Number(row.taxRate) : 0,
      delivery_date: lineDelivery,
      variant_attributes: '',
      notes: row.notes ?? '',
    };
  });

  if (items.length > 0) {
    patch.items = items;
    if (headerDelivery) patch.delivery_date = headerDelivery;
  }

  formRef.current?.setFieldsValue(patch);

  if (resolved.createdCustomerCount > 0 || resolved.createdMaterialCount > 0) {
    message.success(
      t('app.kuaizhizao.salesOrder.aiCreate.applyWithCreated', {
        customer: resolved.createdCustomerCount,
        material: resolved.createdMaterialCount,
      }),
    );
  } else if (resolved.unresolvedMaterialCount > 0) {
    message.warning(t('app.kuaizhizao.salesOrder.aiCreate.materialNotMatched'));
    message.success(t('app.kuaizhizao.salesOrder.aiCreate.applySuccess'));
  } else {
    message.success(t('app.kuaizhizao.salesOrder.aiCreate.applySuccess'));
  }
  return true;
}
