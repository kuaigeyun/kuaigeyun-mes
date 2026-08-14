/**
 * 文件存储位置设置：本地 / 对象存储连接（腾讯 COS、MinIO），以及本环境历史文件迁移。
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { App, Alert, Button, Divider, Form, Input, Modal, Progress, Select, Space, Switch, Typography } from 'antd';
import { Link } from 'react-router-dom';
import {
  backfillImageTiers,
  getFileStorageSettings,
  migrateFileStorageToCos,
  saveFileStorageSettings,
  type FileStorageSettings,
} from '../../../../services/file';
import { getApplicationConnectionListAll } from '../../../../services/applicationConnection';
import { MODAL_CONFIG } from '../../../../components/layout-templates/constants';

export interface FileStorageSettingsModalProps {
  open: boolean;
  onClose: () => void;
  onImageTiersBackfilled?: () => void;
}

/** 本轮前端可选的对象存储连接类型（与后端 SUPPORTED_OBJECT_STORAGE_TYPES 对齐） */
const SUPPORTED_STORAGE_CONNECTION_TYPES = ['tencent_cos', 'minio'] as const;

const LOCAL_LOCATION_VALUE = '__local__';

type StorageLocationOption = {
  label: string;
  value: string;
  type?: string;
};

const FileStorageSettingsModal: React.FC<FileStorageSettingsModalProps> = ({
  open,
  onClose,
  onImageTiersBackfilled,
}) => {
  const { t } = useTranslation();
  const { message: messageApi, modal } = App.useApp();
  const [form] = Form.useForm<FileStorageSettings & { storage_location?: string }>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [imageTierBackfillLoading, setImageTierBackfillLoading] = useState(false);
  const [connectionOptions, setConnectionOptions] = useState<StorageLocationOption[]>([]);
  const [migrateProgress, setMigrateProgress] = useState<{
    percent: number;
    migrated: number;
    failed: number;
    totalHint: number;
    targetBucket?: string;
    failureSamples: Array<{ uuid: string; reason: string }>;
  } | null>(null);

  const storageLocation = Form.useWatch('storage_location', form);
  const isObjectStorage = !!storageLocation && storageLocation !== LOCAL_LOCATION_VALUE;

  const locationOptions = useMemo<StorageLocationOption[]>(
    () => [
      { label: t('pages.system.files.storageBackendLocal'), value: LOCAL_LOCATION_VALUE },
      ...connectionOptions,
    ],
    [connectionOptions, t],
  );

  const typeLabel = useCallback(
    (type: string) => {
      if (type === 'tencent_cos') return t('pages.system.files.storageTypeTencentCos');
      if (type === 'minio') return t('pages.system.files.storageTypeMinio');
      return type;
    },
    [t],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [settings, cosList, minioList] = await Promise.all([
        getFileStorageSettings(),
        getApplicationConnectionListAll({ type: 'tencent_cos', is_active: true }),
        getApplicationConnectionListAll({ type: 'minio', is_active: true }),
      ]);
      const connections = [...cosList, ...minioList].filter((c) =>
        SUPPORTED_STORAGE_CONNECTION_TYPES.includes(
          c.type as (typeof SUPPORTED_STORAGE_CONNECTION_TYPES)[number],
        ),
      );
      const opts: StorageLocationOption[] = connections.map((c) => ({
        value: c.uuid,
        type: c.type,
        label: `${typeLabel(c.type)} ${c.name || c.code || c.uuid}`,
      }));
      setConnectionOptions(opts);

      const locationValue =
        settings.backend === 'connection' && settings.connection_uuid
          ? settings.connection_uuid
          : LOCAL_LOCATION_VALUE;

      form.setFieldsValue({
        storage_location: locationValue,
        backend: settings.backend || 'local',
        connection_uuid: settings.connection_uuid || undefined,
        key_prefix: settings.key_prefix || '',
        delete_local_after_migrate: settings.delete_local_after_migrate !== false,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('pages.system.files.storageSettingsLoadFailed');
      messageApi.error(msg);
    } finally {
      setLoading(false);
    }
  }, [form, messageApi, t, typeLabel]);

  useEffect(() => {
    if (open) {
      setMigrateProgress(null);
      void load();
    }
  }, [open, load]);

  const resolvePayload = (values: FileStorageSettings & { storage_location?: string }): FileStorageSettings => {
    const loc = values.storage_location || LOCAL_LOCATION_VALUE;
    const isConn = loc !== LOCAL_LOCATION_VALUE;
    return {
      backend: isConn ? 'connection' : 'local',
      connection_uuid: isConn ? loc : null,
      key_prefix: (values.key_prefix || '').trim(),
      delete_local_after_migrate: values.delete_local_after_migrate !== false,
    };
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await saveFileStorageSettings(resolvePayload(values));
      messageApi.success(t('pages.system.files.storageSettingsSaveSuccess'));
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) return;
      const msg = error instanceof Error ? error.message : t('pages.system.files.storageSettingsSaveFailed');
      messageApi.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const runMigrate = async (dryRun: boolean) => {
    setMigrating(true);
    setMigrateProgress({
      percent: 0,
      migrated: 0,
      failed: 0,
      totalHint: 0,
      failureSamples: [],
    });
    try {
      const values = await form.validateFields();
      const payload = resolvePayload(values);
      if (payload.backend !== 'connection' || !payload.connection_uuid) {
        messageApi.warning(t('pages.system.files.storageConnectionRequired'));
        return;
      }
      await saveFileStorageSettings(payload);

      let cursor = 0;
      let done = false;
      let totalMigrated = 0;
      let totalFailed = 0;
      let initialTotal = 0;
      let targetBucket = '';
      const allFailures: Array<{ uuid: string; reason: string }> = [];

      while (!done) {
        const result = await migrateFileStorageToCos({
          dry_run: dryRun,
          cursor,
          limit: 50,
          connection_uuid: payload.connection_uuid || undefined,
        });
        if (initialTotal === 0) initialTotal = result.total;
        if (!targetBucket && result.target_bucket) {
          targetBucket = result.target_bucket;
        }
        totalMigrated += result.migrated;
        totalFailed += result.failed;
        allFailures.push(...(result.failures || []));
        const processedApprox = Math.min(initialTotal, totalMigrated + totalFailed);
        let percent =
          initialTotal > 0 ? Math.min(99, Math.round((processedApprox / initialTotal) * 100)) : 0;
        if (result.done) percent = 100;
        setMigrateProgress({
          percent,
          migrated: totalMigrated,
          failed: totalFailed,
          totalHint: initialTotal,
          targetBucket: targetBucket || undefined,
          failureSamples: allFailures.slice(0, 8),
        });
        cursor = result.next_cursor;
        done = result.done;
      }

      if (dryRun) {
        messageApi.success(
          t('pages.system.files.storageMigrateDryRunDone', {
            count: totalMigrated,
            failed: totalFailed,
          }),
        );
      } else if (totalMigrated === 0 && totalFailed === 0) {
        messageApi.warning(t('pages.system.files.storageMigrateNothing'));
      } else if (totalMigrated === 0 && totalFailed > 0) {
        messageApi.error(
          t('pages.system.files.storageMigrateAllFailed', {
            failed: totalFailed,
            bucket: targetBucket || '-',
          }),
        );
      } else if (totalFailed > 0) {
        messageApi.warning(
          t('pages.system.files.storageMigratePartial', {
            migrated: totalMigrated,
            failed: totalFailed,
            bucket: targetBucket || '-',
          }),
        );
      } else {
        messageApi.success(
          t('pages.system.files.storageMigrateSuccess', {
            count: totalMigrated,
            bucket: targetBucket || '-',
          }),
        );
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('pages.system.files.storageMigrateFailed');
      messageApi.error(msg);
    } finally {
      setMigrating(false);
    }
  };

  const handleMigrate = () => {
    modal.confirm({
      title: t('pages.system.files.storageMigrateConfirmTitle'),
      content: t('pages.system.files.storageMigrateConfirmContent'),
      okText: t('pages.system.files.storageMigrateConfirmOk'),
      onOk: () => runMigrate(false),
    });
  };

  const handleBackfillImageTiers = async () => {
    setImageTierBackfillLoading(true);
    try {
      let offset = 0;
      let done = false;
      let totalGenerated = 0;
      while (!done) {
        const result = await backfillImageTiers({ limit: 50, offset });
        totalGenerated += result.generated;
        done = result.done;
        offset = result.next_offset;
      }
      messageApi.success(
        t('pages.system.files.imageTierBackfillSuccess', { count: totalGenerated }),
      );
      onImageTiersBackfilled?.();
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : t('pages.system.files.imageTierBackfillFailed');
      messageApi.error(msg);
    } finally {
      setImageTierBackfillLoading(false);
    }
  };

  return (
    <Modal
      title={t('pages.system.files.storageSettingsTitle')}
      open={open}
      onCancel={onClose}
      width={MODAL_CONFIG.SMALL_WIDTH}
      destroyOnHidden
      confirmLoading={loading}
      footer={
        <Button type="primary" loading={saving} onClick={() => void handleSave()}>
          {t('pages.system.files.storageSettingsSave')}
        </Button>
      }
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        title={t('pages.system.files.storageSettingsEnvHint')}
      />
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          storage_location: LOCAL_LOCATION_VALUE,
          backend: 'local',
          delete_local_after_migrate: true,
          key_prefix: '',
        }}
      >
        <Form.Item
          name="storage_location"
          label={t('pages.system.files.storageBackendLabel')}
          rules={[{ required: true }]}
          extra={
            <Typography.Text type="secondary">
              {t('pages.system.files.storageConnectionHint')}{' '}
              <Link to="/system/application-connections">{t('pages.system.files.storageConnectionLink')}</Link>
            </Typography.Text>
          }
        >
          <Select
            showSearch
            optionFilterProp="label"
            options={locationOptions}
            placeholder={t('pages.system.files.storageLocationPlaceholder')}
            disabled={loading}
          />
        </Form.Item>

        <Form.Item
          name="key_prefix"
          label={t('pages.system.files.storageKeyPrefixLabel')}
          extra={t('pages.system.files.storageKeyPrefixHint')}
        >
          <Input placeholder="dev / prod" maxLength={64} allowClear />
        </Form.Item>

        <Divider />
        <Typography.Text strong>{t('pages.system.files.storageMigrateSection')}</Typography.Text>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, marginBottom: 16 }}>
          <Form.Item name="delete_local_after_migrate" valuePropName="checked" noStyle>
            <Switch />
          </Form.Item>
          <Typography.Text>{t('pages.system.files.storageDeleteLocalLabel')}</Typography.Text>
        </div>
        <Space wrap style={{ marginBottom: migrateProgress ? 12 : 0 }}>
          <Button
            disabled={!isObjectStorage || migrating || imageTierBackfillLoading}
            loading={migrating}
            onClick={handleMigrate}
          >
            {t('pages.system.files.storageMigrateButton')}
          </Button>
          <Button
            disabled={!isObjectStorage || migrating || imageTierBackfillLoading}
            onClick={() => void runMigrate(true)}
          >
            {t('pages.system.files.storageMigrateDryRun')}
          </Button>
        </Space>
        {migrateProgress ? (
          <div style={{ marginBottom: 8 }}>
            <Progress percent={migrateProgress.percent} status={migrating ? 'active' : undefined} />
            <Typography.Text type="secondary">
              {t('pages.system.files.storageMigrateProgress', {
                migrated: migrateProgress.migrated,
                failed: migrateProgress.failed,
                total: migrateProgress.totalHint,
              })}
            </Typography.Text>
            {migrateProgress.targetBucket ? (
              <div>
                <Typography.Text type="secondary">
                  {t('pages.system.files.storageMigrateTargetBucket', {
                    bucket: migrateProgress.targetBucket,
                  })}
                </Typography.Text>
              </div>
            ) : null}
            {migrateProgress.failureSamples.length > 0 ? (
              <Alert
                type="warning"
                showIcon
                style={{ marginTop: 8 }}
                title={t('pages.system.files.storageMigrateFailureHint')}
                description={
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {migrateProgress.failureSamples.map((f) => (
                      <li key={f.uuid}>
                        <Typography.Text code>{f.uuid.slice(0, 8)}</Typography.Text> {f.reason}
                      </li>
                    ))}
                  </ul>
                }
              />
            ) : null}
          </div>
        ) : null}

        <Divider />
        <Typography.Text strong>{t('pages.system.files.imageTierBackfillButton')}</Typography.Text>
        <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 12 }}>
          {t('pages.system.files.imageTierBackfillHint')}
        </Typography.Paragraph>
        <Button
          loading={imageTierBackfillLoading}
          disabled={migrating}
          onClick={() => void handleBackfillImageTiers()}
        >
          {t('pages.system.files.imageTierBackfillButton')}
        </Button>
      </Form>
    </Modal>
  );
};

export default FileStorageSettingsModal;
