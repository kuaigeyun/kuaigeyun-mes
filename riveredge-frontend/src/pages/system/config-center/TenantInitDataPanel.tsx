/**
 * 系统必备 / 补充初始项加载（配置中心 · 系统设置）
 */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Alert, App, Button, Card, Checkbox, Col, Row, Space, Spin, Table, Tag, Typography } from 'antd';
import { CloudDownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  getInitConfig,
  runInitItems,
  runRequiredInitItems,
  type InitItem,
  type RunInitResponse,
} from '../../../services/tenantInit';
import {
  TENANT_INIT_ITEM_NAME_I18N,
  tenantInitItemDescription,
  tenantInitItemLabel,
} from '../../../utils/tenantInitI18n';

function resultRows(results: RunInitResponse['results'], items: InitItem[]) {
  const nameByKey = new Map(items.map((i) => [i.key, i]));
  return Object.entries(results).map(([key, val]) => ({
    key,
    name: nameByKey.get(key)?.name ?? key,
    ...val,
  }));
}

const INIT_ITEM_COL_PROPS = { xs: 24, sm: 12, md: 8 } as const;

function RequiredInitItemCard({ item, t }: { item: InitItem; t: (key: string) => string }) {
  return (
    <Card size="small" type="inner" style={{ width: '100%', height: '100%' }}>
      <Typography.Text strong>{tenantInitItemLabel(t, item)}</Typography.Text>
      <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0 }}>
        {tenantInitItemDescription(t, item)}
      </Typography.Paragraph>
    </Card>
  );
}

function OptionalInitItemCard({
  item,
  t,
  checked,
  onCheckedChange,
}: {
  item: InitItem;
  t: (key: string) => string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <Card size="small" type="inner" style={{ width: '100%', height: '100%' }}>
      <Checkbox
        checked={checked}
        onChange={(e) => onCheckedChange(e.target.checked)}
        style={{ width: '100%', alignItems: 'flex-start' }}
      >
        <div>
          <Typography.Text strong>{tenantInitItemLabel(t, item)}</Typography.Text>
          <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0 }}>
            {tenantInitItemDescription(t, item)}
          </Typography.Paragraph>
        </div>
      </Checkbox>
    </Card>
  );
}

function InitItemGrid({ children }: { children: React.ReactNode }) {
  return (
    <Row gutter={[12, 12]}>
      {children}
    </Row>
  );
}

export const TenantInitDataPanel: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [optionalKeys, setOptionalKeys] = useState<string[]>([]);
  const [lastResults, setLastResults] = useState<RunInitResponse['results'] | null>(null);
  const [runningRequired, setRunningRequired] = useState(false);
  const [runningOptional, setRunningOptional] = useState(false);

  const { data: config, isLoading, refetch } = useQuery({
    queryKey: ['tenantInitConfig'],
    queryFn: getInitConfig,
    staleTime: 300_000,
  });

  const requiredItems = config?.required ?? [];
  const optionalItems = config?.optional ?? [];
  const allItems = useMemo(
    () => [...requiredItems, ...optionalItems],
    [requiredItems, optionalItems],
  );

  const handleRunRequired = async () => {
    setRunningRequired(true);
    try {
      const res = await runRequiredInitItems();
      setLastResults(res.results);
      messageApi.success(res.message);
    } catch (e: any) {
      messageApi.error(e?.message || t('pages.system.configCenter.tenantInit.runFailed'));
    } finally {
      setRunningRequired(false);
    }
  };

  const handleRunOptional = async () => {
    if (optionalKeys.length === 0) {
      messageApi.warning(t('pages.system.configCenter.tenantInit.selectOptionalFirst'));
      return;
    }
    setRunningOptional(true);
    try {
      const res = await runInitItems(optionalKeys);
      setLastResults((prev) => ({ ...prev, ...res.results }));
      messageApi.success(res.message);
    } catch (e: any) {
      messageApi.error(e?.message || t('pages.system.configCenter.tenantInit.runFailed'));
    } finally {
      setRunningOptional(false);
    }
  };

  const handleToggleOptional = (key: string, checked: boolean) => {
    setOptionalKeys((prev) => (checked ? [...prev, key] : prev.filter((k) => k !== key)));
  };

  const resultTableData = lastResults ? resultRows(lastResults, allItems) : [];

  return (
    <Spin spinning={isLoading}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          message={t('pages.system.configCenter.tenantInit.alertTitle')}
          description={t('pages.system.configCenter.tenantInit.alertDesc')}
        />

        <Card size="small" title={t('pages.system.configCenter.tenantInit.requiredTitle')}>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
            {t('pages.system.configCenter.tenantInit.requiredDesc')}
          </Typography.Paragraph>
          <InitItemGrid>
            {requiredItems.map((item) => (
              <Col key={item.key} {...INIT_ITEM_COL_PROPS}>
                <RequiredInitItemCard item={item} t={t} />
              </Col>
            ))}
          </InitItemGrid>
          <Button
            type="primary"
            icon={<CloudDownloadOutlined />}
            loading={runningRequired}
            onClick={handleRunRequired}
            style={{ marginTop: 16 }}
          >
            {t('pages.system.configCenter.tenantInit.runRequiredButton')}
          </Button>
        </Card>

        <Card size="small" title={t('pages.system.configCenter.tenantInit.optionalTitle')}>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
            {t('pages.system.configCenter.tenantInit.optionalDesc')}
          </Typography.Paragraph>
          <InitItemGrid>
            {optionalItems.map((item) => (
              <Col key={item.key} {...INIT_ITEM_COL_PROPS}>
                <OptionalInitItemCard
                  item={item}
                  t={t}
                  checked={optionalKeys.includes(item.key)}
                  onCheckedChange={(checked) => handleToggleOptional(item.key, checked)}
                />
              </Col>
            ))}
          </InitItemGrid>
          <Space style={{ marginTop: 16 }}>
            <Button
              icon={<CloudDownloadOutlined />}
              loading={runningOptional}
              onClick={handleRunOptional}
            >
              {t('pages.system.configCenter.tenantInit.runOptionalButton')}
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
              {t('pages.system.configCenter.tenantInit.refreshConfig')}
            </Button>
          </Space>
        </Card>

        {resultTableData.length > 0 && (
          <Card size="small" title={t('pages.system.configCenter.tenantInit.lastResultTitle')}>
            <Table
              size="small"
              pagination={false}
              dataSource={resultTableData}
              columns={[
                {
                  title: t('pages.system.configCenter.tenantInit.colItem'),
                  dataIndex: 'key',
                  render: (key: string, row) => {
                    const i18nKey = TENANT_INIT_ITEM_NAME_I18N[key];
                    return i18nKey ? t(i18nKey) : row.name || key;
                  },
                },
                {
                  title: t('pages.system.configCenter.tenantInit.colStatus'),
                  dataIndex: 'success',
                  width: 100,
                  render: (ok: boolean) =>
                    ok ? (
                      <Tag color="success">{t('pages.system.configCenter.tenantInit.statusSuccess')}</Tag>
                    ) : (
                      <Tag color="error">{t('pages.system.configCenter.tenantInit.statusFailed')}</Tag>
                    ),
                },
                {
                  title: t('pages.system.configCenter.tenantInit.colDetail'),
                  render: (_, row) =>
                    row.success
                      ? row.created != null
                        ? t('pages.system.configCenter.tenantInit.createdCount', { count: row.created })
                        : '—'
                      : row.error || '—',
                },
              ]}
            />
          </Card>
        )}
      </Space>
    </Spin>
  );
};

export default TenantInitDataPanel;
