/**
 * 邀请码表单 Schema
 */

import type { FieldConfig } from '../../../../components/schema-form';

export const invitationCodeFormSchema: FieldConfig[] = [
  {
    name: 'email',
    type: 'text',
    labelKey: 'field.invitationCode.email',
    placeholderKey: 'field.invitationCode.emailPlaceholder',
  },
  {
    name: 'role_id',
    type: 'number',
    labelKey: 'field.invitationCode.roleId',
    placeholderKey: 'field.invitationCode.roleIdPlaceholder',
  },
  {
    name: 'max_uses',
    type: 'number',
    labelKey: 'field.invitationCode.maxUses',
    required: true,
    rules: [{ required: true, messageKey: 'field.invitationCode.maxUsesRequired' }],
    extraKey: 'field.invitationCode.maxUsesExtra',
    fieldProps: { min: 1 },
  },
  {
    name: 'expires_at',
    type: 'datetime',
    labelKey: 'field.invitationCode.expiresAt',
    placeholderKey: 'field.invitationCode.expiresAtPlaceholder',
    extraKey: 'field.invitationCode.expiresAtExtra',
    fieldProps: { allowClear: true },
  },
  {
    name: 'is_active',
    type: 'switch',
    labelKey: 'field.invitationCode.isActive',
  },
];
