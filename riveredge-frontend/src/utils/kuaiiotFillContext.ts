import { apiRequest } from '../services/api';

export type FillContext = {
  values: Record<string, unknown>;
  device_uuid?: string;
  equipment_uuid?: string;
};

export async function fetchKuaiiotFillContext(params: {
  context: 'reporting' | 'spot_check';
  equipment_uuid?: string;
  device_uuid?: string;
}): Promise<FillContext | null> {
  try {
    return await apiRequest<FillContext>('/apps/kuaiiot/fill-context', {
      method: 'GET',
      params,
    });
  } catch {
    return null;
  }
}
