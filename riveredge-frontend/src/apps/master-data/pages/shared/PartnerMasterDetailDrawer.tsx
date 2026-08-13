/**
 * 客商等多板块基础资料详情抽屉。
 * STANDARD_WIDTH；plainBody 多个 DetailDrawerSection；无生命周期 / 全链路。
 */

import React from 'react';
import { Button, Result } from 'antd';
import { useTranslation } from 'react-i18next';
import { DetailDrawerTemplate, DRAWER_CONFIG } from '../../../../components/layout-templates';

export type PartnerMasterDetailDrawerProps = {
  title: string;
  open: boolean;
  onClose: () => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  extra?: React.ReactNode;
  zIndex?: number;
  children?: React.ReactNode;
};

export const PartnerMasterDetailDrawer: React.FC<PartnerMasterDetailDrawerProps> = ({
  title,
  open,
  onClose,
  loading = false,
  error = null,
  onRetry,
  extra,
  zIndex,
  children,
}) => {
  const { t } = useTranslation();
  const contentReady = Boolean(children);
  const showError = Boolean(error) && !contentReady && !loading;
  const showLoading = loading || (!contentReady && !showError);

  if (!open) return null;

  return (
    <DetailDrawerTemplate
      title={title}
      open={open}
      onClose={onClose}
      zIndex={zIndex}
      width={DRAWER_CONFIG.STANDARD_WIDTH}
      loading={showLoading}
      extra={contentReady ? extra ?? null : null}
      plainBody={
        showError ? (
          <Result
            status="error"
            title={error}
            extra={
              onRetry ? (
                <Button type="primary" onClick={onRetry}>
                  {t('common.retry', { defaultValue: '重试' })}
                </Button>
              ) : null
            }
          />
        ) : contentReady ? (
          children
        ) : (
          <div style={{ minHeight: 80 }} />
        )
      }
    />
  );
};
