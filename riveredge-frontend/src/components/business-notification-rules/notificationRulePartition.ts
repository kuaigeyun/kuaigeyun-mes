import { isHaoligoNotificationDocument } from '../../apps/haoligo/constants/notificationRules';

export function normalizeNotificationRulesFromParameters(notifications: unknown): any[] {
  if (notifications == null) return [];
  if (Array.isArray(notifications)) return notifications;
  if (typeof notifications !== 'object') return [];
  const raw = notifications as { rules?: unknown };
  if (Array.isArray(raw.rules)) return raw.rules;
  return [];
}

/** 按当前可配置的单据类型拆分：未开通应用的规则保留但不展示、不编辑 */
export function partitionRulesByAvailableDocuments(
  rules: any[],
  availableDocuments: ReadonlySet<string>,
): { visible: any[]; hidden: any[] } {
  const visible: any[] = [];
  const hidden: any[] = [];
  for (const rule of rules) {
    const doc = String(rule?.trigger_document || '');
    if (!doc || availableDocuments.has(doc)) {
      visible.push(rule);
    } else {
      hidden.push(rule);
    }
  }
  return { visible, hidden };
}

export function isHaoligoNotificationDocumentCode(documentCode: string): boolean {
  return isHaoligoNotificationDocument(documentCode);
}
