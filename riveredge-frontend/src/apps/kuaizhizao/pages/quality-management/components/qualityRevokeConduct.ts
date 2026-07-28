import type { ActionCapability } from '../../../../../hooks/useDocumentCapabilities';

export type QualityInspectionRecordWithCaps = {
  id?: number | null;
  inspection_code?: string | null;
  capabilities?: {
    delete?: ActionCapability;
    revoke_conduct?: ActionCapability;
  } | null;
};

export function filterDeletableQualityInspectionRecords<T extends QualityInspectionRecordWithCaps>(
  records: T[],
): T[] {
  return records.filter((row) => row.capabilities?.delete?.allowed);
}

export function filterRevokeConductQualityInspectionRecords<T extends QualityInspectionRecordWithCaps>(
  records: T[],
): T[] {
  return records.filter((row) => row.capabilities?.revoke_conduct?.allowed);
}
