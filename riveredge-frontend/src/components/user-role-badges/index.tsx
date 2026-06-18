import React from 'react';
import { Space, Tag } from 'antd';

export type UserRoleBadgeItem = {
  uuid?: string;
  name: string;
  code?: string;
};

const ROLE_TAG_COLORS = ['geekblue', 'cyan', 'purple', 'gold', 'green'] as const;

export function UserRoleBadges({ roles }: { roles?: UserRoleBadgeItem[] | null }) {
  if (!roles?.length) return null;
  return (
    <Space size={4} wrap>
      {roles.map((role, index) => (
        <Tag
          key={role.uuid || role.code || role.name}
          bordered
          color={ROLE_TAG_COLORS[index % ROLE_TAG_COLORS.length]}
          style={{ marginInlineEnd: 0 }}
        >
          {role.name}
        </Tag>
      ))}
    </Space>
  );
}

export function renderUserPickOptionLabel(
  label: React.ReactNode,
  roles?: UserRoleBadgeItem[] | null,
): React.ReactNode {
  return (
    <Space size={6} wrap style={{ rowGap: 4 }}>
      <span>{label}</span>
      <UserRoleBadges roles={roles} />
    </Space>
  );
}
