from types import SimpleNamespace
from unittest.mock import patch

import pytest

from apps.kuaiiot.services.ingest_service import IngestService


@pytest.mark.asyncio
async def test_schedule_device_update_publishes_tenant_event():
    device = SimpleNamespace(
        tenant_id=7,
        uuid="device-uuid",
        id=12,
        code="D-12",
        external_device_id="external-12",
        is_online=True,
        last_seen_at=None,
        equipment_uuid="equipment-uuid",
    )

    with patch(
        "apps.kuaiiot.services.ingest_service.schedule_tenant_realtime_event"
    ) as publish:
        IngestService.schedule_device_update(device, synced_to_mes=True)

    publish.assert_called_once()
    kwargs = publish.call_args.kwargs
    assert kwargs["tenant_id"] == 7
    assert kwargs["scope"] == "kuaiiot"
    assert kwargs["event"] == "kuaiiot.device.updated"
    assert kwargs["payload"]["device_uuid"] == "device-uuid"
    assert kwargs["payload"]["is_online"] is True
    assert kwargs["payload"]["synced_to_mes"] is True
