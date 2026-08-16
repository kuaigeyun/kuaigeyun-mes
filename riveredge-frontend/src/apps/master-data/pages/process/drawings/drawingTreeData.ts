/**
 * 图纸管理左栏：仓库树 + 类型/状态/物料/工艺筛选
 */

import type { DrawingStatus, DrawingType } from '../../../services/drawing';

export const DRAWING_TREE_ALL_KEY = 'all';
export const DRAWING_TREE_UNCLASSIFIED_KEY = 'folder:unclassified';

export type DrawingPaneMode = 'vault' | 'filter';

export type DrawingTreeFilter = {
  drawingType?: DrawingType;
  status?: DrawingStatus;
  materialUuid?: string;
  processRouteUuid?: string;
  folderUuid?: string;
  unclassified?: boolean;
};

export type DrawingTreeNavItem = {
  uuid: string;
  code: string;
  name: string;
};

export function parseDrawingTreeKey(key: string): DrawingTreeFilter {
  if (!key || key === DRAWING_TREE_ALL_KEY || key.startsWith('group:')) {
    return {};
  }
  if (key === DRAWING_TREE_UNCLASSIFIED_KEY) {
    return { unclassified: true };
  }
  if (key.startsWith('folder:')) {
    return { folderUuid: key.slice(7) };
  }
  if (key.startsWith('type:')) {
    return { drawingType: key.slice(5) as DrawingType };
  }
  if (key.startsWith('status:')) {
    return { status: key.slice(7) as DrawingStatus };
  }
  if (key.startsWith('material:')) {
    return { materialUuid: key.slice(9) };
  }
  if (key.startsWith('route:')) {
    return { processRouteUuid: key.slice(6) };
  }
  return {};
}
