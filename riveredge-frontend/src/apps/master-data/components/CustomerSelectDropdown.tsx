/**
 * 客户选择下拉：快速新建 / 快速编辑 / 高级搜索（与报价单一致）
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App } from 'antd';
import { UniDropdown, type UniDropdownProps } from '../../../components/uni-dropdown';
import { customerApi } from '../services/supply-chain';
import type { Customer } from '../types/supply-chain';
import { CustomerFormModal } from './CustomerFormModal';

function formatCustomerLabel(c: Customer | Record<string, unknown>): string {
  const row = c as Record<string, unknown>;
  return (
    `${row.code ?? row.customer_code ?? ''} - ${row.name ?? row.customer_name ?? ''}`.trim() ||
    String(row.id ?? row.customer_id)
  );
}

function getCustomerId(c: Customer | Record<string, unknown>): number | undefined {
  const row = c as Record<string, unknown>;
  const id = row.id ?? row.customer_id;
  return id != null ? Number(id) : undefined;
}

export type CustomerSelectDropdownProps = Omit<
  UniDropdownProps,
  'options' | 'quickCreate' | 'quickEdit' | 'advancedSearch' | 'loading'
> & {
  customers?: Customer[];
  loading?: boolean;
  onCustomersChange?: (customers: Customer[]) => void;
  /** 选中或新建/编辑成功后回调，用于回填表单其它字段 */
  onCustomerPick?: (customer: Customer | null) => void;
  modalZIndex?: number;
  /** 未传入 customers 时是否自动加载 */
  autoLoad?: boolean;
};

export const CustomerSelectDropdown: React.FC<CustomerSelectDropdownProps> = ({
  customers: customersProp,
  loading: loadingProp,
  onCustomersChange,
  onCustomerPick,
  modalZIndex,
  autoLoad = true,
  onChange,
  ...rest
}) => {
  const { message: messageApi } = App.useApp();
  const [internalCustomers, setInternalCustomers] = useState<Customer[]>([]);
  const [internalLoading, setInternalLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editUuid, setEditUuid] = useState<string | null>(null);

  const customers = customersProp ?? internalCustomers;
  const loading = loadingProp ?? internalLoading;

  const mergeCustomerList = useCallback(
    (prev: Customer[], customer: Customer) => {
      const matchKey = customer.uuid ?? customer.id;
      const idx = prev.findIndex((c) => (c.uuid ?? c.id) === matchKey);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...customer };
        return next;
      }
      return [...prev, customer];
    },
    [],
  );

  const refreshCustomers = useCallback(async () => {
    setInternalLoading(true);
    try {
      const res = await customerApi.list({ limit: 1000, isActive: true });
      const list = (Array.isArray(res) ? res : (res as { data?: Customer[]; items?: Customer[] })?.data ?? (res as { items?: Customer[] })?.items ?? []) as Customer[];
      if (customersProp == null) {
        setInternalCustomers(list);
      }
      onCustomersChange?.(list);
      return list;
    } catch {
      return [];
    } finally {
      setInternalLoading(false);
    }
  }, [customersProp, onCustomersChange]);

  useEffect(() => {
    if (autoLoad && customersProp == null) {
      void refreshCustomers();
    }
  }, [autoLoad, customersProp, refreshCustomers]);

  const options = useMemo(
    () =>
      customers.map((c) => ({
        value: getCustomerId(c),
        label: formatCustomerLabel(c),
      })),
    [customers],
  );

  const handleChange = useCallback(
    (value: number | undefined, option: unknown) => {
      const c = value != null ? customers.find((x) => getCustomerId(x) === value) : null;
      onCustomerPick?.(c ?? null);
      onChange?.(value, option as Parameters<NonNullable<UniDropdownProps['onChange']>>[1]);
    },
    [customers, onChange, onCustomerPick],
  );

  const openCreate = useCallback(() => {
    setEditUuid(null);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback(
    (customerId: unknown) => {
      const c = customers.find((x) => getCustomerId(x) === customerId);
      const uuid = c?.uuid;
      if (!uuid) {
        messageApi.warning('无法编辑该客户，请刷新客户列表后重试');
        return;
      }
      setEditUuid(String(uuid));
      setFormOpen(true);
    },
    [customers, messageApi],
  );

  const handleSuccess = useCallback(
    (customer: Customer) => {
      const nextList = mergeCustomerList(customers, customer);
      if (customersProp == null) {
        setInternalCustomers(nextList);
      }
      onCustomersChange?.(nextList);
      onCustomerPick?.(customer);
      onChange?.(customer.id, {
        value: customer.id,
        label: formatCustomerLabel(customer),
      });
      setFormOpen(false);
      setEditUuid(null);
    },
    [customers, customersProp, mergeCustomerList, onChange, onCustomerPick, onCustomersChange],
  );

  return (
    <>
      <UniDropdown
        {...rest}
        showSearch
        allowClear
        loading={loading}
        options={options}
        onChange={handleChange}
        quickCreate={{
          label: '快速新建',
          onClick: openCreate,
        }}
        quickEdit={{
          label: '编辑客户',
          onEdit: openEdit,
        }}
        advancedSearch={{
          label: '高级搜索',
          fields: [
            { name: 'code', label: '客户编号' },
            { name: 'name', label: '客户名称' },
            { name: 'contactPerson', label: '联系人' },
          ],
          onSearch: async (values) => {
            let list: Customer[] = [];
            try {
              const res = await customerApi.list({ limit: 200, skip: 0 });
              list = (Array.isArray(res) ? res : (res as { data?: Customer[]; items?: Customer[] })?.data ?? (res as { items?: Customer[] })?.items ?? []) as Customer[];
            } catch {
              return [];
            }
            let filtered = list;
            if (values.code?.trim()) {
              const k = values.code.trim().toLowerCase();
              filtered = filtered.filter((c) => (c.code ?? '').toLowerCase().includes(k));
            }
            if (values.name?.trim()) {
              const k = values.name.trim().toLowerCase();
              filtered = filtered.filter((c) => (c.name ?? '').toLowerCase().includes(k));
            }
            if (values.contactPerson?.trim()) {
              const k = values.contactPerson.trim().toLowerCase();
              filtered = filtered.filter((c) => (c.contactPerson ?? '').toLowerCase().includes(k));
            }
            return filtered.map((c) => ({
              value: getCustomerId(c),
              label: formatCustomerLabel(c),
            }));
          },
        }}
      />
      <CustomerFormModal
        open={formOpen}
        zIndex={modalZIndex}
        onClose={() => {
          setFormOpen(false);
          setEditUuid(null);
        }}
        editUuid={editUuid}
        onSuccess={handleSuccess}
      />
    </>
  );
};
