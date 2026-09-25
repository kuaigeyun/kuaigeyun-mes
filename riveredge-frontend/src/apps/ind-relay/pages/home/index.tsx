import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Descriptions, Space, Spin, Typography, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ListPageTemplate } from '../../../../components/layout-templates';
import { useResourcePermissions } from '../../../../hooks/useResourcePermissions';
import { industryRelayApi, type RelayModuleStatus } from '../../services/industryRelayApi';

export default function RelayHomePage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [status, setStatus] = useState<RelayModuleStatus | null>(null);
  const entryPerms = useResourcePermissions('ind-relay:entry');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await industryRelayApi.getStatus();
      setStatus(data);
    } catch (e: any) {
      message.error(e?.message || t('app.ind-relay.home.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleReapply = useCallback(async () => {
    setApplying(true);
    try {
      const data = await industryRelayApi.reapplyDefaults();
      setStatus(data);
      message.success(t('app.ind-relay.home.reapplyOk'));
    } catch (e: any) {
      message.error(e?.message || t('app.ind-relay.home.reapplyFailed'));
    } finally {
      setApplying(false);
    }
  }, [t]);

  return (
    <ListPageTemplate>
      <Spin spinning={loading}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {t('app.ind-relay.home.title')}
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {t('app.ind-relay.home.intro')}
          </Typography.Paragraph>

          <Alert type="info" showIcon message={t('app.ind-relay.home.apsBoundary')} />

          {!status?.tables_ready && (
            <Alert
              type="warning"
              showIcon
              message={t('app.ind-relay.home.tablesMissing')}
              description={t('app.ind-relay.home.tablesMissingHint')}
            />
          )}

          <Card
            title={t('app.ind-relay.home.statusTitle')}
            extra={
              <Space>
                <Button onClick={() => void load()}>{t('common.refresh')}</Button>
                {entryPerms.canUpdate ? (
                  <Button type="primary" loading={applying} onClick={() => void handleReapply()}>
                    {t('app.ind-relay.home.reapply')}
                  </Button>
                ) : null}
              </Space>
            }
          >
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label={t('app.ind-relay.home.outputBasis')}>
                {status?.output_basis || '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.ind-relay.home.resourceMode')}>
                {status?.resource_mode || '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.ind-relay.home.lineExclusive')}>
                {status?.line_exclusive ? t('common.yes') : t('common.no')}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.ind-relay.home.hostDefaults')}>
                {status?.host_defaults_applied ? t('common.yes') : t('common.no')}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.ind-relay.home.lineCapacityCount')}>
                {status?.line_capacity_count ?? 0}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.ind-relay.home.changeoverCount')}>
                {status?.changeover_count ?? 0}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title={t('app.ind-relay.home.nextSteps')}>
            <Space direction="vertical">
              <Link to="/apps/ind-relay/line-capacity">{t('app.ind-relay.menu.lineCapacity')}</Link>
              <Link to="/apps/ind-relay/changeover">{t('app.ind-relay.menu.changeover')}</Link>
              <Link to="/apps/ind-relay/line-output">{t('app.ind-relay.menu.lineOutput')}</Link>
              <Link to="/apps/kuaizhizao/plan-management/scheduling">
                {t('app.ind-relay.home.openScheduling')}
              </Link>
            </Space>
          </Card>
        </Space>
      </Spin>
    </ListPageTemplate>
  );
}
