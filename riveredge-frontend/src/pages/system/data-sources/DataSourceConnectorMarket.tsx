/**
 * 数据源连接器市场
 *
 * 新建数据源时展示连接器卡片，支持分类筛选和搜索，点击后进入对应配置表单
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Card, Row, Col, Input, Radio, Space, Typography, theme, Tag } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { MODAL_CONFIG } from '../../../components/layout-templates/constants';
import { getDataSourceDriverAvailability } from '../../../services/dataSource';
import {
  CONNECTOR_DEFINITIONS,
  CONNECTOR_CATEGORIES,
  ConnectorDefinition,
} from './connectors';
import DatabaseBrandIcon from './DatabaseBrandIcon';

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
  const [driverAvailability, setDriverAvailability] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void getDataSourceDriverAvailability()
      .then((availability) => {
        if (!cancelled) setDriverAvailability(availability);
      })
      .catch(() => {
        if (!cancelled) setDriverAvailability({});
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const visibleCategories = useMemo(() => {
    const used = new Set(
      CONNECTOR_DEFINITIONS.map((c) => c.category).filter((c) => c !== 'domestic')
    );
    const hasDomestic = CONNECTOR_DEFINITIONS.some((c) => c.domestic);
    return CONNECTOR_CATEGORIES.filter(
      (c) =>
        c.key === 'all' ||
        (c.key === 'domestic' ? hasDomestic : used.has(c.key as typeof CONNECTOR_DEFINITIONS[number]['category']))
    );
  }, []);

  const filteredConnectors = useMemo(() => {
    let list = CONNECTOR_DEFINITIONS;
    if (category !== 'all') {
      if (category === 'domestic') {
        list = list.filter((c) => c.domestic);
      } else {
        list = list.filter((c) => c.category === category);
      }
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
      width={MODAL_CONFIG.CONNECTOR_MARKET_WIDTH}
      destroyOnHidden
    >
      <Space orientation="vertical" size="medium" style={{ width: '100%' }}>
        <Radio.Group
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          optionType="button"
          size="medium"
        >
          {visibleCategories.map((c) => (
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
          {filteredConnectors.map((connector) => {
            const hasDriver = driverAvailability[connector.type] === true;
            return (
            <Col key={connector.id} xs={24} sm={12} md={8}>
              <Card
                className="datasource-connector-market-card"
                hoverable
                size="small"
                onClick={() => handleSelect(connector)}
                style={{ height: '100%', position: 'relative' }}
              >
                {hasDriver ? (
                  <Tag
                    color="success"
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      margin: 0,
                      lineHeight: '18px',
                      fontSize: 11,
                    }}
                  >
                    {t('pages.system.dataSources.connectorMarket.driverReady')}
                  </Tag>
                ) : null}
                <Space orientation="vertical" size="small" style={{ width: '100%', paddingRight: hasDriver ? 56 : 0 }}>
                  <Space>
                    <DatabaseBrandIcon typeOrId={connector.id} size={28} />
                    <Text strong>{t(`pages.system.dataSources.connectors.${connector.id}.name`, { defaultValue: connector.name })}</Text>
                  </Space>
                  {connector.description && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {t(`pages.system.dataSources.connectors.${connector.id}.desc`, { defaultValue: connector.description })}
                    </Text>
                  )}
                </Space>
              </Card>
            </Col>
            );
          })}
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
