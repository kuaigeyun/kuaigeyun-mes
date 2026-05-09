"""
专用应用与组织的绑定（平台管理员维护）。

仅绑定组织可在应用中心列表中看到对应 is_dedicated 应用（平台管理员不受限）。
"""

from __future__ import annotations

from typing import Any, Dict, List, Set

from loguru import logger

from infra.exceptions.exceptions import ValidationError
from infra.infrastructure.database.database import get_db_connection


class ApplicationDedicatedBindingService:
    @staticmethod
    async def fetch_bound_codes_for_tenant(tenant_id: int) -> Set[str]:
        """读取失败时返回空集合，避免未跑迁移 214 时拖垮整个应用列表接口。"""
        conn = await get_db_connection()
        try:
            rows = await conn.fetch(
                """
                SELECT app_code FROM core_application_dedicated_bindings
                WHERE tenant_id = $1
                """,
                tenant_id,
            )
            return {str(r["app_code"]) for r in rows if r.get("app_code")}
        except Exception as e:  # noqa: BLE001 — 含表不存在、连接异常
            logger.warning(
                "读取专用应用绑定失败 tenant_id={}（请确认已执行迁移 214，存在表 core_application_dedicated_bindings）: {}",
                tenant_id,
                e,
            )
            return set()
        finally:
            await conn.close()

    @staticmethod
    async def list_bindings(*, app_code: str | None = None) -> List[Dict[str, Any]]:
        conn = await get_db_connection()
        try:
            if app_code:
                rows = await conn.fetch(
                    """
                    SELECT b.id, b.app_code, b.tenant_id, b.created_at, t.name AS tenant_name
                    FROM core_application_dedicated_bindings b
                    LEFT JOIN infra_tenants t ON t.id = b.tenant_id
                    WHERE b.app_code = $1
                    ORDER BY b.tenant_id
                    """,
                    app_code,
                )
            else:
                rows = await conn.fetch(
                    """
                    SELECT b.id, b.app_code, b.tenant_id, b.created_at, t.name AS tenant_name
                    FROM core_application_dedicated_bindings b
                    LEFT JOIN infra_tenants t ON t.id = b.tenant_id
                    ORDER BY b.app_code, b.tenant_id
                    """
                )
            return [dict(r) for r in rows]
        except Exception as e:  # noqa: BLE001
            logger.warning(
                "列出专用应用绑定失败 app_code={}（迁移 214 / 表 core_application_dedicated_bindings）: {}",
                app_code,
                e,
            )
            return []
        finally:
            await conn.close()

    @staticmethod
    async def bind(app_code: str, tenant_id: int) -> None:
        code = (app_code or "").strip()
        if not code:
            raise ValidationError("app_code 不能为空")
        conn = await get_db_connection()
        try:
            await conn.execute(
                """
                INSERT INTO core_application_dedicated_bindings (app_code, tenant_id)
                VALUES ($1, $2)
                ON CONFLICT (app_code, tenant_id) DO NOTHING
                """,
                code,
                tenant_id,
            )
        finally:
            await conn.close()

        # 租户侧必须有 core_applications 行，否则列表查询 tenant_id=? 永远拿不到该应用
        from core.services.application.application_service import ApplicationService

        await ApplicationService.ensure_application_registered_from_manifest(tenant_id, code)

    @staticmethod
    async def unbind(app_code: str, tenant_id: int) -> None:
        code = (app_code or "").strip()
        conn = await get_db_connection()
        try:
            await conn.execute(
                """
                DELETE FROM core_application_dedicated_bindings
                WHERE app_code = $1 AND tenant_id = $2
                """,
                code,
                tenant_id,
            )
        finally:
            await conn.close()
