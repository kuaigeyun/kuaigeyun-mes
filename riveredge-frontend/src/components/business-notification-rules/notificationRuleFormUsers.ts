import { USER_SPECIFIED_NOTIFICATION_SCOPE } from './notificationRecipientConstants';
import { getFormNotifyUserDefaultsFromRule } from './notificationRuleRecipientFields';
import { normalizeNotificationRulesFromParameters } from './notificationRulePartition';

export { getFormNotifyUserDefaultsFromRule };

export function findEnabledBusinessNotificationRule(
  notifications: unknown,
  triggerDocument: string,
  triggerAction: string,
): Record<string, unknown> | undefined {
  const rules = normalizeNotificationRulesFromParameters(notifications);
  return rules.find(
    (r) =>
      r?.enabled !== false &&
      String(r?.trigger_document || '').trim() === triggerDocument &&
      String(r?.trigger_action || '').trim() === triggerAction,
  ) as Record<string, unknown> | undefined;
}

/** 规则收件范围含「开单用户指定」时，才需要在单据表单上选择通知人员 */
export function notificationRuleRequiresFormNotifyUsers(
  rule: Record<string, unknown> | undefined,
): boolean {
  if (!rule) return false;
  const scopes = Array.isArray(rule.recipient_scopes)
    ? rule.recipient_scopes.map((s) => String(s))
    : [];
  return scopes.includes(USER_SPECIFIED_NOTIFICATION_SCOPE);
}
