/**
 * 配置中心 - 审核设置面板
 *
 * 数据源：GET /core/audit-bindings（manifest.audit + 租户绑定）
 * 卡片式：单据名称 / 开关 / 审批流程下拉
 */

import React, { useMemo } from 'react';
import { App, Card, Layout, Menu, Select, Spin, Switch, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { theme } from 'antd';

import { AUDIT_CATEGORIES } from './configTree';
import {
  getAuditBindings,
  updateAuditBinding,
  type AuditBindingItem,
} from '../../../services/auditBinding';

const { useToken } = theme;
const { Text, Paragraph } = Typography;

const AUDIT_BINDINGS_QUERY_KEY = ['auditBindings'] as const;

interface AuditSettingsPanelProps {
  selectedCatId: string;
  onSelectCat: (id: string) => void;
}

const AuditSettingsPanel: React.FC<AuditSettingsPanelProps> = ({ selectedCatId, onSelectCat }) => {
  const { t, i18n } = useTranslation();
  const { token } = useToken();
  const { message: messageApi } = App.useApp();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: AUDIT_BINDINGS_QUERY_KEY,
    queryFn: getAuditBindings,
    staleTime: 60_000,
  });

  const updateMutation = useMutation({
    mutationFn: ({
      nodeKey,
      payload,
    }: {
      nodeKey: string;
      payload: { is_enabled?: boolean; process_uuid?: string | null };
    }) => updateAuditBinding(nodeKey, payload),
    onMutate: async ({ nodeKey, payload }) => {
      await queryClient.cancelQueries({ queryKey: AUDIT_BINDINGS_QUERY_KEY });
      const previous = queryClient.getQueryData(AUDIT_BINDINGS_QUERY_KEY);
      if (payload.is_enabled !== undefined) {
        queryClient.setQueryData(AUDIT_BINDINGS_QUERY_KEY, (current: typeof data) => {
          if (!current) return current;
          return {
            ...current,
            items: current.items.map((item) =>
              item.node_key === nodeKey ? { ...item, is_enabled: payload.is_enabled! } : item,
            ),
          };
        });
      }
      return { previous };
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: AUDIT_BINDINGS_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: ['businessConfigAuditRequiredMap'] });
      messageApi.success(t('pages.system.configCenter.auditSwitch.updateSuccess'));
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(AUDIT_BINDINGS_QUERY_KEY, context.previous);
      }
      messageApi.error(error?.message || t('pages.system.configCenter.auditSwitch.updateFailed'));
    },
  });

  const processOptions = data?.process_options ?? [];

  const buildSelectOptionsForItem = (item: AuditBindingItem) => {
    const byCode = processOptions.filter((p) => p.code === item.node_key);
    const opts = byCode.map((p) => ({
      value: p.uuid,
      label: `${p.name} (${p.code})`,
    }));
    if (
      item.process_uuid &&
      item.process_name &&
      item.process_code &&
      !opts.some((o) => o.value === item.process_uuid)
    ) {
      opts.unshift({
        value: item.process_uuid,
        label: `${item.process_name} (${item.process_code})`,
      });
    }
    return opts;
  };

  const pendingNodeKey = updateMutation.isPending ? updateMutation.variables?.nodeKey : null;

  const categoryItems = useMemo(() => {
    const all = data?.items ?? [];
    const currentCat = selectedCatId || AUDIT_CATEGORIES[0]?.id || 'common';
    if (currentCat === 'common') {
      return all.filter((item) => item.config_category === 'common' || !item.config_category);
    }
    return all.filter((item) => item.config_category === currentCat);
  }, [data?.items, selectedCatId]);

  const renderText = (key: string | undefined, fallback?: string) => {
    if (!key) return fallback || '';
    if (i18n.exists(key)) return t(key);
    return fallback || key;
  };

  const handleToggle = (record: AuditBindingItem, checked: boolean) => {
    updateMutation.mutate({
      nodeKey: record.node_key,
      payload: { is_enabled: checked },
    });
  };

  const handleProcessChange = (record: AuditBindingItem, processUuid: string | null) => {
    updateMutation.mutate({
      nodeKey: record.node_key,
      payload: { process_uuid: processUuid || undefined },
    });
  };

  const currentCat =
    AUDIT_CATEGORIES.find((c) => c.id === selectedCatId) || AUDIT_CATEGORIES[0];

  const sectionCardStyle = {
    background: token.colorBgContainer,
    borderColor: token.colorBorderSecondary,
  } as const;

  const itemCardStyle = {
    background: token.colorFillAlter,
    borderColor: token.colorBorderSecondary,
  } as const;

  return (
    <Layout style={{ minHeight: 400, height: '100%', minWidth: 0, background: 'transparent' }}>
      <Layout.Sider
        width={200}
        className="config-center-category-sider"
        style={{ background: token.colorBgContainer, borderRadius: 8, padding: '16px 0' }}
      >
        <div style={{ padding: '0 16px 16px', borderBottom: `1px solid ${token.colorBorder}`, marginBottom: 8 }}>
          <Text strong>{t('pages.system.configCenter.categoryTitle')}</Text>
        </div>
        <Menu
          selectedKeys={[selectedCatId]}
          mode="inline"
          style={{ border: 'none', background: 'transparent' }}
          items={AUDIT_CATEGORIES.map((c) => ({
            key: c.id,
            label: renderText(c.nameKey, c.id),
          }))}
          onClick={({ key }) => onSelectCat(key)}
        />
      </Layout.Sider>
      <Layout.Content
        style={{
          padding: '14px 0 0 24px',
          height: '100%',
          minHeight: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div className="config-center-scrollable-content">
          <div style={{ marginBottom: 16 }}>
            <Text strong style={{ fontSize: 16 }}>
              {renderText(currentCat?.nameKey, currentCat?.id)}
            </Text>
            <Paragraph type="secondary" style={{ marginTop: 4 }}>
              {t('pages.system.configCenter.auditBinding.sectionDesc')}
            </Paragraph>
          </div>

          <Card
            size="small"
            style={sectionCardStyle}
            styles={{ body: { background: token.colorBgContainer } }}
          >
            <Text strong>{t('pages.system.configCenter.auditSwitch.sectionTitle')}</Text>
            <Spin spinning={isLoading}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))',
                  gap: 12,
                  marginTop: 12,
                }}
              >
                {categoryItems.map((item) => (
                  <Card
                    key={item.node_key}
                    size="small"
                    style={itemCardStyle}
                    styles={{ body: { background: token.colorFillAlter } }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: 12,
                      }}
                    >
                      <div style={{ flex: 1, marginRight: 16, minWidth: 0 }}>
                        <Text strong>{item.name}</Text>
                        <Paragraph type="secondary" style={{ fontSize: 12, margin: 0 }}>
                          {item.node_key}
                        </Paragraph>
                      </div>
                      <Switch
                        checked={item.is_enabled}
                        loading={pendingNodeKey === item.node_key}
                        onChange={(v) => handleToggle(item, v)}
                      />
                    </div>
                    <div>
                      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                        {t('pages.system.configCenter.auditBinding.process')}
                      </Text>
                      <Select
                        allowClear
                        showSearch
                        size="middle"
                        placeholder={t('pages.system.configCenter.auditBinding.processPlaceholder')}
                        style={{ width: '100%' }}
                        optionFilterProp="label"
                        value={item.is_enabled ? (item.process_uuid ?? undefined) : undefined}
                        loading={pendingNodeKey === item.node_key}
                        disabled={!item.is_enabled}
                        options={buildSelectOptionsForItem(item)}
                        onChange={(v) => handleProcessChange(item, v ?? null)}
                      />
                    </div>
                  </Card>
                ))}
                {categoryItems.length === 0 && (
                  <Text type="secondary">{t('pages.system.configCenter.auditSwitch.empty')}</Text>
                )}
              </div>
            </Spin>
          </Card>
        </div>
      </Layout.Content>
    </Layout>
  );
};

export default AuditSettingsPanel;
