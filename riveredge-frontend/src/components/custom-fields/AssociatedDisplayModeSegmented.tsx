/**
 * 关联对象 / 关联属性 — 展示方式分段选择（管理端配置）
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { ThemedSegmented } from '../themed-segmented';
import {
  getAssociatedDisplayModeOptions,
  type AssociatedDisplayMode,
} from './customFieldAssociatedDisplayMode';

const DISPLAY_MODE_I18N_KEY: Record<AssociatedDisplayMode, string> = {
  select: 'field.customField.displayModeSelect',
  multiselect: 'field.customField.displayModeMultiselect',
  radio: 'field.customField.displayModeRadio',
  display: 'field.customField.displayModeDisplay',
  input: 'field.customField.displayModeInput',
  number: 'field.customField.displayModeNumber',
};

export interface AssociatedDisplayModeSegmentedProps {
  fieldKind: 'associated_object' | 'associated_attribute';
  hasSourceField: boolean;
  value?: AssociatedDisplayMode;
  onChange?: (value: AssociatedDisplayMode) => void;
  disabled?: boolean;
}

export const AssociatedDisplayModeSegmented: React.FC<AssociatedDisplayModeSegmentedProps> = ({
  fieldKind,
  hasSourceField,
  value,
  onChange,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const modes = getAssociatedDisplayModeOptions(fieldKind, hasSourceField);

  return (
    <ThemedSegmented
      block
      disabled={disabled}
      value={value ?? modes[0]}
      onChange={(next) => onChange?.(next as AssociatedDisplayMode)}
      options={modes.map((mode) => ({
        label: t(DISPLAY_MODE_I18N_KEY[mode]),
        value: mode,
      }))}
    />
  );
};
