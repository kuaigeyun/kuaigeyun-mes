/**
 * 配置中心 - 审核设置面板
 *
 * 数据源：GET /core/audit-bindings（manifest.audit + 租户绑定）
 * 卡片式：单据名称 / 开关 / 审批流程下拉
 */

import React, { useEffect, useMemo } from 'react';
import { App, Button, Card, Layout, Menu, Select, Space, Spin, Switch, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
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

type AuditRenderBlock =
  | { kind: 'section'; sectionKey: string }
  | { kind: 'item'; item: AuditBindingItem };

/** 分区展示序：同分区条目聚拢，避免声明序交错导致标题重复出现 */
const AUDIT_SECTION_ORDER = [
  'office_admin',
  'office_training',
  'plm_change',
  'plm_doc',
  'plm_project',
  'sales_order',
  'sales_fulfillment',
  'sales_special',
  'procurement_request',
  'procurement_order',
  'production_work',
  'production_reporting',
  'quality_inspection',
  'quality_complaint',
  'quality_collab',
  'warehouse_picking',
  'warehouse_logistics',
  'finance_ar_ap',
  'finance_invoice',
] as const;

function sortAuditItemsForSections(items: AuditBindingItem[]): AuditBindingItem[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const sa = (a.item.config_section || '').trim();
      const sb = (b.item.config_section || '').trim();
      const ia = sa ? AUDIT_SECTION_ORDER.indexOf(sa as (typeof AUDIT_SECTION_ORDER)[number]) : -1;
      const ib = sb ? AUDIT_SECTION_ORDER.indexOf(sb as (typeof AUDIT_SECTION_ORDER)[number]) : -1;
      const ra = ia === -1 ? (sa ? 900 : 950) : ia;
      const rb = ib === -1 ? (sb ? 900 : 950) : ib;
      if (ra !== rb) return ra - rb;
      return a.index - b.index;
    })
    .map((x) => x.item);
}

function groupAuditItemsForRender(items: AuditBindingItem[]): AuditRenderBlock[] {
  const blocks: AuditRenderBlock[] = [];
  let lastSection = '';
  for (const item of sortAuditItemsForSections(items)) {
    const section = (item.config_section || '').trim();
    if (section && section !== lastSection) {
      lastSection = section;
      blocks.push({ kind: 'section', sectionKey: section });
    }
    blocks.push({ kind: 'item', item });
  }
  return blocks;
}

