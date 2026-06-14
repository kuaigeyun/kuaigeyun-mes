import { useMemo } from 'react';
import { Alert, Button, Descriptions, Tag } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import type { ProDescriptionsItemProps } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';

import { UniDetail, detailDrawerDescriptionItems } from '../../../components/uni-detail';
import { DRAWER_CONFIG } from '../../../components/layout-templates';
import type { ClientRelease } from '../../../services/clientRelease';

function formatFileSize(bytes?: number | null): string {
  if (bytes == null || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Props = {
  open: boolean;
  release: ClientRelease | null;
  clientLabel?: string;
  onClose: () => void;
};

export function ClientReleaseDetailDrawer({ open, release, clientLabel, onClose }: Props) {
  const { t } = useTranslation();
  const packageInfo = release?.package ?? release?.apk;
  const packageUrl = packageInfo?.url;

  const detailColumns = useMemo((): ProDescriptionsItemProps<ClientRelease>[] => {
    return [
      {
        title: t('pages.infra.clientReleases.columnClient'),
        key: 'client',
        render: () => clientLabel ?? release?.client_key ?? '—',
      },
      {
        title: t('pages.infra.clientReleases.columnPlatform'),
        dataIndex: 'platform',
      },
      {
        title: t('pages.infra.clientReleases.columnVersion'),
        key: 'version',
        render: (_, record) =>
          `${record.app_version}${record.version_code ? ` (${record.version_code})` : ''}`,
      },
      {
        title: t('pages.infra.clientReleases.formRuntimeVersion'),
        dataIndex: 'runtime_version',
        render: (v) => v ?? '—',
      },
      {
        title: t('pages.infra.clientReleases.columnUpdateType'),
        dataIndex: 'update_type',
      },
      {
        title: t('pages.infra.clientReleases.columnStatus'),
        dataIndex: 'is_active',
        render: (_, record) =>
          record.is_active ? (
            <Tag color="success">{t('pages.infra.clientReleases.statusActive')}</Tag>
          ) : (
            <Tag>{t('pages.infra.clientReleases.statusHistory')}</Tag>
          ),
      },
      {
        title: t('pages.infra.clientReleases.formForceUpdate'),
        dataIndex: 'force_update',
        render: (v) => (v ? t('common.enabled') : t('common.disabled')),
      },
      {
        title: t('pages.infra.clientReleases.columnRollout'),
        dataIndex: 'rollout_percent',
        render: (v) => `${v ?? 100}%`,
      },
      {
        title: t('pages.infra.clientReleases.detailMinVersionCode'),
        dataIndex: 'min_version_code',
      },
      {
        title: t('pages.infra.clientReleases.detailBundleId'),
        dataIndex: 'bundle_id',
        render: (v) => v ?? '—',
      },
      {
        title: t('pages.infra.clientReleases.columnPublishedAt'),
        dataIndex: 'published_at',
        valueType: 'dateTime',
      },
      {
        title: t('pages.infra.clientReleases.detailCreatedBy'),
        dataIndex: 'created_by',
        render: (v) => v ?? '—',
      },
      {
        title: t('pages.infra.clientReleases.detailPackageFilename'),
        key: 'package_filename',
        render: (_, record) => record.package?.filename ?? record.apk?.filename ?? '—',
      },
      {
        title: t('pages.infra.clientReleases.detailPackageSize'),
        key: 'package_size',
        render: (_, record) =>
          formatFileSize(record.package?.size_bytes ?? record.apk?.size_bytes),
      },
      {
        title: t('pages.infra.clientReleases.detailPackageSha256'),
        key: 'package_sha256',
        span: 2,
        render: (_, record) => record.package?.sha256 ?? record.apk?.sha256 ?? '—',
      },
      {
        title: t('pages.infra.clientReleases.columnNotes'),
        dataIndex: 'release_notes',
        span: 2,
        render: (v) => v || '—',
      },
      {
        title: t('pages.infra.clientReleases.detailOtaPath'),
        key: 'ota_path',
        span: 2,
        render: (_, record) => record.ota?.relative_path ?? record.ota?.updates_url ?? '—',
      },
      {
        title: 'UUID',
        dataIndex: 'uuid',
        span: 2,
      },
    ];
  }, [clientLabel, release?.client_key, t]);

  return (
    <UniDetail
      title={t('pages.infra.clientReleases.detailTitle')}
      open={open}
      onClose={onClose}
      width={DRAWER_CONFIG.STANDARD_WIDTH}
      banner={
        <Alert type="info" showIcon title={t('pages.infra.clientReleases.detailActivateHint')} />
      }
      footer={
        packageUrl ? (
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => window.open(packageUrl, '_blank', 'noopener,noreferrer')}
          >
            {t('pages.infra.clientReleases.downloadPackage')}
          </Button>
        ) : undefined
      }
      basic={
        release ? (
          <Descriptions
            column={2}
            items={detailDrawerDescriptionItems(detailColumns, release)}
          />
        ) : null
      }
    />
  );
}
