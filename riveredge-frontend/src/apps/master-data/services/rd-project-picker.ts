/**
 * 主数据工程图纸关联研发项目：只读列表（API 在快研发应用，不依赖 compose kuaiplm 前端包）
 */

import { api } from '../../../services/api';

const BASE = '/apps/kuaiplm/rd-projects';

export interface RdProjectPickerItem {
  id?: number;
  project_code?: string;
  project_name?: string;
}

type ListResponse = { items?: RdProjectPickerItem[]; total?: number };

export async function listRdProjectsForDrawingPicker(params?: {
  keyword?: string;
  limit?: number;
}): Promise<{ items: RdProjectPickerItem[]; total: number }> {
  const res = await api.get<ListResponse | RdProjectPickerItem[]>(BASE, {
    params: {
      keyword: params?.keyword?.trim() || undefined,
      limit: params?.limit ?? 50,
      project_type: 'RD',
    },
  });
  if (Array.isArray(res)) {
    return { items: res, total: res.length };
  }
  const items = res?.items ?? [];
  return { items, total: res?.total ?? items.length };
}
