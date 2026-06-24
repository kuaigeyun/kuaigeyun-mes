"""外协维修单维修进度派生逻辑。"""

from apps.haoligo.constants.mold_sheet_audit import SHEET_STATUS_APPROVED, SHEET_STATUS_PENDING
from apps.haoligo.constants.outsource_maintenance_repair_status import (
    OUTSOURCE_MAINTENANCE_REPAIR_STATUS_COMPLETED,
    OUTSOURCE_MAINTENANCE_REPAIR_STATUS_COMPLETE_PENDING,
    OUTSOURCE_MAINTENANCE_REPAIR_STATUS_IN_REPAIR,
    derive_outsource_maintenance_repair_status,
)


def test_repair_status_none_before_audit():
    assert (
        derive_outsource_maintenance_repair_status(
            audit_status="待审核",
            service_type="维修",
            linked_complete_status=None,
        )
        is None
    )


def test_repair_status_in_repair_when_approved_without_complete():
    assert (
        derive_outsource_maintenance_repair_status(
            audit_status=SHEET_STATUS_APPROVED,
            service_type="维修",
            linked_complete_status=None,
        )
        == OUTSOURCE_MAINTENANCE_REPAIR_STATUS_IN_REPAIR
    )


def test_repair_status_complete_pending():
    assert (
        derive_outsource_maintenance_repair_status(
            audit_status=SHEET_STATUS_APPROVED,
            service_type="维修",
            linked_complete_status=SHEET_STATUS_PENDING,
        )
        == OUTSOURCE_MAINTENANCE_REPAIR_STATUS_COMPLETE_PENDING
    )


def test_repair_status_completed():
    assert (
        derive_outsource_maintenance_repair_status(
            audit_status=SHEET_STATUS_APPROVED,
            service_type="维修",
            linked_complete_status=SHEET_STATUS_APPROVED,
        )
        == OUTSOURCE_MAINTENANCE_REPAIR_STATUS_COMPLETED
    )
