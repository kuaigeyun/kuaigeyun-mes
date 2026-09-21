"""研发项目综合进度计算"""

from typing import Iterable, Sequence

from apps.kuaiplm.constants.rd_project import (
    RdDeliverableStatus,
    RdGateStatus,
    RdProjectStatus,
    RdTaskStatus,
)

# 看板「待审门」只跟在研/暂停项目；草稿、已完成、已取消、已删除不计入
PENDING_GATE_LIVE_PROJECT_STATUSES = (
    RdProjectStatus.IN_PROGRESS.value,
    RdProjectStatus.ON_HOLD.value,
)
PENDING_GATE_REVIEW_STATUSES = (
    RdGateStatus.PENDING.value,
    RdGateStatus.IN_PROGRESS.value,
)


def count_pending_current_gates(projects: Sequence, gates: Sequence) -> int:
    """当前待审阶段门数：仅未删除的在研/暂停项目的 current_gate。"""
    current = {
        (int(p.id), p.current_gate_key)
        for p in projects
        if getattr(p, "deleted_at", None) is None
        and getattr(p, "status", None) in PENDING_GATE_LIVE_PROJECT_STATUSES
        and getattr(p, "current_gate_key", None)
    }
    if not current:
        return 0
    pending = set(PENDING_GATE_REVIEW_STATUSES)
    return sum(
        1
        for g in gates
        if getattr(g, "status", None) in pending
        and (int(getattr(g, "project_id")), getattr(g, "gate_key", None)) in current
    )


def _gate_progress(gates: Sequence) -> float:
    if not gates:
        return 0.0
    passed = sum(1 for g in gates if getattr(g, "status", None) == RdGateStatus.PASSED.value)
    return passed * 100.0 / len(gates)


def _task_progress(tasks: Sequence) -> float:
    active = [t for t in tasks if getattr(t, "status", None) != RdTaskStatus.CANCELLED.value]
    if not active:
        return 0.0
    done = sum(1 for t in active if getattr(t, "status", None) == RdTaskStatus.DONE.value)
    return done * 100.0 / len(active)


def _deliverable_progress(deliverables: Sequence) -> float:
    if not deliverables:
        return 0.0
    approved = sum(
        1 for d in deliverables if getattr(d, "status", None) == RdDeliverableStatus.APPROVED.value
    )
    return approved * 100.0 / len(deliverables)


def compute_project_progress(
    gates: Sequence,
    tasks: Sequence,
    deliverables: Sequence,
) -> float:
    """
    综合进度：阶段门 40% + 任务 30% + 交付物 30%。
    无任务时任务项按门进度计；无交付物时交付物项按门进度计。
    """
    gate_pct = _gate_progress(gates)
    task_pct = _task_progress(tasks) if tasks else gate_pct
    deliverable_pct = _deliverable_progress(deliverables) if deliverables else gate_pct
    return round(gate_pct * 0.4 + task_pct * 0.3 + deliverable_pct * 0.3, 1)
