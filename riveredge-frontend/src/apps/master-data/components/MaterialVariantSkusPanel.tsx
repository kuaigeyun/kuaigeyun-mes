/**
 * 主物料详情：属性组合明细表
 */

import React from 'react';
import type { Material } from '../types/material';
import { MaterialVariantCombinationsTable } from './MaterialVariantCombinationsTable';

interface MaterialVariantSkusPanelProps {
  masterMaterial: Material;
  onRefresh?: () => void;
}

export const MaterialVariantSkusPanel: React.FC<MaterialVariantSkusPanelProps> = ({
  masterMaterial,
  onRefresh,
}) => (
  <MaterialVariantCombinationsTable
    material={masterMaterial}
    isEdit
    onVariantsChanged={onRefresh}
  />
);
