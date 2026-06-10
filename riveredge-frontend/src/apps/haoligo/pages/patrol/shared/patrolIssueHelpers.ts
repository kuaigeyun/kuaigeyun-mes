import {
  createDictionaryItem,
  type DictionaryItem,
} from '../../../../../services/dataDictionary';
import type { HazardRow } from '../../../services/haoligo';

export const PATROL_ISSUE_TYPE_DICT_CODE = 'HAOLIGO_PATROL_ISSUE_TYPE';
export const PATROL_ISSUE_TYPE_OTHER = '其他';

export type PatrolCustomIssueItem = {
  text: string;
  addToCommon: boolean;
};

export function hazardIssueTypeCodes(row: Pick<HazardRow, 'issue_type_codes' | 'issue_type_code'>): string[] {
  const fromList = row.issue_type_codes?.filter(Boolean) ?? [];
  if (fromList.length) return fromList;
  const legacy = row.issue_type_code?.trim();
  return legacy ? [legacy] : [];
}

/** 字典勾选列表：排除「其他」（由「其他问题」按钮单独维护） */
export function filterPatrolDictionaryIssueTypes(issueTypes: DictionaryItem[]): DictionaryItem[] {
  return issueTypes.filter((it) => it.value !== PATROL_ISSUE_TYPE_OTHER);
}

export function splitHazardIssueTypesForForm(
  codes: string[],
  issueTypes: DictionaryItem[],
  problemSummary?: string | null,
): { dictCodes: string[]; customIssueItems: PatrolCustomIssueItem[] } {
  const dictValues = new Set(filterPatrolDictionaryIssueTypes(issueTypes).map((it) => it.value));
  const dictCodes = codes.filter((c) => c !== PATROL_ISSUE_TYPE_OTHER && dictValues.has(c));
  const customIssueItems: PatrolCustomIssueItem[] = [];

  for (const code of codes) {
    if (code === PATROL_ISSUE_TYPE_OTHER) continue;
    if (!dictValues.has(code)) {
      customIssueItems.push({ text: code, addToCommon: false });
    }
  }

  const summary = problemSummary?.trim();
  if (codes.includes(PATROL_ISSUE_TYPE_OTHER) && summary) {
    const exists = customIssueItems.some((item) => item.text === summary);
    if (!exists) {
      customIssueItems.push({ text: summary, addToCommon: false });
    }
  }

  return { dictCodes, customIssueItems };
}

export function formatIssueTypeLabels(
  codes: string[],
  issueTypes: DictionaryItem[],
  problemSummary?: string | null,
): string {
  if (!codes.length) return '—';
  const summary = problemSummary?.trim();
  return codes
    .map((c) => {
      if (c === PATROL_ISSUE_TYPE_OTHER && summary) {
        return summary;
      }
      return issueTypes.find((it) => it.value === c)?.label || c;
    })
    .join('、');
}

export async function finalizePatrolIssueTypesForSubmit(params: {
  issueTypeCodes: string[];
  customIssueItems: PatrolCustomIssueItem[];
  issueTypes: DictionaryItem[];
  issueTypeDictUuid: string;
}): Promise<{ issueTypeCodes: string[]; problemSummary?: string; issueTypesChanged: boolean }> {
  const dictCodes = params.issueTypeCodes.filter((c) => c !== PATROL_ISSUE_TYPE_OTHER);
  const mergedCodes = [...dictCodes];
  let issueTypesChanged = false;

  for (const item of params.customIssueItems) {
    const text = item.text.trim();
    if (!text) continue;

    const existsInDict = params.issueTypes.some((it) => it.value === text || it.label === text);
    if (item.addToCommon && !existsInDict) {
      const maxSort = params.issueTypes.reduce((max, it) => Math.max(max, it.sort_order ?? 0), 0);
      await createDictionaryItem(params.issueTypeDictUuid, {
        label: text,
        value: text,
        is_active: true,
        sort_order: maxSort + 1,
      });
      issueTypesChanged = true;
    }

    if (!mergedCodes.includes(text)) {
      mergedCodes.push(text);
    }
  }

  if (!mergedCodes.length) {
    throw new Error('ISSUE_TYPE_REQUIRED');
  }

  return {
    issueTypeCodes: mergedCodes,
    issueTypesChanged,
  };
}
