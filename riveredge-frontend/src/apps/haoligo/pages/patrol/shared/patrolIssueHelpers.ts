import type { DictionaryItem } from '../../../../../services/dataDictionary';
import type { HazardRow } from '../../../services/haoligo';

export function hazardIssueTypeCodes(row: Pick<HazardRow, 'issue_type_codes' | 'issue_type_code'>): string[] {
  const fromList = row.issue_type_codes?.filter(Boolean) ?? [];
  if (fromList.length) return fromList;
  const legacy = row.issue_type_code?.trim();
  return legacy ? [legacy] : [];
}

export function formatIssueTypeLabels(codes: string[], issueTypes: DictionaryItem[]): string {
  if (!codes.length) return '—';
  return codes
    .map((c) => issueTypes.find((it) => it.value === c)?.label || c)
    .join('、');
}
