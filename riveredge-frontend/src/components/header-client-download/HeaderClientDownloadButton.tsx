import React, { useMemo, useState } from 'react';
import { MobileOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Dropdown, Spin, Tooltip, Typography, theme } from 'antd';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';

import { getClientDownloadQrOrigin, getTenantClientDownloads, type TenantClientDownload } from '../../services/clientRelease';
import { getTenantId } from '../../utils/auth';
import {
  isLoopbackDownloadUrl,
  isPageLoopback,
  resolvePublicDownloadUrl,
} from '../../utils/resolvePublicDownloadUrl';
import { useGlobalStore } from '../../stores';

const { Text } = Typography;

function formatFileSize(bytes?: number | null): string {
  if (bytes == null || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DownloadQrCard({
  item,
  qrOrigin,
  originLoading,
}: {
  item: TenantClientDownload;
  qrOrigin?: string;
  originLoading: boolean;
}) {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const downloadUrl = resolvePublicDownloadUrl(item.url, qrOrigin);
  const sizeLabel = formatFileSize(item.size_bytes);
  const blocked = isPageLoopback() && !qrOrigin && !originLoading;
  const showQr = !originLoading && !blocked && !isLoopbackDownloadUrl(downloadUrl);

  return (
    <div style={{ padding: '12px 0' }}>
      <div style={{ marginBottom: 8, textAlign: 'center' }}>
        <Text strong>{item.display_name}</Text>
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            v{item.app_version}
            {sizeLabel ? ` · ${sizeLabel}` : ''}
          </Text>
        </div>
      </div>
      {originLoading ? (
        <div style={{ padding: '24px 0', textAlign: 'center' }}>
          <Spin size="small" />
        </div>
      ) : blocked ? (
        <Alert type="warning" showIcon title={t('ui.header.clientDownload.lanOriginFailed')} />
      ) : showQr ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: 8,
            background: token.colorBgContainer,
            padding: 8,
            borderRadius: token.borderRadius,
            border: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <QRCodeSVG value={downloadUrl} size={148} />
        </div>
      ) : (
        <Alert type="error" showIcon title={t('ui.header.clientDownload.loopbackBlocked')} />
      )}
      {showQr ? (
        <>
          <Text type="secondary" style={{ display: 'block', textAlign: 'center', fontSize: 12, marginTop: 4 }}>
            {t('ui.header.clientDownload.scanHint')}
          </Text>
          <Text
            type="secondary"
            style={{ display: 'block', textAlign: 'center', fontSize: 11, marginTop: 4, lineHeight: 1.5 }}
          >
            {t('ui.header.clientDownload.scanTip')}
          </Text>
        </>
      ) : null}
    </div>
  );
}

export const HeaderClientDownloadButton: React.FC = () => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const currentUser = useGlobalStore((s) => s.currentUser);
  const tenantId =
    getTenantId() ??
    (currentUser?.tenant_id != null ? Number(currentUser.tenant_id) : null) ??
    (currentUser?.tenantId != null ? Number(currentUser.tenantId) : null);
  const [open, setOpen] = useState(false);
  const frontendPort = window.location.port ? Number(window.location.port) : undefined;

  const { data: downloads = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ['tenantClientDownloads', tenantId],
    queryFn: getTenantClientDownloads,
    enabled: tenantId != null,
    staleTime: 60_000,
    retry: 1,
  });

  const { data: qrOrigin, isLoading: originLoading, refetch: refetchOrigin } = useQuery({
    queryKey: ['clientDownloadQrOrigin', tenantId, frontendPort],
    queryFn: async () => {
      const origin = await getClientDownloadQrOrigin(frontendPort);
      try {
        const host = new URL(origin).hostname;
        if (host && !/^(localhost|127\.0\.0\.1|::1)$/i.test(host)) {
          localStorage.setItem('client_download_public_host', host);
        }
      } catch {
        /* ignore */
      }
      return origin;
    },
    enabled: tenantId != null && open,
    staleTime: 300_000,
    retry: 1,
  });

  const visibleDownloads = useMemo(
    () => downloads.filter((item) => Boolean(item.url)),
    [downloads],
  );

  // 默认不展示，避免首屏闪现；仅在拉取完成且存在可下载客户端时显示
  if (!tenantId || isLoading || isFetching || visibleDownloads.length === 0) {
    return null;
  }

  const popup = (
    <div
      style={{
        width: 280,
        maxHeight: 480,
        overflowY: 'auto',
        backgroundColor: token.colorBgElevated,
        borderRadius: token.borderRadiusLG,
        boxShadow: token.boxShadowSecondary,
        padding: '12px 16px',
      }}
    >
      <Text strong style={{ display: 'block', marginBottom: 4 }}>
        {t('ui.header.clientDownload.title')}
      </Text>
      <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
        {t('ui.header.clientDownload.subtitle')}
      </Text>
      {isLoading || isFetching ? (
        <div style={{ padding: '32px 0', textAlign: 'center' }}>
          <Spin />
        </div>
      ) : (
        visibleDownloads.map((item, index) => (
          <div
            key={item.client_key}
            style={
              index < visibleDownloads.length - 1
                ? { borderBottom: `1px solid ${token.colorBorderSecondary}` }
                : undefined
            }
          >
            <DownloadQrCard
              item={item}
              qrOrigin={qrOrigin}
              originLoading={originLoading}
            />
          </div>
        ))
      )}
    </div>
  );

  return (
    <Dropdown
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          void refetch();
          void refetchOrigin();
        }
      }}
      popupRender={() => popup}
      trigger={['click']}
      placement="bottomRight"
      arrow={false}
      classNames={{ root: 'header-actions-dropdown' }}
    >
      <Tooltip title={t('ui.header.clientDownload.tooltip')} open={open ? false : undefined}>
        <Button type="text" size="small" icon={<MobileOutlined />} />
      </Tooltip>
    </Dropdown>
  );
};
