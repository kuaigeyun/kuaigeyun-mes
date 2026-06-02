/**
 * 系统必备 / 补充初始项加载（配置中心 · 系统设置）
 */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Alert, App, Button, Card, Checkbox, Space, Spin, Table, Tag, Typography } from 'antd';
import { CloudDownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  getInitConfig,
  runInitItems,
  runRequiredInitItems,
  type InitItem,
  type RunInitResponse,
} from '../../../services/tenantInit';

const INIT_ITEM_NAME_I18N: Record<string, string> = {
  data_dictionary: 'pages.system.configCenter.tenantInit.item.data_dictionary',
  language: 'pages.system.configCenter.tenantInit.item.language',
  application: 'pages.system.configCenter.tenantInit.item.application',
  system_parameter: 'pages.system.configCenter.tenantInit.item.system_parameter',
  code_rule: 'pages.system.configCenter.tenantInit.item.code_rule',
  approval_process_preset: 'pages.system.configCenter.tenantInit.item.approval_process_preset',
  message_template_preset: 'pages.system.configCenter.tenantInit.item.message_template_preset',
  print_template_preset: 'pages.system.configCenter.tenantInit.item.print_template_preset',
  department_preset: 'pages.system.configCenter.tenantInit.item.department_preset',
  position_preset: 'pages.system.configCenter.tenantInit.item.position_preset',
  role_preset: 'pages.system.configCenter.tenantInit.item.role_preset',
  warehouse_preset: 'pages.system.configCenter.tenantInit.item.warehouse_preset',
  operation_preset: 'pages.system.configCenter.tenantInit.item.operation_preset',
  variant_attribute_preset: 'pages.system.configCenter.tenantInit.item.variant_attribute_preset',
  menu_sync: 'pages.system.configCenter.tenantInit.item.menu_sync',
};

function itemLabel(t: (k: string) => string, item: InitItem): string {
  const key = INIT_ITEM_NAME_I18N[item.key];
  return key ? t(key) : item.name;
}

function resultRows(results: RunInitResponse['results'], items: InitItem[]) {
  const nameByKey = new Map(items.map((i) => [i.key, i]));
  return Object.entries(results).map(([key, val]) => ({
    key,
    name: nameByKey.get(key)?.name ?? key,
    ...val,
  }));
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
    () => [...requiredItems, ...optionalItems, { key: 'menu_sync', name: '菜单同步', description: '' }],
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {requiredItems.map((item) => (
              <Card key={item.key} size="small" type="inner">
                <Typography.Text strong>{itemLabel(t, item)}</Typography.Text>
                <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0 }}>
                  {item.description}
                </Typography.Paragraph>
              </Card>
            ))}
          </div>
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
          <Checkbox.Group
            value={optionalKeys}
            onChange={(vals) => setOptionalKeys(vals as string[])}
            style={{ width: '100%' }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {optionalItems.map((item) => (
                <Card key={item.key} size="small" type="inner">
                  <Checkbox value={item.key}>
                    <Typography.Text strong>{itemLabel(t, item)}</Typography.Text>
                  </Checkbox>
                  <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0, marginLeft: 24 }}>
                    {item.description}
                  </Typography.Paragraph>
                </Card>
              ))}
            </div>
          </Checkbox.Group>
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
                    const i18nKey = INIT_ITEM_NAME_I18N[key];
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
