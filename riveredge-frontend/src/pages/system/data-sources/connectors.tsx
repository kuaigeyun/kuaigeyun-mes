/**
 * 数据源连接器定义
 *
 * 预置连接器模板，用于连接器市场展示和快速配置
 */

import type { ReactNode } from 'react';
import { DatabaseOutlined, ApiOutlined, LinkOutlined } from '@ant-design/icons';

export interface ConnectorDefinition {
  id: string;
  name: string;
  type: string;
  category: 'database' | 'api' | 'oauth' | 'other';
  description?: string;
  icon?: ReactNode;
  defaultConfig?: Record<string, any>;
}

export const CONNECTOR_DEFINITIONS: ConnectorDefinition[] = [
  {
    id: 'postgresql',
    name: 'PostgreSQL',
    type: 'postgresql',
    category: 'database',
    description: '开源关系型数据库',
    icon: <DatabaseOutlined />,
    defaultConfig: { host: 'localhost', port: 5432, database: '', username: '', password: '' },
  },
  {
    id: 'mysql',
    name: 'MySQL',
    type: 'mysql',
    category: 'database',
    description: '流行的关系型数据库',
    icon: <DatabaseOutlined />,
    defaultConfig: { host: 'localhost', port: 3306, database: '', username: '', password: '' },
  },
  {
    id: 'mongodb',
    name: 'MongoDB',
    type: 'mongodb',
    category: 'database',
    description: '文档型 NoSQL 数据库',
    icon: <DatabaseOutlined />,
    defaultConfig: { host: 'localhost', port: 27017, database: '' },
  },
  {
    id: 'oracle',
    name: 'Oracle',
    type: 'oracle',
    category: 'database',
    description: 'Oracle 关系型数据库',
    icon: <DatabaseOutlined />,
    defaultConfig: { host: 'localhost', port: 1521, database: '', username: '', password: '' },
  },
  {
    id: 'sqlserver',
    name: 'SQL Server',
    type: 'sqlserver',
    category: 'database',
    description: 'Microsoft SQL Server',
    icon: <DatabaseOutlined />,
    defaultConfig: { host: 'localhost', port: 1433, database: '', username: '', password: '' },
  },
  {
    id: 'redis',
    name: 'Redis',
    type: 'redis',
    category: 'database',
    description: 'Key-Value 内存数据库',
    icon: <DatabaseOutlined />,
    defaultConfig: { host: 'localhost', port: 6379, password: '' },
  },
  {
    id: 'clickhouse',
    name: 'ClickHouse',
    type: 'clickhouse',
    category: 'database',
    description: '高性能 OLAP 数据库',
    icon: <DatabaseOutlined />,
    defaultConfig: { host: 'localhost', port: 8123, database: 'default', username: 'default', password: '' },
  },
  {
    id: 'influxdb',
    name: 'InfluxDB',
    type: 'influxdb',
    category: 'database',
    description: '时序数据库',
    icon: <DatabaseOutlined />,
    defaultConfig: { host: 'localhost', port: 8086, database: '', username: '', password: '' },
  },
  {
    id: 'doris',
    name: 'Apache Doris',
    type: 'doris',
    category: 'database',
    description: '现代极速分析型数据库',
    icon: <DatabaseOutlined />,
    defaultConfig: { host: 'localhost', port: 9030, database: '', username: 'root', password: '' },
  },
  {
    id: 'starrocks',
    name: 'StarRocks',
    type: 'starrocks',
    category: 'database',
    description: '高性能全场景分析型数据库',
    icon: <DatabaseOutlined />,
    defaultConfig: { host: 'localhost', port: 9030, database: '', username: 'root', password: '' },
  },
  {
    id: 'elasticsearch',
    name: 'Elasticsearch',
    type: 'elasticsearch',
    category: 'database',
    description: '分布式搜索和分析引擎',
    icon: <DatabaseOutlined />,
    defaultConfig: { host: 'localhost', port: 9200, username: '', password: '' },
  },
  {
    id: 'api',
    name: 'REST API',
    type: 'api',
    category: 'api',
    description: '通用 REST 接口',
    icon: <ApiOutlined />,
    defaultConfig: { base_url: '', auth_type: 'none' },
  },
  {
    id: 'oauth',
    name: 'OAuth 2.0',
    type: 'OAuth',
    category: 'oauth',
    description: 'OAuth 2.0 认证',
    icon: <LinkOutlined />,
    defaultConfig: {},
  },
  {
    id: 'webhook',
    name: 'Webhook',
    type: 'Webhook',
    category: 'other',
    description: 'Webhook 回调',
    icon: <LinkOutlined />,
    defaultConfig: {},
  },
  {
    id: 'database',
    name: '通用数据库',
    type: 'Database',
    category: 'database',
    description: '通用数据库连接',
    icon: <DatabaseOutlined />,
    defaultConfig: { host: '', port: 5432, database: '', username: '', password: '' },
  },
];

/** 分类的 i18n 键，在 DataSourceConnectorMarket 中用 t(labelKey) 渲染 */
export const CONNECTOR_CATEGORIES = [
  { key: 'all', labelKey: 'pages.system.dataSources.connectorMarket.categoryAll' },
  { key: 'database', labelKey: 'pages.system.dataSources.connectorMarket.categoryDatabase' },
  { key: 'api', labelKey: 'pages.system.dataSources.connectorMarket.categoryApi' },
  { key: 'oauth', labelKey: 'pages.system.dataSources.connectorMarket.categoryOauth' },
  { key: 'other', labelKey: 'pages.system.dataSources.connectorMarket.categoryOther' },
] as const;