const AuditSettingsPanel: React.FC<AuditSettingsPanelProps> = ({ selectedCatId, onSelectCat }) => {
  const { t, i18n } = useTranslation();
  const { token } = useToken();
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
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

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of data?.items ?? []) {
      const cat = item.config_category || 'common';
      counts.set(cat, (counts.get(cat) || 0) + 1);
    }
    return counts;
  }, [data?.items]);

  const visibleCategories = useMemo(() => {
    if (!data?.items) return AUDIT_CATEGORIES;
    return AUDIT_CATEGORIES.filter((c) => (categoryCounts.get(c.id) || 0) > 0);
  }, [categoryCounts, data?.items]);

  useEffect(() => {
    if (!visibleCategories.some((c) => c.id === selectedCatId)) {
      onSelectCat(visibleCategories[0]?.id || 'common');
    }
  }, [visibleCategories, selectedCatId, onSelectCat]);

  const categoryItems = useMemo(() => {
    const all = data?.items ?? [];
    const currentCat = selectedCatId || visibleCategories[0]?.id || 'common';
    if (currentCat === 'common') {
      return all.filter((item) => item.config_category === 'common' || !item.config_category);
    }
    return all.filter((item) => item.config_category === currentCat);
  }, [data?.items, selectedCatId, visibleCategories]);

  const renderBlocks = useMemo(() => groupAuditItemsForRender(categoryItems), [categoryItems]);

  const renderText = (key: string | undefined, fallback?: string) => {
    if (!key) return fallback || '';
    if (i18n.exists(key)) return t(key);
    return fallback || key;
  };

  const renderSectionTitle = (sectionKey: string) => {
    const nameKey = `pages.system.configCenter.auditSection.${sectionKey}`;
    const descKey = `${nameKey}_desc`;
    return (
      <div
        key={`section:${sectionKey}`}
        style={{
          gridColumn: '1 / -1',
          marginTop: 12,
          marginBottom: 4,
          padding: '12px 14px',
          borderRadius: token.borderRadiusLG,
        }}
      >
        <Text strong style={{ fontSize: 14, color: token.colorPrimary }}>
          {renderText(nameKey, sectionKey)}
        </Text>
        {i18n.exists(descKey) ? (
          <Paragraph
            type="secondary"
            style={{ fontSize: 12, margin: '4px 0 0', color: token.colorTextSecondary }}
          >
            {t(descKey)}
          </Paragraph>
        ) : null}
      </div>
    );
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

  const resolveDesignProcessUuid = (item: AuditBindingItem): string | undefined => {
    if (item.process_uuid) return item.process_uuid;
    const matched = processOptions.filter((p) => p.code === item.node_key);
    return matched.length === 1 ? matched[0].uuid : undefined;
  };

  const handleDesign = (item: AuditBindingItem) => {
    const uuid = resolveDesignProcessUuid(item);
    if (!uuid) {
      messageApi.warning(t('pages.system.configCenter.auditBinding.selectProcessBeforeDesign'));
      return;
    }
    navigate(`/system/approval-processes/designer?uuid=${uuid}`);
  };

  const currentCat =
    visibleCategories.find((c) => c.id === selectedCatId) ||
    AUDIT_CATEGORIES.find((c) => c.id === selectedCatId) ||
    visibleCategories[0] ||
    AUDIT_CATEGORIES[0];

  const sectionCardStyle = {
    background: token.colorBgContainer,
    borderColor: token.colorBorderSecondary,
  } as const;

  const itemCardStyle = {
    background: token.colorFillAlter,
    borderColor: token.colorBorderSecondary,
  } as const;

  return (
    <Layout className="config-center-tab-layout" style={{ minHeight: 0, height: '100%', minWidth: 0, background: 'transparent' }}>
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
          items={visibleCategories.map((c) => ({
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
            {currentCat?.descriptionKey ? (
              <Paragraph type="secondary" style={{ marginTop: 4 }}>
                {renderText(currentCat.descriptionKey, '')}
              </Paragraph>
            ) : (
              <Paragraph type="secondary" style={{ marginTop: 4 }}>
                {t('pages.system.configCenter.auditBinding.sectionDesc')}
              </Paragraph>
            )}
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
                {renderBlocks.map((block) => {
                  if (block.kind === 'section') {
                    return renderSectionTitle(block.sectionKey);
                  }
                  const item = block.item;
                  return (
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
                        <Space.Compact style={{ width: '100%' }}>
                          <Select
                            allowClear
                            showSearch
                            size="medium"
                            placeholder={t('pages.system.configCenter.auditBinding.processPlaceholder')}
                            style={{ flex: 1, minWidth: 0 }}
                            optionFilterProp="label"
                            value={item.process_uuid ?? undefined}
                            loading={pendingNodeKey === item.node_key}
                            options={buildSelectOptionsForItem(item)}
                            onChange={(v) => handleProcessChange(item, v ?? null)}
                          />
                          <Button
                            size="medium"
                            disabled={!resolveDesignProcessUuid(item)}
                            onClick={() => handleDesign(item)}
                          >
                            {t('pages.system.configCenter.auditBinding.design')}
                          </Button>
                        </Space.Compact>
                        {!item.is_enabled && item.process_matched ? (
                          <Paragraph
                            type="secondary"
                            style={{ fontSize: 12, margin: '6px 0 0' }}
                          >
                            {t('pages.system.configCenter.auditBinding.bindRolesBeforeEnable')}
                          </Paragraph>
                        ) : null}
                      </div>
                    </Card>
                  );
                })}
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
