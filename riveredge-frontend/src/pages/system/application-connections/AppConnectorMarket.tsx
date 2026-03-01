/**
 * 应用连接器市场
 *
 * 新建应用连接器时展示连接器卡片，支持分类筛选和搜索，点击后进入对应配置表单。
 * 连接器列表优先从 API 获取，失败时回退到本地预置定义。
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Card, Row, Col, Input, Radio, Space, Typography, Spin, Tag, theme } from 'antd';
import { SearchOutlined, MessageOutlined, CloudOutlined, DatabaseOutlined, AppstoreOutlined, TeamOutlined } from '@ant-design/icons';
import {
  APP_CONNECTOR_DEFINITIONS,
  AppConnectorDefinition,
} from './connectors';
import { getConnectorDefinitions, ConnectorDefinition } from '../../../services/applicationConnection';

const { Text } = Typography;

const ICON_MAP: Record<string, React.ReactNode> = {
  MessageOutlined: <MessageOutlined />,
  CloudOutlined: <CloudOutlined />,
  DatabaseOutlined: <DatabaseOutlined />,
  AppstoreOutlined: <AppstoreOutlined />,
  TeamOutlined: <TeamOutlined />,
};

const CATEGORY_KEYS: Record<string, string> = {
  collaboration: 'categoryCollaboration',
  erp: 'categoryErp',
  plm: 'categoryPlm',
  crm: 'categoryCrm',
  oa: 'categoryOa',
  iot: 'categoryIot',
  wms: 'categoryWms',
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

export interface AppConnectorMarketProps {
  open: boolean;
  onClose: () => void;
  onSelect: (connector: AppConnectorDefinition) => void;
}

const AppConnectorMarket: React.FC<AppConnectorMarketProps> = ({
  open,
  onClose,
  onSelect,
}) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const [category, setCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [connectors, setConnectors] = useState<AppConnectorDefinition[]>(APP_CONNECTOR_DEFINITIONS);
  const categories = useMemo(() => [
    { key: 'all', label: t('pages.system.applicationConnections.categoryAll') },
    { key: 'collaboration', label: t('pages.system.applicationConnections.categoryCollaboration') },
    { key: 'erp', label: t('pages.system.applicationConnections.categoryErp') },
    { key: 'plm', label: t('pages.system.applicationConnections.categoryPlm') },
    { key: 'crm', label: t('pages.system.applicationConnections.categoryCrm') },
    { key: 'oa', label: t('pages.system.applicationConnections.categoryOa') },
    { key: 'iot', label: t('pages.system.applicationConnections.categoryIot') },
    { key: 'wms', label: t('pages.system.applicationConnections.categoryWms') },
  ], [t]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setLoading(true);
      getConnectorDefinitions()
        .then((res) => {
          if (res?.items?.length) {
            setConnectors(res.items.map(toAppConnectorDefinition));
          }
        })
        .catch(() => {
          setConnectors(APP_CONNECTOR_DEFINITIONS);
        })
        .finally(() => setLoading(false));
    }
  }, [open]);

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

  return (
    <Modal
      title={t('pages.system.applicationConnections.marketTitle')}
      open={open}
      onCancel={onClose}
      footer={null}
      width={800}
      destroyOnHidden
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
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
          {filteredConnectors.map((connector) => (
            <Col key={connector.id} xs={24} sm={12} md={8}>
              <Card
                className="app-connector-market-card"
                hoverable
                size="small"
                onClick={() => handleSelect(connector)}
                style={{ height: '100%' }}
              >
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <Space>
                    <span style={{ fontSize: 24, color: token.colorPrimary }}>{connector.icon}</span>
                    <Text strong>{connector.name}</Text>
                    {connector.category && (
                      <Tag color="blue">
                        {CATEGORY_KEYS[connector.category]
                          ? t(`pages.system.applicationConnections.${CATEGORY_KEYS[connector.category]}`)
                          : connector.category}
                      </Tag>
                    )}
                  </Space>
                  {connector.description && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {connector.description}
                    </Text>
                  )}
                </Space>
              </Card>
            </Col>
          ))}
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
