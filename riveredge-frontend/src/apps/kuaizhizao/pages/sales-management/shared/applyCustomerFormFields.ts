/**
 * 客户选中后回填销售单据头字段（逻辑与销售订单 onCustomerPick 一致，供报价单等同等级页面复用）。
 */
import type { ProFormInstance } from '@ant-design/pro-components';
import { formatUserDisplayLabel, normalizeUserDisplayName } from '../../../../../utils/userDisplay';

export type CustomerLike = Record<string, unknown>;

export type UserLike = { id: number | string; [key: string]: unknown };

export type DictOption = { label: string; value: string };

export function resolveFullCustomerFromList(
  customer: CustomerLike,
  customerList: CustomerLike[],
): CustomerLike {
  const id = Number(customer.id ?? customer.customer_id);
  if (!Number.isFinite(id)) return customer;
  return customerList.find((x) => Number(x.id ?? x.customer_id) === id) ?? customer;
}

/**
 * 从客户资料解析付款条件字典码（PAYMENT_TERMS）。
 * 优先客户已有 payment_terms；否则用付款账期天数匹配 NET{天数} / 标签中的天数；
 * 结算方式为预付时尝试 PREPAID。无匹配则返回 undefined（留给手工选择）。
 */
export function resolvePaymentTermsFromCustomer(
  customer: CustomerLike,
  paymentTermsOptions: DictOption[] = [],
): string | undefined {
  const directRaw = customer.payment_terms ?? customer.paymentTerms;
  if (typeof directRaw === 'string' && directRaw.trim()) {
    const direct = directRaw.trim();
    if (!paymentTermsOptions.length) return direct;
    if (paymentTermsOptions.some((o) => o.value === direct)) return direct;
    const byLabel = paymentTermsOptions.find((o) => o.label === direct);
    if (byLabel) return byLabel.value;
  }

  const daysRaw = customer.paymentTermsDays ?? customer.payment_terms_days;
  if (daysRaw != null && daysRaw !== '') {
    const days = Number(daysRaw);
    if (Number.isFinite(days) && days >= 0) {
      if (days === 0) {
        if (!paymentTermsOptions.length) return 'PREPAID';
        const prepaid = paymentTermsOptions.find(
          (o) => o.value === 'PREPAID' || /预付|先款/.test(o.label),
        );
        if (prepaid) return prepaid.value;
      } else {
        const netCode = `NET${days}`;
        if (!paymentTermsOptions.length) {
          if (days === 30 || days === 60) return netCode;
        } else if (paymentTermsOptions.some((o) => o.value === netCode)) {
          return netCode;
        } else {
          const byLabelDays = paymentTermsOptions.find((o) => {
            const m = String(o.label).match(/(\d+)/);
            return m != null && Number(m[1]) === days;
          });
          if (byLabelDays) return byLabelDays.value;
          const byValueDigits = paymentTermsOptions.find(
            (o) => o.value.replace(/\D/g, '') === String(days),
          );
          if (byValueDigits) return byValueDigits.value;
        }
      }
    }
  }

  const settlement = String(
    customer.settlementMethodCode ?? customer.settlement_method_code ?? '',
  )
    .trim()
    .toLowerCase();
  if (settlement === 'prepaid') {
    if (!paymentTermsOptions.length) return 'PREPAID';
    const prepaid = paymentTermsOptions.find(
      (o) => o.value === 'PREPAID' || /预付|先款/.test(o.label),
    );
    if (prepaid) return prepaid.value;
  }

  return undefined;
}

/** 从客户主数据解析需回填的表单字段 */
export function resolveCustomerFormFieldValues(
  customer: CustomerLike,
  users: UserLike[] = [],
  paymentTermsOptions: DictOption[] = [],
): Record<string, unknown> {
  const sIdRaw = customer.salesmanId ?? customer.salesman_id;
  const sId =
    sIdRaw != null && sIdRaw !== '' && Number.isFinite(Number(sIdRaw)) ? Number(sIdRaw) : undefined;
  const salesman = sId != null ? users.find((u) => Number(u.id) === sId) : undefined;
  const sName = normalizeUserDisplayName(
    customer.salesmanName ??
      customer.salesman_name ??
      (salesman ? formatUserDisplayLabel(salesman) : ''),
  );
  const paymentTerms = resolvePaymentTermsFromCustomer(customer, paymentTermsOptions);
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
    ...(paymentTerms != null ? { payment_terms: paymentTerms } : { payment_terms: undefined }),
  };
}

const CLEAR_CUSTOMER_FORM_FIELDS: Record<string, undefined> = {
  customer_name: undefined,
  customer_contact: undefined,
  customer_phone: undefined,
  salesman_id: undefined,
  salesman_name: undefined,
  shipping_address: undefined,
  payment_terms: undefined,
};

export function applyCustomerFormFields(
  formRef: React.RefObject<ProFormInstance | undefined | null> | { current?: ProFormInstance | null },
  customer: CustomerLike | null,
  options: {
    users?: UserLike[];
    customerList?: CustomerLike[];
    includeCustomerId?: boolean;
    paymentTermsOptions?: DictOption[];
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
  const next = resolveCustomerFormFieldValues(
    full,
    options.users,
    options.paymentTermsOptions ?? [],
  );
  // 公海/无归属客户：保留单据上已选业务员，避免「私有→共有」回填把业务员清空
  if (next.salesman_id == null) {
    const currentId = formRef.current?.getFieldValue('salesman_id');
    const currentName = formRef.current?.getFieldValue('salesman_name');
    if (currentId != null && currentId !== '' && Number.isFinite(Number(currentId))) {
      next.salesman_id = Number(currentId);
      next.salesman_name = currentName;
    }
  }
  formRef.current?.setFieldsValue({
    ...(options.includeCustomerId ? { customer_id: full.id ?? full.customer_id } : {}),
    ...next,
  });
}
