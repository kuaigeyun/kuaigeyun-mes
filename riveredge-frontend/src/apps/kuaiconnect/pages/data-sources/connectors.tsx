/**
 * 数据源连接器定义
 *
 * 预置直连数据库模板，用于连接器市场展示和快速配置。
 * API / OAuth 等应用对接请使用「应用连接器」。
 */

/** 数据源分类（连接器市场 Tab） */
export type DataSourceCategory =
  | 'relational'
  | 'document'
  | 'timeseries'
  | 'olap'
  | 'kv'
  | 'vector'
  | 'domestic';

export interface ConnectorDefinition {
  id: string;
  name: string;
  type: string;
  category: DataSourceCategory;
  /** 是否在「国产数据库」分类中展示 */
  domestic?: boolean;
  description?: string;
  defaultConfig?: Record<string, any>;
}

const standardRelationalConfig = {
  host: 'localhost',
  port: 5432,
  database: '',
  username: '',
  password: '',
};

export const CONNECTOR_DEFINITIONS: ConnectorDefinition[] = [
  // 关系型数据库
  {
    id: 'postgresql',
    name: 'PostgreSQL',
    type: 'postgresql',
    category: 'relational',
    description: '开源关系型数据库，生态成熟',
    defaultConfig: { ...standardRelationalConfig, port: 5432 },
  },
  {
    id: 'mysql',
    name: 'MySQL',
    type: 'mysql',
    category: 'relational',
    description: '全球最流行的开源关系型数据库',
    defaultConfig: { ...standardRelationalConfig, port: 3306 },
  },
  {
    id: 'mariadb',
    name: 'MariaDB',
    type: 'mariadb',
    category: 'relational',
    description: 'MySQL 兼容的开源关系型数据库',
    defaultConfig: { ...standardRelationalConfig, port: 3306 },
  },
  {
    id: 'oracle',
    name: 'Oracle',
    type: 'oracle',
    category: 'relational',
    description: '企业级商业关系型数据库',
    defaultConfig: { ...standardRelationalConfig, port: 1521 },
  },
  {
    id: 'sqlserver',
    name: 'SQL Server',
    type: 'sqlserver',
    category: 'relational',
    description: 'Microsoft 企业级关系型数据库',
    defaultConfig: { ...standardRelationalConfig, port: 1433 },
  },
  {
    id: 'sqlite',
    name: 'SQLite',
    type: 'sqlite',
    category: 'relational',
    description: '轻量嵌入式关系型数据库',
    defaultConfig: { file_path: '' },
  },
  {
    id: 'tidb',
    name: 'TiDB',
    type: 'tidb',
    category: 'relational',
    domestic: true,
    description: '分布式 NewSQL，MySQL 协议兼容',
    defaultConfig: { ...standardRelationalConfig, port: 4000 },
  },
  {
    id: 'oceanbase',
    name: 'OceanBase',
    type: 'oceanbase',
    category: 'relational',
    domestic: true,
    description: '分布式关系型数据库，MySQL/Oracle 双模式',
    defaultConfig: { ...standardRelationalConfig, port: 2881 },
  },
  {
    id: 'opengauss',
    name: 'openGauss',
    type: 'opengauss',
    category: 'relational',
    domestic: true,
    description: '开源企业级关系型数据库，PostgreSQL 兼容',
    defaultConfig: { ...standardRelationalConfig, port: 5432 },
  },
  {
    id: 'dameng',
    name: '达梦 DM',
    type: 'dameng',
    category: 'relational',
    domestic: true,
    description: '国产自主关系型数据库',
    defaultConfig: { ...standardRelationalConfig, port: 5236 },
  },
  {
    id: 'kingbase',
    name: '人大金仓 KingbaseES',
    type: 'kingbase',
    category: 'relational',
    domestic: true,
    description: '国产安全数据库，PostgreSQL 兼容',
    defaultConfig: { ...standardRelationalConfig, port: 54321 },
  },
  {
    id: 'gaussdb',
    name: 'GaussDB',
    type: 'gaussdb',
    category: 'relational',
    domestic: true,
    description: '华为云企业级分布式数据库',
    defaultConfig: { ...standardRelationalConfig, port: 5432 },
  },
  // 文档数据库
  {
    id: 'mongodb',
    name: 'MongoDB',
    type: 'mongodb',
    category: 'document',
    description: '最流行的文档型 NoSQL 数据库',
    defaultConfig: { host: 'localhost', port: 27017, database: '' },
  },
  {
    id: 'couchbase',
    name: 'Couchbase',
    type: 'couchbase',
    category: 'document',
    description: '分布式文档与键值存储',
    defaultConfig: { ...standardRelationalConfig, port: 8091 },
  },
  {
    id: 'sequoiadb',
    name: 'SequoiaDB',
    type: 'sequoiadb',
    category: 'document',
    domestic: true,
    description: '国产分布式文档数据库',
    defaultConfig: { host: 'localhost', port: 11810, database: '', username: '', password: '' },
  },
  // 时序数据库
  {
    id: 'influxdb',
    name: 'InfluxDB',
    type: 'influxdb',
    category: 'timeseries',
    description: '云原生时序数据库',
    defaultConfig: { ...standardRelationalConfig, port: 8086 },
  },
  {
    id: 'timescaledb',
    name: 'TimescaleDB',
    type: 'timescaledb',
    category: 'timeseries',
    description: '基于 PostgreSQL 的时序扩展',
    defaultConfig: { ...standardRelationalConfig, port: 5432 },
  },
  {
    id: 'tdengine',
    name: 'TDengine',
    type: 'tdengine',
    category: 'timeseries',
    domestic: true,
    description: '高性能国产时序数据库',
    defaultConfig: { ...standardRelationalConfig, port: 6030 },
  },
  {
    id: 'prometheus',
    name: 'Prometheus',
    type: 'prometheus',
    category: 'timeseries',
    description: '云原生监控与时序指标存储',
    defaultConfig: { host: 'localhost', port: 9090 },
  },
  // 分析型 / 搜索分析
  {
    id: 'clickhouse',
    name: 'ClickHouse',
    type: 'clickhouse',
    category: 'olap',
    description: '列式 OLAP 分析数据库',
    defaultConfig: { ...standardRelationalConfig, port: 8123, database: 'default', username: 'default' },
  },
  {
    id: 'doris',
    name: 'Apache Doris',
    type: 'doris',
    category: 'olap',
    domestic: true,
    description: '实时分析型数据仓库',
    defaultConfig: { ...standardRelationalConfig, port: 9030, username: 'root' },
  },
  {
    id: 'starrocks',
    name: 'StarRocks',
    type: 'starrocks',
    category: 'olap',
    domestic: true,
    description: '极速全场景 MPP 分析数据库',
    defaultConfig: { ...standardRelationalConfig, port: 9030, username: 'root' },
  },
  {
    id: 'gbase',
    name: 'GBase 8a',
    type: 'gbase',
    category: 'olap',
    domestic: true,
    description: '南大通用 MPP 分析型数据库',
    defaultConfig: { ...standardRelationalConfig, port: 5258, username: 'root' },
  },
  {
    id: 'elasticsearch',
    name: 'Elasticsearch',
    type: 'elasticsearch',
    category: 'olap',
    description: '分布式搜索与日志分析引擎',
    defaultConfig: { host: 'localhost', port: 9200, username: '', password: '' },
  },
  {
    id: 'opensearch',
    name: 'OpenSearch',
    type: 'opensearch',
    category: 'olap',
    description: 'Elasticsearch 开源分支，搜索与分析',
    defaultConfig: { host: 'localhost', port: 9200, username: '', password: '' },
  },
  {
    id: 'druid',
    name: 'Apache Druid',
    type: 'druid',
    category: 'olap',
    description: '实时 OLAP 分析数据库',
    defaultConfig: { host: 'localhost', port: 8082, username: '', password: '' },
  },
  {
    id: 'trino',
    name: 'Trino',
    type: 'trino',
    category: 'olap',
    description: '分布式 SQL 查询引擎（原 PrestoSQL）',
    defaultConfig: { host: 'localhost', port: 8080, username: '', password: '' },
  },
  // 键值 / 缓存
  {
    id: 'redis',
    name: 'Redis',
    type: 'redis',
    category: 'kv',
    description: '最流行的内存键值数据库',
    defaultConfig: { host: 'localhost', port: 6379, password: '' },
  },
  {
    id: 'memcached',
    name: 'Memcached',
    type: 'memcached',
    category: 'kv',
    description: '高性能分布式内存缓存',
    defaultConfig: { host: 'localhost', port: 11211 },
  },
  {
    id: 'etcd',
    name: 'etcd',
    type: 'etcd',
    category: 'kv',
    description: '分布式键值存储，常用于配置与服务发现',
    defaultConfig: { host: 'localhost', port: 2379 },
  },
  {
    id: 'keydb',
    name: 'KeyDB',
    type: 'keydb',
    category: 'kv',
    description: 'Redis 兼容的多线程内存数据库',
    defaultConfig: { host: 'localhost', port: 6379, password: '' },
  },
  // 向量数据库
  {
    id: 'milvus',
    name: 'Milvus',
    type: 'milvus',
    category: 'vector',
    description: '开源向量数据库，AI 检索常用',
    defaultConfig: { host: 'localhost', port: 19530, username: '', password: '' },
  },
  {
    id: 'qdrant',
    name: 'Qdrant',
    type: 'qdrant',
    category: 'vector',
    description: '高性能向量相似度搜索引擎',
    defaultConfig: { host: 'localhost', port: 6333, api_key: '' },
  },
  {
    id: 'weaviate',
    name: 'Weaviate',
    type: 'weaviate',
    category: 'vector',
    description: '云原生向量数据库',
    defaultConfig: { host: 'localhost', port: 8080, api_key: '' },
  },
  {
    id: 'chroma',
    name: 'Chroma',
    type: 'chroma',
    category: 'vector',
    description: '面向 AI 应用的嵌入式向量数据库',
    defaultConfig: { host: 'localhost', port: 8000 },
  },
];

