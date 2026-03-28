import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Select, Spin } from 'antd';
import { materialApi } from '../../apps/master-data/services/material';
import { getDataDictionaryByCode, getDictionaryItemList } from '../../services/dataDictionary';
import type { Material } from '../../apps/master-data/types/material';

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

// 全局简单缓存，避免同一页面内多次并发请求同一个物料。
// 实际生产中可考虑更完善的缓存机制。
const materialCache: Record<string, Material> = {};

function normUnitKey(s: string): string {
  return String(s).trim().toLowerCase();
}

/** 单位 code / 旧数据里存的展示文案 -> 字典标签（含小写键，兼容大小写不一致） */
function buildUnitDisplayMap(items: { value: string; label: string }[]): Record<string, string> {
  const rec: Record<string, string> = {};
  for (const i of items) {
    const v = String(i.value).trim();
    const l = String(i.label).trim();
    const label = i.label;
    if (v) {
      rec[v] = label;
      rec[normUnitKey(v)] = label;
    }
    if (l) {
      rec[l] = label;
      rec[normUnitKey(l)] = label;
    }
  }
  return rec;
}

async function loadMaterialUnitDisplayMap(): Promise<Record<string, string>> {
  for (const code of ['MATERIAL_UNIT', 'unit'] as const) {
    try {
      const dictionary = await getDataDictionaryByCode(code);
      const items = await getDictionaryItemList(dictionary.uuid, true);
      return buildUnitDisplayMap(items);
    } catch {
      /* try next code */
    }
  }
  return {};
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
    (async () => {
      try {
        const map = await loadMaterialUnitDisplayMap();
        if (!cancelled) setUnitDisplayByKey(map);
      } catch (e) {
        console.error('Failed to load unit dictionary labels:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!materialId) {
      setMaterial(null);
      return;
    }

    const cacheKey = String(materialId);
    
    // 检查缓存
    if (materialCache[cacheKey]) {
      setMaterial(materialCache[cacheKey]);
      return;
    }

    const fetchMaterial = async () => {
      setLoading(true);
      try {
        const idStr = String(materialId);
        let resp: Material | null = null;
        
        // 策略 1：如果看起来像 UUID (带有连字符且长度较长)，直接 GET
        if (idStr.includes('-') && idStr.length > 20) {
          resp = await materialApi.get(idStr);
        } else {
          // 策略 2：通过 list API 搜索（后端通常支持通过 ID/Code 在列表接口进行检索）
          // 这里尝试精确匹配 ID
          const list = await materialApi.list({ limit: 10, keyword: idStr });
          resp = list.find(m => String(m.id) === idStr) || null;
          
          // 策略 3：如果搜索没结果（可能后端 keyword 不支持 ID 精确匹配），最后强制 GET 一次
          if (!resp) {
            try {
              resp = await materialApi.get(idStr);
            } catch (e) {
              // 捕获可能由于格式不正确抛出的 400/404
              console.warn('Direct GET failed for ID:', idStr);
            }
          }
        }

        if (resp) {
          materialCache[cacheKey] = resp;
          setMaterial(resp);
        }
      } catch (error) {
        console.error('Failed to load material units:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMaterial();
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
