import { rowActionKind } from '../uni-action';
/**
 * 业务配置 · 消息提醒（平台通用 + 已开通定制 APP 合并展示）
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Layout, Modal, Descriptions, Spin, Typography, Divider } from 'antd';
import type { ActionType, ProFormInstance } from '@ant-design/pro-components';
import { ProFormSelect, ProFormDependency, ProFormCheckbox, ProFormSwitch } from '@ant-design/pro-components';
import { UniTable } from '../uni-table';
import { FormModalTemplate } from '../layout-templates';
import { getBusinessConfig, batchUpdateProcessParameters } from '../../services/businessConfig';
import { getMessageConfigList, type MessageConfig } from '../../services/messageConfig';
import { getMessageTemplateList, type MessageTemplate } from '../../services/messageTemplate';
import { getUserList, type User } from '../../services/user';
import { getInstalledApplicationList } from '../../services/application';
import { CORE_NOTIFICATION_RECIPIENT_SCOPES } from './coreNotificationRules';
import { HAOLIGO_NOTIFICATION_RECIPIENT_SCOPES } from '../../apps/haoligo/constants/notificationRules';
import { isHaoligoNotificationDocumentCode } from './notificationRulePartition';
import { buildNotificationConfig } from './notificationAppModules';
import {
  USER_SPECIFIED_NOTIFICATION_SCOPE,
  USER_SPECIFIED_SCOPE_OPTION,
} from './notificationRecipientConstants';
import {
  partitionRulesByAvailableDocuments,
  normalizeNotificationRulesFromParameters,
} from './notificationRulePartition';
import {
  getFixedRecipientUserIdsFromRule,
  getFormNotifyUserDefaultsFromRule,
  splitRuleRecipientUserFields,
  toRecipientUserIdFieldValues,
} from './notificationRuleRecipientFields';
import {
  BUILTIN_IN_APP_CHANNEL_UUID,
  findInAppChannelOption,
  getDefaultNotificationChannelRefs,
  normalizeNotificationChannelRefs,
} from './notificationChannelRefs';

function splitRecipientScopes(scopes: unknown): {
  recipient_role_scopes: string[];
  enable_form_user_notify: boolean;
} {
  const list = Array.isArray(scopes) ? scopes.map((s) => String(s)) : [];
  return {
    recipient_role_scopes: list.filter((s) => s !== USER_SPECIFIED_NOTIFICATION_SCOPE),
    enable_form_user_notify: list.includes(USER_SPECIFIED_NOTIFICATION_SCOPE),
  };
}

function mergeRecipientScopes(values: Record<string, unknown>): string[] {
  const roleScopes = toArrayValue(values.recipient_role_scopes);
  const enableForm = Boolean(values.enable_form_user_notify);
  return enableForm ? [...roleScopes, USER_SPECIFIED_NOTIFICATION_SCOPE] : roleScopes;
}

const { Content } = Layout;
const { Text, Paragraph } = Typography;

const BUSINESS_CONFIG_QUERY_KEY = ['businessConfig'] as const;
const INSTALLED_APPS_QUERY_KEY = ['installedApplications', { is_active: true }] as const;

export type NotificationRulesPanelProps = {
  /** 为 false 时不渲染区块标题（外层 Tab 已展示页面名时） */
  showPageHeader?: boolean;
};

const toArrayValue = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (typeof value === 'string') return value.split(',').map((v) => v.trim()).filter(Boolean);
  return [];
};

