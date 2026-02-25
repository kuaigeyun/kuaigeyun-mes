/**
 * 物料库存指示器
 *
 * 在物料输入框前显示库存状态小点：
 * - 库存充足：绿色小点
 * - 库存不足：红色小点
 * - 悬停显示库存数量
 *
 * 在 SalesOrderIndicatorsProvider 内时使用批量拉取，否则单物料请求。
 *
 * @author Luigi Lu
 * @date 2026-02-24
 */

import React, { useEffect, useRef, useState } from 'react';
import { Tooltip } from 'antd';
import { apiRequest } from '../../../services/api';
import { useSalesOrderIndicators } from './SalesOrderIndicatorsProvider';

interface MaterialInventoryIndicatorProps {
  materialId?: number | null;
  requiredQuantity?: number;
  style?: React.CSSProperties;
}

/** 获取物料可用库存总量（汇总批次库存）- 单物料请求，用于非 Provider 场景 */
async function fetchMaterialInventory(materialId: number): Promise<number> {
  try {
    const res = await apiRequest<{ items?: { quantity: number }[] }>(
      '/apps/kuaizhizao/reports/inventory/batch-query',
      {
        method: 'GET',
        params: { material_id: materialId, include_expired: false },
      }
    );
    const items = res?.items ?? [];
    return items.reduce((sum, it) => sum + (Number(it?.quantity) || 0), 0);
  } catch {
    return 0;
  }
}

export const MaterialInventoryIndicator: React.FC<MaterialInventoryIndicatorProps> = ({
  materialId,
  requiredQuantity = 0,
  style,
}) => {
  const indicatorsCtx = useSalesOrderIndicators();
  const [inventory, setInventory] = useState<number | null>(null);

  // 在 Provider 内：注册并优先使用批量数据
  useEffect(() => {
    if (!materialId || !indicatorsCtx) return;
    indicatorsCtx.registerMaterialId(materialId);
  }, [materialId, indicatorsCtx]);

  // 不在 Provider 内：单物料请求
  useEffect(() => {
    if (!materialId) {
      setInventory(null);
      return;
    }
    if (indicatorsCtx) return;
    let cancelled = false;
    setInventory(null);
    fetchMaterialInventory(materialId).then((qty) => {
      if (!cancelled) setInventory(qty);
    });
    return () => { cancelled = true; };
  }, [materialId, indicatorsCtx]);

  if (!materialId) return null;

  const fromBatch = indicatorsCtx?.inventoryMap[materialId];
  const inv = indicatorsCtx ? (fromBatch ?? 0) : (inventory ?? 0);
  const isLoading = indicatorsCtx ? fromBatch === undefined : inventory === null;
  const req = Number(requiredQuantity) || 0;
  const sufficient = !isLoading && inv >= req;

  const dotColor = isLoading ? '#d9d9d9' : sufficient ? '#52c41a' : '#ff4d4f';
  const tipText = isLoading ? '加载中...' : `库存：${inv}`;

  return (
    <Tooltip title={tipText}>
      <span
        style={{
          display: 'inline-block',
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: dotColor,
          marginRight: 6,
          flexShrink: 0,
          ...style,
        }}
      />
    </Tooltip>
  );
};
