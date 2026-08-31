"""研发项目是否已有实际执行（撤回/删除门控）"""

from typing import Iterable, Sequence

from apps.kuaiplm.constants.rd_project import (
    RdDeliverableStatus,
    RdGateStatus,
    RdTaskStatus,
)


def gates_not_executed(gates: Sequence) -> bool:
    if not gates:
        return True
    pending = RdGateStatus.PENDING.value
    return all(getattr(g, "status", None) == pending for g in gates)


def tasks_not_executed(tasks: Iterable) -> bool:
    active = {RdTaskStatus.IN_PROGRESS.value, RdTaskStatus.DONE.value}
    return not any(getattr(t, "status", None) in active for t in tasks)


def deliverables_not_executed(deliverables: Iterable) -> bool:
    progressed = {RdDeliverableStatus.SUBMITTED.value, RdDeliverableStatus.APPROVED.value}
    return not any(getattr(d, "status", None) in progressed for d in deliverables)
