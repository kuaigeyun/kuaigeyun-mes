"""
数据源 Python 驱动可用性探测（运行时 import 检测，不发起网络连接）。
"""

from __future__ import annotations

import importlib.util
from typing import Dict, Iterable

from core.config.data_source_type_spec import DATA_SOURCE_TYPES


def _module_available(module_name: str) -> bool:
    return importlib.util.find_spec(module_name) is not None


def _any_module_available(module_names: Iterable[str]) -> bool:
    return any(_module_available(name) for name in module_names)


def _probe_single(data_source_type: str) -> bool:
    probes: Dict[str, bool] = {
        "postgresql": _module_available("asyncpg"),
        "timescaledb": _module_available("asyncpg"),
        "mysql": _any_module_available(("aiomysql", "pymysql")),
        "mariadb": _any_module_available(("aiomysql", "pymysql")),
        "tidb": _any_module_available(("aiomysql", "pymysql")),
        "oceanbase": _any_module_available(("aiomysql", "pymysql")),
        "opengauss": _any_module_available(("asyncpg", "psycopg2")),
        "gaussdb": _any_module_available(("asyncpg", "psycopg2")),
        "dameng": _module_available("dmPython"),
        "kingbase": _any_module_available(("ksycopg2", "psycopg2", "asyncpg")),
        "sequoiadb": _module_available("sequoiadb"),
        "gbase": _any_module_available(("gbase", "pymysql")),
        "doris": _any_module_available(("aiomysql", "pymysql")),
        "starrocks": _any_module_available(("aiomysql", "pymysql")),
        "oracle": _any_module_available(("oracledb", "cx_Oracle")),
        "sqlserver": _module_available("pymssql") or _module_available("pyodbc"),
        "sqlite": _module_available("sqlite3"),
        "mongodb": _any_module_available(("motor", "pymongo")),
        "couchbase": _module_available("couchbase"),
        "influxdb": _any_module_available(("influxdb_client", "influxdb")),
        "tdengine": _module_available("taos"),
        "prometheus": _module_available("prometheus_api_client"),
        "clickhouse": _any_module_available(("clickhouse_connect", "clickhouse_driver")),
        "elasticsearch": _module_available("elasticsearch"),
        "opensearch": _any_module_available(("opensearchpy", "opensearch_py")),
        "druid": _module_available("pydruid"),
        "trino": _module_available("trino"),
        "redis": _module_available("redis"),
        "keydb": _module_available("redis"),
        "memcached": _any_module_available(("pymemcache", "aiomemcache")),
        "etcd": _any_module_available(("etcd3", "etcd3gw")),
        "milvus": _module_available("pymilvus"),
        "qdrant": _module_available("qdrant_client"),
        "weaviate": _module_available("weaviate"),
        "chroma": _module_available("chromadb"),
    }
    return probes.get(data_source_type, False)


def probe_data_source_driver_availability() -> Dict[str, bool]:
    """返回各数据源 type → 当前环境是否已安装可用驱动。"""
    return {t: _probe_single(t) for t in DATA_SOURCE_TYPES}
