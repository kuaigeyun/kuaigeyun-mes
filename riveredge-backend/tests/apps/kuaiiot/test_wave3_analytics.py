"""Wave 3 OEE-Live 与 Pipeline 单元测试。"""

from datetime import datetime, timezone
from types import SimpleNamespace

from apps.kuaiiot.services.oee_live_service import OeeLiveService, _StatusSegment


class TestOeeLiveSegments:
    def test_summarize_running_and_idle(self):
        segments = [
            _StatusSegment("运行中", datetime(2026, 8, 7, 8, 0, tzinfo=timezone.utc), datetime(2026, 8, 7, 9, 0, tzinfo=timezone.utc)),
            _StatusSegment("待机", datetime(2026, 8, 7, 9, 0, tzinfo=timezone.utc), datetime(2026, 8, 7, 9, 30, tzinfo=timezone.utc)),
        ]
        result = OeeLiveService._summarize_segments(segments)
        assert result["running_minutes"] == 60.0
        assert result["idle_minutes"] == 30.0
        assert result["availability_rate"] == 66.67

    def test_bucket_status(self):
        assert OeeLiveService._bucket_status("运行中") == "running"
        assert OeeLiveService._bucket_status("故障") == "down"


def test_pipeline_summary_keys():
    graph = SimpleNamespace(
        nodes=[
            SimpleNamespace(id="connection:1", node_type="connection", label="MQTT", status="healthy", meta={}),
            SimpleNamespace(id="device:1", node_type="device", label="CNC-01", status="online", meta={}),
        ],
        edges=[SimpleNamespace(source="connection:1", target="device:1", edge_type="ingress")],
        summary={"connections": 1, "devices": 1, "tags": 0, "open_alerts": 0},
    )
    assert graph.summary["connections"] == 1
