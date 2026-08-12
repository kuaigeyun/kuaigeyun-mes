/**
 * 应用连接器市场
 *
 * 新建应用连接器时展示连接器卡片，支持分类筛选和搜索，点击后进入对应配置表单。
 * AI 类连接器创建为应用连接列表行（可多条不同模型）。
 * 连接器列表优先从 API 获取，失败时回退到本地预置定义。
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Card, Row, Col, Input, Radio, Space, Typography, Spin, theme } from 'antd';
import { MarkerTag, StatusTag } from '../../../constants/statusBadges';
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
} from '@ant-design/icons';
import { MODAL_CONFIG } from '../../../components/layout-templates/constants';
import {
  APP_CONNECTOR_DEFINITIONS,
  AppConnectorDefinition,
  isLlmConnectionType,
} from './connectors';
import {
  getApplicationConnectionListAll,
  getConnectorDefinitions,
  ConnectorDefinition,
} from '../../../services/applicationConnection';

const { Text } = Typography;

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

/** 合并 API 连接器与本地 AI 连接器（API 可能尚未包含） */
function mergeConnectorDefinitions(apiItems: ConnectorDefinition[]): AppConnectorDefinition[] {
  const merged = apiItems.map(toAppConnectorDefinition);
  const knownIds = new Set(merged.map((c) => c.id));
  for (const local of APP_CONNECTOR_DEFINITIONS) {
    if (local.category === 'ai' && !knownIds.has(local.id)) {
      merged.push(local);
    }
  }
  return merged;
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
  ], [t]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCategory(initialCategory);
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
          if (isLlmConnectionType(row.type)) {
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

  const handleSelect = (connector: AppConnectorDefinition) => {
    onSelect(connector);
    onClose();
  };

  const connectorTypeKey = (id: string) =>
    `type${id.charAt(0).toUpperCase()}${id.slice(1)}`;

  const connectorDescKey = (id: string) =>
    `desc${id.charAt(0).toUpperCase()}${id.slice(1)}`;

  return (
    <Modal
      title={t('pages.system.applicationConnections.marketTitle')}
      open={open}
      onCancel={onClose}
      footer={null}
      width={MODAL_CONFIG.CONNECTOR_MARKET_WIDTH}
      destroyOnHidden
    >
      <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
        <Radio.Group
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          optionType="button"
          size="middle"
        >
          {categories.map((c) => (
            <Radio.Button key={c.key} value={c.key}>
              {c.label}
            </Radio.Button>
          ))}
        </Radio.Group>
        <Input
          placeholder={t('pages.system.applicationConnections.searchPlaceholder')}
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
        />
        <Spin spinning={loading}>
          <div style={{ '--connector-primary': token.colorPrimary } as React.CSSProperties}>
            <style>{`
            .app-connector-market-card.ant-card-hoverable:hover {
              box-shadow: none !important;
              border: 1px solid var(--connector-primary) !important;
            }
          `}</style>
            <Row gutter={[16, 16]}>
              {filteredConnectors.map((connector) => {
                const keyConfigured =
                  isLlmConnectionType(connector.type) &&
                  configuredAiTypes.has(connector.type);
                return (
                <Col key={connector.id} xs={24} sm={12} md={8}>
                  <Card
                    className="app-connector-market-card"
                    hoverable
                    size="small"
                    onClick={() => handleSelect(connector)}
                    style={{ height: '100%', position: 'relative' }}
                  >
                    {keyConfigured ? (
                      <StatusTag
                        color="success"
                        style={{ position: 'absolute', top: 8, right: 8, margin: 0, zIndex: 1 }}
                      >
                        {t('pages.system.applicationConnections.marketConfigured')}
                      </StatusTag>
                    ) : null}
                    <Space orientation="vertical" size="small" style={{ width: '100%' }}>
                      <Space wrap>
                        <span style={{ fontSize: 24, color: token.colorPrimary }}>{connector.icon}</span>
                        <Text strong>
                          {t(`pages.system.applicationConnections.${connectorTypeKey(connector.id)}`, {
                            defaultValue: connector.name,
                          })}
                        </Text>
                        {connector.category ? (
                          <MarkerTag color={connector.category === 'ai' ? 'purple' : 'blue'}>
                            {CATEGORY_KEYS[connector.category]
                              ? t(`pages.system.applicationConnections.${CATEGORY_KEYS[connector.category]}`)
                              : connector.category}
                          </MarkerTag>
                        ) : null}
                      </Space>
                      {connector.description ? (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {t(`pages.system.applicationConnections.${connectorDescKey(connector.id)}`, {
                            defaultValue: connector.description,
                          })}
                        </Text>
                      ) : null}
                    </Space>
                  </Card>
                </Col>
                );
              })}
            </Row>
            {filteredConnectors.length === 0 && !loading && (
              <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                {t('pages.system.applicationConnections.noMatch')}
              </div>
            )}
          </div>
        </Spin>
      </Space>
    </Modal>
  );
};

export default AppConnectorMarket;
