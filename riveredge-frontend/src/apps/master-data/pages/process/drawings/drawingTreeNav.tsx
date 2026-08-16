/**
 * 图纸管理左栏导航：四种分类模式 + 带图标的树节点
 */

import React from 'react';
import type { DataNode } from 'antd/es/tree';
import type { TFunction } from 'i18next';
import {
  AppstoreOutlined,
  AuditOutlined,
  BlockOutlined,
  BranchesOutlined,
  BuildOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EditOutlined,
  LockOutlined,
  FileOutlined,
  FolderOutlined,
  InboxOutlined,
  ProductOutlined,
  StopOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import type { DrawingStatus, DrawingType } from '../../../services/drawing';
import type { DrawingFolder } from '../../../services/drawingFolder';
import {
  DRAWING_TREE_ALL_KEY,
  DRAWING_TREE_UNCLASSIFIED_KEY,
  type DrawingTreeNavItem,
} from './drawingTreeData';

export type DrawingNavMode = 'type' | 'status' | 'material' | 'route';

export const DRAWING_NAV_MODES: {
  mode: DrawingNavMode;
  icon: React.ComponentType<{ style?: React.CSSProperties }>;
  labelKey: string;
}[] = [
  { mode: 'type', icon: AppstoreOutlined, labelKey: 'app.master-data.drawings.tree.byType' },
  { mode: 'status', icon: AuditOutlined, labelKey: 'app.master-data.drawings.tree.byStatus' },
  { mode: 'material', icon: ProductOutlined, labelKey: 'app.master-data.drawings.tree.byMaterial' },
  { mode: 'route', icon: BranchesOutlined, labelKey: 'app.master-data.drawings.tree.byRoute' },
];

const DRAWING_TYPES: DrawingType[] = ['part', 'assembly', 'process', 'other'];
const DRAWING_STATUSES: DrawingStatus[] = ['Draft', 'Editing', 'Pending', 'Released', 'Obsolete'];

const TYPE_ICONS: Record<DrawingType, React.ReactNode> = {
  part: <BlockOutlined />,
  assembly: <BuildOutlined />,
  process: <ToolOutlined />,
  other: <FileOutlined />,
};

const STATUS_ICONS: Record<DrawingStatus, React.ReactNode> = {
  Draft: <EditOutlined />,
  Editing: <LockOutlined />,
  Pending: <ClockCircleOutlined />,
  Released: <CheckCircleOutlined />,
  Obsolete: <StopOutlined />,
};

function matchSearch(text: string, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  return text.toLowerCase().includes(q);
}

export function treeKeyBelongsToMode(key: string, mode: DrawingNavMode): boolean {
  if (!key || key === DRAWING_TREE_ALL_KEY) return true;
  if (mode === 'type') return key.startsWith('type:');
  if (mode === 'status') return key.startsWith('status:');
  if (mode === 'material') return key.startsWith('material:');
  if (mode === 'route') return key.startsWith('route:');
  return false;
}

export function isVaultTreeKey(key: string): boolean {
  return !key || key === DRAWING_TREE_ALL_KEY || key.startsWith('folder:');
}

export function folderUuidFromTreeKey(key: string): string | null {
  if (!key.startsWith('folder:') || key === DRAWING_TREE_UNCLASSIFIED_KEY) return null;
  return key.slice(7);
}

export function inferNavModeFromTreeKey(key: string): DrawingNavMode | null {
  if (key.startsWith('type:')) return 'type';
  if (key.startsWith('status:')) return 'status';
  if (key.startsWith('material:')) return 'material';
  if (key.startsWith('route:')) return 'route';
  return null;
}

export function buildDrawingNavTree(
  mode: DrawingNavMode,
  t: TFunction,
  materials: DrawingTreeNavItem[],
  routes: DrawingTreeNavItem[],
  search = '',
): DataNode[] {
  const allLabel = t('app.master-data.drawings.tree.all');
  const nodes: DataNode[] = [];

  if (matchSearch(allLabel, search)) {
    nodes.push({
      key: DRAWING_TREE_ALL_KEY,
      title: allLabel,
      icon: <AppstoreOutlined />,
      isLeaf: true,
    });
  }

  if (mode === 'type') {
    DRAWING_TYPES.forEach((type) => {
      const title = t(`app.master-data.drawings.type.${type}`);
      if (!matchSearch(title, search)) return;
      nodes.push({
        key: `type:${type}`,
        title,
        icon: TYPE_ICONS[type],
        isLeaf: true,
      });
    });
  }

  if (mode === 'status') {
    DRAWING_STATUSES.forEach((status) => {
      const title = t(`app.master-data.drawings.status.${status}`);
      if (!matchSearch(title, search)) return;
      nodes.push({
        key: `status:${status}`,
        title,
        icon: STATUS_ICONS[status],
        isLeaf: true,
      });
    });
  }

  if (mode === 'material') {
    const materialNodes = materials
      .filter((m) => matchSearch(`${m.code} ${m.name}`, search))
      .slice(0, 200)
      .map((m) => ({
        key: `material:${m.uuid}`,
        title: `${m.code} ${m.name}`.trim(),
        icon: <ProductOutlined />,
        isLeaf: true,
      }));

    if (materialNodes.length) {
      nodes.push(...materialNodes);
    } else if (!search.trim()) {
      nodes.push({
        key: 'material:empty',
        title: t('app.master-data.drawings.tree.emptyMaterial'),
        disabled: true,
        isLeaf: true,
      });
    }
  }

  if (mode === 'route') {
    const routeNodes = routes
      .filter((r) => matchSearch(`${r.code} ${r.name}`, search))
      .slice(0, 200)
      .map((r) => ({
        key: `route:${r.uuid}`,
        title: `${r.code} ${r.name}`.trim(),
        icon: <BranchesOutlined />,
        isLeaf: true,
      }));

    if (routeNodes.length) {
      nodes.push(...routeNodes);
    } else if (!search.trim()) {
      nodes.push({
        key: 'route:empty',
        title: t('app.master-data.drawings.tree.emptyRoute'),
        disabled: true,
        isLeaf: true,
      });
    }
  }

  return nodes.length
    ? nodes
    : [
        {
          key: DRAWING_TREE_ALL_KEY,
          title: allLabel,
          icon: <AppstoreOutlined />,
          isLeaf: true,
        },
      ];
}

function mapFolderNodes(folders: DrawingFolder[], search: string): DataNode[] {
  return folders
    .map((folder) => {
      const children = mapFolderNodes(folder.children ?? [], search);
      const selfMatch = matchSearch(folder.name, search);
      if (!selfMatch && !children.length) return null;
      return {
        key: `folder:${folder.uuid}`,
        title: folder.name,
        icon: <FolderOutlined />,
        isLeaf: !children.length,
        children: children.length ? children : undefined,
      } as DataNode;
    })
    .filter((node): node is DataNode => node != null);
}

export function buildDrawingVaultTree(
  t: TFunction,
  folders: DrawingFolder[],
  search = '',
): DataNode[] {
  const allLabel = t('app.master-data.drawings.tree.all');
  const unclassifiedLabel = t('app.master-data.drawings.tree.unclassified');
  const nodes: DataNode[] = [];

  if (matchSearch(allLabel, search)) {
    nodes.push({
      key: DRAWING_TREE_ALL_KEY,
      title: allLabel,
      icon: <InboxOutlined />,
      isLeaf: true,
    });
  }
  if (matchSearch(unclassifiedLabel, search)) {
    nodes.push({
      key: DRAWING_TREE_UNCLASSIFIED_KEY,
      title: unclassifiedLabel,
      icon: <FileOutlined />,
      isLeaf: true,
    });
  }
  nodes.push(...mapFolderNodes(folders, search));
  return nodes.length
    ? nodes
    : [
        {
          key: DRAWING_TREE_ALL_KEY,
          title: allLabel,
          icon: <InboxOutlined />,
          isLeaf: true,
        },
      ];
}
