import React, { useCallback, useEffect, useState } from 'react';
import { InputNumber } from 'antd';
import type { Material } from '../../apps/master-data/types/material';
import {
  MaterialUnitSelect,
  fetchMaterialForUnitSelectCache,
} from '../material-unit-select';
import {
  convertQuantityBetweenUnits,
  type MaterialScenario,
  resolveMaterialScenarioUnit,
} from '../../utils/materialScenarioUnit';

export type QuantityWithUnitValue = {
  quantity?: number | null;
  unit?: string;
};

export interface QuantityWithUnitProps {
  materialId?: number | string;
  /** 已加载物料时可传入，避免重复请求 */
  material?: Material | null;
  scenario?: MaterialScenario;
  /**
   * 默认单位（如检验单 material_unit）。
   * value.unit 为空时展示并写入，避免单位下拉只显示「单位」占位。
   */
  preferredUnit?: string;
  value?: QuantityWithUnitValue;
  onChange?: (next: QuantityWithUnitValue) => void;
  disabled?: boolean;
  size?: 'large' | 'middle' | 'small';
  quantityMin?: number;
  quantityPrecision?: number;
  quantityPlaceholder?: string;
  unitPlaceholder?: string;
  /** combined：数量+单位同一行；split 保留 flex 但由父级分列使用时仍可用 */
  layout?: 'combined' | 'quantity-only' | 'unit-only';
  style?: React.CSSProperties;
  className?: string;
}

export { QuantityWithUnitDisplay } from './QuantityWithUnitDisplay';
export type { QuantityWithUnitDisplayProps } from './QuantityWithUnitDisplay';
export { DocumentLineUnitSelect } from './DocumentLineUnitSelect';
export type { DocumentLineUnitSelectProps } from './DocumentLineUnitSelect';
export {
  applyDocumentLineUnitChange,
  recalculateQuantityOnUnitChange,
  type DocumentLineUnitFields,
} from './formHelpers';

export const QuantityWithUnit: React.FC<QuantityWithUnitProps> = ({
  materialId,
  material: materialProp,
  scenario = 'sale',
  preferredUnit,
  value,
  onChange,
  disabled = false,
  size='medium',
  quantityMin = 0,
  quantityPrecision = 2,
  quantityPlaceholder,
  unitPlaceholder,
  layout = 'combined',
  style,
  className,
}) => {
  const [material, setMaterial] = useState<Material | null>(materialProp ?? null);

  useEffect(() => {
    if (materialProp) {
      setMaterial(materialProp);
      return;
    }
    if (!materialId) {
      setMaterial(null);
      return;
    }
    let cancelled = false;
    fetchMaterialForUnitSelectCache(materialId).then((resp) => {
      if (!cancelled && resp) setMaterial(resp);
    });
    return () => {
      cancelled = true;
    };
  }, [materialId, materialProp]);

  const resolveDefaultUnit = useCallback(() => {
    const preferred = String(preferredUnit ?? '').trim();
    if (preferred) return preferred;
    return resolveMaterialScenarioUnit(material, scenario);
  }, [preferredUnit, material, scenario]);

  const effectiveUnit = String(value?.unit ?? '').trim() || resolveDefaultUnit();

  // value 尚未带单位时，用默认单位回填，避免下拉长期停在「单位」占位
  useEffect(() => {
    if (!onChange) return;
    if (String(value?.unit ?? '').trim()) return;
    const unit = resolveDefaultUnit();
    if (!unit) return;
    onChange({
      quantity: value?.quantity,
      unit,
    });
  }, [onChange, value?.unit, value?.quantity, resolveDefaultUnit]);

  const handleQuantityChange = useCallback(
    (qty: number | null) => {
      onChange?.({
        quantity: qty ?? undefined,
        unit: String(value?.unit ?? '').trim() || resolveDefaultUnit(),
      });
    },
    [onChange, value?.unit, resolveDefaultUnit],
  );

  const handleUnitChange = useCallback(
    (newUnit: string) => {
      const oldUnit = String(value?.unit ?? '').trim() || resolveDefaultUnit();
      const oldQty = Number(value?.quantity);
      let nextQty = value?.quantity;
      if (Number.isFinite(oldQty) && oldQty > 0 && oldUnit && newUnit && oldUnit !== newUnit) {
        nextQty = convertQuantityBetweenUnits(material, oldQty, oldUnit, newUnit);
      }
      onChange?.({
        quantity: nextQty ?? undefined,
        unit: newUnit,
      });
    },
    [onChange, value?.quantity, value?.unit, material, resolveDefaultUnit],
  );

  const quantityControl = (
    <InputNumber
      value={value?.quantity ?? null}
      onChange={handleQuantityChange}
      min={quantityMin}
      precision={quantityPrecision}
      placeholder={quantityPlaceholder}
      disabled={disabled}
      size={size}
      style={{ width: layout === 'combined' ? '100%' : '100%' }}
    />
  );

  const unitControl = (
    <MaterialUnitSelect
      materialId={materialId ?? material?.id}
      value={effectiveUnit || undefined}
      onChange={handleUnitChange}
      disabled={disabled}
      size={size}
      placeholder={unitPlaceholder}
      noStyle
    />
  );

  if (layout === 'quantity-only') return quantityControl;
  if (layout === 'unit-only') return unitControl;

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        ...style,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>{quantityControl}</div>
      <div style={{ flexShrink: 0, minWidth: 72 }}>{unitControl}</div>
    </div>
  );
};
