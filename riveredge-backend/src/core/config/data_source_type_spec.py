"""
数据源类型定义（直连数据库，不含应用连接器）

供 data_sources API、Schema 校验、 onboarding 等共用。
"""

# 关系型
_RELATIONAL = (
    "postgresql", "mysql", "mariadb", "oracle", "sqlserver", "sqlite",
    "tidb", "oceanbase", "opengauss", "dameng", "kingbase", "gaussdb",
)
# 文档型
_DOCUMENT = ("mongodb", "couchbase", "sequoiadb")
# 时序
_TIMESERIES = ("influxdb", "timescaledb", "tdengine", "prometheus")
# 分析型 / 搜索分析
_OLAP = ("clickhouse", "doris", "starrocks", "gbase", "elasticsearch", "opensearch", "druid", "trino")
# 键值
_KV = ("redis", "memcached", "etcd", "keydb")
# 向量
_VECTOR = ("milvus", "qdrant", "weaviate", "chroma")

DATA_SOURCE_TYPES = _RELATIONAL + _DOCUMENT + _TIMESERIES + _OLAP + _KV + _VECTOR

# 当前仅校验必填配置项，未对目标库发起真实连接（postgresql / sqlserver 等有独立实测逻辑）
DATA_SOURCE_CONFIG_ONLY_TYPES = frozenset(
    set(DATA_SOURCE_TYPES) - {"postgresql", "sqlserver"}
)

DATA_SOURCE_TYPE_LABELS: dict[str, str] = {
    "postgresql": "PostgreSQL",
    "mysql": "MySQL",
    "mariadb": "MariaDB",
    "oracle": "Oracle",
    "sqlserver": "SQL Server",
    "sqlite": "SQLite",
    "tidb": "TiDB",
    "oceanbase": "OceanBase",
    "opengauss": "openGauss",
    "dameng": "达梦 DM",
    "kingbase": "人大金仓 KingbaseES",
    "gaussdb": "GaussDB",
    "sequoiadb": "SequoiaDB",
    "gbase": "GBase 8a",
    "mongodb": "MongoDB",
    "couchbase": "Couchbase",
    "influxdb": "InfluxDB",
    "timescaledb": "TimescaleDB",
    "tdengine": "TDengine",
    "prometheus": "Prometheus",
    "clickhouse": "ClickHouse",
    "doris": "Apache Doris",
    "starrocks": "StarRocks",
    "elasticsearch": "Elasticsearch",
    "opensearch": "OpenSearch",
    "druid": "Apache Druid",
    "trino": "Trino",
    "redis": "Redis",
    "memcached": "Memcached",
    "etcd": "etcd",
    "keydb": "KeyDB",
    "milvus": "Milvus",
    "qdrant": "Qdrant",
    "weaviate": "Weaviate",
    "chroma": "Chroma",
}
