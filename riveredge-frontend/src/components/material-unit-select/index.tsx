import React, { useState, useEffect, useMemo } from 'react';
import { Select, Spin } from 'antd';
import { materialApi } from '../../apps/master-data/services/material';
import type { Material } from '../../apps/master-data/types/material';

export interface MaterialUnitSelectProps {
  /** 物料 ID (支持数字 ID 或字符串 UUID) */
  materialId?: number | string;
  /** 当前选中的单位值（单位名称） */
  value?: string;
  /** 变更回调 */
  onChange?: (value: string) => void;
  /** 尺寸 */
  size?: 'large' | 'middle' | 'small';
  /** 是否禁用 */
  disabled?: boolean;
  /** 占位符 */
  placeholder?: string;
  /** 是否带样式（用于 Form.Item noStyle 模式，去边框等） */
  noStyle?: boolean;
}

// 同一瞬间并发去重，不跨渲染/操作复用物料档案。
const materialInflight = new Map<string, Promise<Material | null>>();
const materialByKeyCache = new Map<string, Material>();

/** @deprecated 不再提供 code→name 映射；保留空实现避免旧 import 断裂 */
export async function getMaterialUnitDisplayMapShared(): Promise<Record<string, string>> {
  return {};
}

/** 页面已加载物料列表时写入，避免 numeric id 误调 GET /materials/{id}（仅 UUID 合法） */
export function registerMaterialsForUnitSelect(materials: Array<Material | Record<string, unknown>>): void {
  for (const raw of materials) {
    const m = raw as Material;
    if (m.id != null) materialByKeyCache.set(String(m.id), m);
    if (m.uuid) materialByKeyCache.set(String(m.uuid), m);
  }
}

function rememberMaterialForUnitSelect(material: Material): void {
  if (material.id != null) materialByKeyCache.set(String(material.id), material);
  if (material.uuid) materialByKeyCache.set(String(material.uuid), material);
}

/**
 * 拉取单条物料（每次请求最新；同 id 并发去重）
 */
export async function fetchMaterialForUnitSelectCache(materialId: number | string): Promise<Material | null> {
  const cacheKey = String(materialId);
  const cached = materialByKeyCache.get(cacheKey);
  if (cached) return cached;

  const inflight = materialInflight.get(cacheKey);
  if (inflight) return inflight;

  const promise = (async () => {
    const idStr = String(materialId);
    let resp: Material | null = null;

    if (idStr.includes('-') && idStr.length > 20) {
      resp = await materialApi.get(idStr);
    } else {
      const numericId = Number(idStr);
      if (Number.isFinite(numericId)) {
        const listRes = await materialApi.list({ limit: 2000, isActive: true });
        const items = Array.isArray(listRes?.items) ? listRes.items : [];
        resp = items.find((m) => Number(m.id) === numericId) ?? null;
      }
    }
    if (resp) rememberMaterialForUnitSelect(resp);
    return resp;
  })().finally(() => {
    materialInflight.delete(cacheKey);
  });

  materialInflight.set(cacheKey, promise);
  return promise;
}

/**
 * 批量预取物料档案（写入组件内部缓存）。
 */
export async function prefetchMaterialsForUnitSelect(
  materialIds: Array<number | string | null | undefined>
): Promise<Map<string, Material>> {
  const unique = [
    ...new Set(
      materialIds
        .filter((x): x is number | string => x != null && x !== '')
        .map((x) => String(x))
    ),
  ];
  const out = new Map<string, Material>();
  if (unique.length === 0) return out;

  await Promise.all(
    unique.map(async (key) => {
      try {
        const m = await fetchMaterialForUnitSelectCache(key);
        if (m) out.set(key, m);
      } catch {
        /* ignore single miss */
      }
    })
  );
  return out;
}

/**
 * 物料单位选择：选项与存值均为单位名称（物料档案已存名称）。
 */
export const MaterialUnitSelect: React.FC<MaterialUnitSelectProps> = ({
  materialId,
  value,
  onChange,
  size='medium',
  disabled = false,
  placeholder = '单位',
  noStyle = false,
}) => {
  const [material, setMaterial] = useState<Material | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!materialId) {
      setMaterial(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetchMaterialForUnitSelectCache(materialId)
      .then((resp) => {
        if (cancelled) return;
        if (resp) setMaterial(resp);
      })
      .catch((error) => {
        console.error('Failed to load material units:', error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [materialId]);

  const options = useMemo(() => {
    if (!material) return [];

    const unitSet = new Set<string>();
    if (material.baseUnit) {
      unitSet.add(material.baseUnit);
    }

    if (material.units?.units) {
      material.units.units.forEach((u) => {
        if (u.unit) unitSet.add(u.unit);
      });
    }

    return Array.from(unitSet);
  }, [material]);

  const selectOptions = useMemo(
    () => options.map((u) => ({ value: u, label: u })),
    [options]
  );

  const cellTextStyle: React.CSSProperties = {
    fontSize: 'inherit',
    lineHeight: 'inherit',
    color: 'inherit',
  };

  if (materialId == null || materialId === '') {
    return <span style={cellTextStyle}>-</span>;
  }

  if (loading && (value == null || value === '')) {
    return <Spin size="small" />;
  }

  if (!material) {
    if (value != null && value !== '') {
      return <span style={cellTextStyle}>{String(value)}</span>;
    }
    return <span style={cellTextStyle}>-</span>;
  }

  if (options.length <= 1) {
    const raw = value || material.baseUnit || '';
    return <span style={cellTextStyle}>{raw || '-'}</span>;
  }

  return (
    <Select
      value={value}
      onChange={onChange}
      size={size}
      disabled={disabled}
      placeholder={placeholder}
      style={{ width: '100%', minWidth: 60, fontSize: 'inherit' }}
      variant={noStyle ? 'borderless' : 'outlined'}
      popupMatchSelectWidth={false}
      options={selectOptions}
      optionFilterProp="label"
    />
  );
};

export default MaterialUnitSelect;
