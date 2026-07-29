import React, { useState } from 'react';
import { WechatOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Button, Dropdown, Spin, Tooltip, Typography, theme } from 'antd';
import { useTranslation } from 'react-i18next';

import { getTenantHeaderMiniprogramQr } from '../../services/clientRelease';
import { normalizeFilePreviewUrl } from '../../services/file';
import { getTenantId } from '../../utils/auth';
import { useGlobalStore } from '../../stores';

const { Text } = Typography;

export const HeaderMiniprogramQrButton: React.FC = () => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const currentUser = useGlobalStore((s) => s.currentUser);
  const tenantId =
    getTenantId() ??
    (currentUser?.tenant_id != null ? Number(currentUser.tenant_id) : null) ??
    (currentUser?.tenantId != null ? Number(currentUser.tenantId) : null);
  const [open, setOpen] = useState(false);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['tenantHeaderMiniprogramQr', tenantId],
    queryFn: getTenantHeaderMiniprogramQr,
    enabled: tenantId != null,
    staleTime: 60_000,
    retry: 1,
  });

  const imageUrl = data?.image_url ? normalizeFilePreviewUrl(data.image_url) : null;
  const visible = Boolean(data?.enabled && imageUrl);

  if (!tenantId || isLoading || !visible) {
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
        {t('ui.header.miniprogramQr.title')}
      </Text>
      <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
        {t('ui.header.miniprogramQr.subtitle')}
      </Text>
      {isFetching ? (
        <div style={{ padding: '32px 0', textAlign: 'center' }}>
          <Spin />
        </div>
      ) : (
        <div style={{ padding: '12px 0', textAlign: 'center' }}>
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
            <img
              src={imageUrl!}
              alt={t('ui.header.miniprogramQr.title')}
              width={148}
              height={148}
              style={{ objectFit: 'contain', display: 'block' }}
            />
          </div>
          <Text type="secondary" style={{ display: 'block', fontSize: 12, marginTop: 4 }}>
            {t('ui.header.miniprogramQr.scanHint')}
          </Text>
        </div>
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
        }
      }}
      popupRender={() => popup}
      trigger={['click']}
      placement="bottomRight"
      arrow={false}
      classNames={{ root: 'header-actions-dropdown' }}
    >
      <Tooltip title={t('ui.header.miniprogramQr.tooltip')} open={open ? false : undefined}>
        <Button type="text" size="small" icon={<WechatOutlined />} />
      </Tooltip>
    </Dropdown>
  );
};
