"""工程图纸服务：现行版筛选与修订递增。"""

import unittest
from datetime import datetime, timezone

from apps.master_data.models.drawing import EngineeringDrawing
from apps.master_data.services.drawing_service import _next_revision, pick_current_effective_rows


def _drawing(
    *,
    code: str,
    revision: str,
    status: str,
    created_at: datetime,
    released_at: datetime | None = None,
    drawing_id: int = 1,
) -> EngineeringDrawing:
    row = EngineeringDrawing(
        tenant_id=1,
        code=code,
        name=f"{code}-{revision}",
        revision=revision,
        drawing_type="part",
        status=status,
        file_uuid="00000000-0000-0000-0000-000000000001",
    )
    row.id = drawing_id
    row.created_at = created_at
    row.released_at = released_at
    return row


class TestDrawingServiceHelpers(unittest.TestCase):
    def test_next_revision_alpha(self):
        self.assertEqual(_next_revision("A"), "B")
        self.assertEqual(_next_revision("Z"), "AA")

    def test_pick_current_effective_prefers_latest_released(self):
        base = datetime(2026, 1, 1, tzinfo=timezone.utc)
        rows = [
            _drawing(code="PD0003", revision="A", status="Obsolete", created_at=base, drawing_id=1),
            _drawing(
                code="PD0003",
                revision="B",
                status="Released",
                created_at=base.replace(day=2),
                released_at=base.replace(day=2),
                drawing_id=2,
            ),
            _drawing(
                code="PD0003",
                revision="C",
                status="Released",
                created_at=base.replace(day=3),
                released_at=base.replace(day=3),
                drawing_id=3,
            ),
            _drawing(code="PD0003", revision="D", status="Draft", created_at=base.replace(day=4), drawing_id=4),
        ]
        effective = pick_current_effective_rows(rows)
        self.assertEqual(len(effective), 1)
        self.assertEqual(effective[0].revision, "C")

    def test_pick_current_effective_prefers_pending_over_older_draft(self):
        base = datetime(2026, 1, 1, tzinfo=timezone.utc)
        rows = [
            _drawing(code="PD0006", revision="A", status="Draft", created_at=base, drawing_id=1),
            _drawing(
                code="PD0006",
                revision="B",
                status="Pending",
                created_at=base.replace(day=2),
                drawing_id=2,
            ),
        ]
        effective = pick_current_effective_rows(rows)
        self.assertEqual(len(effective), 1)
        self.assertEqual(effective[0].revision, "B")

    def test_pick_current_effective_falls_back_to_latest_draft(self):
        base = datetime(2026, 1, 1, tzinfo=timezone.utc)
        rows = [
            _drawing(code="PD0004", revision="A", status="Obsolete", created_at=base, drawing_id=1),
            _drawing(code="PD0004", revision="B", status="Draft", created_at=base.replace(day=2), drawing_id=2),
            _drawing(code="PD0004", revision="C", status="Draft", created_at=base.replace(day=3), drawing_id=3),
        ]
        effective = pick_current_effective_rows(rows)
        self.assertEqual(len(effective), 1)
        self.assertEqual(effective[0].revision, "C")

    def test_pick_current_effective_skips_obsolete_only_codes(self):
        base = datetime(2026, 1, 1, tzinfo=timezone.utc)
        rows = [
            _drawing(code="PD0005", revision="A", status="Obsolete", created_at=base, drawing_id=1),
        ]
        self.assertEqual(pick_current_effective_rows(rows), [])


if __name__ == "__main__":
    unittest.main()
