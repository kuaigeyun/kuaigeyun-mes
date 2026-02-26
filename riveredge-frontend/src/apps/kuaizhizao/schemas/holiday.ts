/**
 * 假期表单 Schema 配置
 */

import type { FieldConfig } from '../../../components/schema-form';

export const holidayFormSchema: FieldConfig[] = [
  {
    name: 'name',
    type: 'text',
    labelKey: 'field.holiday.name',
    required: true,
    colSpan: 12,
    rules: [{ required: true, messageKey: 'field.holiday.nameRequired' }],
  },
  {
    name: 'holidayDate',
    type: 'date',
    labelKey: 'field.holiday.holidayDate',
    required: true,
    colSpan: 12,
    rules: [{ required: true, messageKey: 'field.holiday.holidayDateRequired' }],
  },
  {
    name: 'holidayType',
    type: 'text',
    labelKey: 'field.holiday.holidayType',
    colSpan: 12,
  },
  {
    name: 'description',
    type: 'textarea',
    labelKey: 'field.holiday.description',
    colSpan: 24,
    fieldProps: { rows: 3 },
  },
  {
    name: 'isActive',
    type: 'switch',
    labelKey: 'field.holiday.isActive',
    colSpan: 12,
  },
];
