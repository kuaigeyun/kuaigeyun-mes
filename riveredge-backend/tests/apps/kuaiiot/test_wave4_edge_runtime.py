"""Wave 4 边缘运行时与运维单元测试。"""

from apps.kuaiiot.constants import EDGE_PROTOCOLS, INGEST_BATCH_MAX_ITEMS
from apps.kuaiiot.services.edge_config_service import EdgeConfigService
from infra.exceptions.exceptions import ValidationError
import pytest


class TestEdgeProtocolValidation:
    def test_modbus_requires_registers(self):
        with pytest.raises(ValidationError, match="registers"):
            EdgeConfigService._validate_config(
                "modbus_tcp",
                {"publish": {"mode": "http_ingest"}},
            )

    def test_modbus_requires_address_and_data_type(self):
        with pytest.raises(ValidationError, match="address"):
            EdgeConfigService._validate_config(
                "modbus_tcp",
                {
                    "registers": [{"tag_key": "temp"}],
                    "publish": {"mode": "http_ingest"},
                },
            )
        with pytest.raises(ValidationError, match="data_type"):
            EdgeConfigService._validate_config(
                "modbus_tcp",
                {
                    "registers": [{"tag_key": "temp", "address": 0}],
                    "publish": {"mode": "http_ingest"},
                },
            )
        EdgeConfigService._validate_config(
            "modbus_tcp",
            {
                "host": "127.0.0.1",
                "port": 502,
                "unit_id": 1,
                "registers": [{"tag_key": "temp", "address": 0, "data_type": "float32"}],
                "publish": {"mode": "http_ingest"},
            },
        )

    def test_opc_ua_requires_endpoint_and_nodes(self):
        with pytest.raises(ValidationError, match="endpoint"):
            EdgeConfigService._validate_config(
                "opc_ua",
                {"nodes": [{"tag_key": "temp"}], "publish": {"mode": "http_ingest"}},
            )
        EdgeConfigService._validate_config(
            "opc_ua",
            {
                "endpoint": "opc.tcp://127.0.0.1:4840",
                "nodes": [{"tag_key": "temp", "node_id": "ns=2;s=Temp"}],
                "publish": {"mode": "http_ingest", "buffer_max": 100},
            },
        )

    def test_s7_requires_host_and_db_blocks(self):
        with pytest.raises(ValidationError, match="host"):
            EdgeConfigService._validate_config(
                "s7",
                {"rack": 0, "slot": 1, "db_blocks": [{"tag_key": "status"}], "publish": {"mode": "http_ingest"}},
            )
        EdgeConfigService._validate_config(
            "s7",
            {
                "host": "192.168.1.20",
                "rack": 0,
                "slot": 1,
                "db_blocks": [{"tag_key": "status", "db_number": 1, "offset": 0, "data_type": "bool"}],
                "publish": {"mode": "http_ingest", "buffer_max": 50},
            },
        )

    def test_supported_protocols(self):
        assert "opc_ua" in EDGE_PROTOCOLS
        assert "s7" in EDGE_PROTOCOLS


def test_batch_limit_constant():
    assert INGEST_BATCH_MAX_ITEMS == 100
