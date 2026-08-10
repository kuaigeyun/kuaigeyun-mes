"""BuildProvenanceService 状态判定单元测试（mock Gitee）。"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from infra.services.build_provenance_service import (
    BuildProvenanceService,
    is_valid_uuid_v4,
    resolve_provenance_status,
)


@pytest.mark.asyncio
async def test_resolve_provenance_status_unverified_build_without_commit():
    assert await resolve_provenance_status(git_commit="") == "unverified_build"


@pytest.mark.asyncio
async def test_resolve_provenance_status_official_self_hosted():
    with patch(
        "infra.services.build_provenance_service._gitee_commit_exists",
        new=AsyncMock(return_value=True),
    ):
        assert await resolve_provenance_status(git_commit="3266282") == "official_self_hosted"


@pytest.mark.asyncio
async def test_resolve_provenance_status_official_self_hosted_via_github_only():
    with patch(
        "infra.services.build_provenance_service._gitee_commit_exists",
        new=AsyncMock(return_value=False),
    ), patch(
        "infra.services.build_provenance_service._github_commit_exists",
        new=AsyncMock(return_value=True),
    ):
        assert await resolve_provenance_status(git_commit="605ba6d") == "official_self_hosted"


@pytest.mark.asyncio
async def test_resolve_provenance_status_unverified_commit():
    with patch(
        "infra.services.build_provenance_service._gitee_commit_exists",
        new=AsyncMock(return_value=False),
    ), patch(
        "infra.services.build_provenance_service._github_commit_exists",
        new=AsyncMock(return_value=False),
    ):
        assert await resolve_provenance_status(git_commit="deadbeef") == "unverified_commit"


@pytest.mark.asyncio
async def test_resolve_provenance_status_official_unknown_commit_on_timeout():
    with patch(
        "infra.services.build_provenance_service._gitee_commit_exists",
        new=AsyncMock(return_value=None),
    ), patch(
        "infra.services.build_provenance_service._github_commit_exists",
        new=AsyncMock(return_value=None),
    ):
        assert await resolve_provenance_status(git_commit="3266282") == "official_unknown_commit"


@pytest.mark.asyncio
async def test_get_provenance_includes_telemetry_fields():
    service = BuildProvenanceService()
    with patch.object(service, "get_provenance", wraps=service.get_provenance):
        with patch(
            "infra.services.build_provenance_service.resolve_git_commit",
            return_value="abc1234",
        ), patch(
            "infra.services.build_provenance_service.resolve_provenance_status",
            new=AsyncMock(return_value="official_self_hosted"),
        ), patch(
            "infra.services.build_provenance_service.is_instance_registered",
            new=AsyncMock(return_value=False),
        ), patch(
            "infra.services.build_provenance_service.infra_settings"
        ) as mock_settings:
            mock_settings.INSTALL_TELEMETRY_ENABLED = True
            mock_settings.OFFICIAL_PROVENANCE_ENABLED = True
            data = await service.get_provenance()
    assert data["git_commit"] == "abc1234"
    assert data["telemetry_enabled"] is True
    assert data["telemetry_disclosure_path"] == "docs/telemetry-disclosure.md"


def test_is_valid_uuid_v4():
    assert is_valid_uuid_v4("550e8400-e29b-41d4-a716-446655440000")
    assert not is_valid_uuid_v4("not-a-uuid")
    assert not is_valid_uuid_v4("6ba7b810-9dad-11d1-80b4-00c04fd430c8")  # v1
