"""继电器行业包：启停钩子（产量口径 + 产线排程默认）。"""

from __future__ import annotations

from typing import Any, Dict, Optional

from loguru import logger

from apps.kuaizhizao.schemas.scheduling_constraints import SchedulingConstraints
from apps.kuaizhizao.services.scheduling_config_service import SchedulingConfigService
from infra.models.tenant import Tenant
from infra.services.business_config_service import BusinessConfigService

SNAPSHOT_KEY = "ind_relay_host_snapshot"
HOST_DEFAULTS_EXT = "relay.host_defaults"


def resolve_profile_seed(profile_key: str) -> Optional[Dict[str, Any]]:
    return None


def _constraints_as_dict(raw: Any) -> Dict[str, Any]:
    if raw is None:
        return {}
    if hasattr(raw, "model_dump"):
        data = raw.model_dump()
        return data if isinstance(data, dict) else {}
    if isinstance(raw, dict):
        return dict(raw)
    return {}


async def apply_standalone(tenant_id: int, extension_id: str) -> None:
    if extension_id != HOST_DEFAULTS_EXT:
        return
    await _snapshot_and_apply_defaults(tenant_id)


async def revert_standalone(tenant_id: int, extension_id: str) -> None:
    if extension_id != HOST_DEFAULTS_EXT:
        return
    await _restore_from_snapshot(tenant_id)


async def _snapshot_and_apply_defaults(tenant_id: int) -> None:
    tenant = await Tenant.get_or_none(id=tenant_id)
    if not tenant:
        logger.warning("ind_relay host_defaults: tenant {} not found", tenant_id)
        return
    settings = dict(tenant.settings or {})
    cfg = await SchedulingConfigService().get_default_config(tenant_id)
    constraints = _constraints_as_dict(cfg.constraints if cfg else None)

    # 仅首次启停写快照；reapply 不得覆盖，否则停用时无法还原用户原口径
    if SNAPSHOT_KEY not in settings:
        biz = await BusinessConfigService().get_business_config(tenant_id)
        current_basis = (
            (biz.get("parameters") or {}).get("production", {}).get("output_basis", "all_operations")
        )
        settings[SNAPSHOT_KEY] = {
            "output_basis": current_basis,
            "resource_mode": constraints.get("resource_mode", "workstation"),
            "line_exclusive": constraints.get("line_exclusive", True),
        }
        tenant.settings = settings
        await tenant.save(update_fields=["settings", "updated_at"])

    await BusinessConfigService().update_process_parameter(
        tenant_id, "production", "output_basis", "last_operation_effective_qualified"
    )

    merged = SchedulingConstraints.model_validate(
        {
            **constraints,
            "resource_mode": "production_line",
            "line_exclusive": True,
        }
    )
    await SchedulingConfigService().upsert_default_config(
        tenant_id=tenant_id,
        constraints=merged,
        updated_by=1,
    )
    logger.info(
        "ind_relay host_defaults applied tenant={} output_basis=last_operation_effective_qualified resource_mode=production_line",
        tenant_id,
    )


async def _restore_from_snapshot(tenant_id: int) -> None:
    tenant = await Tenant.get_or_none(id=tenant_id)
    if not tenant:
        return
    settings = dict(tenant.settings or {})
    snap = settings.pop(SNAPSHOT_KEY, None) or {}
    tenant.settings = settings
    await tenant.save(update_fields=["settings", "updated_at"])

    basis = snap.get("output_basis") or "all_operations"
    await BusinessConfigService().update_process_parameter(
        tenant_id, "production", "output_basis", basis
    )

    cfg = await SchedulingConfigService().get_default_config(tenant_id)
    constraints = _constraints_as_dict(cfg.constraints if cfg else None)
    merged = SchedulingConstraints.model_validate(
        {
            **constraints,
            "resource_mode": snap.get("resource_mode") or "workstation",
            "line_exclusive": bool(snap.get("line_exclusive", True)),
        }
    )
    await SchedulingConfigService().upsert_default_config(
        tenant_id=tenant_id,
        constraints=merged,
        updated_by=1,
    )
    logger.info(
        "ind_relay host_defaults reverted tenant={} output_basis={} resource_mode={}",
        tenant_id,
        basis,
        snap.get("resource_mode") or "workstation",
    )
