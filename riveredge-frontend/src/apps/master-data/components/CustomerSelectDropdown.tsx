/**
 * 客户选择下拉：快速新建 / 快速编辑 / 高级搜索（与报价单一致）
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App } from 'antd';
import { UniDropdown, type UniDropdownProps } from '../../../components/uni-dropdown';
import type { Customer } from '../types/supply-chain';
import { CustomerFormModal } from './CustomerFormModal';
import { useGlobalStore } from '../../../stores/globalStore';
import {
  ReferenceDisplayAccessError,
  canReadReferenceResource,
  referenceDisplayToIdOptions,
  searchReferenceDisplay,
} from '../../../utils/referenceDisplay';

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
  /** 宿主 {app}:{module}，供隐式 display 鉴权 */
  hostResource?: string;
};

export const CustomerSelectDropdown: React.FC<CustomerSelectDropdownProps> = ({
  customers: customersProp,
  loading: loadingProp,
  onCustomersChange,
  onCustomerPick,
  modalZIndex,
  autoLoad = true,
  hostResource,
  onChange,
  ...rest
}) => {
  const { message: messageApi } = App.useApp();
  const currentUser = useGlobalStore((s) => s.currentUser);
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
      const res = await searchReferenceDisplay({
        resource: 'master-data:supply-chain:customer',
        hostResource,
        pageSize: 1000,
      });
      const list = res.items.map(
        (item) =>
          ({
            id: item.id,
            uuid: item.uuid,
            code: item.code,
            name: item.name,
          }) as Customer,
      );
      if (customersProp == null) {
        setInternalCustomers(list);
      }
      onCustomersChange?.(list);
      return list;
    } catch (err) {
      if (err instanceof ReferenceDisplayAccessError) {
        messageApi.warning(err.message);
      }
      return [];
    } finally {
      setInternalLoading(false);
    }
  }, [customersProp, hostResource, messageApi, onCustomersChange]);

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

  const canManageCustomer = canReadReferenceResource(currentUser, 'master-data:supply-chain:customer');

  return (
    <>
      <UniDropdown
        {...rest}
        showSearch
        allowClear
        loading={loading}
        options={options}
        onChange={handleChange}
        quickCreate={
          canManageCustomer
            ? {
                label: '快速新建',
                onClick: openCreate,
              }
            : undefined
        }
        quickEdit={
          canManageCustomer
            ? {
                label: '编辑客户',
                onEdit: openEdit,
              }
            : undefined
        }
        advancedSearch={{
          label: '高级搜索',
          fields: [
            { name: 'keyword', label: '关键词' },
          ],
          onSearch: async (values) => {
            try {
              const res = await searchReferenceDisplay({
                resource: 'master-data:supply-chain:customer',
                hostResource,
                keyword: values.keyword,
                pageSize: 200,
              });
              return referenceDisplayToIdOptions(res.items);
            } catch (err) {
              if (err instanceof ReferenceDisplayAccessError) {
                messageApi.warning(err.message);
              }
              return [];
            }
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