/** 分类的 i18n 键，在 DataSourceConnectorMarket 中用 t(labelKey) 渲染 */
export const CONNECTOR_CATEGORIES = [
  { key: 'all', labelKey: 'pages.system.dataSources.connectorMarket.categoryAll' },
  { key: 'domestic', labelKey: 'pages.system.dataSources.connectorMarket.categoryDomestic' },
  { key: 'relational', labelKey: 'pages.system.dataSources.connectorMarket.categoryRelational' },
  { key: 'document', labelKey: 'pages.system.dataSources.connectorMarket.categoryDocument' },
  { key: 'timeseries', labelKey: 'pages.system.dataSources.connectorMarket.categoryTimeseries' },
  { key: 'olap', labelKey: 'pages.system.dataSources.connectorMarket.categoryOlap' },
  { key: 'kv', labelKey: 'pages.system.dataSources.connectorMarket.categoryKv' },
  { key: 'vector', labelKey: 'pages.system.dataSources.connectorMarket.categoryVector' },
] as const;

export const DATA_SOURCE_DB_TYPES = CONNECTOR_DEFINITIONS.map((c) => c.type);

/** 标准 host/port/database/username/password 表单 */
export const DATA_SOURCE_STANDARD_DB_FORM_TYPES = [
  'postgresql',
  'mysql',
  'mariadb',
  'oracle',
  'tidb',
  'oceanbase',
  'opengauss',
  'dameng',
  'kingbase',
  'gaussdb',
  'timescaledb',
  'tdengine',
  'clickhouse',
  'influxdb',
  'doris',
  'starrocks',
  'gbase',
  'couchbase',
  'druid',
  'trino',
  'milvus',
  'sequoiadb',
] as const;

