"""检验单：未开启人工审核时自动审核通过。"""

from unittest.mock import AsyncMock, patch

import pytest

from apps.kuaizhizao.constants import ReviewStatus
from apps.kuaizhizao.services.quality_service import (
    _quality_inspection_conduct_finalize_fields,
    _quality_inspection_initial_review_fields,
)


@pytest.mark.asyncio
async def test_initial_review_fields_when_audit_off():
    with patch(
        "apps.kuaizhizao.services.quality_service._is_quality_audit_required",
        new=AsyncMock(return_value=False),
    ):
        fields = await _quality_inspection_initial_review_fields(1, "process_inspection")
    assert fields == {"review_status": ReviewStatus.APPROVED}


@pytest.mark.asyncio
async def test_initial_review_fields_when_audit_on():
    with patch(
        "apps.kuaizhizao.services.quality_service._is_quality_audit_required",
        new=AsyncMock(return_value=True),
    ):
        fields = await _quality_inspection_initial_review_fields(1, "process_inspection")
    assert fields == {}


@pytest.mark.asyncio
async def test_conduct_finalize_auto_approve_when_audit_off_and_qualified():
    with patch(
        "apps.kuaizhizao.services.quality_service._is_quality_audit_required",
        new=AsyncMock(return_value=False),
    ):
        fields = await _quality_inspection_conduct_finalize_fields(
            1,
            "process_inspection",
            quality_status="合格",
            inspected_by=10,
            inspector_name="检验员",
        )
    assert fields["status"] == "已审核"
    assert fields["review_status"] == ReviewStatus.APPROVED
    assert fields["reviewer_id"] == 10
    assert fields["reviewer_name"] == "检验员"
    assert fields["review_time"] is not None


@pytest.mark.asyncio
async def test_conduct_finalize_stays_inspected_when_audit_on():
    with patch(
        "apps.kuaizhizao.services.quality_service._is_quality_audit_required",
        new=AsyncMock(return_value=True),
    ):
        fields = await _quality_inspection_conduct_finalize_fields(
            1,
            "process_inspection",
            quality_status="合格",
            inspected_by=10,
            inspector_name="检验员",
        )
    assert fields == {"status": "已检验"}


@pytest.mark.asyncio
async def test_conduct_finalize_unqualified_stays_inspected_when_audit_off():
    with patch(
        "apps.kuaizhizao.services.quality_service._is_quality_audit_required",
        new=AsyncMock(return_value=False),
    ):
        fields = await _quality_inspection_conduct_finalize_fields(
            1,
            "finished_goods_inspection",
            quality_status="不合格",
            inspected_by=10,
            inspector_name="检验员",
        )
    assert fields == {"status": "已检验"}
