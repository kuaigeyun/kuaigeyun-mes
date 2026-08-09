/**
 * 数据库连接器品牌图标（离线 simple-icons 子集）
 */
import React from 'react';
import { DatabaseOutlined } from '@ant-design/icons';
import { Icon as IconifyIcon, addCollection } from '@iconify/react/dist/offline';
import databaseBrandIcons from '../../../assets/icons/database-brand-icons.json';
import { getDatabaseBrandColor } from './databaseBrandColors';

addCollection(databaseBrandIcons as Parameters<typeof addCollection>[0]);

const BRAND_ICON_IDS = new Set(Object.keys(databaseBrandIcons.icons));

export interface DatabaseBrandIconProps {
  /** 连接器 id 或数据源 type（二者一致） */
  typeOrId: string;
  size?: number;
  style?: React.CSSProperties;
  className?: string;
}

export const DatabaseBrandIcon: React.FC<DatabaseBrandIconProps> = ({
  typeOrId,
  size = 24,
  style,
  className,
}) => {
  const color = getDatabaseBrandColor(typeOrId);

  if (BRAND_ICON_IDS.has(typeOrId)) {
    return (
      <IconifyIcon
        icon={`db-brand:${typeOrId}`}
        width={size}
        height={size}
        className={className}
        style={{ color, flexShrink: 0, ...style }}
      />
    );
  }

  return (
    <DatabaseOutlined
      className={className}
      style={{ fontSize: size, color, flexShrink: 0, ...style }}
    />
  );
};

export default DatabaseBrandIcon;
