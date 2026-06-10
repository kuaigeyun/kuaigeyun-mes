import { EditOutlined } from '@ant-design/icons';
import { App, Button, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DetailDrawerTemplate, DRAWER_CONFIG } from '../../../components/layout-templates';
import {
  listClientProductConfigs,
  type ClientProductConfig,
} from '../../../services/clientRelease';
import { ClientProductConfigEditModal } from './ClientProductConfigEditModal';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function ClientProductConfigDrawer({ open, onClose }: Props) {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ClientProductConfig[]>([]);
  const [editClientKey, setEditClientKey] = useState<string | null>(null);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listClientProductConfigs('android');
      setRows(list.filter((row) => row.push_configurable));
    } catch (e) {
      messageApi.error(
        e instanceof Error ? e.message : t('pages.infra.clientReleases.configFetchFailed'),
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [messageApi, t]);

  useEffect(() => {
    if (open) {
      void loadRows();
    } else {
      setEditClientKey(null);
    }
  }, [open, loadRows]);

  const columns: ColumnsType<ClientProductConfig> = [
    {
      title: t('pages.infra.clientReleases.columnClient'),
      key: 'client',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{record.display_name}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {record.client_key}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: t('pages.infra.clientReleases.columnPlatform'),
      dataIndex: 'platform_target',
      width: 100,
      render: (value: string) => {
        const label =
          value === 'android'
            ? t('pages.infra.clientReleases.platformAndroid')
            : value === 'ios'
              ? t('pages.infra.clientReleases.platformIos')
              : value === 'windows'
                ? t('pages.infra.clientReleases.platformWindows')
                : value;
        return label;
      },
    },
    {
      title: t('pages.infra.clientReleases.configColumnPush'),
      key: 'push',
      width: 120,
      render: (_, record) =>
        record.push_enabled ? (
          <Tag color="blue">{t('pages.infra.clientReleases.configPushOn')}</Tag>
        ) : (
          <Tag>{t('pages.infra.clientReleases.configPushOff')}</Tag>
        ),
    },
    {
      title: t('pages.infra.clientReleases.configJpushAppKey'),
      key: 'app_key',
      ellipsis: true,
      render: (_, record) => {
        if (record.jpush_app_key) {
          return record.jpush_app_key;
        }
        if (record.env_fallback_app_key) {
          return (
            <Typography.Text type="secondary">
              {t('pages.infra.clientReleases.configFromEnv')}
            </Typography.Text>
          );
        }
        return <Typography.Text type="secondary">{t('pages.infra.clientReleases.configNotSet')}</Typography.Text>;
      },
    },
    {
      title: t('pages.infra.clientReleases.configColumnSecret'),
      key: 'secret',
      width: 120,
      render: (_, record) => {
        if (record.jpush_master_secret_configured) {
          return <Tag color="green">{t('pages.infra.clientReleases.configSecretConfigured')}</Tag>;
        }
        if (record.env_fallback_master_secret) {
          return <Tag color="gold">{t('pages.infra.clientReleases.configFromEnv')}</Tag>;
        }
        return <Tag>{t('pages.infra.clientReleases.configNotSet')}</Tag>;
      },
    },
    {
      title: t('pages.infra.clientReleases.configColumnReady'),
      key: 'ready',
      width: 110,
      render: (_, record) =>
        record.effective_push_ready ? (
          <Tag color="success">{t('pages.infra.clientReleases.configReadyYes')}</Tag>
        ) : (
          <Tag color="warning">{t('pages.infra.clientReleases.configReadyNo')}</Tag>
        ),
    },
    {
      title: t('common.actions'),
      key: 'action',
      width: 88,
      fixed: 'right',
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          icon={<EditOutlined />}
          onClick={() => setEditClientKey(record.client_key)}
        >
          {t('pages.infra.clientReleases.configEditAction')}
        </Button>
      ),
    },
  ];

  return (
    <>
      <DetailDrawerTemplate
        title={t('pages.infra.clientReleases.configDrawerTitle')}
        open={open}
        onClose={onClose}
        width={DRAWER_CONFIG.LARGE_WIDTH}
        loading={loading}
        plainBody={
          <Table<ClientProductConfig>
            rowKey="client_key"
            size="middle"
            pagination={false}
            scroll={{ x: 960 }}
            dataSource={rows}
            columns={columns}
          />
        }
      />

      <ClientProductConfigEditModal
        open={editClientKey != null}
        clientKey={editClientKey}
        onClose={() => setEditClientKey(null)}
        onSaved={() => void loadRows()}
      />
    </>
  );
}