/** 与 Elasticsearch 相同的主机端口认证表单 */
export const DATA_SOURCE_SEARCH_FORM_TYPES = ['elasticsearch', 'opensearch'] as const;

export function getConnectorDefinitionByType(type: string): ConnectorDefinition | undefined {
  return CONNECTOR_DEFINITIONS.find((c) => c.type === type);
}

/** 分类默认 Tag 色（filled） */
const DATA_SOURCE_CATEGORY_COLORS: Record<DataSourceCategory, string> = {
  relational: 'blue',
  document: 'green',
  timeseries: 'cyan',
  olap: 'gold',
  kv: 'volcano',
  vector: 'purple',
  domestic: 'red',
};

/** 各连接器类型 Tag 色（filled，贴近品牌/语义） */
export const DATA_SOURCE_TYPE_TAG_COLORS: Record<string, string> = {
  postgresql: 'blue',
  mysql: 'orange',
  mariadb: 'orange',
  oracle: 'red',
  sqlserver: 'geekblue',
  sqlite: 'blue',
  tidb: 'cyan',
  oceanbase: 'blue',
  opengauss: 'geekblue',
  dameng: 'red',
  kingbase: 'volcano',
  gaussdb: 'purple',
  sequoiadb: 'green',
  gbase: 'gold',
  mongodb: 'green',
  couchbase: 'lime',
  influxdb: 'purple',
  timescaledb: 'blue',
  tdengine: 'volcano',
  prometheus: 'orange',
  clickhouse: 'gold',
  doris: 'geekblue',
  starrocks: 'purple',
  elasticsearch: 'gold',
  opensearch: 'blue',
  druid: 'magenta',
  trino: 'cyan',
  redis: 'red',
  memcached: 'blue',
  etcd: 'purple',
  keydb: 'volcano',
  milvus: 'purple',
  qdrant: 'geekblue',
  weaviate: 'green',
  chroma: 'cyan',
};

export function getDataSourceTypeTagColor(type: string): string {
  if (DATA_SOURCE_TYPE_TAG_COLORS[type]) {
    return DATA_SOURCE_TYPE_TAG_COLORS[type];
  }
  const def = getConnectorDefinitionByType(type);
  if (def) {
    return DATA_SOURCE_CATEGORY_COLORS[def.category];
  }
  return 'geekblue';
}

export function getDataSourceTypeDisplay(type: string): { color: string; text: string } {
  const def = getConnectorDefinitionByType(type);
  return {
    color: getDataSourceTypeTagColor(type),
    text: def?.name ?? type,
  };
}

export function getDataSourceTypeSelectOptions() {
  return CONNECTOR_DEFINITIONS.map((c) => ({
    label: c.name,
    value: c.type,
  }));
}
