import React from 'react';
import { SyncOutlined } from '@ant-design/icons';
import { Tooltip, theme } from 'antd';
import { useTranslation } from 'react-i18next';

export function hasExternalSyncSource(record: Record<string, unknown> | null | undefined): boolean {
  if (!record) return false;
  const raw = record.externalSyncAt ?? record.external_sync_at;
  return raw != null && raw !== '';
}

export interface ExternalSyncSourceIconProps {
  title?: string;
  style?: React.CSSProperties;
}

/** 列表主列：标记该行数据曾通过「同步」写入/更新 */
export function ExternalSyncSourceIcon({ title, style }: ExternalSyncSourceIconProps) {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  return (
    <Tooltip title={title ?? t('components.externalSyncSource.iconHint')}>
      <SyncOutlined
        aria-label={title ?? t('components.externalSyncSource.iconHint')}
        style={{
          fontSize: 12,
          color: token.colorPrimary,
          flexShrink: 0,
          ...style,
        }}
      />
    </Tooltip>
  );
}

export function renderExternalSyncPrimaryExtra(
  record: Record<string, unknown> | null | undefined,
): React.ReactNode {
  if (!hasExternalSyncSource(record)) return null;
  return <ExternalSyncSourceIcon style={{ marginLeft: 4 }} />;
}
