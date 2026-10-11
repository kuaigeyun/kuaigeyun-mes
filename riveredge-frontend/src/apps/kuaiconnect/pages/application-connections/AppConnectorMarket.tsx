/**
 * 应用连接器市场
 *
 * 新建应用连接器时展示连接器卡片，支持分类筛选和搜索，点击后进入对应配置表单。
 * AI 类连接器创建为应用连接列表行（可多条不同模型）。
 * 连接器列表优先从 API 获取，失败时回退到本地预置定义。
 * ERP Tab 内按厂商分组，组内再分云产品 / 传统产品。
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Card, Row, Col, Input, Space, Typography, Spin, Tag, theme } from 'antd';
import { MarkerTag } from '../../../constants/statusBadges';
import {
  SearchOutlined,
  MessageOutlined,
  CloudOutlined,
  DatabaseOutlined,
  AppstoreOutlined,
  TeamOutlined,
  RobotOutlined,
  CloudServerOutlined,
  HddOutlined,
  RocketOutlined,
  InteractionOutlined,
  ApartmentOutlined,
  EnvironmentOutlined,
  CarOutlined,
} from '@ant-design/icons';
import { MODAL_CONFIG } from '../../../components/layout-templates/constants';
import {
  APP_CONNECTOR_DEFINITIONS,
  AppConnectorCategory,
  AppConnectorDefinition,
  ERP_DEPLOYMENT_KIND_ORDER,
  ERP_VENDOR_GROUP_ORDER,
  ErpDeploymentKind,
  ErpVendorGroup,
  isKuaiaiOcrConnectionType,
  isKuaiaiWorkbuddyConnectionType,
  isLlmConnectionType,
  resolveErpDeploymentKind,
  resolveErpVendorGroup,
} from './connectors';
import {
  getApplicationConnectionListAll,
  getConnectorDefinitions,
  ConnectorDefinition,
} from '../../../services/applicationConnection';
import {
  AppConnectorBrandIcon,
  resolveConnectorMarketCardAccent,
} from './connectorBrandPresentation';

const { Text } = Typography;

const CATEGORY_MARKET_ACCENT: Record<AppConnectorCategory, string> = {
  collaboration: '#2BA245',
  erp: '#1677ff',
  plm: '#531dab',
  crm: '#eb2f96',
  oa: '#13c2c2',
  iot: '#fa8c16',
  wms: '#597ef7',
  storage: '#722ed1',
  ai: '#722ed1',
  other: '#1677ff',
};

const ICON_MAP: Record<string, React.ReactNode> = {
  MessageOutlined: <MessageOutlined />,
  CloudOutlined: <CloudOutlined />,
  DatabaseOutlined: <DatabaseOutlined />,
  AppstoreOutlined: <AppstoreOutlined />,
  TeamOutlined: <TeamOutlined />,
  RobotOutlined: <RobotOutlined />,
  CloudServerOutlined: <CloudServerOutlined />,
  HddOutlined: <HddOutlined />,
  RocketOutlined: <RocketOutlined />,
  InteractionOutlined: <InteractionOutlined />,
  ApartmentOutlined: <ApartmentOutlined />,
  EnvironmentOutlined: <EnvironmentOutlined />,
  CarOutlined: <CarOutlined />,
};

const CATEGORY_KEYS: Record<string, string> = {
  collaboration: 'categoryCollaboration',
  erp: 'categoryErp',
  plm: 'categoryPlm',
  crm: 'categoryCrm',
  oa: 'categoryOa',
  iot: 'categoryIot',
  wms: 'categoryWms',
  storage: 'categoryStorage',
  ai: 'categoryAi',
  other: 'categoryOther',
};

const ERP_VENDOR_I18N_KEYS: Record<ErpVendorGroup, string> = {
  kingdee: 'erpVendorKingdee',
  yonyou: 'erpVendorYonyou',
  digiwin: 'erpVendorDigiwin',
  sap: 'erpVendorSap',
  other: 'erpVendorOther',
};

const ERP_DEPLOYMENT_I18N_KEYS: Record<ErpDeploymentKind, string> = {
  cloud: 'erpDeploymentCloud',
  traditional: 'erpDeploymentTraditional',
};

function toAppConnectorDefinition(c: ConnectorDefinition): AppConnectorDefinition {
  return {
    id: c.id,
    name: c.name,
    type: c.type,
    category: c.category as AppConnectorDefinition['category'],
    description: c.description,
    icon: (c.icon && ICON_MAP[c.icon]) || <AppstoreOutlined />,
    defaultConfig: c.default_config || {},
  };
}

/** 合并 API 与本地预置：展示序以本地产品目录为准（大型在前），API 仅补本地尚未收录的项 */
function mergeConnectorDefinitions(apiItems: ConnectorDefinition[]): AppConnectorDefinition[] {
  const byId = new Map<string, AppConnectorDefinition>();
  for (const local of APP_CONNECTOR_DEFINITIONS) {
    byId.set(local.id, local);
  }
  for (const api of apiItems.map(toAppConnectorDefinition)) {
    if (!byId.has(api.id)) {
      byId.set(api.id, api);
    }
  }
  const ordered: AppConnectorDefinition[] = [];
  const seen = new Set<string>();
  for (const local of APP_CONNECTOR_DEFINITIONS) {
    const item = byId.get(local.id);
    if (!item) continue;
    ordered.push(item);
    seen.add(local.id);
  }
  for (const [id, item] of byId) {
    if (!seen.has(id)) ordered.push(item);
  }
  return ordered;
}

