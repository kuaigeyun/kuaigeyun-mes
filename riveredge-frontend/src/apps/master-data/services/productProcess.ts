import { api } from '../../../services/api';
import type { MaterialProductProcess, MaterialProductProcessSave } from '../types/productProcess';

export const productProcessApi = {
  get: async (materialUuid: string): Promise<MaterialProductProcess> => {
    return api.get(`/apps/master-data/process/materials/${materialUuid}/product-process`);
  },

  save: async (
    materialUuid: string,
    data: MaterialProductProcessSave,
  ): Promise<MaterialProductProcess> => {
    return api.put(`/apps/master-data/process/materials/${materialUuid}/product-process`, data);
  },
};
