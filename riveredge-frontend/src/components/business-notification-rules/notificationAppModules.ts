/**
 * 已开通应用的消息提醒扩展注册（单据/动作/收件范围按 app code 挂载）
 */

import {
  HAOLIGO_NOTIFICATION_ACTION_OPTIONS,
  HAOLIGO_NOTIFICATION_DOCUMENT_OPTIONS,
  HAOLIGO_NOTIFICATION_RECIPIENT_SCOPES,
} from '../../apps/haoligo/constants/notificationRules';
import { loadHaoligoNotificationRulePresets } from '../../apps/haoligo/services/haoligo';
import {
  CORE_NOTIFICATION_ACTION_OPTIONS,
  CORE_NOTIFICATION_DOCUMENT_OPTIONS,
  CORE_NOTIFICATION_RECIPIENT_SCOPES,
} from './coreNotificationRules';
import { USER_SPECIFIED_SCOPE_OPTION } from './notificationRecipientConstants';

export type NotificationDocumentOption = { value: string; labelKey: string; fallback: string };

export type NotificationPresetLoader = () => Promise<{
  created: number;
  total_rules: number;
  skipped_missing_template?: number;
}>;

export type NotificationAppModule = {
  appCode: string;
  documentOptions: readonly NotificationDocumentOption[];
  actionOptions: Record<string, Array<{ value: string; labelKey: string; fallback: string }>>;
  extraRecipientScopes: Array<{ value: string; labelKey: string; fallback: string }>;
  loadPresets?: NotificationPresetLoader;
};

/** 各应用消息提醒能力注册（未开通的应用不会出现在配置中） */
export const NOTIFICATION_APP_MODULES: Record<string, NotificationAppModule> = {
  kuaizhizao: {
    appCode: 'kuaizhizao',
    documentOptions: CORE_NOTIFICATION_DOCUMENT_OPTIONS,
    actionOptions: CORE_NOTIFICATION_ACTION_OPTIONS,
    extraRecipientScopes: [],
  },
  haoligo: {
    appCode: 'haoligo',
    documentOptions: HAOLIGO_NOTIFICATION_DOCUMENT_OPTIONS,
    actionOptions: HAOLIGO_NOTIFICATION_ACTION_OPTIONS,
    extraRecipientScopes: HAOLIGO_NOTIFICATION_RECIPIENT_SCOPES,
    loadPresets: loadHaoligoNotificationRulePresets,
  },
};

export function buildNotificationConfig(installedAppCodes: ReadonlySet<string>) {
  const documentOptions: NotificationDocumentOption[] = [];
  const actionOptions: Record<string, Array<{ value: string; labelKey: string; fallback: string }>> = {};
  const extraRecipientScopes: Array<{ value: string; labelKey: string; fallback: string }> = [];
  const presetLoaders: NotificationPresetLoader[] = [];

  for (const code of installedAppCodes) {
    const mod = NOTIFICATION_APP_MODULES[code];
    if (!mod) continue;
    documentOptions.push(...mod.documentOptions);
    Object.assign(actionOptions, mod.actionOptions);
    extraRecipientScopes.push(...mod.extraRecipientScopes);
    if (mod.loadPresets) presetLoaders.push(mod.loadPresets);
  }

  const availableDocuments = new Set(documentOptions.map((d) => d.value));
  const baseRecipientScopes = installedAppCodes.has('kuaizhizao')
    ? [...CORE_NOTIFICATION_RECIPIENT_SCOPES]
    : documentOptions.length > 0
      ? CORE_NOTIFICATION_RECIPIENT_SCOPES.filter((s) => s.value === 'creator')
      : [];

  return {
    documentOptions,
    actionOptions,
    extraRecipientScopes,
    baseRecipientScopes,
    formUserScopeOption: documentOptions.length > 0 ? USER_SPECIFIED_SCOPE_OPTION : null,
    presetLoaders,
    availableDocuments,
  };
}
