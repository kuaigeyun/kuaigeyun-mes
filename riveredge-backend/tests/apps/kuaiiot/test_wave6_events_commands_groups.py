"""快数采 Wave 6 单元测试。"""

import asyncio
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from apps.kuaiiot.schemas.iot import DeviceCommandCreate, IngestPayload
from apps.kuaiiot.services.command_service import CommandService
from apps.kuaiiot.services.device_group_service import DeviceGroupService
from apps.kuaiiot.services.message_log_service import MessageLogService
from apps.kuaiiot.services.product_service import ProductService


class TestProductEventValidation:
    def test_validate_events_ok(self):
        events = ProductService._validate_events(
            [
                {"event_key": "fault", "name": "故障", "level": "critical"},
                {"event_key": "mold_change", "name": "换模", "level": "info"},
            ]
        )
        assert len(events) == 2
        assert events[0]["level"] == "critical"

    def test_validate_events_duplicate(self):
        with pytest.raises(Exception, match="event_key 重复"):
            ProductService._validate_events(
                [
                    {"event_key": "fault", "name": "故障", "level": "warning"},
                    {"event_key": "fault", "name": "故障2", "level": "info"},
                ]
            )


class TestProductFunctionValidation:
    def test_validate_functions_ok(self):
        functions = ProductService._validate_functions(
            [
                {
                    "function_key": "set_speed",
                    "name": "设置转速",
                    "timeout_seconds": 30,
                    "params": [{"key": "value", "name": "转速", "value_type": "number", "required": True}],
                    "edge_action": {"type": "modbus_write", "address": 100, "data_type": "uint16", "param_key": "value"},
                }
            ]
        )
        assert functions[0]["function_key"] == "set_speed"


class TestDeviceGroupTree:
    def test_build_tree(self):
        parent = MagicMock()
        parent.uuid = "p1"
        parent.id = 1
        parent.code = "line-a"
        parent.name = "A线"
        parent.parent_id = None
        parent.sort_order = 0
        parent.remark = None

        child = MagicMock()
        child.uuid = "c1"
        child.id = 2
        child.code = "cell-1"
        child.name = "单元1"
        child.parent_id = 1
        child.sort_order = 0
        child.remark = None

        tree = DeviceGroupService.build_tree([parent, child])
        assert len(tree) == 1
        assert tree[0].code == "line-a"
        assert len(tree[0].children) == 1
        assert tree[0].children[0].code == "cell-1"


class TestMessageLogService:
    def test_truncate_payload(self):
        payload = {"data": "x" * 5000}
        truncated = MessageLogService._truncate_payload(payload)
        assert truncated["truncated"] is True


def test_command_timeout_marks_expired():
    now = datetime(2026, 8, 7, 12, 0, tzinfo=timezone.utc)
    command = AsyncMock()
    command.tenant_id = 1
    command.device_id = 10
    command.uuid = "cmd-1"
    command.status = "sent"
    command.save = AsyncMock()

    expired_qs = MagicMock()
    expired_qs.all = AsyncMock(return_value=[command])

    with patch("apps.kuaiiot.services.command_service.resolve_business_datetime", return_value=now), patch(
        "apps.kuaiiot.services.command_service.IotDeviceCommand.filter",
        return_value=expired_qs,
    ), patch(
        "apps.kuaiiot.services.command_service.MessageLogService.append",
        new=AsyncMock(),
    ):
        count = asyncio.run(CommandService.timeout_expired_commands())
        assert count == 1
        assert command.status == "timeout"
        command.save.assert_awaited()


def test_command_create_validates_params():
    device = MagicMock()
    device.id = 1
    device.product_id = 2
    device.connection_id = None

    product = MagicMock()
    product.functions = [
        {
            "function_key": "set_speed",
            "name": "设置转速",
            "timeout_seconds": 30,
            "params": [{"key": "value", "name": "转速", "value_type": "number", "required": True}],
        }
    ]

    with patch(
        "apps.kuaiiot.services.command_service.ProductService.get_by_id",
        new=AsyncMock(return_value=product),
    ), patch(
        "apps.kuaiiot.services.command_service.IotEdgeConfig.filter",
        return_value=AsyncMock(exists=AsyncMock(return_value=True)),
    ), patch(
        "apps.kuaiiot.services.command_service.IotDeviceCommand.create",
        new=AsyncMock(return_value=MagicMock(uuid="cmd-1", function_key="set_speed", params={"value": 100})),
    ), patch(
        "apps.kuaiiot.services.command_service.MessageLogService.append",
        new=AsyncMock(),
    ):
        command = asyncio.run(
            CommandService.create_command(
                1,
                device,
                DeviceCommandCreate(function_key="set_speed", params={"value": 100}),
                requested_by=99,
            )
        )
        assert command.function_key == "set_speed"


def test_ingest_payload_events_optional():
    payload = IngestPayload(tags={}, events=[{"event_key": "fault"}])
    assert payload.events[0]["event_key"] == "fault"
