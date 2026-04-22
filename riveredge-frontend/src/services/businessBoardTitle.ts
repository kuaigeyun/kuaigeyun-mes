/**
 * 运营看板外观（顶栏标题、中间配图，租户级，持久化在后端 infra_tenant_configs）
 */

import { apiRequest } from './api';

export interface BusinessBoardTitlePayload {
  title: string | null;
  /** 中间配图文件 UUID，空表示使用系统默认 /img/dashboard.png */
  hero_image_uuid: string | null;
}

export async function getBusinessBoardTitle(): Promise<BusinessBoardTitlePayload> {
  return apiRequest<BusinessBoardTitlePayload>('/core/dashboard/business-board-title', {
    method: 'GET',
  });
}

/** title / hero_image_uuid 均为空则恢复全部默认（后端删除租户配置） */
export async function putBusinessBoardTitle(payload: {
  title: string | null;
  hero_image_uuid: string | null;
}): Promise<BusinessBoardTitlePayload> {
  return apiRequest<BusinessBoardTitlePayload>('/core/dashboard/business-board-title', {
    method: 'PUT',
    data: {
      title: payload.title && payload.title.trim() ? payload.title.trim() : null,
      hero_image_uuid: payload.hero_image_uuid?.trim() || null,
    },
  });
}
