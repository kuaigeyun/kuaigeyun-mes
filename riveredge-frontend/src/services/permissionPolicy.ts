import { apiRequest } from './api';
import type { UserFieldMaskMap } from '../utils/fieldMaskPermission';

export async function getMyFieldMasks(): Promise<UserFieldMaskMap> {
  return apiRequest<UserFieldMaskMap>('/core/permission-policies/me/field-masks');
}
