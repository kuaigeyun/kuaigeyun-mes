/**
 * 文件存储位置设置：本地 / 腾讯 COS，以及本环境历史文件迁移。
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { App, Alert, Button, Form, Input, Modal, Progress, Radio, Select, Space, Switch, Typography } from 'antd';
import { Link } from 'react-router-dom';
import {
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
}

const FileStorageSettingsModal: React.FC<FileStorageSettingsModalProps> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const { message: messageApi, modal } = App.useApp();
  const [form] = Form.useForm<FileStorageSettings>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [cosOptions, setCosOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [migrateProgress, setMigrateProgress] = useState<{
    percent: number;
    migrated: number;
    failed: number;
    totalHint: number;
    targetBucket?: string;
    failureSamples: Array<{ uuid: string; reason: string }>;
  } | null>(null);

  const backend = Form.useWatch('backend', form);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [settings, cosList] = await Promise.all([
        getFileStorageSettings(),
        getApplicationConnectionListAll({ type: 'tencent_cos', is_active: true }),
      ]);
      form.setFieldsValue({
        backend: settings.backend || 'local',
        connection_uuid: settings.connection_uuid || undefined,
        key_prefix: settings.key_prefix || '',
        delete_local_after_migrate: settings.delete_local_after_migrate !== false,
      });
      setCosOptions(
        cosList.map((c) => ({
          value: c.uuid,
          label: c.name || c.code || c.uuid,
        })),
      );
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('pages.system.files.storageSettingsLoadFailed');
      messageApi.error(msg);
    } finally {
      setLoading(false);
    }
  }, [form, messageApi, t]);

  useEffect(() => {
    if (open) {
      setMigrateProgress(null);
      void load();
    }
  }, [open, load]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload: FileStorageSettings = {
        backend: values.backend,
        connection_uuid: values.backend === 'connection' ? values.connection_uuid || null : null,
        key_prefix: (values.key_prefix || '').trim(),
        delete_local_after_migrate: values.delete_local_after_migrate !== false,
      };
      await saveFileStorageSettings(payload);
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
      // 迁移前先落库当前表单，确保 key_prefix / 连接与 UI 一致
      const values = await form.validateFields();
      await saveFileStorageSettings({
        backend: values.backend,
        connection_uuid: values.backend === 'connection' ? values.connection_uuid || null : null,
        key_prefix: (values.key_prefix || '').trim(),
        delete_local_after_migrate: values.delete_local_after_migrate !== false,
      });

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
          connection_uuid: values.connection_uuid || undefined,
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

  return (
    <Modal
      title={t('pages.system.files.storageSettingsTitle')}
      open={open}
      onCancel={onClose}
      footer={null}
      width={MODAL_CONFIG.SMALL_WIDTH}
      destroyOnClose
      confirmLoading={loading}
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message={t('pages.system.files.storageSettingsEnvHint')}
      />
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          backend: 'local',
          delete_local_after_migrate: true,
          key_prefix: '',
        }}
      >
        <Form.Item
          name="backend"
          label={t('pages.system.files.storageBackendLabel')}
          rules={[{ required: true }]}
        >
          <Radio.Group>
            <Radio value="local">{t('pages.system.files.storageBackendLocal')}</Radio>
            <Radio value="connection">{t('pages.system.files.storageBackendCos')}</Radio>
          </Radio.Group>
        </Form.Item>

        {backend === 'connection' && (
          <Form.Item
            name="connection_uuid"
            label={t('pages.system.files.storageConnectionLabel')}
            rules={[{ required: true, message: t('pages.system.files.storageConnectionRequired') }]}
            extra={
              <Typography.Text type="secondary">
                {t('pages.system.files.storageConnectionHint')}{' '}
                <Link to="/system/application-connections">{t('pages.system.files.storageConnectionLink')}</Link>
              </Typography.Text>
            }
          >
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              options={cosOptions}
              placeholder={t('pages.system.files.storageConnectionPlaceholder')}
            />
          </Form.Item>
        )}

        <Form.Item
          name="key_prefix"
          label={t('pages.system.files.storageKeyPrefixLabel')}
          extra={t('pages.system.files.storageKeyPrefixHint')}
        >
          <Input placeholder="dev / prod" maxLength={64} allowClear />
        </Form.Item>

        <Form.Item
          name="delete_local_after_migrate"
          label={t('pages.system.files.storageDeleteLocalLabel')}
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>

        <Space wrap style={{ marginBottom: 16 }}>
          <Button type="primary" loading={saving} onClick={() => void handleSave()}>
            {t('pages.system.files.storageSettingsSave')}
          </Button>
          <Button
            disabled={backend !== 'connection' || migrating}
            loading={migrating}
            onClick={handleMigrate}
          >
            {t('pages.system.files.storageMigrateButton')}
          </Button>
          <Button
            disabled={backend !== 'connection' || migrating}
            onClick={() => void runMigrate(true)}
          >
            {t('pages.system.files.storageMigrateDryRun')}
          </Button>
        </Space>

        {migrateProgress && (
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
                message={t('pages.system.files.storageMigrateFailureHint')}
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
        )}
      </Form>
    </Modal>
  );
};

export default FileStorageSettingsModal;
