/**
 * 数据源连接器市场
 *
 * 新建数据源时展示连接器卡片，支持分类筛选和搜索，点击后进入对应配置表单
 */

import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Card, Row, Col, Input, Radio, Space, Typography, theme } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import {
  CONNECTOR_DEFINITIONS,
  CONNECTOR_CATEGORIES,
  ConnectorDefinition,
} from './connectors';

const { Text } = Typography;

export interface DataSourceConnectorMarketProps {
  open: boolean;
  onClose: () => void;
  onSelect: (connector: ConnectorDefinition) => void;
}

const DataSourceConnectorMarket: React.FC<DataSourceConnectorMarketProps> = ({
  open,
  onClose,
  onSelect,
}) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const [category, setCategory] = useState<string>('all');
  const [search, setSearch] = useState('');

  const filteredConnectors = useMemo(() => {
    let list = CONNECTOR_DEFINITIONS;
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
  }, [category, search]);

  const handleSelect = (connector: ConnectorDefinition) => {
    onSelect(connector);
    onClose();
  };

  return (
    <Modal
      title={t('pages.system.dataSources.connectorMarket.title')}
      open={open}
      onCancel={onClose}
      footer={null}
      width={720}
      destroyOnHidden
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Radio.Group
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          optionType="button"
          size="middle"
        >
          {CONNECTOR_CATEGORIES.map((c) => (
            <Radio.Button key={c.key} value={c.key}>
              {t(c.labelKey)}
            </Radio.Button>
          ))}
        </Radio.Group>
        <Input
          placeholder={t('pages.system.dataSources.connectorMarket.searchPlaceholder')}
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
        />
        <div style={{ '--connector-primary': token.colorPrimary } as React.CSSProperties}>
          <style>{`
            .datasource-connector-market-card.ant-card-hoverable:hover {
              box-shadow: none !important;
              border: 1px solid var(--connector-primary) !important;
            }
          `}</style>
        <Row gutter={[16, 16]}>
          {filteredConnectors.map((connector) => (
            <Col key={connector.id} xs={24} sm={12} md={8}>
              <Card
                className="datasource-connector-market-card"
                hoverable
                size="small"
                onClick={() => handleSelect(connector)}
                style={{ height: '100%' }}
              >
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <Space>
                    <span style={{ fontSize: 24, color: token.colorPrimary }}>{connector.icon}</span>
                    <Text strong>{connector.name}</Text>
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
        {filteredConnectors.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
            {t('pages.system.dataSources.connectorMarket.empty')}
          </div>
        )}
        </div>
      </Space>
    </Modal>
  );
};

export default DataSourceConnectorMarket;
