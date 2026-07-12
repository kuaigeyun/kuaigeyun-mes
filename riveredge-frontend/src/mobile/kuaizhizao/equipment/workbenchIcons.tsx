import React from 'react';
import {
  ScanOutlined,
  CheckCircleOutlined,
  ToolOutlined,
  BellOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';

const ICON_MAP: Record<string, React.ReactNode> = {
  scan: <ScanOutlined />,
  check: <CheckCircleOutlined />,
  tool: <ToolOutlined />,
  bell: <BellOutlined />,
  app: <AppstoreOutlined />,
};

export function renderWorkbenchEntryIcon(iconKey?: string): React.ReactNode {
  const key = (iconKey || 'app').trim().toLowerCase();
  return ICON_MAP[key] ?? ICON_MAP.app;
}
