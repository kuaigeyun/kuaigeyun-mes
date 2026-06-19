import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Select, Spin } from 'antd';
import { materialApi } from '../../apps/master-data/services/material';
import type { Material } from '../../apps/master-data/types/material';
import { getMaterialUnitDisplayMapShared, normUnitKey } from '../../utils/materialUnitDisplay';

interface MaterialUnitSelectProps {
  /** 物料 ID (支持数字 ID 或字符串 UUID) */
  materialId?: number | string;
  /** 当前选中的单位值 */
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

export { getMaterialUnitDisplayMapShared } from '../../utils/materialUnitDisplay';

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
async function fetchMaterialForUnitSelectCache(materialId: number | string): Promise<Material | null> {
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
 * 批量预取物料档案（写入组件内部缓存），并预热单位字典。
 * 大表格（如需求计算预览）在展示前调用，可避免每格单独请求、逐行闪烁。
 */
export async function prefetchMaterialsForUnitSelect(
  materialIds: Array<number | string | null | undefined>
): Promise<Map<string, Material>> {
  await getMaterialUnitDisplayMapShared();

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
        const material = await fetchMaterialForUnitSelectCache(key);
        if (material) {
          rememberMaterialForUnitSelect(material);
          out.set(key, material);
        }
      } catch {
        /* 单条失败不影响其余行 */
      }
    })
  );
  return out;
}

/**
 * 物料关联单位选择组件
 * 
 * 核心逻辑：
 * 1. 监控 materialId 变化。
 * 2. 载入物料定义的合法单位（基础单位 + 辅助单位）。
 * 3. 根据单位数量自动决定展示形式：
 *    - 仅 1 个单位：显示为只读文本渲染。
 *    - > 1 个单位：显示为受限下拉框，选项仅限物料定义的合法单位。
 */
export const MaterialUnitSelect: React.FC<MaterialUnitSelectProps> = ({
  materialId,
  value,
  onChange,
  size = 'middle',
  disabled = false,
  placeholder = '单位',
  noStyle = false,
}) => {
  const [material, setMaterial] = useState<Material | null>(null);
  const [loading, setLoading] = useState(false);
  const [unitDisplayByKey, setUnitDisplayByKey] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    getMaterialUnitDisplayMapShared().then((map) => {
      if (!cancelled) setUnitDisplayByKey(map);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

  // 计算物料对应的合法单位列表
  const options = useMemo(() => {
    if (!material) return [];
    
    const unitSet = new Set<string>();
    // 永远包含基础单位
    if (material.baseUnit) {
      unitSet.add(material.baseUnit);
    }
    
    // 包含所有辅助单位
    if (material.units?.units) {
      material.units.units.forEach(u => {
        if (u.unit) unitSet.add(u.unit);
      });
    }

    return Array.from(unitSet);
  }, [material]);

  const resolveUnitLabel = useCallback(
    (u: string) => {
      const t = String(u).trim();
      if (!t) return '';
      return unitDisplayByKey[t] ?? unitDisplayByKey[normUnitKey(t)] ?? t;
    },
    [unitDisplayByKey]
  );

  const selectOptions = useMemo(
    () => options.map((u) => ({ value: u, label: resolveUnitLabel(u) })),
    [options, resolveUnitLabel]
  );

  /** 与表格内 Input 等单元格一致：继承 td 的字号与正文色 */
  const cellTextStyle: React.CSSProperties = {
    fontSize: 'inherit',
    lineHeight: 'inherit',
    color: 'inherit',
  };

  // 1. 未选物料：不占位提示文案，与其它列视觉一致
  if (materialId == null || materialId === '') {
    return <span style={cellTextStyle}>-</span>;
  }

  // 2. 已选物料、拉详情中且无值：转圈（须在 !materialId 之后，避免误显）
  if (loading && (value == null || value === '')) {
    return <Spin size="small" />;
  }

  // 3. 值优先：详情未返回时仍能展示已保存的单位标签
  if (!material) {
    if (value != null && value !== '') {
      return <span style={cellTextStyle}>{resolveUnitLabel(String(value))}</span>;
    }
    return <span style={cellTextStyle}>-</span>;
  }

  // 4. 单单位：只读文本
  if (options.length <= 1) {
    const raw = value || material.baseUnit || '';
    const display = raw ? resolveUnitLabel(String(raw)) : '';
    return <span style={cellTextStyle}>{display || '-'}</span>;
  }

  // 5. 多单位：下拉（字号随单元格）
  return (
    <Select
      value={value}
      onChange={onChange}
      size={size}
      disabled={disabled}
      placeholder={placeholder}
      style={{ width: '100%', minWidth: 60, fontSize: 'inherit' }}
      variant={noStyle ? 'borderless' : 'outlined'}
      dropdownMatchSelectWidth={false}
      options={selectOptions}
      optionFilterProp="label"
    />
  );
};

export default MaterialUnitSelect;
