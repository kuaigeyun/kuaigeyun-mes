import { InboxOutlined } from '@ant-design/icons';
import {
  ProFormDigit,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
  ProFormUploadDragger,
} from '@ant-design/pro-components';
import type { ProFormInstance } from '@ant-design/pro-components';
import { App, Alert } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import SafeProFormSelect from '../../../components/safe-pro-form-select';
import { FormModalTemplate, MODAL_CONFIG } from '../../../components/layout-templates';
import {
  publishClientReleasePackage,
  uploadClientReleasePackage,
  type ClientProduct,
  type ClientRelease,
} from '../../../services/clientRelease';
import {
  parseClientPackageMetadata,
  type ClientPackageMetadata,
} from '../../../utils/parseClientPackageMetadata';

type Props = {
  open: boolean;
  products: ClientProduct[];
  defaultClientKey?: string;
  existingRelease?: ClientRelease | null;
  onClose: () => void;
  onSuccess: () => void;
};

const PLATFORM_ACCEPT: Record<string, string> = {
  android: '.apk',
  ios: '.ipa',
  windows: '.exe,.msi,.zip',
};

export function ClientReleaseUploadModal({
  open,
  products,
  defaultClientKey,
  existingRelease,
  onClose,
  onSuccess,
}: Props) {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const formRef = useRef<ProFormInstance>();
  const [loading, setLoading] = useState(false);
  const [parsingPackage, setParsingPackage] = useState(false);
  const [detectedMeta, setDetectedMeta] = useState<ClientPackageMetadata | null>(null);
  const isReplacing = Boolean(existingRelease);

  useEffect(() => {
    if (!open) {
      setDetectedMeta(null);
      setParsingPackage(false);
    }
  }, [open]);

  const handlePackageFileChange = useCallback(
    async (info: { fileList: UploadFile[] }) => {
      const uploadFile = info.fileList[0]?.originFileObj;
      if (!uploadFile) {
        setDetectedMeta(null);
        return;
      }

      const platform =
        (formRef.current?.getFieldValue('platform') as string | undefined) ??
        existingRelease?.platform ??
        'android';

      setParsingPackage(true);
      try {
        const meta = await parseClientPackageMetadata(uploadFile, platform);
        if (!meta) {
          setDetectedMeta(null);
          if (platform === 'android' && uploadFile.name.toLowerCase().endsWith('.apk')) {
            messageApi.warning(t('pages.infra.clientReleases.packageParseFailed'));
          }
          return;
        }

        setDetectedMeta(meta);
        if (!isReplacing) {
          formRef.current?.setFieldsValue({
            app_version: meta.app_version,
            version_code: meta.version_code,
            runtime_version: meta.runtime_version,
          });
          messageApi.success(
            t('pages.infra.clientReleases.packageParsed', {
              version: meta.app_version,
              code: meta.version_code,
            }),
          );
        } else if (
          existingRelease &&
          (meta.app_version !== existingRelease.app_version ||
            meta.version_code !== existingRelease.version_code)
        ) {
          messageApi.error(
            t('pages.infra.clientReleases.packageVersionMismatch', {
              version: meta.app_version,
              code: meta.version_code,
              expectedVersion: existingRelease.app_version,
              expectedCode: existingRelease.version_code,
            }),
          );
        }
      } finally {
        setParsingPackage(false);
      }
    },
    [existingRelease, isReplacing, messageApi, t],
  );

  const platformOptions = useMemo(
    () => [
      { value: 'android', label: t('pages.infra.clientReleases.platformAndroid') },
      { value: 'ios', label: t('pages.infra.clientReleases.platformIos') },
      { value: 'windows', label: t('pages.infra.clientReleases.platformWindows') },
    ],
    [t],
  );

  const productOptions = useMemo(
    () =>
      products.map((p) => ({
        value: p.client_key,
        label: `${p.display_name} (${p.client_key})`,
      })),
    [products],
  );

  const initialValues = useMemo(() => {
    if (existingRelease) {
      return {
        client_key: existingRelease.client_key,
        platform: existingRelease.platform,
        app_version: existingRelease.app_version,
        version_code: existingRelease.version_code,
        runtime_version: existingRelease.runtime_version ?? undefined,
        release_notes: existingRelease.release_notes,
        force_update: existingRelease.force_update,
        rollout_percent: existingRelease.rollout_percent ?? 100,
        activate: true,
      };
    }
    const product = products.find((p) => p.client_key === defaultClientKey) ?? products[0];
    return {
      client_key: defaultClientKey ?? product?.client_key,
      platform: product?.platform_target ?? 'android',
      app_version: '',
      version_code: 0,
      runtime_version: undefined as string | undefined,
      release_notes: '',
      force_update: false,
      rollout_percent: 100,
      activate: true,
    };
  }, [defaultClientKey, existingRelease, products]);

  const handleFinish = async (values: Record<string, unknown>) => {
    const packageFiles = values.package_file as UploadFile[] | undefined;
    const uploadFile = packageFiles?.[0]?.originFileObj;
    if (!uploadFile) {
      messageApi.warning(t('pages.infra.clientReleases.selectFileRequired'));
      return;
    }

    if (existingRelease && detectedMeta) {
      if (
        detectedMeta.app_version !== existingRelease.app_version ||
        detectedMeta.version_code !== existingRelease.version_code
      ) {
        messageApi.error(t('pages.infra.clientReleases.packageReplaceMismatch'));
        return;
      }
    }

    setLoading(true);
    try {
      if (existingRelease) {
        await uploadClientReleasePackage(existingRelease.id, uploadFile, uploadFile.name);
        messageApi.success(t('pages.infra.clientReleases.replaceSuccess'));
      } else {
        const clientKey = String(values.client_key);
        const platform = String(values.platform);
        const appVersion = String(values.app_version).trim();
        if (!clientKey || !platform || !appVersion) {
          messageApi.warning(t('pages.infra.clientReleases.formIncomplete'));
          return;
        }
        await publishClientReleasePackage(
          {
            client_key: clientKey,
            platform,
            app_version: appVersion,
            version_code: Number(values.version_code ?? 0),
            runtime_version: values.runtime_version ? String(values.runtime_version) : appVersion,
            update_type: 'package',
            requires_native: true,
            force_update: Boolean(values.force_update),
            min_version_code: 0,
            release_notes: String(values.release_notes ?? ''),
            rollout_percent: Number(values.rollout_percent ?? 100),
          },
          uploadFile,
          { activate: Boolean(values.activate) },
        );
        messageApi.success(t('pages.infra.clientReleases.uploadSuccess'));
      }
      onSuccess();
      onClose();
    } catch (e) {
      messageApi.error(e instanceof Error ? e.message : t('pages.infra.clientReleases.uploadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const uploadAccept =
    existingRelease != null
      ? PLATFORM_ACCEPT[existingRelease.platform] ?? '.apk,.exe,.msi,.zip'
      : '.apk,.ipa,.exe,.msi,.zip';

  const packageUploadField = (
    <ProFormUploadDragger
      name="package_file"
      label={t('pages.infra.clientReleases.formPackageFile')}
      colProps={{ span: 24 }}
      icon={<InboxOutlined />}
      title={t('pages.infra.clientReleases.uploadDragHint')}
      description={t('pages.infra.clientReleases.uploadDragSubHint')}
      max={1}
      accept={uploadAccept}
      rules={[{ required: true, message: t('pages.infra.clientReleases.selectFileRequired') }]}
      fieldProps={{
        beforeUpload: () => false,
        style: { width: '100%' },
        onChange: handlePackageFileChange,
        disabled: parsingPackage,
      }}
    />
  );

  const detectedMetaAlert =
    detectedMeta && !isReplacing ? (
      <Alert
        type="info"
        showIcon
        message={t('pages.infra.clientReleases.packageDetectedTitle')}
        description={t('pages.infra.clientReleases.packageDetectedDesc', {
          version: detectedMeta.app_version,
          code: detectedMeta.version_code,
          package: detectedMeta.package_name ?? '—',
        })}
        style={{ marginBottom: 16 }}
      />
    ) : null;

  return (
    <FormModalTemplate
      title={
        isReplacing
          ? t('pages.infra.clientReleases.replaceModalTitle')
          : t('pages.infra.clientReleases.uploadModalTitle')
      }
      open={open}
      formRef={formRef}
      onClose={onClose}
      onFinish={handleFinish}
      initialValues={initialValues}
      loading={loading || parsingPackage}
      width={MODAL_CONFIG.STANDARD_WIDTH}
      grid
    >
      {!isReplacing ? (
        <>
          <SafeProFormSelect
            name="client_key"
            label={t('pages.infra.clientReleases.columnClient')}
            rules={[{ required: true, message: t('pages.infra.clientReleases.formClientRequired') }]}
            options={productOptions}
            placeholder={t('pages.infra.clientReleases.formClientPlaceholder')}
            colProps={{ span: 24 }}
            fieldProps={{
              onChange: (key: string) => {
                const product = products.find((p) => p.client_key === key);
                if (product) {
                  formRef.current?.setFieldsValue({ platform: product.platform_target });
                }
              },
            }}
          />
          <SafeProFormSelect
            name="platform"
            label={t('pages.infra.clientReleases.columnPlatform')}
            rules={[{ required: true, message: t('pages.infra.clientReleases.formPlatformRequired') }]}
            options={platformOptions}
            colProps={{ span: 12 }}
          />
          {packageUploadField}
          {detectedMetaAlert}
          <ProFormText
            name="app_version"
            label={t('pages.infra.clientReleases.columnVersion')}
            rules={[{ required: true, message: t('pages.infra.clientReleases.formVersionRequired') }]}
            placeholder={t('pages.infra.clientReleases.formVersionPlaceholder')}
            tooltip={t('pages.infra.clientReleases.formVersionAutoTooltip')}
            colProps={{ span: 12 }}
          />
          <ProFormDigit
            name="version_code"
            label={t('pages.infra.clientReleases.formVersionCode')}
            tooltip={t('pages.infra.clientReleases.formVersionCodeTooltip')}
            min={1}
            rules={[
              { required: true, message: t('pages.infra.clientReleases.formVersionCodeRequired') },
            ]}
            fieldProps={{ precision: 0 }}
            colProps={{ span: 12 }}
          />
          <ProFormText
            name="runtime_version"
            label={t('pages.infra.clientReleases.formRuntimeVersion')}
            placeholder={t('pages.infra.clientReleases.formRuntimeVersionPlaceholder')}
            colProps={{ span: 12 }}
          />
          <ProFormTextArea
            name="release_notes"
            label={t('pages.infra.clientReleases.columnNotes')}
            placeholder={t('pages.infra.clientReleases.formNotesPlaceholder')}
            colProps={{ span: 24 }}
            fieldProps={{ rows: 3 }}
          />
          <ProFormDigit
            name="rollout_percent"
            label={t('pages.infra.clientReleases.formRolloutPercent')}
            min={0}
            max={100}
            fieldProps={{ precision: 0 }}
            colProps={{ span: 8 }}
          />
          <ProFormSwitch
            name="force_update"
            label={t('pages.infra.clientReleases.formForceUpdate')}
            colProps={{ span: 8 }}
          />
          <ProFormSwitch
            name="activate"
            label={t('pages.infra.clientReleases.activateAfterUpload')}
            colProps={{ span: 8 }}
          />
        </>
      ) : (
        <>
          <ProFormText
            name="app_version"
            label={t('pages.infra.clientReleases.columnVersion')}
            disabled
            colProps={{ span: 24 }}
          />
          {packageUploadField}
        </>
      )}
    </FormModalTemplate>
  );
}
