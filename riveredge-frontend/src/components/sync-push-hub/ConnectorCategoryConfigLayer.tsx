import React, { useEffect, useMemo, useState } from 'react';
import { Button, Flex, Spin, Tag, Typography, theme } from 'antd';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  getApplicationConnectionListAll,
  getConnectorDefinitions,
  type ApplicationConnection,
  type ConnectorDefinition,
} from '../../services/applicationConnection';
import { buildConnectedAppRows } from './connectorCategoryConfig';

export interface ConnectorCategoryConfigLayerProps {
  writableCategories: Iterable<string>;
}

export const ConnectorCategoryConfigLayer: React.FC<ConnectorCategoryConfigLayerProps> = ({
  writableCategories,
}) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const [loading, setLoading] = useState(true);
  const [definitions, setDefinitions] = useState<ConnectorDefinition[]>([]);
  const [connections, setConnections] = useState<ApplicationConnection[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [catalogResult, connectionResult] = await Promise.allSettled([
        getConnectorDefinitions(),
        getApplicationConnectionListAll({ is_active: true }),
      ]);
      if (cancelled) return;
      if (catalogResult.status === 'fulfilled') {
        setDefinitions(catalogResult.value?.items || []);
      }
      setConnections(connectionResult.status === 'fulfilled' ? connectionResult.value : []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(
    () =>
      buildConnectedAppRows({
        definitions,
        connections,
        writableCategories,
      }),
    [connections, definitions, writableCategories],
  );

  const categoryLabel = (categoryKey: string) => {
    const labelKey = `components.syncPushHub.category.${categoryKey}`;
    const translated = t(labelKey);
    return translated === labelKey ? categoryKey : translated;
  };

  return (
    <section aria-label={t('components.syncPushHub.configLayerTitle')}>
      <Flex align="center" justify="space-between" gap={8} wrap="wrap">
        <Typography.Text strong>{t('components.syncPushHub.configLayerTitle')}</Typography.Text>
        <Link to="/system/application-connections">
          <Button size="small" type="link">
            {t('components.syncPushHub.goConfigureConnection')}
          </Button>
        </Link>
      </Flex>
      <Typography.Paragraph type="secondary" style={{ margin: '2px 0 6px', fontSize: token.fontSizeSM }}>
        {t('components.syncPushHub.configLayerDisclaimer')}
      </Typography.Paragraph>
      {loading ? (
        <Spin size="small" />
      ) : rows.length === 0 ? (
        <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
          {t('components.syncPushHub.configLayerEmpty')}
        </Typography.Text>
      ) : (
        <Flex vertical gap={4}>
          {rows.map((row) => (
            <Flex
              key={row.key}
              align="center"
              gap={8}
              wrap="wrap"
              style={{
                minHeight: 28,
                padding: '2px 0',
                borderBottom: `1px solid ${token.colorBorderSecondary}`,
              }}
            >
              <Tag style={{ marginInlineEnd: 0 }}>{categoryLabel(row.categoryKey)}</Tag>
              <Typography.Text ellipsis style={{ flex: 1, minWidth: 120 }}>
                {row.displayName}
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                {row.pushRegistered
                  ? t('components.syncPushHub.categoryWritableHint')
                  : t('components.syncPushHub.categoryNotWritable')}
              </Typography.Text>
            </Flex>
          ))}
        </Flex>
      )}
    </section>
  );
};
