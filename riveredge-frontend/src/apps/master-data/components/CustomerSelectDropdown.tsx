/**
 * 客户选择下拉：快速新建 / 快速编辑 / 高级搜索（与报价单一致）
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Form } from 'antd';
import { UniDropdown, type UniDropdownProps } from '../../../components/uni-dropdown';
import type { Customer } from '../types/supply-chain';
import { CustomerFormModal } from './CustomerFormModal';
import { useGlobalStore } from '../../../stores/globalStore';
import {
  ReferenceDisplayAccessError,
  canReadReferenceResource,
  referenceDisplayToIdOptions,
  resolveReferenceDisplay,
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
  /**
   * 与表单 customer_name 快照字段联动，options 未就绪时用名称回显，避免裸 id 闪烁。
   * 设为 false 则不读取 Form。
   */
  snapshotNameField?: string | false;
};

export const CustomerSelectDropdown: React.FC<CustomerSelectDropdownProps> = ({
  customers: customersProp,
  loading: loadingProp,
  onCustomersChange,
  onCustomerPick,
  modalZIndex,
  autoLoad = true,
  hostResource,
  snapshotNameField = 'customer_name',
  onChange,
  value,
  ...rest
}) => {
  const { message: messageApi } = App.useApp();
  const currentUser = useGlobalStore((s) => s.currentUser);
  const form = Form.useFormInstance();
  const snapshotName =
    snapshotNameField === false
      ? undefined
      : Form.useWatch(snapshotNameField, form);
  const [internalCustomers, setInternalCustomers] = useState<Customer[]>([]);
  const [internalLoading, setInternalLoading] = useState(false);
  const [resolvedById, setResolvedById] = useState<Map<number, Customer>>(new Map());
  const [resolvingId, setResolvingId] = useState<number | null>(null);
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
        pageSize: 200,
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

  const selectedId = value != null && value !== '' ? Number(value) : NaN;

  useEffect(() => {
    if (!Number.isFinite(selectedId)) return;
    if (customers.some((c) => getCustomerId(c) === selectedId)) return;
    if (resolvedById.has(selectedId)) return;

    let cancelled = false;
    setResolvingId(selectedId);
    void resolveReferenceDisplay({
      resource: 'master-data:supply-chain:customer',
      recordIds: [selectedId],
      hostResource,
    })
      .then((items) => {
        if (cancelled || !items.length) return;
        const item = items[0];
        const id = item.id != null ? Number(item.id) : selectedId;
        setResolvedById((prev) => {
          if (prev.has(id)) return prev;
          const next = new Map(prev);
          next.set(id, {
            id,
            uuid: item.uuid ?? undefined,
            code: item.code ?? undefined,
            name: item.name ?? undefined,
          } as Customer);
          return next;
        });
      })
      .catch((err) => {
        if (err instanceof ReferenceDisplayAccessError) {
          messageApi.warning(err.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setResolvingId((cur) => (cur === selectedId ? null : cur));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId, customers, hostResource, messageApi, resolvedById]);

  const allCustomers = useMemo(() => {
    const seen = new Set<number>();
    const merged: Customer[] = [];
    for (const c of customers) {
      const id = getCustomerId(c);
      if (id == null || seen.has(id)) continue;
      seen.add(id);
      merged.push(c);
    }
    for (const [id, c] of resolvedById) {
      if (!seen.has(id)) merged.push(c);
    }
    return merged;
  }, [customers, resolvedById]);

  const snapshotDisplayLabel = useMemo(() => {
    if (snapshotName == null || snapshotName === '') return undefined;
    const text = String(snapshotName).trim();
    return text || undefined;
  }, [snapshotName]);

  const options = useMemo(() => {
    const base = allCustomers.map((c) => ({
      value: getCustomerId(c),
      label: formatCustomerLabel(c),
    }));
    if (!Number.isFinite(selectedId) || base.some((o) => o.value === selectedId)) {
      return base;
    }
    const resolved = resolvedById.get(selectedId);
    const label =
      (resolved ? formatCustomerLabel(resolved) : undefined) ??
      snapshotDisplayLabel ??
      (resolvingId === selectedId ? snapshotDisplayLabel ?? '\u00A0' : undefined);
    if (!label) return base;
    return [...base, { value: selectedId, label }];
  }, [allCustomers, selectedId, resolvedById, snapshotDisplayLabel, resolvingId]);

  const handleChange = useCallback(
    (nextValue: number | undefined, option: unknown) => {
      const c = nextValue != null ? allCustomers.find((x) => getCustomerId(x) === nextValue) : null;
      onCustomerPick?.(c ?? null);
      onChange?.(nextValue, option as Parameters<NonNullable<UniDropdownProps['onChange']>>[1]);
    },
    [allCustomers, onChange, onCustomerPick],
  );

  const openCreate = useCallback(() => {
    setEditUuid(null);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback(
    (customerId: unknown) => {
      const c = allCustomers.find((x) => getCustomerId(x) === customerId);
      const uuid = c?.uuid;
      if (!uuid) {
        messageApi.warning('无法编辑该客户，请刷新客户列表后重试');
        return;
      }
      setEditUuid(String(uuid));
      setFormOpen(true);
    },
    [allCustomers, messageApi],
  );

  const handleSuccess = useCallback(
    (customer: Customer) => {
      const nextList = mergeCustomerList(allCustomers, customer);
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
    [allCustomers, customersProp, mergeCustomerList, onChange, onCustomerPick, onCustomersChange],
  );

  const canManageCustomer = canReadReferenceResource(currentUser, 'master-data:supply-chain:customer');

  const optionPending =
    Number.isFinite(selectedId) && !options.some((o) => o.value === selectedId);

  return (
    <>
      <UniDropdown
        {...rest}
        value={value}
        showSearch
        allowClear
        loading={loading || (optionPending && resolvingId === selectedId)}
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
