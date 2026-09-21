"""外推写回资格（push_ready）— 与极光 effective_push_ready / client_product_config 无关。

正式写回条件（由 DocumentPushService 强制）：
  push_ready == True  ∧  (source_type, target_profile) ∈ SUPPORTED_PROFILES

push_ready 语义（诚实）：
  租户存在 is_active 且 is_connected 且未软删的 IntegrationConfig，
  且其 type 属于该 target_profile 的连接器族。
  目录/连接器预设（仅存在记录、未接通）≠ 已接通。

dry_run 可跳过本门禁以组装预览；正式推必须通过。
"""

from __future__ import annotations

from typing import Any, Dict, FrozenSet, Optional, Set

from core.models.integration_config import IntegrationConfig
from infra.exceptions.exceptions import ValidationError

# profile → 默认连接器 type（与各 *PushService.DEFAULT_CONNECTOR_TYPE / Pipeline 一致）
PROFILE_CONNECTOR_TYPE: Dict[str, str] = {
    "kingdee_prd_mo": "kingdee_galaxy",
    "kingdee_prd_morpt": "kingdee_galaxy",
    "kingdee_sal_saleorder": "kingdee_galaxy",
    "kingdee_pur_purchaseorder": "kingdee_galaxy",
    "kingdee_stk_miscellaneous": "kingdee_galaxy",
    "oa_http_webhook": "Webhook",
    "feishu_im_notify": "feishu",
}

# 同 Adapter 族的 type 别名（与 document_push_adapter 注册别名对齐；禁止扩到 WMS/PLM）
_CONNECTOR_TYPE_FAMILY: Dict[str, FrozenSet[str]] = {
    "kingdee_galaxy": frozenset({"kingdee_galaxy"}),
    "feishu": frozenset({"feishu"}),
    "Webhook": frozenset(
        {
            "Webhook",
            "webhook",
            "weaver",
            "seeyon",
            "landray",
            "cloudhub",
            "tongda_oa",
            "salesforce",
            "xiaoshouyi",
            "fenxiang",
            "qidian",
            "supra_crm",
        }
    ),
}


def connector_type_for_profile(target_profile: str) -> str:
    profile = str(target_profile or "").strip()
    kind = PROFILE_CONNECTOR_TYPE.get(profile)
    if not kind:
        raise ValidationError(f"未知推送 profile，无法判定连接器: {profile!r}")
    return kind


def connector_type_family(connector_type: str) -> FrozenSet[str]:
    kind = str(connector_type or "").strip()
    if kind in _CONNECTOR_TYPE_FAMILY:
        return _CONNECTOR_TYPE_FAMILY[kind]
    for family in _CONNECTOR_TYPE_FAMILY.values():
        if kind in family:
            return family
    return frozenset({kind}) if kind else frozenset()


def is_connection_push_ready(connection: Optional[Any]) -> bool:
    """单条连接是否具备外推写回资格。预设存在 ≠ 已接通。"""
    if connection is None:
        return False
    if getattr(connection, "deleted_at", None) is not None:
        return False
    if not bool(getattr(connection, "is_active", False)):
        return False
    # 硬裁决：必须 is_connected；禁止把「有配置」当成 push_ready
    return bool(getattr(connection, "is_connected", False))


async def find_push_ready_connection(
    tenant_id: int,
    *,
    target_profile: str,
    connection_code: Optional[str] = None,
) -> Optional[IntegrationConfig]:
    """查找该 profile 下已接通的连接；无则返回 None。"""
    kind = connector_type_for_profile(target_profile)
    types: Set[str] = set(connector_type_family(kind))
    code = str(connection_code or "").strip()

    query = IntegrationConfig.filter(
        tenant_id=tenant_id,
        type__in=list(types),
        is_active=True,
        is_connected=True,
        deleted_at__isnull=True,
    )
    if code:
        return await query.filter(code=code).first()
    return await query.first()


async def is_document_push_ready(
    tenant_id: int,
    *,
    target_profile: str,
    connection_code: Optional[str] = None,
) -> bool:
    """租户对该 target_profile 是否具备外推写回资格（与极光无关）。"""
    connection = await find_push_ready_connection(
        tenant_id,
        target_profile=target_profile,
        connection_code=connection_code,
    )
    return is_connection_push_ready(connection)


async def assert_document_push_ready(
    tenant_id: int,
    *,
    source_type: str,
    target_profile: str,
    connection_code: Optional[str] = None,
    dry_run: bool = False,
) -> None:
    """正式写回前门禁。dry_run 跳过（允许无连接时组装预览）。"""
    if dry_run:
        return
    ready = await is_document_push_ready(
        tenant_id,
        target_profile=target_profile,
        connection_code=connection_code,
    )
    if ready:
        return
    kind = connector_type_for_profile(target_profile)
    code = str(connection_code or "").strip()
    hint = f" connection_code={code!r}" if code else ""
    raise ValidationError(
        f"外推未就绪（push_ready=false）：source_type={source_type!r} "
        f"target_profile={target_profile!r} connector={kind!r}{hint}；"
        f"请先在应用连接中完成连接测试并保持已接通"
    )
