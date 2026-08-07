/**
 * 已开通应用的消息提醒扩展注册（单据/动作/收件范围按 app code 挂载）
 *
 * 定制包（haoligo）通过 import.meta.glob 可选发现：未 compose 时不进入启动主图。
 */

import {
  CORE_NOTIFICATION_ACTION_OPTIONS,
  CORE_NOTIFICATION_DOCUMENT_OPTIONS,
  CORE_NOTIFICATION_RECIPIENT_SCOPES,
} from './coreNotificationRules';
import { USER_SPECIFIED_SCOPE_OPTION } from './notificationRecipientConstants';
import { loadKuaizhizaoNotificationRulePresets } from '../../apps/kuaizhizao/services/notification-rules';

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

const HAOLIGO_NOTIFICATION_CONSTANTS = import.meta.glob(
  '../../apps/haoligo/constants/notificationRules.ts',
);

const HAOLIGO_SERVICES = import.meta.glob('../../apps/haoligo/services/haoligo.ts');

const KUAIIOT_NOTIFICATION_CONSTANTS = import.meta.glob(
  '../../apps/kuaiiot/constants/notificationRules.ts',
);
const KUAIIOT_NOTIFICATION_SERVICES = import.meta.glob(
  '../../apps/kuaiiot/services/notification-rules.ts',
);

let haoligoModulePromise: Promise<NotificationAppModule | null> | null = null;
let kuaiiotModulePromise: Promise<NotificationAppModule | null> | null = null;

async function loadHaoligoNotificationModule(): Promise<NotificationAppModule | null> {
  const constEntry = Object.entries(HAOLIGO_NOTIFICATION_CONSTANTS)[0];
  if (!constEntry) return null;
  const [, loadConstants] = constEntry;
  const constants = (await loadConstants()) as {
    HAOLIGO_NOTIFICATION_DOCUMENT_OPTIONS: NotificationAppModule['documentOptions'];
    HAOLIGO_NOTIFICATION_ACTION_OPTIONS: NotificationAppModule['actionOptions'];
    HAOLIGO_NOTIFICATION_RECIPIENT_SCOPES: NotificationAppModule['extraRecipientScopes'];
  };
  const svcEntry = Object.entries(HAOLIGO_SERVICES)[0];
  let loadPresets: NotificationPresetLoader | undefined;
  if (svcEntry) {
    const services = (await svcEntry[1]()) as {
      loadHaoligoNotificationRulePresets?: NotificationPresetLoader;
    };
    loadPresets = services.loadHaoligoNotificationRulePresets;
  }
  return {
    appCode: 'haoligo',
    documentOptions: constants.HAOLIGO_NOTIFICATION_DOCUMENT_OPTIONS,
    actionOptions: constants.HAOLIGO_NOTIFICATION_ACTION_OPTIONS,
    extraRecipientScopes: [...constants.HAOLIGO_NOTIFICATION_RECIPIENT_SCOPES],
    loadPresets,
  };
}

async function loadKuaiiotNotificationModule(): Promise<NotificationAppModule | null> {
  const constEntry = Object.entries(KUAIIOT_NOTIFICATION_CONSTANTS)[0];
  if (!constEntry) return null;
  const [, loadConstants] = constEntry;
  const constants = (await loadConstants()) as {
    KUAIIOT_NOTIFICATION_DOCUMENT_OPTIONS: NotificationAppModule['documentOptions'];
    KUAIIOT_NOTIFICATION_ACTION_OPTIONS: NotificationAppModule['actionOptions'];
  };
  const svcEntry = Object.entries(KUAIIOT_NOTIFICATION_SERVICES)[0];
  let loadPresets: NotificationPresetLoader | undefined;
  if (svcEntry) {
    const services = (await svcEntry[1]()) as {
      loadKuaiiotNotificationRulePresets?: NotificationPresetLoader;
    };
    loadPresets = services.loadKuaiiotNotificationRulePresets;
  }
  return {
    appCode: 'kuaiiot',
    documentOptions: constants.KUAIIOT_NOTIFICATION_DOCUMENT_OPTIONS,
    actionOptions: constants.KUAIIOT_NOTIFICATION_ACTION_OPTIONS,
    extraRecipientScopes: [],
    loadPresets,
  };
}

/** 开源应用：静态注册。定制/专业包：ensureNotificationAppModules 后并入。 */
export const NOTIFICATION_APP_MODULES: Record<string, NotificationAppModule> = {
  kuaizhizao: {
    appCode: 'kuaizhizao',
    documentOptions: CORE_NOTIFICATION_DOCUMENT_OPTIONS,
    actionOptions: CORE_NOTIFICATION_ACTION_OPTIONS,
    extraRecipientScopes: [],
    loadPresets: loadKuaizhizaoNotificationRulePresets,
  },
};

/** 确保定制/专业包提醒模块已合并进 NOTIFICATION_APP_MODULES（可重复调用） */
export async function ensureNotificationAppModules(): Promise<void> {
  if (!haoligoModulePromise) {
    haoligoModulePromise = loadHaoligoNotificationModule();
  }
  const haoligo = await haoligoModulePromise;
  if (haoligo && !NOTIFICATION_APP_MODULES.haoligo) {
    NOTIFICATION_APP_MODULES.haoligo = haoligo;
  }
  if (!kuaiiotModulePromise) {
    kuaiiotModulePromise = loadKuaiiotNotificationModule();
  }
  const kuaiiot = await kuaiiotModulePromise;
  if (kuaiiot && !NOTIFICATION_APP_MODULES.kuaiiot) {
    NOTIFICATION_APP_MODULES.kuaiiot = kuaiiot;
  }
}

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
