import { kuaioaDelete, kuaioaList, kuaioaPost, kuaioaPut } from './kuaioaApi';

const BASE = '/apps/kuaioa/licenses';

export interface ComplianceLicense {
  id: number;
  license_code: string;
  license_name: string;
  license_type: string;
  holder_name?: string | null;
  expiry_date?: string | null;
  status: string;
  days_until_expiry?: number;
}

export const listComplianceLicenses = (params?: Record<string, unknown>) =>
  kuaioaList<ComplianceLicense>(BASE, params);

export const listExpiringLicenses = (withinDays = 30) =>
  kuaioaList<ComplianceLicense>(`${BASE}/expiring`, { within_days: withinDays });

export const createComplianceLicense = (data: Partial<ComplianceLicense>) =>
  kuaioaPost<ComplianceLicense>(BASE, data);

export const updateComplianceLicense = (id: number, data: Partial<ComplianceLicense>) =>
  kuaioaPut<ComplianceLicense>(`${BASE}/${id}`, data);

export const deleteComplianceLicense = (id: number) => kuaioaDelete(`${BASE}/${id}`);
