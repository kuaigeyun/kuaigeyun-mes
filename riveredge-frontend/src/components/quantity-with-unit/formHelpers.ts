import type { FormInstance } from 'antd/es/form';
import type { Material } from '../../apps/master-data/types/material';
import { convertQuantityBetweenUnits } from '../../utils/materialScenarioUnit';

export type DocumentLineUnitFields = {
  quantity: string;
  unit: string;
};

export function recalculateQuantityOnUnitChange(params: {
  material: Material | null | undefined;
  currentQuantity: number | null | undefined;
  oldUnit: string | null | undefined;
  newUnit: string;
}): number {
  const qty = Number(params.currentQuantity);
  if (!Number.isFinite(qty)) return qty;
  return convertQuantityBetweenUnits(
    params.material,
    qty,
    params.oldUnit,
    params.newUnit,
  );
}

/** 明细表单位切换：同步更新同行数量（按物料换算表重算） */
export function applyDocumentLineUnitChange(
  form: FormInstance,
  listName: string,
  rowIndex: number,
  fields: DocumentLineUnitFields,
  newUnit: string,
  material: Material | null | undefined,
): void {
  const items = form.getFieldValue(listName) ?? [];
  const row = items[rowIndex] ?? {};
  const newQty = recalculateQuantityOnUnitChange({
    material,
    currentQuantity: row[fields.quantity],
    oldUnit: row[fields.unit],
    newUnit,
  });
  const nextItems = [...items];
  nextItems[rowIndex] = {
    ...row,
    [fields.unit]: newUnit,
    [fields.quantity]: newQty,
  };
  form.setFieldsValue({ [listName]: nextItems });
}
