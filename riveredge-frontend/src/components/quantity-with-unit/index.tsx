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
  value,
  onChange,
  disabled = false,
  size = 'middle',
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

  const handleQuantityChange = useCallback(
    (qty: number | null) => {
      onChange?.({
        quantity: qty ?? undefined,
        unit: value?.unit ?? resolveMaterialScenarioUnit(material, scenario),
      });
    },
    [onChange, value?.unit, material, scenario],
  );

  const handleUnitChange = useCallback(
    (newUnit: string) => {
      const oldUnit = value?.unit;
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
    [onChange, value?.quantity, value?.unit, material],
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
      value={value?.unit}
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
