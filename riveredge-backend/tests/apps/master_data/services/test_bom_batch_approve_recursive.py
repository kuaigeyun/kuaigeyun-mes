"""BOM 批量审核：递归时跳过已审核/已草稿子件。"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from apps.master_data.services.material_service import MaterialService
from infra.exceptions.exceptions import ValidationError


def _bom_row(row_id: int, uuid: str, approval_status: str, material_id: int = 100):
    return SimpleNamespace(
        id=row_id,
        uuid=uuid,
        material_id=material_id,
        component_id=None,
        version="1.0",
        approval_status=approval_status,
    )


@pytest.mark.asyncio
async def test_recursive_approve_skips_already_approved_child_rows():
    parent = _bom_row(1, "parent-uuid", "draft")
    child_approved = _bom_row(2, "child-approved", "approved", material_id=200)
    child_draft = _bom_row(3, "child-draft", "draft", material_id=200)

    updated_ids: list[int] = []

    def make_qs(rows):
        qs = MagicMock()
        qs.all = AsyncMock(return_value=rows)

        async def _update(**_kwargs):
            return len(rows)

        qs.update = _update
        return qs

    async def fake_filter(**kwargs):
        if kwargs.get("uuid__in") == ["parent-uuid"]:
            return make_qs([parent])
        if kwargs.get("id__in") == [1]:
            return make_qs([parent])
        if kwargs.get("material_id") == 200:
            return make_qs([child_approved, child_draft])
        if set(kwargs.get("id__in") or []) == {1, 2, 3}:
            return make_qs([parent, child_approved, child_draft])
        if kwargs.get("id__in"):
            ids = list(kwargs["id__in"])
            updated_ids.extend(ids)
            selected = [r for r in (parent, child_approved, child_draft) if r.id in ids]
            return make_qs(selected)
        if kwargs.get("uuid__in"):
            return make_qs([parent])
        return make_qs([])

    with (
        patch("apps.master_data.services.material_service.BOM.filter", side_effect=fake_filter),
        patch.object(
            MaterialService,
            "_assert_bom_version_components_have_source_type",
            new=AsyncMock(),
        ),
    ):
        await MaterialService.batch_approve_bom(
            tenant_id=1,
            bom_uuids=["parent-uuid"],
            approved_by=99,
            approved=True,
            recursive=True,
            is_reverse=False,
        )

    assert sorted(updated_ids) == [1, 3]


@pytest.mark.asyncio
async def test_non_recursive_approve_still_rejects_mixed_status():
    rows = [
        _bom_row(1, "a", "draft"),
        _bom_row(2, "b", "approved"),
    ]

    async def fake_filter(**kwargs):
        qs = MagicMock()
        qs.all = AsyncMock(return_value=rows)
        qs.update = AsyncMock(return_value=0)
        return qs

    with patch("apps.master_data.services.material_service.BOM.filter", side_effect=fake_filter):
        with pytest.raises(ValidationError, match="仅草稿/待审核状态可审核"):
            await MaterialService.batch_approve_bom(
                tenant_id=1,
                bom_uuids=["a", "b"],
                approved_by=99,
                approved=True,
                recursive=False,
                is_reverse=False,
            )
