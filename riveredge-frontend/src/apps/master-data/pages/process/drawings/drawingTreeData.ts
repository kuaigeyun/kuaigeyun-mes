/**
 * 图纸管理左栏导航树：类型 / 状态 / 物料 / 工艺路线
 */

import type { DrawingStatus, DrawingType } from '../../../services/drawing';

export const DRAWING_TREE_ALL_KEY = 'all';

export type DrawingTreeFilter = {
  drawingType?: DrawingType;
  status?: DrawingStatus;
  materialUuid?: string;
  processRouteUuid?: string;
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

