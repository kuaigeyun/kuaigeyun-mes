import { ProFormDependency, ProFormSwitch, ProFormText } from '@ant-design/pro-components';
import type { ProFormInstance } from '@ant-design/pro-components';
import { App, Alert, Button, Space, Typography } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FormModalTemplate, MODAL_CONFIG } from '../../../components/layout-templates';
import SafeProFormSelect from '../../../components/safe-pro-form-select';
import {
  getClientProductConfig,
  listPushTestUsers,
  sendClientPushTest,
  updateClientProductConfig,
  type ClientProductConfig,
  type ClientPushTestResult,
} from '../../../services/clientRelease';
import { getTenantList, TenantStatus } from '../../../services/tenant';

type Props = {
  open: boolean;
  clientKey: string | null;
  onClose: () => void;
  onSaved: () => void;
};

export function ClientProductConfigEditModal({ open, clientKey, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const formRef = useRef<ProFormInstance>();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [testingPush, setTestingPush] = useState(false);
  const [pushTestResult, setPushTestResult] = useState<ClientPushTestResult | null>(null);
  const [config, setConfig] = useState<ClientProductConfig | null>(null);

  useEffect(() => {
    if (!open || !clientKey) {
      setConfig(null);
      setPushTestResult(null);
      return;
    }

    let cancelled = false;
    setFetching(true);
    void getClientProductConfig(clientKey)
      .then((data) => {
        if (cancelled) return;
        setConfig(data);
        formRef.current?.setFieldsValue({
          push_enabled: data.push_enabled,
          jpush_app_key: data.jpush_app_key,
          jpush_master_secret: '',
          push_test_tenant_id: undefined,
          push_test_user_id: undefined,
        });
      })
      .catch((e) => {
        if (cancelled) return;
        messageApi.error(
          e instanceof Error ? e.message : t('pages.infra.clientReleases.configFetchFailed'),
        );
        setConfig(null);
      })
      .finally(() => {
        if (!cancelled) setFetching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, clientKey, messageApi, t]);

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (!clientKey) return;

    const payload: {
      push_enabled?: boolean;
      jpush_app_key?: string;
      jpush_master_secret?: string;
    } = {
      push_enabled: values.push_enabled as boolean,
      jpush_app_key: (values.jpush_app_key as string | undefined)?.trim(),
    };

    const secret = (values.jpush_master_secret as string | undefined)?.trim();
    if (secret) {
      payload.jpush_master_secret = secret;
    }

    setLoading(true);
    try {
      await updateClientProductConfig(clientKey, payload);
      messageApi.success(t('pages.infra.clientReleases.configSaveSuccess'));
      onSaved();
      onClose();
    } catch (e) {
      messageApi.error(
        e instanceof Error ? e.message : t('pages.infra.clientReleases.configSaveFailed'),
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePushTest = async () => {
    if (!clientKey) return;
    const tenantId = Number(formRef.current?.getFieldValue('push_test_tenant_id'));
    const userId = Number(formRef.current?.getFieldValue('push_test_user_id'));
    if (!Number.isFinite(tenantId) || tenantId < 1 || !Number.isFinite(userId) || userId < 1) {
      messageApi.warning(t('pages.infra.clientReleases.configPushTestNeedIds'));
      return;
    }
    setTestingPush(true);
    setPushTestResult(null);
    try {
      const result = await sendClientPushTest(clientKey, {
        tenant_id: tenantId,
        user_id: userId,
      });
      setPushTestResult(result);
      if (result.success) {
        messageApi.success(t('pages.infra.clientReleases.configPushTestSent'));
      } else {
        messageApi.warning(result.hint || t('pages.infra.clientReleases.configPushTestFailed'));
      }
    } catch (e) {
      messageApi.error(
        e instanceof Error ? e.message : t('pages.infra.clientReleases.configPushTestFailed'),
      );
    } finally {
      setTestingPush(false);
    }
  };

  const title = config
    ? t('pages.infra.clientReleases.configEditTitle', { name: config.display_name })
    : t('pages.infra.clientReleases.configEditTitleFallback');

  return (
    <FormModalTemplate
      title={title}
      open={open}
      onClose={onClose}
      formRef={formRef}
      width={MODAL_CONFIG.STANDARD_WIDTH}
      loading={loading || fetching}
      isEdit
      onFinish={handleSubmit}
    >
      {config?.effective_push_ready ? (
        <Alert
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
          message={t('pages.infra.clientReleases.configPushReady')}
        />
      ) : (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={t('pages.infra.clientReleases.configPushNotReady')}
        />
      )}

      {(config?.env_fallback_app_key || config?.env_fallback_master_secret) && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={t('pages.infra.clientReleases.configEnvFallbackHint')}
        />
      )}

      <ProFormSwitch
        name="push_enabled"
        label={t('pages.infra.clientReleases.configPushEnabled')}
        tooltip={t('pages.infra.clientReleases.configPushEnabledTooltip')}
      />

      <ProFormText
        name="jpush_app_key"
        label={t('pages.infra.clientReleases.configJpushAppKey')}
        placeholder={t('pages.infra.clientReleases.configJpushAppKeyPlaceholder')}
        rules={[{ required: true, message: t('pages.infra.clientReleases.configJpushAppKeyRequired') }]}
        fieldProps={{ autoComplete: 'off' }}
      />

      <ProFormText.Password
        name="jpush_master_secret"
        label={t('pages.infra.clientReleases.configJpushMasterSecret')}
        placeholder={
          config?.jpush_master_secret_configured
            ? t('pages.infra.clientReleases.configJpushMasterSecretKeep')
            : t('pages.infra.clientReleases.configJpushMasterSecretPlaceholder')
        }
        extra={
          config?.jpush_master_secret_configured
            ? t('pages.infra.clientReleases.configJpushMasterSecretConfigured')
            : undefined
        }
        fieldProps={{ autoComplete: 'new-password' }}
      />

      {clientKey === 'haoligo' ? (
        <>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message={t('pages.infra.clientReleases.configPushTestHint')}
          />
          <SafeProFormSelect
            name="push_test_tenant_id"
            label={t('pages.infra.clientReleases.configPushTestTenant')}
            placeholder={t('pages.infra.clientReleases.configPushTestTenantPlaceholder')}
            showSearch
            debounceTime={300}
            rules={[{ required: false }]}
            fieldProps={{
              filterOption: false,
              onChange: () => {
                formRef.current?.setFieldsValue({ push_test_user_id: undefined });
                setPushTestResult(null);
              },
            }}
            request={async ({ keyWords }) => {
              const res = await getTenantList(
                {
                  page: 1,
                  page_size: 50,
                  name: keyWords?.trim() || undefined,
                  status: TenantStatus.ACTIVE,
                },
                true,
              );
              return (res.items ?? []).map((tenant) => ({
                label: `${tenant.name} (#${tenant.id})`,
                value: tenant.id,
              }));
            }}
          />
          <ProFormDependency name={['push_test_tenant_id', 'push_test_user_id']}>
            {({ push_test_tenant_id, push_test_user_id }) => {
              const tenantId = Number(push_test_tenant_id);
              const userId = Number(push_test_user_id);
              const aliasPreview =
                Number.isFinite(tenantId) &&
                tenantId > 0 &&
                Number.isFinite(userId) &&
                userId > 0
                  ? `${tenantId}_${userId}`
                  : null;
              return (
                <>
                  <SafeProFormSelect
                    key={`push-test-user-${push_test_tenant_id}`}
                    name="push_test_user_id"
                    label={t('pages.infra.clientReleases.configPushTestUser')}
                    placeholder={t('pages.infra.clientReleases.configPushTestUserPlaceholder')}
                    showSearch
                    debounceTime={300}
                    disabled={!push_test_tenant_id}
                    params={{ tenantId: push_test_tenant_id }}
                    fieldProps={{
                      filterOption: false,
                      onChange: () => setPushTestResult(null),
                    }}
                    request={async ({ keyWords }) => {
                      if (!clientKey) return [];
                      const tid = Number(push_test_tenant_id);
                      if (!Number.isFinite(tid) || tid < 1) return [];
                      const res = await listPushTestUsers(clientKey, {
                        tenant_id: tid,
                        keyword: keyWords?.trim() || undefined,
                        page: 1,
                        page_size: 50,
                      });
                      return (res.items ?? []).map((user) => ({
                        label: `${user.label || user.username} (#${user.id})`,
                        value: user.id,
                      }));
                    }}
                  />
                  {aliasPreview ? (
                    <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                      {t('pages.infra.clientReleases.configPushTestAliasPreview', {
                        alias: aliasPreview,
                      })}
                    </Typography.Text>
                  ) : null}
                </>
              );
            }}
          </ProFormDependency>
          <Space style={{ marginBottom: 16 }}>
            <Button loading={testingPush} onClick={() => void handlePushTest()}>
              {t('pages.infra.clientReleases.configPushTestAction')}
            </Button>
          </Space>
          {pushTestResult ? (
            <Alert
              type={pushTestResult.success ? 'success' : 'warning'}
              showIcon
              style={{ marginBottom: 16 }}
              message={
                pushTestResult.success
                  ? t('pages.infra.clientReleases.configPushTestOk', { alias: pushTestResult.alias })
                  : t('pages.infra.clientReleases.configPushTestFail', { alias: pushTestResult.alias })
              }
              description={
                <>
                  <div>{pushTestResult.hint}</div>
                  <div style={{ marginTop: 8, wordBreak: 'break-all' }}>
                    HTTP {pushTestResult.http_status}: {pushTestResult.jpush_message}
                  </div>
                </>
              }
            />
          ) : null}
        </>
      ) : null}
    </FormModalTemplate>
  );
}
