"""看板待审门统计：只计未删除的在研/暂停项目当前阶段门。"""

from types import SimpleNamespace

from apps.kuaiplm.utils.rd_project_progress import count_pending_current_gates


def test_pending_gate_reviews_ignore_deleted_project_gates():
    project = SimpleNamespace(
        id=1, status="IN_PROGRESS", current_gate_key="concept", deleted_at="2026-09-01"
    )
    gates = [
        SimpleNamespace(project_id=1, gate_key=key, status="PENDING")
        for key in (
            "concept",
            "design",
            "prototype",
            "pilot",
            "release",
            "ramp",
            "first_delivery",
            "stable_production",
            "service_handover",
        )
    ]
    assert count_pending_current_gates([project], gates) == 0


def test_pending_gate_reviews_count_only_current_gate_of_live_project():
    project = SimpleNamespace(
        id=2, status="IN_PROGRESS", current_gate_key="design", deleted_at=None
    )
    gates = [
        SimpleNamespace(project_id=2, gate_key="concept", status="PASSED"),
        SimpleNamespace(project_id=2, gate_key="design", status="PENDING"),
        SimpleNamespace(project_id=2, gate_key="prototype", status="PENDING"),
    ]
    assert count_pending_current_gates([project], gates) == 1


def test_pending_gate_reviews_zero_when_no_live_projects():
    draft = SimpleNamespace(
        id=3, status="DRAFT", current_gate_key="concept", deleted_at=None
    )
    gates = [SimpleNamespace(project_id=3, gate_key="concept", status="PENDING")]
    assert count_pending_current_gates([draft], gates) == 0
    assert count_pending_current_gates([], []) == 0
