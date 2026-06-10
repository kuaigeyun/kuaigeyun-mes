import { ProFormSwitch, ProFormText } from '@ant-design/pro-components';
import type { ProFormInstance } from '@ant-design/pro-components';
import { App, Alert } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FormModalTemplate, MODAL_CONFIG } from '../../../components/layout-templates';
import {
  getClientProductConfig,
  updateClientProductConfig,
  type ClientProductConfig,
} from '../../../services/clientRelease';

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
  const [config, setConfig] = useState<ClientProductConfig | null>(null);

  useEffect(() => {
    if (!open || !clientKey) {
      setConfig(null);
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
    </FormModalTemplate>
  );
}
