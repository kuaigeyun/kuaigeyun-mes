/**
 * 客户选中后回填销售单据头字段（逻辑与销售订单 onCustomerPick 一致，供报价单等同等级页面复用）。
 */
import type { ProFormInstance } from '@ant-design/pro-components';
import { formatUserDisplayLabel, normalizeUserDisplayName } from '../../../../../utils/userDisplay';

export type CustomerLike = Record<string, unknown>;

export type UserLike = { id: number | string; [key: string]: unknown };

export function resolveFullCustomerFromList(
  customer: CustomerLike,
  customerList: CustomerLike[],
): CustomerLike {
  const id = Number(customer.id ?? customer.customer_id);
  if (!Number.isFinite(id)) return customer;
  return customerList.find((x) => Number(x.id ?? x.customer_id) === id) ?? customer;
}

/** 从客户主数据解析需回填的表单字段 */
export function resolveCustomerFormFieldValues(
  customer: CustomerLike,
  users: UserLike[] = [],
): Record<string, unknown> {
  const sIdRaw = customer.salesmanId ?? customer.salesman_id;
  const sId =
    sIdRaw != null && sIdRaw !== '' && Number.isFinite(Number(sIdRaw)) ? Number(sIdRaw) : undefined;
  const salesman = sId != null ? users.find((u) => Number(u.id) === sId) : undefined;
  const sName =
    normalizeUserDisplayName(
      customer.salesmanName ??
      customer.salesman_name ??
      (salesman ? formatUserDisplayLabel(salesman) : ''),
    );
  return {
    customer_name: customer.name ?? customer.customer_name,
    customer_contact:
      customer.contactPerson ??
      customer.contact_person ??
      customer.contact ??
      customer.customer_contact,
    customer_phone: customer.phone ?? customer.customer_phone,
    salesman_id: sId,
    salesman_name: sName,
    shipping_address:
      customer.deliveryAddress ??
      customer.delivery_address ??
      customer.address ??
      customer.shipping_address ??
      '',
  };
}

const CLEAR_CUSTOMER_FORM_FIELDS: Record<string, undefined> = {
  customer_name: undefined,
  customer_contact: undefined,
  customer_phone: undefined,
  salesman_id: undefined,
  salesman_name: undefined,
  shipping_address: undefined,
};

export function applyCustomerFormFields(
  formRef: React.RefObject<ProFormInstance | undefined | null> | { current?: ProFormInstance | null },
  customer: CustomerLike | null,
  options: {
    users?: UserLike[];
    customerList?: CustomerLike[];
    includeCustomerId?: boolean;
  } = {},
): void {
  if (!customer) {
    formRef.current?.setFieldsValue({
      ...CLEAR_CUSTOMER_FORM_FIELDS,
      ...(options.includeCustomerId ? { customer_id: undefined } : {}),
    });
    return;
  }
  const full = options.customerList
    ? resolveFullCustomerFromList(customer, options.customerList)
    : customer;
  formRef.current?.setFieldsValue({
    ...(options.includeCustomerId ? { customer_id: full.id ?? full.customer_id } : {}),
    ...resolveCustomerFormFieldValues(full, options.users),
  });
}
