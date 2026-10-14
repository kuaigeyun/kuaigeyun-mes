"""项目建议书 funide-oa 供应商评审策略。"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from apps.funide_oa.project_proposal_policy import (
    funide_project_proposal_supplier_assessment_optional,
)


@pytest.mark.asyncio
async def test_supplier_assessment_optional_when_funide_enabled():
    with patch(
        "core.services.application.enabled_apps.resolve_enabled_app_codes",
        new=AsyncMock(return_value=frozenset({"kuaiplm", "funide-oa"})),
    ):
        assert await funide_project_proposal_supplier_assessment_optional(1) is True


@pytest.mark.asyncio
async def test_supplier_assessment_required_without_funide():
    with patch(
        "core.services.application.enabled_apps.resolve_enabled_app_codes",
        new=AsyncMock(return_value=frozenset({"kuaiplm"})),
    ):
        assert await funide_project_proposal_supplier_assessment_optional(1) is False
