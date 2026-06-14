import { useCallback, useEffect, useMemo, useState } from 'react';
import { storageAreaApi, storageLocationApi } from '../../master-data/services/warehouse';

type LocationOption = {
  label: string;
  value: string;
};

const MASTER_DATA_LIST_LIMIT = 1000;

function toWarehouseId(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function useWarehouseLocationOptions() {
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null);
  const [storageAreaList, setStorageAreaList] = useState<any[]>([]);
  const [storageLocationList, setStorageLocationList] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [areas, locations] = await Promise.all([
          storageAreaApi.list({ limit: MASTER_DATA_LIST_LIMIT, is_active: true }),
          storageLocationApi.list({ limit: MASTER_DATA_LIST_LIMIT, is_active: true }),
        ]);
        if (cancelled) return;
        setStorageAreaList(areas?.items || []);
        setStorageLocationList(locations?.items || []);
      } catch {
        if (cancelled) return;
        setStorageAreaList([]);
        setStorageLocationList([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateSelectedWarehouseId = useCallback((value: unknown) => {
    setSelectedWarehouseId(toWarehouseId(value));
  }, []);

  const resetSelectedWarehouseId = useCallback(() => {
    setSelectedWarehouseId(null);
  }, []);

  const locationOptions = useMemo<LocationOption[]>(() => {
    const visibleStorageAreaIds = new Set(
      storageAreaList
        .filter((a: any) => {
          const whId = Number(a.warehouseId ?? a.warehouse_id ?? 0);
          return selectedWarehouseId ? whId === selectedWarehouseId : true;
        })
        .map((a: any) => Number(a.id)),
    );
    return storageLocationList
      .filter((loc: any) => {
        const areaId = Number(loc.storageAreaId ?? loc.storage_area_id ?? 0);
        if (!selectedWarehouseId) return true;
        return visibleStorageAreaIds.has(areaId);
      })
      .map((loc: any) => {
        const code = String(loc.code ?? '').trim();
        const name = String(loc.name ?? '').trim();
        const label = code && name ? `${code} - ${name}` : code || name || `库位${loc.id}`;
        return { label, value: code || name };
      })
      .filter((x) => !!x.value);
  }, [storageAreaList, storageLocationList, selectedWarehouseId]);

  return {
    selectedWarehouseId,
    locationOptions,
    updateSelectedWarehouseId,
    resetSelectedWarehouseId,
  };
}