export const NotificationRulesPanel: React.FC<NotificationRulesPanelProps> = ({ showPageHeader = true }) => {
  const { t, i18n } = useTranslation();
  const { message: messageApi } = App.useApp();
  const queryClient = useQueryClient();

  const notificationFormRef = useRef<ProFormInstance>();
  const notificationTableActionRef = useRef<ActionType>();
  const [notificationModalOpen, setNotificationModalOpen] = useState(false);
  const [notificationModalMode, setNotificationModalMode] = useState<'create' | 'edit'>('create');
  const [editingNotificationRuleId, setEditingNotificationRuleId] = useState<string | null>(null);
  const [notificationModalInitialValues, setNotificationModalInitialValues] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [loadingPresets, setLoadingPresets] = useState(false);

  const { data: installedApps } = useQuery({
    queryKey: INSTALLED_APPS_QUERY_KEY,
    queryFn: () => getInstalledApplicationList({ is_active: true }),
    staleTime: 60_000,
  });

  const installedAppCodes = useMemo(
    () => new Set((installedApps || []).map((app) => String(app.code || '')).filter(Boolean)),
    [installedApps],
  );

  const cfg = useMemo(() => buildNotificationConfig(installedAppCodes), [installedAppCodes]);

  const { data: bizRes, isLoading: configLoading, isFetching, refetch: refetchBusinessConfig } = useQuery({
    queryKey: BUSINESS_CONFIG_QUERY_KEY,
    queryFn: getBusinessConfig,
    staleTime: 60_000,
  });

  const { data: usersRes } = useQuery({
    queryKey: ['notificationRulesUsers'],
    queryFn: () => getUserList({ page: 1, page_size: 200, is_active: true }),
    staleTime: 300_000,
  });

  const { data: messageChannels = [] } = useQuery({
    queryKey: ['notificationRulesChannels'],
    queryFn: () => getMessageConfigList({ skip: 0, limit: 500, is_active: true }),
    staleTime: 300_000,
  });

  const { data: messageTemplates = [] } = useQuery({
    queryKey: ['notificationRulesTemplates'],
    // 列表展示需解析历史规则中的 template_uuid，不可仅拉启用模板
    queryFn: () => getMessageTemplateList({ skip: 0, limit: 500 }),
    staleTime: 300_000,
  });

  const loading = configLoading && !bizRes;

  const renderText = (key: string | undefined, fallback?: string) => {
    if (!key) return fallback || '';
    if (i18n.exists(key)) return t(key);
    return fallback || key;
  };

  const userOptions = useMemo(
    () =>
      (usersRes?.items || []).map((u: User) => ({
        value: u.id,
        label: `${u.full_name || u.username}${u.department?.name ? (i18n.language?.startsWith('zh') ? `（${u.department.name}）` : ` (${u.department.name})`) : ''}`,
      })),
    [usersRes, i18n.language],
  );

  const channelOptions = useMemo(() => {
    const builtInName = t('pages.system.configCenter.notification.channel.inApp');
    const unknownLabel = t('pages.system.configCenter.notification.channel.unknown');
    const builtIn = {
      uuid: BUILTIN_IN_APP_CHANNEL_UUID,
      name: builtInName,
      code: 'IN_APP_DEFAULT',
      type: 'internal',
      is_active: true,
    } as Partial<MessageConfig>;
    const list = Array.isArray(messageChannels) ? messageChannels : [];
    const hasInternal = list.some(
      (it: { type?: string; code?: string; uuid?: string }) =>
        it?.type === 'internal' ||
        it?.code === 'IN_APP_DEFAULT' ||
        it?.uuid === BUILTIN_IN_APP_CHANNEL_UUID,
    );
    const merged = hasInternal ? list : [builtIn as MessageConfig, ...list];
    return merged.map((it: { uuid?: string; code?: string; name?: string }) => ({
      value: String(it.uuid || it.code),
      label: String(it.name || it.code || unknownLabel),
      code: String(it.code || ''),
      type: String(it.type || ''),
    }));
  }, [messageChannels, t]);

  const templateOptions = useMemo(
    () =>
      (Array.isArray(messageTemplates) ? messageTemplates : [])
        .filter((it) => it.is_active !== false)
        .map((it: MessageTemplate) => ({
          value: String(it.uuid),
          label: it.name || it.code,
          code: it.code,
        })),
    [messageTemplates],
  );

  const defaultChannelValues = useMemo(
    () => getDefaultNotificationChannelRefs(channelOptions),
    [channelOptions],
  );

  const channelNameByKey = useMemo(() => {
    const m = new Map<string, string>();
    const inApp = findInAppChannelOption(channelOptions);
    const inAppLabel = inApp?.label ?? t('pages.system.configCenter.notification.channel.inApp');
    m.set(BUILTIN_IN_APP_CHANNEL_UUID, inAppLabel);
    m.set('IN_APP_DEFAULT', inAppLabel);
    for (const ch of channelOptions) {
      m.set(String(ch.value), String(ch.label));
      if (ch.code) m.set(String(ch.code), String(ch.label));
    }
    return m;
  }, [channelOptions, t]);

  const templateNameByKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const it of Array.isArray(messageTemplates) ? messageTemplates : []) {
      const label = String(it.name || it.code || '').trim();
      if (!label) continue;
      const uuid = String(it.uuid || '').trim();
      if (uuid) m.set(uuid, label);
      const code = String(it.code || '').trim();
      if (code) m.set(code, label);
    }
    return m;
  }, [messageTemplates]);

  const notificationDocumentOptions = useMemo(
    () =>
      cfg.documentOptions.map((it) => ({
        value: it.value,
        label: renderText(it.labelKey, it.fallback),
      })),
    [cfg.documentOptions, t, i18n.language],
  );

  const getNotificationActionOptions = (documentCode: string) =>
    (cfg.actionOptions[String(documentCode || '')] || []).map((it) => ({
      value: it.value,
      label: renderText(it.labelKey, it.fallback),
    }));

  const getRulePartitions = () => {
    const all = normalizeNotificationRulesFromParameters(bizRes?.parameters?.notifications);
    return partitionRulesByAvailableDocuments(all, cfg.availableDocuments);
  };

  const mergeAndSaveVisibleRules = async (visibleRules: any[]) => {
    const { hidden } = getRulePartitions();
    await batchUpdateProcessParameters({
      parameters: {
        notifications: { rules: [...hidden, ...visibleRules] },
      },
    });
  };

  const notificationRuleRows = useMemo(() => {
    const { visible } = partitionRulesByAvailableDocuments(
      normalizeNotificationRulesFromParameters(bizRes?.parameters?.notifications),
      cfg.availableDocuments,
    );

    const getDocumentLabel = (code: string) => {
      const item = cfg.documentOptions.find((it) => it.value === code);
      return item ? renderText(item.labelKey, item.fallback) : code || '-';
    };
    const getActionLabel = (documentCode: string, actionCode: string) => {
      const found = (cfg.actionOptions[String(documentCode || '')] || []).find((it) => it.value === actionCode);
      if (found) return renderText(found.labelKey, found.fallback);
      return actionCode || '-';
    };
    const getScopeLabel = (code: string) => {
      if (code === USER_SPECIFIED_NOTIFICATION_SCOPE) {
        return renderText(USER_SPECIFIED_SCOPE_OPTION.labelKey, USER_SPECIFIED_SCOPE_OPTION.fallback);
      }
      const fromCore = CORE_NOTIFICATION_RECIPIENT_SCOPES.find((it) => it.value === code);
      if (fromCore) return renderText(fromCore.labelKey, fromCore.fallback);
      const fromHaoligo = HAOLIGO_NOTIFICATION_RECIPIENT_SCOPES.find((it) => it.value === code);
      if (fromHaoligo) return renderText(fromHaoligo.labelKey, fromHaoligo.fallback);
      const key = `pages.system.configCenter.notification.scope.${code}`;
      return i18n.exists(key) ? t(key) : code;
    };

    return visible.map((rule: Record<string, unknown>, idx: number) => {
      const channelRefs = Array.isArray(rule?.channel_uuids)
        ? rule.channel_uuids
        : Array.isArray(rule?.channels)
          ? rule.channels
          : [];
      const channels =
        (channelRefs as string[])
          .map((v) => channelNameByKey.get(String(v)) || String(v))
          .join(' + ') ||
        channelNameByKey.get(BUILTIN_IN_APP_CHANNEL_UUID) ||
        '-';
      const scopeList = Array.isArray(rule?.recipient_scopes)
        ? rule.recipient_scopes.map((s) => String(s))
        : [];
      const hasUserSpecified = scopeList.includes(USER_SPECIFIED_NOTIFICATION_SCOPE);
      const roleScopes = scopeList.filter((s) => s !== USER_SPECIFIED_NOTIFICATION_SCOPE);
      const fixedUserCount = getFixedRecipientUserIdsFromRule(rule).length;
      const formDefaultCount = getFormNotifyUserDefaultsFromRule(rule).length;
      const scopePart = roleScopes.map((v) => getScopeLabel(v)).join(' + ');
      const userSpecifiedPart = hasUserSpecified
        ? formDefaultCount > 0
          ? t('pages.system.configCenter.notification.recipients.formUserWithDefaults', {
              count: formDefaultCount,
            })
          : renderText(USER_SPECIFIED_SCOPE_OPTION.labelKey, USER_SPECIFIED_SCOPE_OPTION.fallback)
        : '';
      const fixedUsersPart =
        fixedUserCount > 0
          ? t('pages.system.configCenter.notification.recipients.fixedUsers', {
              count: fixedUserCount,
            })
          : '';
      const recipients = [scopePart, fixedUsersPart, userSpecifiedPart].filter(Boolean).join(' + ') || '-';
      const templateKey = String(rule?.template_uuid || rule?.template || '').trim();
      const template =
        templateNameByKey.get(templateKey) ||
        (templateKey ? t('pages.system.configCenter.notification.template.unknown') : '-');
      return {
        id: String(rule?.id || rule?.code || idx + 1),
        scene: rule?.scene_name || t('pages.system.configCenter.notification.scene.default'),
        document: getDocumentLabel(String(rule?.trigger_document || '')) || String(rule?.trigger_document || '-'),
        action:
          getActionLabel(String(rule?.trigger_document || ''), String(rule?.trigger_action || '')) ||
          String(rule?.trigger_action || '-'),
        channels,
        recipients,
        template,
        enabled: rule?.enabled !== false,
        raw: rule,
      };
    });
  }, [bizRes, channelNameByKey, templateNameByKey, t, i18n, cfg]);

  const handleCreateNotificationRule = async (values: Record<string, unknown>) => {
    try {
      setSaving(true);
      const { visible: existingVisible } = getRulePartitions();
      const channelRefs = normalizeNotificationChannelRefs(
        toArrayValue(values.channels).length > 0 ? toArrayValue(values.channels) : defaultChannelValues,
        channelOptions,
      );
      const newRule = {
        id: `rule_${Date.now()}`,
        scene_name: t('pages.system.configCenter.notification.scene.default'),
        enabled: values.rule_enabled !== false,
        trigger_document: values.trigger_document || '',
        trigger_action: values.trigger_action || '',
        channel_uuids: channelRefs,
        channels: channelRefs,
        recipient_scopes: mergeRecipientScopes(values),
        ...toRecipientUserIdFieldValues(values),
        template_uuid: values.template || '',
        template: values.template || '',
      };
      const allowedActions = (cfg.actionOptions[String(newRule.trigger_document)] || []).map((it) => it.value);
      if (!allowedActions.includes(String(newRule.trigger_action))) {
        throw new Error(t('pages.system.configCenter.notification.error.actionMismatch'));
      }
      const nextVisible =
        notificationModalMode === 'edit' && editingNotificationRuleId
          ? existingVisible.map((r: { id?: string }) =>
              String(r?.id) === editingNotificationRuleId ? { ...r, ...newRule, id: editingNotificationRuleId } : r,
            )
          : [...existingVisible, newRule];
      await mergeAndSaveVisibleRules(nextVisible);
      messageApi.success(
        notificationModalMode === 'edit'
          ? t('pages.system.configCenter.notification.message.updated')
          : t('pages.system.configCenter.notification.message.created'),
      );
      setNotificationModalOpen(false);
      setNotificationModalMode('create');
      setEditingNotificationRuleId(null);
      await queryClient.invalidateQueries({ queryKey: BUSINESS_CONFIG_QUERY_KEY });
      await refetchBusinessConfig();
      notificationTableActionRef.current?.reload?.();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown; message?: string };
      if (!err?.errorFields) {
        messageApi.error(err.message || t('pages.system.configCenter.notification.message.createFailed'));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleEditNotificationRule = (row: { id: string; raw?: Record<string, unknown> }) => {
    setNotificationModalMode('edit');
    setEditingNotificationRuleId(String(row.id));
    const scopeSplit = splitRecipientScopes(row.raw?.recipient_scopes);
    const userFields = splitRuleRecipientUserFields(
      row.raw,
      scopeSplit.enable_form_user_notify,
    );
    const channelRefs = normalizeNotificationChannelRefs(
      (Array.isArray(row.raw?.channel_uuids)
        ? row.raw.channel_uuids
        : Array.isArray(row.raw?.channels)
          ? row.raw.channels
          : defaultChannelValues
      ).map((v) => String(v)),
      channelOptions,
    );
    setNotificationModalInitialValues({
      trigger_document: row.raw?.trigger_document,
      trigger_action: row.raw?.trigger_action,
      channels: channelRefs,
      recipient_role_scopes: scopeSplit.recipient_role_scopes,
      enable_form_user_notify: scopeSplit.enable_form_user_notify,
      recipient_user_ids: userFields.recipient_user_ids,
      form_notify_default_user_ids: userFields.form_notify_default_user_ids,
      template: row.raw?.template_uuid || row.raw?.template || undefined,
      rule_enabled: row.raw?.enabled !== false,
    });
    setNotificationModalOpen(true);
  };

  const handleViewNotificationRule = (row: {
    scene: string;
    enabled: boolean;
    document: string;
    action: string;
    channels: string;
    recipients: string;
    template: string;
  }) => {
    Modal.info({
      title: t('pages.system.configCenter.notification.modal.detailTitle'),
      width: 720,
      content: (
        <Descriptions column={2} size="small">
          <Descriptions.Item label={t('pages.system.configCenter.notification.detail.scene')}>{row.scene}</Descriptions.Item>
          <Descriptions.Item label={t('pages.system.configCenter.notification.detail.status')}>
            {row.enabled
              ? t('pages.system.configCenter.notification.status.enabled')
              : t('pages.system.configCenter.notification.status.disabled')}
          </Descriptions.Item>
          <Descriptions.Item label={t('pages.system.configCenter.notification.detail.document')}>{row.document}</Descriptions.Item>
          <Descriptions.Item label={t('pages.system.configCenter.notification.detail.action')}>{row.action}</Descriptions.Item>
          <Descriptions.Item label={t('pages.system.configCenter.notification.detail.channels')} span={2}>
            {row.channels}
          </Descriptions.Item>
          <Descriptions.Item label={t('pages.system.configCenter.notification.detail.recipients')} span={2}>
            {row.recipients}
          </Descriptions.Item>
          <Descriptions.Item label={t('pages.system.configCenter.notification.detail.template')} span={2}>
            {row.template}
          </Descriptions.Item>
        </Descriptions>
      ),
    });
  };

  const handleDeleteNotificationRule = (row: { id: string }) => {
    Modal.confirm({
      title: t('pages.system.configCenter.notification.modal.deleteTitle'),
      content: t('pages.system.configCenter.notification.modal.deleteConfirm'),
      onOk: async () => {
        try {
          const { visible } = getRulePartitions();
          const nextVisible = visible.filter((r: { id?: string }) => String(r?.id) !== String(row.id));
          await mergeAndSaveVisibleRules(nextVisible);
          messageApi.success(t('pages.system.configCenter.notification.message.deleted'));
          await queryClient.invalidateQueries({ queryKey: BUSINESS_CONFIG_QUERY_KEY });
          await refetchBusinessConfig();
          notificationTableActionRef.current?.reload?.();
        } catch (error: unknown) {
          messageApi.error(
            (error as Error)?.message || t('pages.system.configCenter.notification.message.deleteFailed'),
          );
        }
      },
    });
  };

  const handleLoadPresets = async () => {
    if (cfg.presetLoaders.length === 0) return;
    try {
      setLoadingPresets(true);
      let lastRes: {
        created: number;
        updated?: number;
        repaired_templates?: number;
        templates_created?: number;
        total_rules: number;
        skipped_missing_template?: number;
      } | null = null;
      for (const load of cfg.presetLoaders) {
        lastRes = await load();
      }
      await queryClient.invalidateQueries({ queryKey: BUSINESS_CONFIG_QUERY_KEY });
      queryClient.removeQueries({ queryKey: ['uniTable', 'notification-rules.config-center'], exact: false });
      await refetchBusinessConfig();
      notificationTableActionRef.current?.reload?.();
      const res = lastRes || { created: 0, updated: 0, total_rules: 0 };
      const updated = res.updated ?? 0;
      const repairedTemplates = res.repaired_templates ?? 0;
      const templatesCreated = res.templates_created ?? 0;
      if (res.created > 0 || updated > 0 || repairedTemplates > 0 || templatesCreated > 0) {
        messageApi.success(
          repairedTemplates > 0 || templatesCreated > 0
            ? t('pages.system.configCenter.notification.preset.repairedTemplates', {
                templatesCreated,
                repaired: repairedTemplates,
                total: res.total_rules,
              })
            : updated > 0 && res.created > 0
              ? t('pages.system.configCenter.notification.preset.loadedAndUpdated', {
                  created: res.created,
                  updated,
                  total: res.total_rules,
                })
              : updated > 0
                ? t('pages.system.configCenter.notification.preset.scopesUpdated', {
                    updated,
                    total: res.total_rules,
                  })
                : t('pages.system.configCenter.notification.preset.loaded', {
                    created: res.created,
                    total: res.total_rules,
                  }),
        );
      } else if ((res.skipped_missing_template ?? 0) > 0) {
        messageApi.warning(t('pages.system.configCenter.notification.preset.missingTemplate'));
      } else {
        messageApi.info(t('pages.system.configCenter.notification.preset.alreadyExists'));
      }
    } catch (error: unknown) {
      messageApi.error((error as Error)?.message || t('pages.system.configCenter.notification.preset.failed'));
    } finally {
      setLoadingPresets(false);
    }
  };

  const baseRecipientScopeOptions = cfg.baseRecipientScopes.map((it) => ({
    value: it.value,
    label: renderText(it.labelKey, it.fallback),
  }));

  const extraRecipientScopeOptions = cfg.extraRecipientScopes.map((it) => ({
    value: it.value,
    label: renderText(it.labelKey, it.fallback),
  }));

  const showPresetButton = cfg.presetLoaders.length > 0;
  const hasDocumentOptions = cfg.documentOptions.length > 0;

  const rulesListSignature = useMemo(
    () =>
      notificationRuleRows
        .map((r) => String(r.id))
        .sort()
        .join(','),
    [notificationRuleRows],
  );

  const templateCatalogSignature = useMemo(
    () =>
      (Array.isArray(messageTemplates) ? messageTemplates : [])
        .map((it) => `${it.uuid}:${it.name || it.code}`)
        .sort()
        .join('|'),
    [messageTemplates],
  );

  useEffect(() => {
    notificationTableActionRef.current?.reload?.();
  }, [rulesListSignature, installedAppCodes.size, templateCatalogSignature]);

  useEffect(() => {
    if (!notificationModalOpen || channelOptions.length === 0) return;
    const form = notificationFormRef.current;
    if (!form) return;
    const current = toArrayValue(form.getFieldValue('channels'));
    const next =
      current.length > 0
        ? normalizeNotificationChannelRefs(current, channelOptions)
        : defaultChannelValues;
    const sorted = (arr: string[]) => [...arr].map(String).sort().join(',');
    if (sorted(current) !== sorted(next)) {
      form.setFieldValue('channels', next);
    }
  }, [notificationModalOpen, channelOptions, defaultChannelValues]);

  return (
    <>
      <Layout style={{ minHeight: 400, height: '100%', minWidth: 0, background: 'transparent' }}>
        <Content
          style={{
            padding: showPageHeader ? '14px 0 0 0' : 0,
            height: '100%',
            minHeight: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div className="config-center-scrollable-content">
            {showPageHeader ? (
              <div style={{ marginBottom: 16 }}>
                <Text strong style={{ fontSize: 16 }}>
                  {t('pages.system.configCenter.notification.title')}
                </Text>
                <Paragraph type="secondary" style={{ marginTop: 4 }}>
                  {t('pages.system.configCenter.notification.desc')}
                </Paragraph>
              </div>
            ) : null}
            <Spin spinning={loading || isFetching}>
              <UniTable
                columnPersistenceId="notification-rules.config-center"
                actionRef={notificationTableActionRef}
                tanstackQuery={{ enabled: false }}
                rowKey="id"
                pagination={false}
                search={false}
                options={false}
                showCreateButton={hasDocumentOptions}
                createButtonText={t('pages.system.configCenter.notification.create')}
                toolBarActionsAfterCreate={
                  showPresetButton
                    ? [
                        <Button {...rowActionKind('import')} key="load-presets" loading={loadingPresets} onClick={() => void handleLoadPresets()}>
                          {t('pages.system.configCenter.notification.preset.button')}
                        </Button>,
                      ]
                    : undefined
                }
                onCreate={() => {
                  notificationFormRef.current?.resetFields?.();
                  setNotificationModalInitialValues({ channels: defaultChannelValues });
                  setNotificationModalMode('create');
                  setEditingNotificationRuleId(null);
                  setNotificationModalOpen(true);
                }}
                columns={[
                  { title: t('pages.system.configCenter.notification.column.scene'), dataIndex: 'scene', width: 180 },
                  { title: t('pages.system.configCenter.notification.column.document'), dataIndex: 'document', width: 120 },
                  { title: t('pages.system.configCenter.notification.column.template'), dataIndex: 'template', width: 220 },
                  { title: t('pages.system.configCenter.notification.column.action'), dataIndex: 'action', width: 140 },
                  { title: t('pages.system.configCenter.notification.column.channels'), dataIndex: 'channels', width: 180 },
                  { title: t('pages.system.configCenter.notification.column.recipients'), dataIndex: 'recipients', width: 220 },
                  {
                    title: t('pages.system.configCenter.notification.column.status'),
                    dataIndex: 'enabled',
                    width: 90,
                    render: (_: unknown, row: { enabled: boolean }) =>
                      row.enabled
                        ? t('pages.system.configCenter.notification.status.enabled')
                        : t('pages.system.configCenter.notification.status.disabled'),
                  },
                  {
                    title: t('pages.system.configCenter.notification.column.actions'),
                    width: 220,
                    fixed: 'right' as const,
                    render: (_: unknown, row: { id: string }) => {
                      const actions: React.ReactNode[] = [
                        <Button {...rowActionKind('read')} key="detail" onClick={() => handleViewNotificationRule(row as never)}>
                          {t('pages.system.configCenter.notification.action.view')}
                        </Button>,
                        <Button {...rowActionKind('update')} key="edit" onClick={() => handleEditNotificationRule(row as never)}>
                          {t('pages.system.configCenter.notification.action.edit')}
                        </Button>,
                        <Button {...rowActionKind('delete')} key="delete" onClick={() => handleDeleteNotificationRule(row)}>
                          {t('pages.system.configCenter.notification.action.delete')}
                        </Button>,
                      ];
                      return actions;
                    },
                  },
                ]}
                request={async () => ({
                  data: notificationRuleRows,
                  success: true,
                  total: notificationRuleRows.length,
                })}
              />
            </Spin>
          </div>
        </Content>
      </Layout>

      <FormModalTemplate
        title={
          notificationModalMode === 'edit'
            ? t('pages.system.configCenter.notification.modal.editTitle')
            : t('pages.system.configCenter.notification.modal.createTitle')
        }
        open={notificationModalOpen}
        onClose={() => {
          setNotificationModalOpen(false);
          setNotificationModalMode('create');
          setEditingNotificationRuleId(null);
        }}
        onFinish={handleCreateNotificationRule}
        isEdit={notificationModalMode === 'edit'}
        formRef={notificationFormRef}
        width={860}
        layout="vertical"
        initialValues={notificationModalInitialValues}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
          <ProFormSwitch
            name="rule_enabled"
            label={t('pages.system.configCenter.notification.form.enabled')}
            initialValue={true}
          />
          <ProFormSelect
            name="trigger_document"
            label={t('pages.system.configCenter.notification.form.document')}
            rules={[{ required: true, message: t('pages.system.configCenter.notification.form.documentRequired') }]}
            options={notificationDocumentOptions}
          />
          <ProFormDependency name={['trigger_document']}>
            {({ trigger_document }) => (
              <ProFormSelect
                name="trigger_action"
                label={t('pages.system.configCenter.notification.form.action')}
                rules={[{ required: true, message: t('pages.system.configCenter.notification.form.actionRequired') }]}
                options={getNotificationActionOptions(String(trigger_document || ''))}
                fieldProps={{
                  placeholder: trigger_document
                    ? t('pages.system.configCenter.notification.form.actionPlaceholder')
                    : t('pages.system.configCenter.notification.form.selectDocumentFirst'),
                  disabled: !trigger_document,
                }}
              />
            )}
          </ProFormDependency>
          <ProFormDependency name={['trigger_document', 'trigger_action']}>
            {({ trigger_document, trigger_action }) => {
              const validValues = (cfg.actionOptions[String(trigger_document || '')] || []).map((it) => it.value);
              if (trigger_action && !validValues.includes(trigger_action)) {
                notificationFormRef.current?.setFieldValue?.('trigger_action', undefined);
              }
              return null;
            }}
          </ProFormDependency>
          <ProFormSelect
            name="template"
            label={t('pages.system.configCenter.notification.form.template')}
            options={templateOptions}
            initialValue={templateOptions[0]?.value}
          />
          <ProFormSelect
            name="channels"
            label={t('pages.system.configCenter.notification.form.channels')}
            mode="multiple"
            options={channelOptions}
            fieldProps={{
              placeholder: t('pages.system.configCenter.notification.form.channelsPlaceholder'),
            }}
          />
          <div style={{ gridColumn: '1 / -1' }}>
            <Typography.Text strong>{t('pages.system.configCenter.notification.form.designatedSection')}</Typography.Text>
          </div>
          <ProFormDependency name={['trigger_document']}>
            {({ trigger_document }) => {
              const doc = String(trigger_document || '');
              const isAppDoc = isHaoligoNotificationDocumentCode(doc);
              const scopeOptions = [
                ...baseRecipientScopeOptions,
                ...(isAppDoc ? extraRecipientScopeOptions : []),
              ];
              return (
                <ProFormSelect
                  name="recipient_role_scopes"
                  label={t('pages.system.configCenter.notification.form.roles')}
                  mode="multiple"
                  options={scopeOptions}
                  initialValue={isAppDoc ? ['creator'] : ['salesman', 'follower']}
                />
              );
            }}
          </ProFormDependency>
          <ProFormSelect
            name="recipient_user_ids"
            label={
              cfg.formUserScopeOption
                ? t('pages.system.configCenter.notification.form.fixedUsers')
                : t('pages.system.configCenter.notification.form.specifiedUsers')
            }
            mode="multiple"
            options={userOptions}
            fieldProps={{
              placeholder: cfg.formUserScopeOption
                ? t('pages.system.configCenter.notification.form.fixedUsersPlaceholder')
                : t('pages.system.configCenter.notification.form.specifiedUsersPlaceholder'),
            }}
          />
          {cfg.formUserScopeOption ? (
            <>
              <div style={{ gridColumn: '1 / -1' }}>
                <Divider style={{ margin: '4px 0 12px' }} />
                <Typography.Text strong>{t('pages.system.configCenter.notification.form.formUserSection')}</Typography.Text>
                <Typography.Paragraph type="secondary" style={{ marginTop: 4, marginBottom: 0 }}>
                  {t('pages.system.configCenter.notification.form.formUserSectionDesc')}
                </Typography.Paragraph>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <ProFormCheckbox name="enable_form_user_notify">
                  {renderText(cfg.formUserScopeOption.labelKey, cfg.formUserScopeOption.fallback)}
                </ProFormCheckbox>
              </div>
              <ProFormDependency name={['enable_form_user_notify']}>
                {({ enable_form_user_notify }) =>
                  enable_form_user_notify ? (
                    <ProFormSelect
                      name="form_notify_default_user_ids"
                      label={t('pages.system.configCenter.notification.form.formUserDefaultUsers')}
                      mode="multiple"
                      options={userOptions}
                      fieldProps={{
                        placeholder: t(
                          'pages.system.configCenter.notification.form.formUserDefaultUsersPlaceholder',
                        ),
                      }}
                    />
                  ) : null
                }
              </ProFormDependency>
            </>
          ) : null}
        </div>
      </FormModalTemplate>
    </>
  );
};
