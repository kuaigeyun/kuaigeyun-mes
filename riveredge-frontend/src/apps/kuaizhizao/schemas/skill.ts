/**
 * 技能表单 Schema 配置
 */

import type { FieldConfig } from '../../../components/schema-form';

export const skillFormSchema: FieldConfig[] = [
  {
    name: 'code',
    type: 'text',
    labelKey: 'field.skill.code',
    required: true,
    colSpan: 12,
    rules: [{ required: true, messageKey: 'field.skill.codeRequired' }],
    fieldProps: { style: { textTransform: 'uppercase' } },
  },
  {
    name: 'name',
    type: 'text',
    labelKey: 'field.skill.name',
    required: true,
    colSpan: 12,
    rules: [{ required: true, messageKey: 'field.skill.nameRequired' }],
  },
  {
    name: 'category',
    type: 'text',
    labelKey: 'field.skill.category',
    colSpan: 12,
  },
  {
    name: 'description',
    type: 'textarea',
    labelKey: 'field.skill.description',
    colSpan: 24,
    fieldProps: { rows: 3 },
  },
  {
    name: 'isActive',
    type: 'switch',
    labelKey: 'field.skill.isActive',
    colSpan: 12,
  },
];
