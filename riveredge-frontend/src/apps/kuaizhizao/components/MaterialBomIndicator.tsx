/**
 * 物料BOM检查指示器
 *
 * 显示物料是否有BOM配置：有/无
 *
 * 在 SalesOrderIndicatorsProvider 内时使用批量拉取，否则单物料请求。
 *
 * @author Luigi Lu
 * @date 2026-02-24
 */

import React, { useEffect, useState } from 'react';
import { Tooltip } from 'antd';
import { apiRequest } from '../../../services/api';
import { useSalesOrderIndicators } from './SalesOrderIndicatorsProvider';

interface MaterialBomIndicatorProps {
  materialId?: number | null;
  style?: React.CSSProperties;
}

/** 检查物料是否有BOM - 单物料请求，用于非 Provider 场景 */
async function checkMaterialHasBom(materialId: number): Promise<boolean> {
  try {
    const res = await apiRequest<unknown[]>(
      `/apps/master-data/materials/bom/material/${materialId}`,
      { method: 'GET', params: { only_active: true } }
    );
    const arr = Array.isArray(res) ? res : [];
    return arr.length > 0;
  } catch {
    return false;
  }
}

export const MaterialBomIndicator: React.FC<MaterialBomIndicatorProps> = ({
  materialId,
  style,
}) => {
  const indicatorsCtx = useSalesOrderIndicators();
  const [hasBom, setHasBom] = useState<boolean | null>(null);

  // 在 Provider 内：注册并优先使用批量数据
  useEffect(() => {
    if (!materialId || !indicatorsCtx) return;
    indicatorsCtx.registerMaterialId(materialId);
  }, [materialId, indicatorsCtx]);

  // 不在 Provider 内：单物料请求
  useEffect(() => {
    if (!materialId) {
      setHasBom(null);
      return;
    }
    if (indicatorsCtx) return;
    let cancelled = false;
    setHasBom(null);
    checkMaterialHasBom(materialId).then((v) => {
      if (!cancelled) setHasBom(v);
    });
    return () => { cancelled = true; };
  }, [materialId, indicatorsCtx]);

  if (!materialId) return null;

  const fromBatch = indicatorsCtx?.bomMap[materialId];
  const resolved = indicatorsCtx ? fromBatch : hasBom;
  const isLoading = indicatorsCtx ? fromBatch === undefined : hasBom === null;

  const text = isLoading ? '...' : resolved ? '有' : '无';
  const color = isLoading ? 'var(--ant-color-text-tertiary)' : resolved ? 'var(--ant-color-success)' : 'var(--ant-color-text-tertiary)';

  return (
    <Tooltip title={isLoading ? '加载中...' : resolved ? '已配置BOM' : '未配置BOM'}>
      <span style={{ color, fontSize: 12, ...style }}>{text}</span>
    </Tooltip>
  );
};
