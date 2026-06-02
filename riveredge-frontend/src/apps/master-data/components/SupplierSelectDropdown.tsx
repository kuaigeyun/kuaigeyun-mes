/**
 * 供应商选择下拉：快速新建 / 快速编辑 / 高级搜索
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App } from 'antd';
import { UniDropdown, type UniDropdownProps } from '../../../components/uni-dropdown';
import { supplierApi } from '../services/supply-chain';
import type { Supplier } from '../types/supply-chain';
import { SupplierFormModal } from './SupplierFormModal';

function formatSupplierLabel(s: Supplier | Record<string, unknown>): string {
  const row = s as Record<string, unknown>;
  return (
    `${row.code ?? row.supplier_code ?? ''} - ${row.name ?? row.supplier_name ?? ''}`.trim() ||
    String(row.id ?? row.supplier_id)
  );
}

function getSupplierId(s: Supplier | Record<string, unknown>): number | undefined {
  const row = s as Record<string, unknown>;
  const id = row.id ?? row.supplier_id;
  return id != null ? Number(id) : undefined;
}

export type SupplierSelectDropdownProps = Omit<
  UniDropdownProps,
  'options' | 'quickCreate' | 'quickEdit' | 'advancedSearch' | 'loading'
> & {
  suppliers?: Supplier[];
  loading?: boolean;
  onSuppliersChange?: (suppliers: Supplier[]) => void;
  onSupplierPick?: (supplier: Supplier | null) => void;
  modalZIndex?: number;
  autoLoad?: boolean;
};

export const SupplierSelectDropdown: React.FC<SupplierSelectDropdownProps> = ({
  suppliers: suppliersProp,
  loading: loadingProp,
  onSuppliersChange,
  onSupplierPick,
  modalZIndex,
  autoLoad = true,
  onChange,
  ...rest
}) => {
  const { message: messageApi } = App.useApp();
  const [internalSuppliers, setInternalSuppliers] = useState<Supplier[]>([]);
  const [internalLoading, setInternalLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editUuid, setEditUuid] = useState<string | null>(null);

  const suppliers = suppliersProp ?? internalSuppliers;
  const loading = loadingProp ?? internalLoading;

  const mergeSupplierList = useCallback((prev: Supplier[], supplier: Supplier) => {
    const matchKey = supplier.uuid ?? supplier.id;
    const idx = prev.findIndex((s) => (s.uuid ?? s.id) === matchKey);
    if (idx >= 0) {
      const next = [...prev];
      next[idx] = { ...next[idx], ...supplier };
      return next;
    }
    return [...prev, supplier];
  }, []);

  const refreshSuppliers = useCallback(async () => {
    setInternalLoading(true);
    try {
      const res = await supplierApi.list?.({ isActive: true, limit: 500 } as Parameters<NonNullable<typeof supplierApi.list>>[0]);
      const list = (Array.isArray(res) ? res : (res as { data?: Supplier[] })?.data ?? (res as { results?: Supplier[] })?.results ?? (res as { items?: Supplier[] })?.items ?? []) as Supplier[];
      if (suppliersProp == null) {
        setInternalSuppliers(list);
      }
      onSuppliersChange?.(list);
      return list;
    } catch {
      return [];
    } finally {
      setInternalLoading(false);
    }
  }, [onSuppliersChange, suppliersProp]);

  useEffect(() => {
    if (autoLoad && suppliersProp == null) {
      void refreshSuppliers();
    }
  }, [autoLoad, refreshSuppliers, suppliersProp]);

  const options = useMemo(
    () =>
      suppliers.map((s) => ({
        value: getSupplierId(s),
        label: formatSupplierLabel(s),
      })),
    [suppliers],
  );

  const handleChange = useCallback(
    (value: number | undefined, option: unknown) => {
      const s = value != null ? suppliers.find((x) => getSupplierId(x) === value) : null;
      onSupplierPick?.(s ?? null);
      onChange?.(value, option as Parameters<NonNullable<UniDropdownProps['onChange']>>[1]);
    },
    [onChange, onSupplierPick, suppliers],
  );

  const openCreate = useCallback(() => {
    setEditUuid(null);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback(
    (supplierId: unknown) => {
      const s = suppliers.find((x) => getSupplierId(x) === supplierId);
      const uuid = s?.uuid;
      if (!uuid) {
        messageApi.warning('无法编辑该供应商，请刷新供应商列表后重试');
        return;
      }
      setEditUuid(String(uuid));
      setFormOpen(true);
    },
    [messageApi, suppliers],
  );

  const handleSuccess = useCallback(
    (supplier: Supplier) => {
      const nextList = mergeSupplierList(suppliers, supplier);
      if (suppliersProp == null) {
        setInternalSuppliers(nextList);
      }
      onSuppliersChange?.(nextList);
      onSupplierPick?.(supplier);
      onChange?.(supplier.id, {
        value: supplier.id,
        label: formatSupplierLabel(supplier),
      });
      setFormOpen(false);
      setEditUuid(null);
    },
    [mergeSupplierList, onChange, onSupplierPick, onSuppliersChange, suppliers, suppliersProp],
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
          label: '编辑供应商',
          onEdit: openEdit,
        }}
        advancedSearch={{
          label: '高级搜索',
          fields: [
            { name: 'code', label: '供应商编号' },
            { name: 'name', label: '供应商名称' },
            { name: 'contact_person', label: '联系人' },
          ],
          onSearch: async (values) => {
            try {
              const res = await supplierApi.list?.({ ...values, limit: 100 } as Parameters<NonNullable<typeof supplierApi.list>>[0]);
              const list = (Array.isArray(res) ? res : (res as { data?: Supplier[] })?.data ?? []) as Supplier[];
              return list.map((s) => ({
                value: getSupplierId(s),
                label: formatSupplierLabel(s),
              }));
            } catch {
              return [];
            }
          },
        }}
      />
      <SupplierFormModal
        open={formOpen}
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
