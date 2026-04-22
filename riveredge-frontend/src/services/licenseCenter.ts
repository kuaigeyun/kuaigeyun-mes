import { apiRequest } from './api';

export interface PlatformLicenseItem {
  uuid: string;
  app_code: string;
  alias?: string;
  key_last4: string;
  is_active: boolean;
  remark?: string;
  created_by?: number;
  max_activations: number;
  current_activations: number;
  created_at: string;
  updated_at: string;
  revoked_at?: string;
}

export interface CreatePlatformLicensePayload {
  license_key: string;
  app_code: string;
  max_activations?: number;
  alias?: string;
  remark?: string;
}

export interface GeneratePlatformLicenseKeyResponse {
  license_key: string;
}

export async function listPlatformLicenses(params?: {
  app_code?: string;
  is_active?: boolean;
}): Promise<PlatformLicenseItem[]> {
  return apiRequest<PlatformLicenseItem[]>('/infra/license-center/licenses', {
    method: 'GET',
    params,
  });
}

export async function createPlatformLicense(
  payload: CreatePlatformLicensePayload
): Promise<PlatformLicenseItem> {
  return apiRequest<PlatformLicenseItem>('/infra/license-center/licenses', {
    method: 'POST',
    data: payload,
  });
}

export async function revokePlatformLicense(licenseUuid: string): Promise<PlatformLicenseItem> {
  return apiRequest<PlatformLicenseItem>(`/infra/license-center/licenses/${licenseUuid}/revoke`, {
    method: 'POST',
  });
}

export async function generatePlatformLicenseKey(appCode?: string): Promise<GeneratePlatformLicenseKeyResponse> {
  return apiRequest<GeneratePlatformLicenseKeyResponse>('/infra/license-center/licenses/generate', {
    method: 'GET',
    params: {
      app_code: appCode || undefined,
    },
  });
}

export async function getPlatformLicensePlainKey(licenseUuid: string): Promise<GeneratePlatformLicenseKeyResponse> {
  return apiRequest<GeneratePlatformLicenseKeyResponse>(`/infra/license-center/licenses/${licenseUuid}/plain-key`, {
    method: 'GET',
  });
}

