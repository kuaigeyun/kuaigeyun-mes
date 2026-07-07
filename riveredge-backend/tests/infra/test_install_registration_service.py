"""InstallRegistrationService 登记逻辑单元测试。"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from infra.services.install_registration_service import InstallRegistrationService


@pytest.mark.asyncio
async def test_register_returns_disabled_when_telemetry_off():
    with patch(
        "infra.services.install_registration_service.infra_settings"
    ) as mock_settings:
        mock_settings.INSTALL_TELEMETRY_ENABLED = False
        result = await InstallRegistrationService().register(
            payload={"install_instance_id": "550e8400-e29b-41d4-a716-446655440000"},
            client_ip="127.0.0.1",
        )
    assert result == {"registered": False, "reason": "telemetry_disabled"}


@pytest.mark.asyncio
async def test_register_rejects_mismatched_install_id():
    with patch(
        "infra.services.install_registration_service.infra_settings"
    ) as mock_settings:
        mock_settings.INSTALL_TELEMETRY_ENABLED = True
        with patch(
            "infra.services.install_registration_service.resolve_install_instance_id",
            return_value="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        ):
            result = await InstallRegistrationService().register(
                payload={"install_instance_id": "550e8400-e29b-41d4-a716-446655440000"},
                client_ip="127.0.0.1",
            )
    assert result == {"registered": False, "reason": "install_id_mismatch"}


@pytest.mark.asyncio
async def test_register_creates_record_when_valid():
    with patch(
        "infra.services.install_registration_service.infra_settings"
    ) as mock_settings:
        mock_settings.INSTALL_TELEMETRY_ENABLED = True
        mock_settings.APP_VERSION = "1.0.0"
        install_id = "550e8400-e29b-41d4-a716-446655440000"
        with patch(
            "infra.services.install_registration_service.resolve_install_instance_id",
            return_value=install_id,
        ), patch(
            "infra.services.install_registration_service.resolve_git_commit",
            return_value="3266282",
        ), patch(
            "infra.services.install_registration_service.resolve_build_git_remote",
            return_value="https://gitee.com/someone/fork",
        ), patch(
            "infra.services.install_registration_service.resolve_build_git_branch",
            return_value="develop",
        ), patch(
            "infra.services.install_registration_service.InstallRegistration.get_or_none",
            new=AsyncMock(return_value=None),
        ), patch(
            "infra.services.install_registration_service.InstallRegistration.create",
            new=AsyncMock(),
        ) as mock_create:
            result = await InstallRegistrationService().register(
                payload={
                    "install_instance_id": install_id,
                    "provenance_status": "unverified_commit",
                },
                client_ip="10.0.0.1",
            )
    assert result["registered"] is True
    mock_create.assert_awaited_once()
    create_kwargs = mock_create.await_args.kwargs
    assert create_kwargs["build_git_remote"] == "https://gitee.com/someone/fork"
    assert create_kwargs["build_git_remote_is_official"] is False
