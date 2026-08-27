/**
 * 仓储单据明细行数量展示：数量列带单位（QuantityWithUnitDisplay）。
 * 头表总数量可能混单位，禁止在列表总数量列附带单位。
 */

import React from 'react';
import { QuantityWithUnitDisplay } from '../../../../../components/quantity-with-unit';

/** 明细行数量：始终带该行单位 */
export function renderWarehouseLineQuantity(
  quantity: unknown,
  unit?: unknown,
): React.ReactNode {
  return <QuantityWithUnitDisplay quantity={quantity} unit={unit} />;
}
