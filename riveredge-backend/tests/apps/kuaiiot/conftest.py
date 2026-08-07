"""快数采测试公共 mock。"""

import sys
import types
from unittest.mock import MagicMock

sys.modules.setdefault("aiomqtt", MagicMock())

_influx_root = types.ModuleType("influxdb_client")
_influx_root.InfluxDBClient = MagicMock
_influx_root.Point = MagicMock
_influx_client = types.ModuleType("influxdb_client.client")
_influx_write = types.ModuleType("influxdb_client.client.write_api")
_influx_write.SYNCHRONOUS = "sync"
_influx_client.write_api = _influx_write
_influx_root.client = _influx_client
sys.modules["influxdb_client"] = _influx_root
sys.modules["influxdb_client.client"] = _influx_client
sys.modules["influxdb_client.client.write_api"] = _influx_write
