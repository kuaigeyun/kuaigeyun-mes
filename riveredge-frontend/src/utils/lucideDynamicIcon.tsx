/**
 * Lucide 按名称动态加载（避免 `import * as LucideIcons` 把整包打进主 vendor）。
 */
import React from 'react';
import { DynamicIcon, type IconName } from 'lucide-react/dynamic';

export function toLucideKebabName(name: string): string {
  return name
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
}

type LucideIconByNameProps = Omit<React.ComponentProps<typeof DynamicIcon>, 'name'> & {
  name: string;
  fallback?: React.ReactNode;
};

/** 按 PascalCase / kebab-case 名称渲染单个 Lucide 图标（异步分包）。 */
export function LucideIconByName({ name, fallback = null, ...props }: LucideIconByNameProps) {
  const iconName = toLucideKebabName(name);
  if (!iconName) {
    return <>{fallback}</>;
  }
  return <DynamicIcon name={iconName as IconName} {...props} />;
}
