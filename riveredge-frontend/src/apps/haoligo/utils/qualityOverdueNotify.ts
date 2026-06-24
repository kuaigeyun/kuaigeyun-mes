import { findEnabledBusinessNotificationRule, getFormNotifyUserDefaultsFromRule } from '../../../components/business-notification-rules/notificationRuleFormUsers';
import { listHaoligoNotifyUserOptions } from '../services/haoligo';
import { QUALITY_OVERDUE_MINISTER_KEYWORDS } from './qualityMeta';

function mergeUniqueIds(...groups: number[][]): number[] {
  const ids = new Set<number>();
  for (const group of groups) {
    for (const id of group) {
      if (Number.isFinite(id) && id > 0) ids.add(id);
    }
  }
  return [...ids];
}

export function resolveQualityOverdueNotifyDefaultsFromRules(
  notifications: unknown,
  triggerDocument: string,
): number[] {
  const actions = ['temporary_overdue', 'long_term_overdue'] as const;
  const groups: number[][] = [];
  for (const action of actions) {
    const rule = findEnabledBusinessNotificationRule(notifications, triggerDocument, action);
    groups.push(getFormNotifyUserDefaultsFromRule(rule));
  }
  return mergeUniqueIds(...groups);
}

export async function resolveQualityOverdueMinisterUserIds(): Promise<number[]> {
  const groups: number[][] = [];
  for (const keyword of QUALITY_OVERDUE_MINISTER_KEYWORDS) {
    const rows = await listHaoligoNotifyUserOptions({ keyword, limit: 30 });
    const matched = rows
      .filter((row) => row.label.includes(keyword))
      .map((row) => row.id);
    groups.push(matched);
  }
  return mergeUniqueIds(...groups);
}

export async function resolveQualityOverdueNotifySeedIds(
  notifications: unknown,
  triggerDocument: string,
  existingIds?: number[] | null,
): Promise<number[]> {
  const current = mergeUniqueIds([Array.isArray(existingIds) ? existingIds.map((x) => Number(x)) : []]);
  if (current.length) return current;
  const fromRules = resolveQualityOverdueNotifyDefaultsFromRules(notifications, triggerDocument);
  if (fromRules.length) return fromRules;
  return resolveQualityOverdueMinisterUserIds();
}
