/**
 * 详情抽屉时间显示（不进菜单，地址：/apps/kuaizhizao/timeconfig）
 * 整合业务配置中的 3 项详情抽屉开关，并列出快制造详情抽屉时间字段供显隐。
 */

import React, { useEffect, useMemo, useState } from 'react';
import { App, Alert, Button, Card, Result, Select, Space, Spin, Switch, Typography } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useResourcePermissions } from '../../../../hooks/useResourcePermissions';
import { DETAIL_DRAWER_FEATURES_QUERY_KEY } from '../../../../hooks/useDetailDrawerFeatures';
import {
  batchUpdateProcessParameters,
  getBusinessConfig,
  isDetailBasicUpdatedAtEnabled,
  isDetailOperationLogEnabled,
  resolveDetailFullChainMode,
  resolveDetailTimeFieldHiddenMap,
  type DetailFullChainMode,
} from '../../../../services/businessConfig';
import { getApiErrorMessage } from '../../../../utils/errorHandler';
import { DETAIL_DRAWER_TIME_GROUPS } from '../../constants/detailDrawerTimeFields';

const CONFIG_CENTER_RESOURCE = 'system:config-center';

export default function TimeconfigPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const perms = useResourcePermissions(CONFIG_CENTER_RESOURCE);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: DETAIL_DRAWER_FEATURES_QUERY_KEY,
    queryFn: getBusinessConfig,
  });

  const [fullChainMode, setFullChainMode] = useState<DetailFullChainMode>('documents_only');
  const [operationLogEnabled, setOperationLogEnabled] = useState(true);
  const [updatedAtEnabled, setUpdatedAtEnabled] = useState(true);
  const [hiddenMap, setHiddenMap] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setFullChainMode(resolveDetailFullChainMode(data));
    setOperationLogEnabled(isDetailOperationLogEnabled(data));
    setUpdatedAtEnabled(isDetailBasicUpdatedAtEnabled(data));
    setHiddenMap(resolveDetailTimeFieldHiddenMap(data));
  }, [data]);

  const canUpdate = perms.canUpdate;

  const groups = useMemo(() => DETAIL_DRAWER_TIME_GROUPS, []);
  const fieldKeys = useMemo(
    () => groups.flatMap((group) => group.fields.map((item) => item.key)),
    [groups],
  );

  const setAllTimeFieldsShown = (shown: boolean) => {
    setHiddenMap(Object.fromEntries(fieldKeys.map((key) => [key, !shown])));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await batchUpdateProcessParameters({
        parameters: {
          common: {
            detail_full_chain_mode: fullChainMode,
            detail_operation_log_enabled: operationLogEnabled,
            detail_basic_updated_at_enabled: updatedAtEnabled,
            detail_time_field_hidden: Object.fromEntries(
              Object.entries(hiddenMap).filter(([, hidden]) => hidden === true),
            ),
          },
        },
      });
      await queryClient.invalidateQueries({ queryKey: DETAIL_DRAWER_FEATURES_QUERY_KEY });
      message.success(t('app.kuaizhizao.timeconfig.saveSuccess'));
    } catch (e) {
      message.error(getApiErrorMessage(e, t('common.saveFailed')));
    } finally {
      setSaving(false);
    }
  };

  if (!perms.canRead) {
    return <Result status="403" title={t('app.kuaizhizao.timeconfig.noPermission')} />;
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spin />
      </div>
    );
  }

  if (error) {
    return (
      <Result
        status="error"
        title={t('app.kuaizhizao.timeconfig.loadFailed')}
        extra={
          <Button type="primary" onClick={() => void refetch()}>
            {t('common.retry')}
          </Button>
        }
      />
    );
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '16px 20px 48px' }}>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        {t('app.kuaizhizao.timeconfig.pageTitle')}
      </Typography.Title>
      <Alert
        title={t('app.kuaizhizao.timeconfig.pageHint')}
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Card title={t('app.kuaizhizao.timeconfig.sectionDrawer')} style={{ marginBottom: 16 }}>
        <Space orientation="vertical" size="medium" style={{ width: '100%' }}>
          <div>
            <Typography.Text strong>{t('pages.system.configCenter.param.common_detail_full_chain_mode')}</Typography.Text>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
              {t('pages.system.configCenter.param.common_detail_full_chain_mode_desc')}
            </Typography.Paragraph>
            <Select
              style={{ minWidth: 280 }}
              value={fullChainMode}
              disabled={!canUpdate}
              onChange={(value) => setFullChainMode(value as DetailFullChainMode)}
              options={[
                {
                  value: 'off',
                  label: t('common.close'),
                },
                {
                  value: 'on',
                  label: t('common.enabled'),
                },
                {
                  value: 'documents_only',
                  label: t('pages.system.configCenter.param.common_detail_full_chain_mode_opt_documents_only'),
                },
              ]}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
            <div>
              <Typography.Text strong>
                {t('pages.system.configCenter.param.common_detail_operation_log_enabled')}
              </Typography.Text>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                {t('pages.system.configCenter.param.common_detail_operation_log_enabled_desc')}
              </Typography.Paragraph>
            </div>
            <Switch
              checked={operationLogEnabled}
              disabled={!canUpdate}
              onChange={setOperationLogEnabled}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
            <div>
              <Typography.Text strong>
                {t('common.updatedAt')}
              </Typography.Text>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                {t('pages.system.configCenter.param.common_detail_basic_updated_at_enabled_desc')}
              </Typography.Paragraph>
            </div>
            <Switch checked={updatedAtEnabled} disabled={!canUpdate} onChange={setUpdatedAtEnabled} />
          </div>
        </Space>
      </Card>

      <Card title={t('app.kuaizhizao.timeconfig.sectionFields')} style={{ marginBottom: 16 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 16,
            marginBottom: 8,
          }}
        >
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {t('app.kuaizhizao.timeconfig.sectionFieldsHint')}
          </Typography.Paragraph>
          {canUpdate ? (
            <Space size="small">
              <Button onClick={() => setAllTimeFieldsShown(true)}>
                {t('app.kuaizhizao.timeconfig.enableAll')}
              </Button>
              <Button onClick={() => setAllTimeFieldsShown(false)}>
                {t('app.kuaizhizao.timeconfig.disableAll')}
              </Button>
            </Space>
          ) : null}
        </div>
        {groups.map((group) => (
          <div key={group.documentType} style={{ marginBottom: 20 }}>
            <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
              {t(group.titleKey)}
            </Typography.Text>
            <Space orientation="vertical" size="small" style={{ width: '100%' }}>
              {group.fields.map((item) => {
                const shown = hiddenMap[item.key] !== true;
                return (
                  <div
                    key={item.key}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 16,
                    }}
                  >
                    <Typography.Text>{t(item.labelKey)}</Typography.Text>
                    <Switch
                      checked={shown}
                      disabled={!canUpdate}
                      onChange={(checked) => {
                        setHiddenMap((prev) => ({ ...prev, [item.key]: !checked }));
                      }}
                    />
                  </div>
                );
              })}
            </Space>
          </div>
        ))}
      </Card>

      {canUpdate ? (
        <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={() => void handleSave()}>
          {t('common.save')}
        </Button>
      ) : null}
    </div>
  );
}
