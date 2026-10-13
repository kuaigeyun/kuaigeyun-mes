import React from 'react';

export interface MaterialUnitLabelProps {
  value?: string | null;
  emptyText?: string;
}

function coerceUnitRaw(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }
  return '';
}

/**
 * 展示业务字段中的单位文案。
 * 真源：写入时即为单位目录 name；禁止在此做 code→name 映射。
 */
export const MaterialUnitLabel: React.FC<MaterialUnitLabelProps> = ({
  value,
  emptyText = '-',
}) => {
  const raw = coerceUnitRaw(value);
  if (!raw) return <>{emptyText}</>;
  return <>{raw}</>;
};

export default MaterialUnitLabel;
