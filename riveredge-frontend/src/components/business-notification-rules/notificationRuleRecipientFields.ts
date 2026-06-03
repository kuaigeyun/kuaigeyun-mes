import { USER_SPECIFIED_NOTIFICATION_SCOPE } from './notificationRecipientConstants';

export function ruleHasUserSpecifiedScope(rule: Record<string, unknown> | undefined): boolean {
  if (!rule) return false;
  const scopes = Array.isArray(rule.recipient_scopes)
    ? rule.recipient_scopes.map((s) => String(s))
    : [];
  return scopes.includes(USER_SPECIFIED_NOTIFICATION_SCOPE);
}

function normalizeUserIdList(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => Number(v)).filter((id) => Number.isFinite(id) && id > 0);
}

/** 规则固定收件人（每次均通知，开单不可改） */
export function getFixedRecipientUserIdsFromRule(
  rule: Record<string, unknown> | undefined,
): number[] {
  if (!rule) return [];
  const fixed = normalizeUserIdList(rule.recipient_user_ids);
  if (!ruleHasUserSpecifiedScope(rule)) return fixed;
  const defaults = normalizeUserIdList(rule.form_notify_default_user_ids);
  if (defaults.length) return fixed;
  if (Array.isArray(rule.form_notify_default_user_ids)) return fixed;
  return [];
}

/** 开单用户指定 · 默认人员（仅当表单未选人时使用） */
export function getFormNotifyUserDefaultsFromRule(
  rule: Record<string, unknown> | undefined,
): number[] {
  if (!rule) return [];
  const dedicated = normalizeUserIdList(rule.form_notify_default_user_ids);
  if (dedicated.length) return dedicated;
  if (ruleHasUserSpecifiedScope(rule)) {
    return normalizeUserIdList(rule.recipient_user_ids);
  }
  return [];
}

export function splitRuleRecipientUserFields(
  raw: Record<string, unknown> | undefined,
  enableFormUserNotify: boolean,
): { recipient_user_ids: number[]; form_notify_default_user_ids: number[] } {
  const fixed = getFixedRecipientUserIdsFromRule(raw);
  const defaults = getFormNotifyUserDefaultsFromRule(raw);
  if (!enableFormUserNotify) {
    return {
      recipient_user_ids: normalizeUserIdList(raw?.recipient_user_ids),
      form_notify_default_user_ids: [],
    };
  }
  return { recipient_user_ids: fixed, form_notify_default_user_ids: defaults };
}

export function toRecipientUserIdFieldValues(values: Record<string, unknown>): {
  recipient_user_ids: number[];
  form_notify_default_user_ids: number[];
} {
  const toNums = (key: string) =>
    (Array.isArray(values[key]) ? values[key] : [])
      .map((v) => Number(v))
      .filter((id) => Number.isFinite(id) && id > 0);
  const enableForm = Boolean(values.enable_form_user_notify);
  return {
    recipient_user_ids: toNums('recipient_user_ids'),
    form_notify_default_user_ids: enableForm ? toNums('form_notify_default_user_ids') : [],
  };
}
