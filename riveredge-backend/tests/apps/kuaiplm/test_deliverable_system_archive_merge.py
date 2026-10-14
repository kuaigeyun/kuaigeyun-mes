"""体系清单并入交付物：填充态计算。"""

from apps.kuaiplm.constants.rd_project_system_archive import RdSystemArchiveFillStatus
from apps.kuaiplm.models.rd_project import RdProjectDeliverable
from apps.kuaiplm.services.rd_project_deliverable_system_archive_service import (
    compute_deliverable_fill_status,
    enrich_deliverable_system_archive_fields,
)


def test_compute_deliverable_fill_status_numeric_upload():
    row = RdProjectDeliverable(
        tenant_id=1,
        name="设计任务计划书",
        system_archive_type_code="design_task_plan",
        file_uuid="abc",
    )
    assert compute_deliverable_fill_status(row) == RdSystemArchiveFillStatus.UPLOADED.value


def test_enrich_deliverable_system_archive_fields():
    row = RdProjectDeliverable(
        tenant_id=1,
        name="项目建议书",
        system_archive_type_code="project_proposal",
        linked_target_id=9,
        linked_target_name="PP-001",
    )
    extra = enrich_deliverable_system_archive_fields(row)
    assert extra["fill_status"] == RdSystemArchiveFillStatus.LINKED.value
    assert extra["modes"] == ["link"]
    assert extra["system_archive_type_name"] == "项目建议书"
