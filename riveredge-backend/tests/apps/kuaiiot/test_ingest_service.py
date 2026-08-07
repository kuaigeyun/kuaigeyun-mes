"""IngestService 单元测试。"""

from decimal import Decimal
from unittest.mock import AsyncMock, patch

import pytest

from apps.kuaiiot.services.ingest_service import IngestService


class TestIngestServiceCoerce:
    def test_coerce_boolean(self):
        assert IngestService._coerce_value(True, "boolean") == (None, None, True)
        assert IngestService._coerce_value("online", "boolean") == (None, None, True)

    def test_coerce_number(self):
        assert IngestService._coerce_value("12.5", "number") == (None, Decimal("12.5"), None)

    def test_apply_map_target_status(self):
        payload = {}
        IngestService._apply_map_target("status", "运行中", None, None, payload)
        assert payload["status"] == "运行中"

    def test_apply_map_target_other_parameters(self):
        payload = {}
        IngestService._apply_map_target("other_parameters.speed", None, Decimal("120"), None, payload)
        assert payload["other_parameters"]["speed"] == 120.0


@pytest.mark.asyncio
async def test_maybe_sync_mes_throttled():
    device = AsyncMock()
    device.equipment_uuid = "eq-1"
    device.tenant_id = 1
    device.last_mes_sync_at = None
    device.save = AsyncMock()

    with patch("apps.kuaiiot.services.ingest_service.resolve_business_datetime") as mock_now, patch(
        "apps.kuaiiot.services.ingest_service.EquipmentStatusMonitorService"
    ) as mock_service_cls, patch(
        "apps.kuaiiot.services.ingest_service.MesGuardService.prepare_mes_payload",
        new=AsyncMock(side_effect=lambda tenant_id, equipment_uuid, mes_payload: mes_payload),
    ):
        from datetime import datetime, timezone

        now = datetime(2026, 8, 7, 4, 0, tzinfo=timezone.utc)
        mock_now.return_value = now
        mock_service_cls.return_value.create_status_monitor = AsyncMock()
        synced = await IngestService._maybe_sync_mes(device, {"status": "运行中"}, now)
        assert synced is True
        device.last_mes_sync_at = now
        synced_again = await IngestService._maybe_sync_mes(device, {"status": "待机"}, now)
        assert synced_again is False
