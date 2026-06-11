/**
 * 供应商选择下拉：快速新建 / 快速编辑 / 高级搜索
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App } from 'antd';
import { UniDropdown, type UniDropdownProps } from '../../../components/uni-dropdown';
import type { Supplier } from '../types/supply-chain';
import { SupplierFormModal } from './SupplierFormModal';
import { useGlobalStore } from '../../../stores/globalStore';
import {
  ReferenceDisplayAccessError,
  canReadReferenceResource,
  referenceDisplayToIdOptions,
  searchReferenceDisplay,
} from '../../../utils/referenceDisplay';

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
  hostResource?: string;
};

export const SupplierSelectDropdown: React.FC<SupplierSelectDropdownProps> = ({
  suppliers: suppliersProp,
  loading: loadingProp,
  onSuppliersChange,
  onSupplierPick,
  modalZIndex,
  autoLoad = true,
  hostResource,
  onChange,
  ...rest
}) => {
  const { message: messageApi } = App.useApp();
  const currentUser = useGlobalStore((s) => s.currentUser);
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
      const res = await searchReferenceDisplay({
        resource: 'master-data:supply-chain:supplier',
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
          }) as Supplier,
      );
      if (suppliersProp == null) {
        setInternalSuppliers(list);
      }
      onSuppliersChange?.(list);
      return list;
    } catch (err) {
      if (err instanceof ReferenceDisplayAccessError) {
        messageApi.warning(err.message);
      }
      return [];
    } finally {
      setInternalLoading(false);
    }
  }, [hostResource, messageApi, onSuppliersChange, suppliersProp]);

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

  const canManageSupplier = canReadReferenceResource(currentUser, 'master-data:supply-chain:supplier');

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
          canManageSupplier
            ? {
                label: '快速新建',
                onClick: openCreate,
              }
            : undefined
        }
        quickEdit={
          canManageSupplier
            ? {
                label: '编辑供应商',
                onEdit: openEdit,
              }
            : undefined
        }
        advancedSearch={{
          label: '高级搜索',
          fields: [{ name: 'keyword', label: '关键词' }],
          onSearch: async (values) => {
            try {
              const res = await searchReferenceDisplay({
                resource: 'master-data:supply-chain:supplier',
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
