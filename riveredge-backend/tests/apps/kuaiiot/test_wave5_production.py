"""快数采生产落地补齐单元测试。"""

import asyncio
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest

from apps.kuaiiot.constants import INGEST_MAX_TAGS_PER_PAYLOAD
from apps.kuaiiot.schemas.iot import IngestPayload
from apps.kuaiiot.services.retention_service import RetentionService


class TestIngestPayloadGuard:
    def test_tags_limit(self):
        with pytest.raises(ValueError, match=str(INGEST_MAX_TAGS_PER_PAYLOAD)):
            IngestPayload(tags={f"tag_{idx}": idx for idx in range(INGEST_MAX_TAGS_PER_PAYLOAD + 1)})


def test_retention_service_purge():
    now = datetime(2026, 8, 7, 12, 0, tzinfo=timezone.utc)
    dedup_filter = AsyncMock(return_value=3)
    alert_filter = AsyncMock(return_value=2)
    with patch("apps.kuaiiot.services.retention_service.resolve_business_datetime", return_value=now), patch(
        "apps.kuaiiot.services.retention_service.IotIngestDedup.filter",
        return_value=AsyncMock(delete=dedup_filter),
    ), patch(
        "apps.kuaiiot.services.retention_service.IotAlert.filter",
        return_value=AsyncMock(delete=alert_filter),
    ), patch(
        "apps.kuaiiot.services.retention_service.IotMessageLog.filter",
        return_value=AsyncMock(delete=AsyncMock(return_value=0)),
    ):
        result = asyncio.run(RetentionService.purge_expired_records())
        assert result == {"dedup_deleted": 3, "alerts_deleted": 2, "message_logs_deleted": 0}
        dedup_filter.assert_awaited_once()
        alert_filter.assert_awaited_once()
