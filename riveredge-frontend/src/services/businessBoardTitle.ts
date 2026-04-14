/**
 * 运营看板顶栏标题（租户级，持久化在后端 infra_tenant_configs）
 */

import { apiRequest } from './api';

export interface BusinessBoardTitlePayload {
  title: string | null;
}

export async function getBusinessBoardTitle(): Promise<BusinessBoardTitlePayload> {
  return apiRequest<BusinessBoardTitlePayload>('/core/dashboard/business-board-title', {
    method: 'GET',
  });
}

/** title 为空或 null 表示恢复默认（后端删除租户配置） */
export async function putBusinessBoardTitle(title: string | null): Promise<BusinessBoardTitlePayload> {
  return apiRequest<BusinessBoardTitlePayload>('/core/dashboard/business-board-title', {
    method: 'PUT',
    data: { title: title && title.trim() ? title.trim() : null },
  });
}
