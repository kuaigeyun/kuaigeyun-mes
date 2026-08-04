import React, { useCallback } from 'react';
import type { FormInstance } from 'antd/es/form';
import type { Material } from '../../apps/master-data/types/material';
import {
  MaterialUnitSelect,
  fetchMaterialForUnitSelectCache,
  type MaterialUnitSelectProps,
} from '../material-unit-select';
import {
  applyDocumentLineUnitChange,
  type DocumentLineUnitFields,
} from './formHelpers';

export interface DocumentLineUnitSelectProps extends Omit<MaterialUnitSelectProps, 'onChange'> {
  form: FormInstance;
  listName: string;
  rowIndex: number;
  fields: DocumentLineUnitFields;
  /** 页面已加载物料列表时可传入，避免异步拉取 */
  material?: Material | null;
  onUnitChange?: (newUnit: string) => void;
}

/** 明细表单位选择：切换单位时按物料换算表同步重算同行数量 */
export const DocumentLineUnitSelect: React.FC<DocumentLineUnitSelectProps> = ({
  form,
  listName,
  rowIndex,
  fields,
  material: materialProp,
  onUnitChange,
  value,
  ...selectProps
}) => {
  const handleChange = useCallback(
    async (newUnit: string) => {
      let material = materialProp ?? null;
      if (!material && selectProps.materialId != null) {
        material = await fetchMaterialForUnitSelectCache(selectProps.materialId);
      }
      applyDocumentLineUnitChange(form, listName, rowIndex, fields, newUnit, material);
      onUnitChange?.(newUnit);
    },
    [form, listName, rowIndex, fields, materialProp, onUnitChange, selectProps.materialId],
  );

  return (
    <MaterialUnitSelect
      {...selectProps}
      value={value}
      onChange={handleChange}
    />
  );
};