export interface AppConnectorMarketProps {
  open: boolean;
  onClose: () => void;
  onSelect: (connector: AppConnectorDefinition) => void;
  /** 打开时默认选中的分类 Tab（如 ai） */
  initialCategory?: string;
}

const AppConnectorMarket: React.FC<AppConnectorMarketProps> = ({
  open,
  onClose,
  onSelect,
  initialCategory = 'all',
}) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const [category, setCategory] = useState<string>(initialCategory);
  const [search, setSearch] = useState('');
  const [connectors, setConnectors] = useState<AppConnectorDefinition[]>(APP_CONNECTOR_DEFINITIONS);
  /** AI type → 列表中已存在连接行 */
  const [configuredAiTypes, setConfiguredAiTypes] = useState<Set<string>>(() => new Set());
  const categories = useMemo(() => [
    { key: 'all', label: t('pages.system.applicationConnections.categoryAll') },
    { key: 'collaboration', label: t('pages.system.applicationConnections.categoryCollaboration') },
    { key: 'erp', label: t('pages.system.applicationConnections.categoryErp') },
    { key: 'plm', label: t('pages.system.applicationConnections.categoryPlm') },
    { key: 'crm', label: t('pages.system.applicationConnections.categoryCrm') },
    { key: 'oa', label: t('pages.system.applicationConnections.categoryOa') },
    { key: 'iot', label: t('pages.system.applicationConnections.categoryIot') },
    { key: 'wms', label: t('pages.system.applicationConnections.categoryWms') },
    { key: 'storage', label: t('pages.system.applicationConnections.categoryStorage') },
    { key: 'ai', label: t('pages.system.applicationConnections.categoryAi') },
    { key: 'other', label: t('pages.system.applicationConnections.categoryOther') },
  ], [t]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    // 旧版多 Tab 入口若仍传 erp_*，收拢到 ERP
    const nextCategory =
      typeof initialCategory === 'string' && initialCategory.startsWith('erp_')
        ? 'erp'
        : initialCategory;
    setCategory(nextCategory);
    setSearch('');
    setLoading(true);
    let cancelled = false;
    const loadConnectors = getConnectorDefinitions()
      .then((res) => {
        if (cancelled) return;
        if (res?.items?.length) {
          setConnectors(mergeConnectorDefinitions(res.items));
        } else {
          setConnectors(APP_CONNECTOR_DEFINITIONS);
        }
      })
      .catch(() => {
        if (!cancelled) setConnectors(APP_CONNECTOR_DEFINITIONS);
      });
    const loadConfigured = getApplicationConnectionListAll()
      .then((items) => {
        if (cancelled) return;
        const next = new Set<string>();
        for (const row of items) {
          if (
            isLlmConnectionType(row.type) ||
            isKuaiaiOcrConnectionType(row.type) ||
            isKuaiaiWorkbuddyConnectionType(row.type)
          ) {
            next.add(row.type);
          }
        }
        setConfiguredAiTypes(next);
      })
      .catch(() => {
        if (!cancelled) setConfiguredAiTypes(new Set());
      });
    void Promise.all([loadConnectors, loadConfigured]).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, initialCategory]);

  const filteredConnectors = useMemo(() => {
    let list = connectors;
    if (category !== 'all') {
      list = list.filter((c) => c.category === category);
    }
    if (search.trim()) {
      const kw = search.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(kw) ||
          c.type.toLowerCase().includes(kw) ||
          (c.description || '').toLowerCase().includes(kw)
      );
    }
    return list;
  }, [connectors, category, search]);

  const erpVendorSections = useMemo(() => {
    if (category !== 'erp') return null;
    const sections: Array<{
      group: ErpVendorGroup;
      deployments: Array<{ kind: ErpDeploymentKind; items: AppConnectorDefinition[] }>;
    }> = [];
    for (const group of ERP_VENDOR_GROUP_ORDER) {
      const vendorItems = filteredConnectors.filter(
        (c) => (resolveErpVendorGroup(c) || 'other') === group,
      );
      if (!vendorItems.length) continue;
      const deployments = ERP_DEPLOYMENT_KIND_ORDER.map((kind) => ({
        kind,
        items: vendorItems.filter((c) => (resolveErpDeploymentKind(c) || 'traditional') === kind),
      })).filter((block) => block.items.length > 0);
      if (deployments.length) {
        sections.push({ group, deployments });
      }
    }
    return sections;
  }, [category, filteredConnectors]);

  const handleSelect = (connector: AppConnectorDefinition) => {
    onSelect(connector);
    onClose();
  };

  const connectorTypeKey = (id: string) =>
    `type${id.charAt(0).toUpperCase()}${id.slice(1)}`;

  const connectorDescKey = (id: string) =>
    `desc${id.charAt(0).toUpperCase()}${id.slice(1)}`;

  const renderConnectorCard = (connector: AppConnectorDefinition, options?: { hideCategoryTag?: boolean }) => {
    const keyConfigured =
      (isLlmConnectionType(connector.type) ||
        isKuaiaiOcrConnectionType(connector.type) ||
        isKuaiaiWorkbuddyConnectionType(connector.type)) &&
      configuredAiTypes.has(connector.type);
    const tagLabel = CATEGORY_KEYS[connector.category]
      ? t(`pages.system.applicationConnections.${CATEGORY_KEYS[connector.category]}`)
      : connector.category;
    const showCategoryTag = Boolean(connector.category) && !options?.hideCategoryTag;
    const title = t(`pages.system.applicationConnections.${connectorTypeKey(connector.id)}`, {
      defaultValue: connector.name,
    });
    const description = connector.description
      ? t(`pages.system.applicationConnections.${connectorDescKey(connector.id)}`, {
          defaultValue: connector.description,
        })
      : '';
    const cardAccent =
      resolveConnectorMarketCardAccent(connector.id) ??
      CATEGORY_MARKET_ACCENT[connector.category] ??
      token.colorPrimary;
    return (
      <Col key={connector.id} xs={24} sm={12} md={8}>
        <Card
          className="app-connector-market-card"
          hoverable
          size="small"
          onClick={() => handleSelect(connector)}
          style={
            {
              height: '100%',
              position: 'relative',
              '--connector-card-accent': cardAccent,
            } as React.CSSProperties
          }
        >
          <div className="app-connector-market-card-inner">
            <AppConnectorBrandIcon connectorId={connector.id} fallbackIcon={connector.icon} />
            <div className="app-connector-market-card-main">
              <div className="app-connector-market-card-title-row">
                <div className="app-connector-market-card-title">
                  <Text strong ellipsis={{ tooltip: title }}>
                    {title}
                  </Text>
                </div>
                {(connector.marketLabBadge ||
                  isKuaiaiWorkbuddyConnectionType(connector.type) ||
                  showCategoryTag ||
                  keyConfigured) && (
                  <div className="app-connector-market-card-tags">
                    {connector.marketLabBadge || isKuaiaiWorkbuddyConnectionType(connector.type) ? (
                      <MarkerTag color="default">{t('app.kuaiai.hub.labBadge')}</MarkerTag>
                    ) : null}
                    {showCategoryTag ? (
                      <MarkerTag color={connector.category === 'ai' ? 'purple' : 'blue'}>
                        {tagLabel}
                      </MarkerTag>
                    ) : null}
                    {keyConfigured ? (
                      <MarkerTag color="success">
                        {t('pages.system.applicationConnections.marketConfigured')}
                      </MarkerTag>
                    ) : null}
                  </div>
                )}
              </div>
              {description ? (
                <div
                  className="app-connector-market-card-desc"
                  style={{ color: token.colorTextSecondary }}
                  title={description}
                >
                  {description}
                </div>
              ) : null}
            </div>
          </div>
        </Card>
      </Col>
    );
  };

  return (
    <Modal
      title={t('pages.system.applicationConnections.marketTitle')}
      open={open}
      onCancel={onClose}
      footer={null}
      width={MODAL_CONFIG.CONNECTOR_MARKET_WIDTH}
      destroyOnHidden
      styles={{
        body: {
          paddingTop: token.paddingSM,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <div
        className="app-connector-market-shell"
        style={
          {
            '--connector-tag-idle-bg': token.colorFillTertiary,
            '--connector-tag-idle-color': token.colorText,
            '--connector-market-toolbar-bg': token.colorBgContainer,
            '--connector-market-toolbar-border': token.colorBorderSecondary,
          } as React.CSSProperties
        }
      >
        <style>{`
        .app-connector-market-shell {
          display: flex;
          flex-direction: column;
          width: 100%;
          max-height: min(72vh, 720px);
          min-height: 280px;
        }
        .app-connector-market-toolbar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 12px 16px;
          width: 100%;
          flex-shrink: 0;
          padding-bottom: 12px;
          background: var(--connector-market-toolbar-bg);
          border-bottom: 1px solid var(--connector-market-toolbar-border);
        }
        .app-connector-market-scroll {
          flex: 1 1 auto;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
          padding-top: 16px;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .app-connector-market-scroll::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }
        .app-connector-market-category-tags {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-start;
          align-items: center;
          gap: 8px;
          flex: 1 1 auto;
          min-width: 0;
        }
        .app-connector-market-category-tags .ant-tag {
          margin-inline-end: 0;
          display: inline-flex;
          align-items: center;
          min-height: 32px;
          padding-inline: 12px;
          padding-block: 5px;
          font-size: 14px;
          line-height: 22px;
          border-radius: 6px;
        }
        .app-connector-market-category-tags .ant-tag-checkable:not(.ant-tag-checkable-checked) {
          background: var(--connector-tag-idle-bg);
          color: var(--connector-tag-idle-color);
        }
        .app-connector-market-search {
          width: 272px;
          max-width: 100%;
          flex: 0 0 auto;
          margin-inline-start: auto;
        }
      `}</style>
        <div className="app-connector-market-toolbar">
          <div className="app-connector-market-category-tags">
            {categories.map((c) => (
              <Tag.CheckableTag
                key={c.key}
                checked={category === c.key}
                onChange={(checked) => {
                  if (checked) setCategory(c.key);
                }}
              >
                {c.label}
              </Tag.CheckableTag>
            ))}
          </div>
          <Input
            className="app-connector-market-search"
            placeholder={t('pages.system.applicationConnections.searchPlaceholder')}
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
          />
        </div>
        <div className="app-connector-market-scroll">
          <Spin spinning={loading}>
            <div
            style={
              {
                '--connector-primary': token.colorPrimary,
                '--connector-border': token.colorBorderSecondary,
                '--connector-fill': token.colorFillQuaternary,
                '--connector-card-bg': token.colorBgContainer,
              } as React.CSSProperties
            }
          >
            <style>{`
            .app-connector-market-card {
              border-radius: 10px;
              border: 1px solid var(--connector-border);
              box-shadow: none;
              overflow: hidden;
              background: var(--connector-card-bg, #ffffff);
            }
            .app-connector-market-card::before {
              content: '';
              position: absolute;
              left: 0;
              right: 0;
              top: 0;
              height: 72px;
              pointer-events: none;
              z-index: 2;
              background: var(--connector-card-accent, var(--connector-primary));
              opacity: 0.065;
              -webkit-mask-image: linear-gradient(180deg, #000 0%, transparent 100%);
              mask-image: linear-gradient(180deg, #000 0%, transparent 100%);
            }
            .app-connector-market-card .ant-card-body {
              padding: 18px 16px 17px;
              position: relative;
              z-index: 1;
              background: transparent !important;
            }
            .app-connector-market-card.ant-card-hoverable:hover {
              box-shadow: none !important;
              border-color: var(--connector-primary) !important;
              background: var(--connector-fill);
            }
            .app-connector-market-card.ant-card-hoverable:hover::before {
              opacity: 0.09;
            }
            .app-connector-market-card-inner {
              display: flex;
              gap: 12px;
              align-items: flex-start;
              min-height: 58px;
            }
            .app-connector-market-card-main {
              flex: 1;
              min-width: 0;
            }
            .app-connector-market-card-title-row {
              display: flex;
              align-items: center;
              flex-wrap: wrap;
              gap: 4px 6px;
              margin-bottom: 6px;
              line-height: 1.35;
            }
            .app-connector-market-card-title {
              flex: 1 1 auto;
              min-width: 0;
            }
            .app-connector-market-card-tags {
              display: inline-flex;
              flex-wrap: wrap;
              align-items: center;
              gap: 4px;
              flex-shrink: 0;
            }
            .app-connector-market-card-desc {
              font-size: 12px;
              line-height: 1.55;
              min-height: 2.85em;
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
              overflow: hidden;
            }
            .app-connector-brand-icon--fallback {
              background: var(--connector-fill);
              color: var(--connector-primary);
              border: 1px solid var(--connector-border);
            }
          `}</style>
            {erpVendorSections ? (
              <Space orientation="vertical" size="large" style={{ width: '100%' }}>
                {erpVendorSections.map((section) => (
                  <div key={section.group}>
                    <Text
                      strong
                      style={{
                        display: 'block',
                        marginBottom: 12,
                        fontSize: 15,
                      }}
                    >
                      {t(
                        `pages.system.applicationConnections.${ERP_VENDOR_I18N_KEYS[section.group]}`,
                      )}
                    </Text>
                    <Space orientation="vertical" size="medium" style={{ width: '100%' }}>
                      {section.deployments.map((block) => (
                        <div key={`${section.group}-${block.kind}`}>
                          <Text
                            type="secondary"
                            style={{
                              display: 'block',
                              marginBottom: 8,
                              fontSize: 13,
                            }}
                          >
                            {t(
                              `pages.system.applicationConnections.${ERP_DEPLOYMENT_I18N_KEYS[block.kind]}`,
                            )}
                          </Text>
                          <Row gutter={[16, 16]}>
                            {block.items.map((c) => renderConnectorCard(c, { hideCategoryTag: true }))}
                          </Row>
                        </div>
                      ))}
                    </Space>
                  </div>
                ))}
              </Space>
            ) : (
              <Row gutter={[16, 16]}>
                {filteredConnectors.map((c) =>
                  renderConnectorCard(c, { hideCategoryTag: category !== 'all' }),
                )}
              </Row>
            )}
            {filteredConnectors.length === 0 && !loading && (
              <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                {t('pages.system.applicationConnections.noMatch')}
              </div>
            )}
            </div>
          </Spin>
        </div>
      </div>
    </Modal>
  );
};

export default AppConnectorMarket;
