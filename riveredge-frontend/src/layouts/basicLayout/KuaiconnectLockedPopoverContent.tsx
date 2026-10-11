import React from 'react';
import { Button, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { DATA_CENTER_SYSTEM_PATHS } from '../../utils/kuaiconnectAccess';

export type KuaiconnectFeatureMeta = {
  path: (typeof DATA_CENTER_SYSTEM_PATHS)[number];
  titleKey: string;
  descKey: string;
};

const FEATURE_META: readonly KuaiconnectFeatureMeta[] = [
  {
    path: '/system/application-connections',
    titleKey: 'menu.system.application-connections',
    descKey: 'ui.systemSettingsPanel.kuaiconnectFeat.connectors',
  },
  {
    path: '/system/apis',
    titleKey: 'menu.system.apis',
    descKey: 'ui.systemSettingsPanel.kuaiconnectFeat.apis',
  },
  {
    path: '/system/data-sources',
    titleKey: 'menu.system.data-sources',
    descKey: 'ui.systemSettingsPanel.kuaiconnectFeat.dataSources',
  },
  {
    path: '/system/datasets',
    titleKey: 'menu.system.datasets',
    descKey: 'ui.systemSettingsPanel.kuaiconnectFeat.datasets',
  },
];

export function resolveKuaiconnectFeatureMeta(path?: string | null): KuaiconnectFeatureMeta | undefined {
  const normalized = String(path || '').trim();
  if (!normalized) return undefined;
  return FEATURE_META.find(
    (row) => normalized === row.path || normalized.startsWith(`${row.path}/`),
  );
}

export function KuaiconnectLockedPopoverTitle({ featurePath }: { featurePath?: string }) {
  const { t } = useTranslation();
  const feature = resolveKuaiconnectFeatureMeta(featurePath);
  const title = feature ? t(feature.titleKey) : t('ui.systemSettingsPanel.kuaiconnectRequiredTitle');
  return (
    <span className="riveredge-kuaiconnect-popover-title">
      <span>{title}</span>
      <span className="menu-item-badge menu-item-badge-pro">PRO</span>
    </span>
  );
}

export type KuaiconnectLockedPopoverContentProps = {
  featurePath?: string;
  onGoAppCenter: () => void;
};

export function KuaiconnectLockedPopoverContent({
  featurePath,
  onGoAppCenter,
}: KuaiconnectLockedPopoverContentProps) {
  const { t } = useTranslation();
  const feature = resolveKuaiconnectFeatureMeta(featurePath);

  if (!feature) {
    return (
      <div className="riveredge-kuaiconnect-popover">
        <Typography.Paragraph type="secondary" className="riveredge-kuaiconnect-popover-intro">
          {t('ui.systemSettingsPanel.kuaiconnectRequiredIntro')}
        </Typography.Paragraph>
        <Button type="link" size="small" className="riveredge-kuaiconnect-popover-actions" onClick={onGoAppCenter}>
          {t('ui.systemSettingsPanel.kuaiconnectGoAppCenter')}
        </Button>
      </div>
    );
  }

  return (
    <div className="riveredge-kuaiconnect-popover">
      <Typography.Paragraph type="secondary" className="riveredge-kuaiconnect-popover-intro">
        {t('ui.systemSettingsPanel.kuaiconnectSingleIntro', { name: t(feature.titleKey) })}
      </Typography.Paragraph>
      <div className="riveredge-kuaiconnect-popover-feature riveredge-kuaiconnect-popover-feature--active">
        <div className="riveredge-kuaiconnect-popover-feature-name">{t(feature.titleKey)}</div>
        <div className="riveredge-kuaiconnect-popover-feature-desc">{t(feature.descKey)}</div>
      </div>
      <Typography.Text type="secondary" className="riveredge-kuaiconnect-popover-foot">
        {t('ui.systemSettingsPanel.kuaiconnectRequiredFoot')}
      </Typography.Text>
      <Button type="link" size="small" className="riveredge-kuaiconnect-popover-actions" onClick={onGoAppCenter}>
        {t('ui.systemSettingsPanel.kuaiconnectGoAppCenter')}
      </Button>
    </div>
  );
}
