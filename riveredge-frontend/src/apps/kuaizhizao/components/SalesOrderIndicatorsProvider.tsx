/**
 * 销售订单明细视图 - 数量检查与 BOM 检查批量拉取 Provider
 *
 * 收集子组件注册的 materialId，批量请求库存汇总和 BOM 检查，避免每行独立请求导致的逐条更新。
 *
 * @author Luigi Lu
 * @date 2026-02-24
 */

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../../services/api';

export interface SalesOrderIndicatorsContextValue {
  inventoryMap: Record<number, number>;
  bomMap: Record<number, boolean>;
  registerMaterialId: (materialId: number) => void;
}

const SalesOrderIndicatorsContext = createContext<SalesOrderIndicatorsContextValue | null>(null);

const DEBOUNCE_MS = 50;

/** 批量获取物料库存汇总 */
async function fetchBatchInventory(materialIds: number[]): Promise<Record<number, number>> {
  if (materialIds.length === 0) return {};
  try {
    const res = await apiRequest<{ material_totals?: Record<string, number> }>(
      '/apps/kuaizhizao/reports/inventory/batch-query',
      {
        method: 'GET',
        params: {
          material_ids: materialIds,
          summary_only: true,
          include_expired: false,
        },
      }
    );
    const totals = res?.material_totals ?? {};
    const result: Record<number, number> = {};
    for (const [k, v] of Object.entries(totals)) {
      const id = parseInt(k, 10);
      if (!Number.isNaN(id)) result[id] = Number(v) || 0;
    }
    return result;
  } catch {
    return {};
  }
}

/** 批量检查物料是否有 BOM（后端复用单次检查逻辑，一次请求返回全部结果） */
async function fetchBatchBomCheck(materialIds: number[]): Promise<Record<number, boolean>> {
  if (materialIds.length === 0) return {};
  try {
    const res = await apiRequest<Record<string, boolean>>(
      '/apps/master-data/materials/bom/batch-check',
      {
        method: 'GET',
        params: { material_ids: materialIds, only_active: true },
      }
    );
    const result: Record<number, boolean> = {};
    for (const [k, v] of Object.entries(res ?? {})) {
      const id = parseInt(k, 10);
      if (!Number.isNaN(id)) result[id] = !!v;
    }
    for (const id of materialIds) {
      if (!(id in result)) result[id] = false;
    }
    return result;
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('BOM 批量检查失败:', e);
    }
    return {};
  }
}

export const SalesOrderIndicatorsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [inventoryMap, setInventoryMap] = useState<Record<number, number>>({});
  const [bomMap, setBomMap] = useState<Record<number, boolean>>({});
  const idsRef = useRef<Set<number>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchedIdsRef = useRef<Set<number>>(new Set());

  const registerMaterialId = useCallback((materialId: number) => {
    if (!materialId) return;
    idsRef.current.add(materialId);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      const ids = Array.from(idsRef.current);
      const toFetch = ids.filter((id) => !fetchedIdsRef.current.has(id));
      if (toFetch.length === 0) return;

      fetchedIdsRef.current = new Set([...fetchedIdsRef.current, ...toFetch]);

      Promise.all([fetchBatchInventory(toFetch), fetchBatchBomCheck(toFetch)]).then(
        ([inv, bom]) => {
          setInventoryMap((prev) => ({ ...prev, ...inv }));
          setBomMap((prev) => ({ ...prev, ...bom }));
        }
      );
    }, DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const value: SalesOrderIndicatorsContextValue = {
    inventoryMap,
    bomMap,
    registerMaterialId,
  };

  return (
    <SalesOrderIndicatorsContext.Provider value={value}>
      {children}
    </SalesOrderIndicatorsContext.Provider>
  );
};

export function useSalesOrderIndicators(): SalesOrderIndicatorsContextValue | null {
  return useContext(SalesOrderIndicatorsContext);
}
