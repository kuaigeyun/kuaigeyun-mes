import type { ProColumns } from '@ant-design/pro-components';
import { extractProTableSort } from '../../../utils/tableQueryKey';

function pickString(search: Record<string, unknown> | null | undefined, key: string) {
  const v = search?.[key];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function resolveManagementSort(sort?: Record<string, unknown>) {
  const { sortBy, sortOrder } = extractProTableSort(sort ?? {});
  if (!sortBy || !sortOrder) {
    return { sort_field: undefined, sort_order: undefined };
  }
  return {
    sort_field: sortBy,
    sort_order: sortOrder === 'desc' ? 'desc' : 'asc',
  };
}

export function marginReportProductSearchColumns(labels: {
  productCode: string;
  productName: string;
}): ProColumns[] {
  return [
    {
      title: labels.productCode,
      dataIndex: 'product_code',
      hideInTable: true,
      order: 10,
      fieldProps: { allowClear: true },
    },
    {
      title: labels.productName,
      dataIndex: 'product_name',
      hideInTable: true,
      order: 11,
      fieldProps: { allowClear: true },
    },
  ];
}

export function marginReportCustomerSearchColumns(customerLabel: string): ProColumns[] {
  return [
    {
      title: customerLabel,
      dataIndex: 'customer_name',
      hideInTable: true,
      order: 10,
      fieldProps: { allowClear: true },
    },
  ];
}

export function marginReportOrderSearchColumns(labels: {
  orderNo: string;
  deliveryNote: string;
}): ProColumns[] {
  return [
    {
      title: labels.orderNo,
      dataIndex: 'sales_order_code',
      hideInTable: true,
      order: 10,
      fieldProps: { allowClear: true },
    },
    {
      title: labels.deliveryNote,
      dataIndex: 'delivery_code',
      hideInTable: true,
      order: 11,
      fieldProps: { allowClear: true },
    },
  ];
}

export function resolveMarginReportListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
  dimension?: 'product' | 'customer' | 'order',
): Record<string, string | number | boolean | undefined> {
  const s = searchFormValues ?? {};
  const fuzzyKeyword = pickString(s, 'keyword');
  const { sort_field, sort_order } = resolveManagementSort(sort);

  const params: Record<string, string | number | boolean | undefined> = {
    sort_field,
    sort_order,
  };

  if (fuzzyKeyword) {
    params.keyword = fuzzyKeyword;
  } else if (dimension === 'product') {
    const productCode = pickString(s, 'product_code');
    const productName = pickString(s, 'product_name');
    if (productCode) params.product_code = productCode;
    if (productName) params.product_name = productName;
  } else if (dimension === 'customer') {
    const customerName = pickString(s, 'customer_name');
    if (customerName) params.customer_name = customerName;
  } else if (dimension === 'order') {
    const salesOrderCode = pickString(s, 'sales_order_code');
    const deliveryCode = pickString(s, 'delivery_code');
    if (salesOrderCode) params.sales_order_code = salesOrderCode;
    if (deliveryCode) params.delivery_code = deliveryCode;
  }

  return params;
}
