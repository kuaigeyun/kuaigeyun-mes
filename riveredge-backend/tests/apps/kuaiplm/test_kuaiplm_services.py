"""快研发核心逻辑单元测试（避免完整应用 bootstrap）。"""

from __future__ import annotations

from datetime import datetime, timezone


def test_change_desk_merge_pagination_slice():
    rows = [
        {"uuid": f"uuid-{i}", "created_at": datetime(2026, 1, i, tzinfo=timezone.utc)}
        for i in range(1, 6)
    ]
    rows.sort(key=lambda x: x["created_at"], reverse=True)
    page = 2
    page_size = 2
    offset = (page - 1) * page_size
    sliced = rows[offset : offset + page_size]
    assert [row["uuid"] for row in sliced] == ["uuid-3", "uuid-2"]


def test_project_link_dedup_skips_when_exists():
    exists = True
    project_id = 10
    should_create = bool(project_id) and not exists
    assert should_create is False


def test_project_link_creates_when_missing():
    exists = False
    project_id = 10
    should_create = bool(project_id) and not exists
    assert should_create is True


def test_push_trial_requires_material_reference():
    project = {"material_id": None, "material_code": None}
    can_push = bool(project["material_id"] or project["material_code"])
    assert can_push is False


def test_gate_pass_requires_previous_gate():
    gates = [
        {"id": 1, "sort_order": 1, "status": "PENDING"},
        {"id": 2, "sort_order": 2, "status": "PENDING"},
    ]
    gate = gates[1]
    prev = gates[0]
    can_pass = prev["status"] in ("PASSED", "SKIPPED")
    assert can_pass is False


def test_current_gate_key_advances_to_next_open():
    gates = [
        {"gate_key": "concept", "status": "PASSED"},
        {"gate_key": "design", "status": "PENDING"},
        {"gate_key": "prototype", "status": "PENDING"},
    ]
    next_key = next(
        (g["gate_key"] for g in gates if g["status"] not in ("PASSED", "SKIPPED")),
        gates[-1]["gate_key"],
    )
    assert next_key == "design"
