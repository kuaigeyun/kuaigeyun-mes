import { Button, Descriptions, Space, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { getClientReleasesByApp, type ClientRelease } from '../../../../services/clientRelease';

type Props = {
  appCode: string;
};

export function ApplicationClientReleasesPanel({ appCode }: Props) {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['clientReleasesByApp', appCode],
    queryFn: () => getClientReleasesByApp(appCode),
    enabled: Boolean(appCode),
  });

  if (isLoading) {
    return (
      <Typography.Text type="secondary">
        {t('pages.system.applications.clientReleasesLoading')}
      </Typography.Text>
    );
  }
  if (!data?.length) {
    return null;
  }

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Typography.Text strong>{t('pages.system.applications.clientReleasesLinkedTitle')}</Typography.Text>
      {data.map((r: ClientRelease) => (
        <Descriptions key={r.id} column={1} size="small" bordered>
          <Descriptions.Item label={t('pages.infra.clientReleases.columnClient')}>
            {r.client_key}
          </Descriptions.Item>
          <Descriptions.Item label={t('pages.infra.clientReleases.columnVersion')}>
            {r.app_version}
            {r.version_code ? ` (${r.version_code})` : ''}
          </Descriptions.Item>
          <Descriptions.Item label={t('pages.infra.clientReleases.columnPlatform')}>
            {r.platform}
          </Descriptions.Item>
          {(r.package?.url || r.apk?.url) && (
            <Descriptions.Item label={t('pages.infra.clientReleases.columnPackage')}>
              <a href={r.package?.url || r.apk?.url} target="_blank" rel="noreferrer">
                {t('pages.infra.clientReleases.downloadPackage')}
              </a>
            </Descriptions.Item>
          )}
          {r.release_notes ? (
            <Descriptions.Item label={t('pages.infra.clientReleases.columnNotes')}>
              {r.release_notes}
            </Descriptions.Item>
          ) : null}
        </Descriptions>
      ))}
      <Link to={`/infra/client-releases?app_code=${encodeURIComponent(appCode)}`} target="_blank">
        <Button type="link" size="small" style={{ padding: 0 }}>
          {t('pages.system.applications.clientReleasesManageLink')}
        </Button>
      </Link>
    </Space>
  );
}
