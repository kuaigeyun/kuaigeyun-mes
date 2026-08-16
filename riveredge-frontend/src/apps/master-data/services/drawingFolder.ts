/**
 * 图纸仓库文件夹 API
 */

import { api } from '../../../services/api';

export interface DrawingFolder {
  id: number;
  uuid: string;
  tenantId: number;
  name: string;
  parentId?: number | null;
  parentUuid?: string | null;
  sortOrder: number;
  isActive: boolean;
  children?: DrawingFolder[];
}

export interface DrawingFolderCreate {
  name: string;
  parentUuid?: string | null;
  sortOrder?: number;
}

export interface DrawingFolderUpdate {
  name?: string;
  parentUuid?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export const drawingFolderApi = {
  tree: async (): Promise<DrawingFolder[]> => {
    const res = await api.get<{ data: DrawingFolder[] }>('/apps/master-data/process/drawing-folders/tree');
    return res?.data ?? [];
  },

  create: async (data: DrawingFolderCreate): Promise<DrawingFolder> => {
    return api.post<DrawingFolder>('/apps/master-data/process/drawing-folders', data);
  },

  update: async (uuid: string, data: DrawingFolderUpdate): Promise<DrawingFolder> => {
    return api.put<DrawingFolder>(`/apps/master-data/process/drawing-folders/${uuid}`, data);
  },

  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/master-data/process/drawing-folders/${uuid}`);
  },
};
