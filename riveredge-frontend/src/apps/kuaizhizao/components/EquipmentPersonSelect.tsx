import React from 'react';
import { Form, Input } from 'antd';
import type { ProFormInstance } from '@ant-design/pro-components';
import { UniUserSelect } from '../../../components/uni-user-select';
import { resolveUserDisplay, type User } from '../../../services/user';

export interface EquipmentPersonSelectProps {
  uuidFieldName: string;
  idFieldName: string;
  nameFieldName: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  formRef: React.RefObject<ProFormInstance | undefined>;
}

function pickUser(user: User | User[] | undefined): User | undefined {
  if (!user) return undefined;
  return Array.isArray(user) ? user[0] : user;
}

export function syncEquipmentPersonFields(
  formRef: React.RefObject<ProFormInstance | undefined>,
  idFieldName: string,
  nameFieldName: string,
  user: User | User[] | undefined,
) {
  const picked = pickUser(user);
  formRef.current?.setFieldsValue({
    [idFieldName]: picked?.id,
    [nameFieldName]: picked ? picked.full_name || picked.username : undefined,
  });
}

export async function resolveUserUuidById(userId?: number | null): Promise<string | undefined> {
  if (!userId) return undefined;
  try {
    const items = await resolveUserDisplay({ user_ids: [userId] });
    return items[0]?.uuid;
  } catch {
    return undefined;
  }
}

export const EquipmentPersonSelect: React.FC<EquipmentPersonSelectProps> = ({
  uuidFieldName,
  idFieldName,
  nameFieldName,
  label,
  placeholder,
  required,
  formRef,
}) => (
  <>
    <UniUserSelect
      name={uuidFieldName}
      label={label}
      placeholder={placeholder}
      required={required}
      onChange={(_uuid, user) => syncEquipmentPersonFields(formRef, idFieldName, nameFieldName, user)}
    />
    <Form.Item name={idFieldName} hidden>
      <Input />
    </Form.Item>
    <Form.Item name={nameFieldName} hidden>
      <Input />
    </Form.Item>
  </>
);
