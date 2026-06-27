import { findEnabledBusinessNotificationRule, getFormNotifyUserDefaultsFromRule } from '../../../components/business-notification-rules/notificationRuleFormUsers';
import { listHaoligoNotifyUserOptions } from '../services/haoligo';
import { getQualityComplaintOverdueNotifyIds } from './qualityComplaintOverdueNotifyDefaults';
import { getQualityIssueOverdueNotifyIdsForKind, resolveQualityIssueKindForOverdueNotify } from './qualityIssueOverdueNotifyDefaults';
import { getQualityLineStopOverdueNotifyIdsForKind } from './qualityLineStopOverdueNotifyDefaults';
import {
  QUALITY_COMPLAINT_OVERDUE_MINISTER_KEYWORDS,
  QUALITY_OVERDUE_MINISTER_KEYWORDS,
  resolveQualityIssueOverdueMinisterKeywords,
  resolveQualityLineStopOverdueMinisterKeywords,
} from './qualityMeta';

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

export async function resolveMinisterUserIdsByKeywords(keywords: readonly string[]): Promise<number[]> {
  const groups: number[][] = [];
  for (const keyword of keywords) {
    const rows = await listHaoligoNotifyUserOptions({ keyword, limit: 30 });
    const matched = rows.filter((row) => row.label.includes(keyword)).map((row) => row.id);
    groups.push(matched);
  }
  return mergeUniqueIds(...groups);
}

export async function resolveQualityOverdueMinisterUserIds(): Promise<number[]> {
  return resolveMinisterUserIdsByKeywords(QUALITY_OVERDUE_MINISTER_KEYWORDS);
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

export async function resolveQualityIssueOverdueNotifySeedIds(
  notifications: unknown,
  triggerDocument: string,
  action: 'temporary_overdue' | 'long_term_overdue',
  issueKind: string | null | undefined,
  existingIds?: number[] | null,
  haoligoParameters?: Record<string, unknown> | null,
  equipmentId?: number | null,
): Promise<number[]> {
  const current = mergeUniqueIds([Array.isArray(existingIds) ? existingIds.map((x) => Number(x)) : []]);
  if (current.length) return current;
  const rule = findEnabledBusinessNotificationRule(notifications, triggerDocument, action);
  const fromRules = getFormNotifyUserDefaultsFromRule(rule);
  if (fromRules.length) return fromRules;
  const resolvedKind = resolveQualityIssueKindForOverdueNotify({
    issue_kind: issueKind,
    equipment_id: equipmentId,
  });
  const fromKind = getQualityIssueOverdueNotifyIdsForKind(haoligoParameters, resolvedKind);
  if (fromKind.length) return fromKind;
  return resolveMinisterUserIdsByKeywords(resolveQualityIssueOverdueMinisterKeywords(resolvedKind));
}

export async function resolveQualityComplaintOverdueNotifySeedIds(
  notifications: unknown,
  triggerDocument: string,
  action: 'temporary_overdue' | 'long_term_overdue',
  existingIds?: number[] | null,
  haoligoParameters?: Record<string, unknown> | null,
): Promise<number[]> {
  const current = mergeUniqueIds([Array.isArray(existingIds) ? existingIds.map((x) => Number(x)) : []]);
  if (current.length) return current;
  const rule = findEnabledBusinessNotificationRule(notifications, triggerDocument, action);
  const fromRules = getFormNotifyUserDefaultsFromRule(rule);
  if (fromRules.length) return fromRules;
  const fromConfig = getQualityComplaintOverdueNotifyIds(haoligoParameters);
  if (fromConfig.length) return fromConfig;
  return resolveMinisterUserIdsByKeywords(QUALITY_COMPLAINT_OVERDUE_MINISTER_KEYWORDS);
}

export async function resolveQualityLineStopOverdueNotifySeedIds(
  notifications: unknown,
  triggerDocument: string,
  action: 'temporary_overdue' | 'long_term_overdue',
  stopKind: string | null | undefined,
  existingIds?: number[] | null,
  haoligoParameters?: Record<string, unknown> | null,
): Promise<number[]> {
  const current = mergeUniqueIds([Array.isArray(existingIds) ? existingIds.map((x) => Number(x)) : []]);
  if (current.length) return current;
  const rule = findEnabledBusinessNotificationRule(notifications, triggerDocument, action);
  const fromRules = getFormNotifyUserDefaultsFromRule(rule);
  if (fromRules.length) return fromRules;
  const fromKind = getQualityLineStopOverdueNotifyIdsForKind(haoligoParameters, stopKind);
  if (fromKind.length) return fromKind;
  return resolveMinisterUserIdsByKeywords(resolveQualityLineStopOverdueMinisterKeywords(stopKind));
}
