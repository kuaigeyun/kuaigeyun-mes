"""
应用管理服务模块

提供应用的 CRUD 操作和安装/卸载功能。
使用直接的 asyncpg 连接，避免 Tortoise ORM 配置问题。
"""

import hashlib
import json
import os
from pathlib import Path
from typing import Optional, List, Dict, Any, Set
from uuid import UUID, uuid4
from datetime import datetime
import asyncpg

from core.schemas.application import ApplicationCreate, ApplicationUpdate
from core.config.industry_app_catalog import requires_pro_license_for_app
from core.config.extension_provider import is_extension_provider_app_code
from core.config.industry_pack import is_industry_module_app_code, is_industry_pack_shell_code
from core.config.pro_app_catalog import resolve_application_sort_order
from core.services.application.application_dedicated_binding_service import ApplicationDedicatedBindingService
from core.utils.timezone_utils import now_utc
from infra.models.tenant import Tenant
from infra.services.package_service import PackageService
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.infrastructure.database.database import get_db_connection
from loguru import logger

# 由于使用直接 asyncpg 连接，类型注解使用 Dict[str, Any]
ApplicationDict = Dict[str, Any]

_PLACEHOLDER_APP_CODES = {"kuaicrm", "kuaipdm", "kuaichain"}
_BASE_APP_CODES = frozenset({"master-data"})
_PRO_ACTIVATION_REGISTRY_KEY = "pro_app_activation_registry"


class ApplicationService:
    """
    应用管理服务类
    
    提供应用的 CRUD 操作和安装/卸载功能。
    """

    @staticmethod
    def _normalize_menu_config_field(raw: Any) -> Optional[Dict[str, Any]]:
        """asyncpg jsonb 可能已是 dict；仅对字符串做 json.loads。"""
        if raw is None:
            return None
        if isinstance(raw, dict):
            return raw
        if isinstance(raw, str):
            text = raw.strip()
            if not text:
                return None
            try:
                parsed = json.loads(text)
            except json.JSONDecodeError:
                return None
            return parsed if isinstance(parsed, dict) else None
        return None

    @staticmethod
    def _normalize_application_row(app_dict: Dict[str, Any]) -> Dict[str, Any]:
        if "menu_config" in app_dict:
            app_dict["menu_config"] = ApplicationService._normalize_menu_config_field(
                app_dict.get("menu_config")
            )
        return app_dict

    @staticmethod
    def _manifest_is_dedicated(manifest: Dict[str, Any]) -> bool:
        if manifest.get("is_dedicated") is True:
            return True
        cat = str(manifest.get("market_category") or "").strip().lower()
        return cat == "dedicated"

    @staticmethod
    def _manifest_is_base(manifest: Dict[str, Any]) -> bool:
        code = str(manifest.get("code") or "")
        if code in _BASE_APP_CODES:
            return True
        return str(manifest.get("market_category") or "").strip().lower() == "base"

    @staticmethod
    def is_base_app_code(app_code: str) -> bool:
        if app_code in _BASE_APP_CODES:
            return True
        manifest = ApplicationService._get_manifest_by_code(app_code)
        return bool(manifest and ApplicationService._manifest_is_base(manifest))

    @staticmethod
    async def _auto_enable_base_app_if_needed(
        tenant_id: int,
        app_code: str,
        application: ApplicationDict,
    ) -> ApplicationDict:
        """
        基础应用（manifest market_category=base）在本轮新安装后默认启用。

        仅应由扫描安装路径在「本轮新安装」后调用；禁止在每次 scan / 菜单同步时
        对已安装但已停用的应用再次调用（否则会把用户关闭的应用重新打开）。
        """
        if not ApplicationService.is_base_app_code(app_code):
            return application
        if not application.get("is_installed") or application.get("is_active"):
            return application
        uuid = application.get("uuid")
        if not uuid:
            return application
        try:
            return await ApplicationService.enable_application(tenant_id, str(uuid))
        except Exception as e:
            logger.error(f"自动启用基础应用 {app_code} 失败 (tenant_id={tenant_id}): {e}")
            return application

    @staticmethod
    def effective_is_dedicated(app_row: Dict[str, Any]) -> bool:
        """
        是否与 manifest 约定一致地视为定制（专用）应用。
        DB 列未同步时仍以 manifest 为准，避免前端分类与「全部」列表不一致。
        """
        if bool(app_row.get("is_dedicated")):
            return True
        code = app_row.get("code")
        if not code:
            return False
        manifest = ApplicationService._get_manifest_by_code(str(code))
        if not manifest:
            return False
        return ApplicationService._manifest_is_dedicated(manifest)

    @staticmethod
    async def _persist_is_dedicated(tenant_id: int, code: str, is_dedicated: bool) -> None:
        conn = await get_db_connection()
        try:
            await conn.execute(
                """
                UPDATE core_applications
                SET is_dedicated = $1, updated_at = NOW()
                WHERE tenant_id = $2 AND code = $3 AND deleted_at IS NULL
                """,
                is_dedicated,
                tenant_id,
                code,
            )
        except Exception as e:  # noqa: BLE001 — 列未迁移时列表接口仍可返回
            logger.warning(
                "写入 core_applications.is_dedicated 失败 tenant_id={} code={}（迁移 214）: {}",
                tenant_id,
                code,
                e,
            )
        finally:
            await conn.close()

    @staticmethod
    def _filter_dedicated_for_viewer(
        apps: List[Dict[str, Any]],
        *,
        bound_codes: set,
        globally_bound_codes: set,
    ) -> List[Dict[str, Any]]:
        """定制应用：全局未绑定则全员可见；已有绑定则仅绑定租户可见。"""
        out: List[Dict[str, Any]] = []
        for a in apps:
            if ApplicationService.effective_is_dedicated(a):
                if ApplicationDedicatedBindingService.is_dedicated_visible_to_tenant(
                    str(a.get("code") or ""),
                    tenant_bound_codes=bound_codes,
                    globally_bound_codes=globally_bound_codes,
                ):
                    out.append(a)
            else:
                out.append(a)
        return out

    @staticmethod
    async def _resolve_package_controls(tenant_id: int) -> Dict[str, Any]:
        tenant = await Tenant.get_or_none(id=tenant_id)
        if not tenant:
            return {"allow_pro_apps": False, "allowed_app_codes": []}
        return await PackageService().get_effective_package_config_for_plan(tenant.plan)

    @staticmethod
    async def _is_app_allowed_by_package(tenant_id: int, app_code: str) -> bool:
        controls = await ApplicationService._resolve_package_controls(tenant_id)
        allowed_codes = set(controls.get("allowed_app_codes") or [])
        if not allowed_codes:
            return True
        return str(app_code or "") in allowed_codes

    @staticmethod
    async def _filter_apps_by_package_whitelist(
        tenant_id: int,
        applications: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        controls = await ApplicationService._resolve_package_controls(tenant_id)
        allowed_codes = set(controls.get("allowed_app_codes") or [])
        if not allowed_codes:
            return applications
        return [app for app in applications if str(app.get("code") or "") in allowed_codes]

    @staticmethod
    async def reconcile_is_dedicated_with_manifest(tenant_id: int, applications: List[Dict[str, Any]]) -> None:
        """manifest 标明专用而 DB 未同步时写入 is_dedicated，保证分类与绑定过滤一致。"""
        for app_dict in applications:
            code = app_dict.get("code")
            if not code:
                continue
            manifest = ApplicationService._get_manifest_by_code(str(code))
            if not manifest or not ApplicationService._manifest_is_dedicated(manifest):
                continue
            if bool(app_dict.get("is_dedicated")):
                continue
            await ApplicationService._persist_is_dedicated(tenant_id, str(code), True)
            app_dict["is_dedicated"] = True

    @staticmethod
    async def ensure_application_registered_from_manifest(tenant_id: int, code: str) -> Optional[ApplicationDict]:
        """
        保证指定租户在 core_applications 中存在该 code 的记录（从磁盘 manifest 创建）。

        专用应用仅写入绑定表时，租户侧尚无应用行会导致列表为空；绑定或拉列表时按需补齐。
        """
        code = (code or "").strip()
        if not code or code in _PLACEHOLDER_APP_CODES:
            return None
        existing = await ApplicationService.get_application_by_code(tenant_id, code)
        if existing:
            return existing
        manifest = ApplicationService._get_manifest_by_code(code)
        if not manifest:
            logger.warning(f"专用应用已绑定但找不到 manifest，跳过自动注册: code={code}, tenant_id={tenant_id}")
            return None
        app_data = ApplicationCreate(
            name=manifest.get("name", code),
            code=code,
            description=manifest.get("description"),
            icon=manifest.get("icon"),
            version=manifest.get("version", "1.0.0"),
            route_path=manifest.get("route_path"),
            entry_point=manifest.get("entry_point"),
            menu_config=manifest.get("menu_config"),
            permission_code=manifest.get("permission_code") or f"app:{code}",
            is_system=False,
            is_active=False,
            sort_order=resolve_application_sort_order(code, manifest.get("sort_order")),
        )
        try:
            await ApplicationService.create_application(tenant_id=tenant_id, data=app_data)
        except ValidationError:
            # 并发下可能已被其它请求创建
            return await ApplicationService.get_application_by_code(tenant_id, code)
        ded = ApplicationService._manifest_is_dedicated(manifest)
        await ApplicationService._persist_is_dedicated(tenant_id, code, ded)
        return await ApplicationService.get_application_by_code(tenant_id, code)
    
    @staticmethod
    async def _reconcile_renamed_application_codes(tenant_id: int) -> int:
        """合并 manifest 改编码产生的双份应用：旧 code 行并入新 code 或原地改码。"""
        from core.config.app_code_renames import APPLICATION_CODE_RENAMES

        if not APPLICATION_CODE_RENAMES:
            return 0

        conn = await get_db_connection()
        affected = 0
        try:
            for old_code, new_code in APPLICATION_CODE_RENAMES.items():
                old_row = await conn.fetchrow(
                    """
                    SELECT * FROM core_applications
                    WHERE tenant_id = $1 AND code = $2 AND deleted_at IS NULL
                    ORDER BY id ASC
                    LIMIT 1
                    """,
                    tenant_id,
                    old_code,
                )
                if not old_row:
                    continue

                new_row = await conn.fetchrow(
                    """
                    SELECT * FROM core_applications
                    WHERE tenant_id = $1 AND code = $2 AND deleted_at IS NULL
                    ORDER BY id ASC
                    LIMIT 1
                    """,
                    tenant_id,
                    new_code,
                )

                if new_row:
                    old_installed = bool(old_row.get("is_installed"))
                    new_installed = bool(new_row.get("is_installed"))
                    merged_installed = old_installed or new_installed
                    if old_installed and not new_installed:
                        merged_active = bool(old_row.get("is_active"))
                    elif new_installed:
                        merged_active = bool(new_row.get("is_active"))
                    else:
                        merged_active = bool(new_row.get("is_active"))

                    await conn.execute(
                        """
                        UPDATE core_applications
                        SET
                            is_installed = $3,
                            is_active = $4,
                            entry_point = COALESCE(NULLIF(entry_point, ''), $5),
                            route_path = COALESCE(NULLIF(route_path, ''), $6),
                            updated_at = NOW()
                        WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
                        """,
                        new_row["id"],
                        tenant_id,
                        merged_installed,
                        merged_active,
                        old_row.get("entry_point"),
                        old_row.get("route_path"),
                    )
                    await conn.execute(
                        """
                        UPDATE core_applications
                        SET deleted_at = NOW(), updated_at = NOW()
                        WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
                        """,
                        old_row["id"],
                        tenant_id,
                    )
                else:
                    await conn.execute(
                        """
                        UPDATE core_applications
                        SET
                            code = $3,
                            entry_point = COALESCE($4, entry_point),
                            route_path = COALESCE($5, route_path),
                            updated_at = NOW()
                        WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
                        """,
                        old_row["id"],
                        tenant_id,
                        new_code,
                        f"../apps/{new_code}/index.tsx",
                        f"/apps/{new_code}",
                    )
                affected += 1
        finally:
            await conn.close()
        return affected

    @staticmethod
    async def _reconcile_duplicate_application_rows(tenant_id: int) -> int:
        """软删除同租户下同 code 的重复应用行（保留 id 最小者）。"""
        conn = await get_db_connection()
        try:
            result = await conn.execute(
                """
                UPDATE core_applications AS dup
                SET deleted_at = NOW(), updated_at = NOW()
                WHERE dup.tenant_id = $1
                  AND dup.deleted_at IS NULL
                  AND dup.id NOT IN (
                      SELECT MIN(id)
                      FROM core_applications
                      WHERE tenant_id = $1 AND deleted_at IS NULL
                      GROUP BY code
                  )
                """,
                tenant_id,
            )
            if result.startswith("UPDATE "):
                return int(result.split(" ")[1])
            return 0
        finally:
            await conn.close()

    @staticmethod
    async def create_application(
        tenant_id: int,
        data: ApplicationCreate
    ) -> ApplicationDict:
        """
        创建应用
        
        Args:
            tenant_id: 组织ID
            data: 应用创建数据
            
        Returns:
            Application: 创建的应用对象
            
        Raises:
            ValidationError: 当应用代码已存在时抛出
        """
        conn = await get_db_connection()
        try:
            # 检查应用代码是否已存在
            existing = await conn.fetchval(
                "SELECT id FROM core_applications WHERE tenant_id = $1 AND code = $2 AND deleted_at IS NULL",
                tenant_id, data.code
            )
            if existing:
                raise ValidationError(f"应用代码 {data.code} 已存在")

            # 插入新应用
            app_data = data.model_dump()
            app_data['tenant_id'] = tenant_id
            app_data['uuid'] = str(uuid4())  # 生成UUID
            app_data['created_at'] = now_utc()
            app_data['updated_at'] = now_utc()
            
            # 排除数据库可能不存在的列（兼容未执行迁移 127 的环境）
            for key in ['is_custom_name', 'is_custom_sort']:
                app_data.pop(key, None)
            
            # 将 menu_config 字典转换为 JSON 字符串
            if 'menu_config' in app_data and app_data['menu_config'] is not None:
                if isinstance(app_data['menu_config'], dict):
                    app_data['menu_config'] = json.dumps(app_data['menu_config'], ensure_ascii=False)

            columns = list(app_data.keys())
            placeholders = [f"${i+1}" for i in range(len(columns))]
            values = list(app_data.values())

            query = f"""
                INSERT INTO core_applications ({', '.join(columns)})
                VALUES ({', '.join(placeholders)})
                RETURNING *
            """

            try:
                row = await conn.fetchrow(query, *values)
            except asyncpg.UniqueViolationError:
                existing = await conn.fetchval(
                    "SELECT id FROM core_applications WHERE tenant_id = $1 AND code = $2 AND deleted_at IS NULL",
                    tenant_id,
                    data.code,
                )
                if existing:
                    row = await conn.fetchrow(
                        "SELECT * FROM core_applications WHERE id = $1",
                        existing,
                    )
                else:
                    raise ValidationError(f"应用代码 {data.code} 已存在")
            return dict(row)

        finally:
            await conn.close()
    
    @staticmethod
    async def get_application_by_uuid(
        tenant_id: int,
        uuid: str
    ) -> ApplicationDict:
        """
        根据UUID获取应用
        
        Args:
            tenant_id: 组织ID
            uuid: 应用UUID
            
        Returns:
            ApplicationDict: 应用字典对象
            
        Raises:
            NotFoundError: 当应用不存在时抛出
        """
        conn = await get_db_connection()
        try:
            query = """
                SELECT * FROM core_applications
                WHERE tenant_id = $1 AND uuid = $2 AND deleted_at IS NULL
                LIMIT 1
            """
            row = await conn.fetchrow(query, tenant_id, uuid)
            
            if not row:
                raise NotFoundError("应用不存在")
            
            app_dict = ApplicationService._normalize_application_row(dict(row))
            
            return app_dict
        finally:
            await conn.close()

    @staticmethod
    async def get_application_by_uuid_optional(
        tenant_id: int,
        uuid: str
    ) -> Optional[ApplicationDict]:
        """
        根据UUID获取应用（不存在时返回 None，不抛异常）
        """
        try:
            return await ApplicationService.get_application_by_uuid(tenant_id, uuid)
        except NotFoundError:
            return None

    @staticmethod
    async def get_application_by_code(
        tenant_id: int,
        code: str
    ) -> Optional[ApplicationDict]:
        """
        根据代码获取应用
        
        Args:
            tenant_id: 组织ID
            code: 应用代码
            
        Returns:
            ApplicationDict: 应用字典对象，如果不存在返回 None
        """
        conn = await get_db_connection()
        try:
            query = """
                SELECT * FROM core_applications
                WHERE tenant_id = $1 AND code = $2 AND deleted_at IS NULL
                LIMIT 1
            """
            row = await conn.fetchrow(query, tenant_id, code)
            
            if not row:
                return None
            
            app_dict = ApplicationService._normalize_application_row(dict(row))
            
            return app_dict
        finally:
            await conn.close()
    
    @staticmethod
    async def list_applications(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        is_installed: Optional[bool] = None,
        is_active: Optional[bool] = None,
    ) -> List[Dict[str, Any]]:
        """
        获取应用列表

        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            is_installed: 是否已安装（可选）
            is_active: 是否启用（可选）

        Returns:
            List[Dict[str, Any]]: 应用列表
        """
        conn = await get_db_connection()
        try:
            # 构建查询条件
            conditions = ["tenant_id = $1", "deleted_at IS NULL"]
            params = [tenant_id]
            param_index = 2

            if is_installed is not None:
                conditions.append(f"is_installed = ${param_index}")
                params.append(is_installed)
                param_index += 1

            if is_active is not None:
                conditions.append(f"is_active = ${param_index}")
                params.append(is_active)
                param_index += 1

            # 精简：隐藏并下线占位应用
            conditions.append(f"code <> ALL(${param_index}::text[])")
            params.append(list(_PLACEHOLDER_APP_CODES))
            param_index += 1

            where_clause = " AND ".join(conditions)

            query = f"""
                SELECT * FROM core_applications
                WHERE {where_clause}
                ORDER BY sort_order, id
                OFFSET ${param_index} LIMIT ${param_index + 1}
            """
            params.extend([skip, limit])

            rows = await conn.fetch(query, *params)

            # 转换结果为字典列表
            applications = []
            for row in rows:
                applications.append(ApplicationService._normalize_application_row(dict(row)))

            bound = await ApplicationDedicatedBindingService.fetch_bound_codes_for_tenant(tenant_id)
            globally_bound = await ApplicationDedicatedBindingService.fetch_globally_bound_app_codes()
            # 已绑定或全局未绑定的定制应用，若尚未注册 core_applications 行则从 manifest 补齐
            if is_installed is None and is_active is None:
                present_codes = {str(a.get("code") or "") for a in applications}
                manifest_codes_to_ensure: set[str] = set(bound)
                for manifest in ApplicationService._scan_plugin_manifests():
                    code = str(manifest.get("code") or "").strip()
                    if not code or not ApplicationService._manifest_is_dedicated(manifest):
                        continue
                    if ApplicationDedicatedBindingService.is_dedicated_visible_to_tenant(
                        code,
                        tenant_bound_codes=bound,
                        globally_bound_codes=globally_bound,
                    ):
                        manifest_codes_to_ensure.add(code)
                for app_code in manifest_codes_to_ensure:
                    if app_code not in present_codes:
                        ensured = await ApplicationService.ensure_application_registered_from_manifest(
                            tenant_id, app_code
                        )
                        if ensured:
                            applications.append(ensured)
                            present_codes.add(app_code)
                applications.sort(key=lambda a: (a.get("sort_order") or 999, a.get("id") or 0))

            await ApplicationService.reconcile_is_dedicated_with_manifest(tenant_id, applications)
            applications = await ApplicationService._filter_apps_by_package_whitelist(tenant_id, applications)

            return ApplicationService._filter_dedicated_for_viewer(
                applications,
                bound_codes=bound,
                globally_bound_codes=globally_bound,
            )

        finally:
            await conn.close()
    
    @staticmethod
    async def update_application(
        tenant_id: int,
        uuid: str,
        data: ApplicationUpdate,
        *,
        sync_derived_resources: bool = True,
        skip_permission_sync: bool = False,
    ) -> ApplicationDict:
        """
        更新应用
        
        Args:
            tenant_id: 组织ID
            uuid: 应用UUID
            data: 应用更新数据
            
        Returns:
            Application: 更新后的应用对象
            
        Raises:
            NotFoundError: 当应用不存在时抛出
        """
        conn = await get_db_connection()
        try:
            # 获取当前应用信息
            application = await ApplicationService.get_application_by_uuid(tenant_id, uuid)

            # 记录旧的菜单配置和应用状态
            old_menu_config = application.get('menu_config')
            old_is_active = application.get('is_active', False)

            update_data = data.model_dump(exclude_unset=True)

            # 构建更新查询
            if update_data:
                set_clauses = []
                params = [tenant_id, uuid]
                param_index = 3

                for key, value in update_data.items():
                    if key == 'menu_config' and value is not None:
                        # 特殊处理menu_config字段，将JSON对象转换为jsonb
                        if isinstance(value, dict):
                            set_clauses.append(f"{key} = ${param_index}::jsonb")
                            params.append(json.dumps(value, ensure_ascii=False))
                        else:
                            set_clauses.append(f"{key} = ${param_index}")
                            params.append(value)
                    else:
                        set_clauses.append(f"{key} = ${param_index}")
                        params.append(value)
                    param_index += 1

                query = f"""
                    UPDATE core_applications
                    SET {', '.join(set_clauses)}, updated_at = NOW()
                    WHERE tenant_id = $1 AND uuid = $2 AND deleted_at IS NULL
                """

                result = await conn.execute(query, *params)

                if result != "UPDATE 1":
                    raise NotFoundError(f"应用 {uuid} 更新失败")

            # 如果名称变更、菜单配置变更或应用状态变更，自动同步菜单（批量扫描路径应关闭以避免长时间阻塞）
            name_changed = 'name' in update_data
            menu_config_changed = 'menu_config' in update_data
            is_active_changed = 'is_active' in update_data

            if sync_derived_resources and (name_changed or menu_config_changed or is_active_changed):
                from core.services.system.menu_service import MenuService
                from core.models.menu import Menu

                # 重新获取更新后的应用信息
                updated_app = await ApplicationService.get_application_by_uuid(tenant_id, uuid)

                # 如果名称变更且未提供新的菜单配置，尝试更新根菜单名称
                if name_changed and not menu_config_changed:
                    # 查找该应用的根菜单（parent_id 为空）
                    root_menu = await Menu.filter(
                        tenant_id=tenant_id,
                        application_uuid=uuid,
                        parent_id__isnull=True,
                        deleted_at__isnull=True
                    ).first()
                    
                    if root_menu:
                        root_menu.name = updated_app['name']
                        await root_menu.save()
                        # 清除缓存
                        await MenuService._clear_menu_cache(tenant_id)

                # 如果菜单配置变更，重新同步所有菜单
                if menu_config_changed and updated_app.get('menu_config'):
                    # 同步菜单时，如果应用有自定义名称，同步逻辑应该优先考虑它吗？
                    # 这里的 sync_menus_from_application_config 内部目前使用的是 menu_config 里的 title
                    await MenuService.sync_menus_from_application_config(
                        tenant_id=tenant_id,
                        application_uuid=uuid,
                        menu_config=updated_app['menu_config'],
                        is_active=updated_app.get('is_active', True),
                        skip_permission_sync=skip_permission_sync,
                    )
                elif is_active_changed:
                    # 如果只是应用状态变更，只更新菜单的启用状态
                    await Menu.filter(
                        tenant_id=tenant_id,
                        application_uuid=uuid,
                        deleted_at__isnull=True
                    ).update(is_active=updated_app.get('is_active', True))
                    await MenuService._clear_menu_cache(tenant_id)

            # 返回更新后的应用信息
            return await ApplicationService.get_application_by_uuid(tenant_id, uuid)

        finally:
            await conn.close()
    
    @staticmethod
    async def delete_application(
        tenant_id: int,
        uuid: str
    ) -> None:
        """
        删除应用（软删除）
        
        Args:
            tenant_id: 组织ID
            uuid: 应用UUID
            
        Raises:
            NotFoundError: 当应用不存在时抛出
            ValidationError: 当应用是系统应用时抛出
        """
        application = await ApplicationService.get_application_by_uuid(tenant_id, uuid)
        
        if application.is_system:
            raise ValidationError("系统应用不可删除")
        
        # 软删除
        application.deleted_at = now_utc()
        await application.save()
    
    @staticmethod
    async def install_application(
        tenant_id: int,
        uuid: str,
        *,
        sync_menus_after_install: bool = True,
    ) -> ApplicationDict:
        """
        安装应用

        安装后默认标记为未启用（is_active=FALSE），须调用启用接口才会变为启用状态，
        以便 PRO 应用必须走 enable_application 中的 License 校验。

        Args:
            tenant_id: 组织ID
            uuid: 应用UUID
            
        Returns:
            ApplicationDict: 安装后的应用对象
            
        Raises:
            NotFoundError: 当应用不存在时抛出
            ValidationError: 当应用已安装时抛出
        """
        application = await ApplicationService.get_application_by_uuid(tenant_id, uuid)
        
        if application.get('is_installed'):
            raise ValidationError("应用已安装")
        
        # 更新数据库（安装后不自动启用，防止绕过 PRO 等启用门禁）
        conn = await get_db_connection()
        try:
            update_query = """
                UPDATE core_applications
                SET is_installed = TRUE, is_active = FALSE, updated_at = NOW()
                WHERE tenant_id = $1 AND uuid = $2 AND deleted_at IS NULL
            """
            await conn.execute(update_query, tenant_id, uuid)
        finally:
            await conn.close()
        
        # 更新本地字典
        application['is_installed'] = True
        application['is_active'] = False
        
        # 自动同步应用菜单配置到菜单管理（批量扫描时可关闭，改由「一键同步菜单」或清单同步接口写入）
        app_code = str(application.get("code") or "")
        if is_industry_module_app_code(app_code):
            from core.services.application.industry_pack_menu_service import IndustryPackMenuService

            await IndustryPackMenuService.sync_after_industry_module_lifecycle(
                tenant_id, activate_shell=False
            )
        elif sync_menus_after_install and application.get("menu_config"):
            from core.services.system.menu_service import MenuService

            await MenuService.sync_menus_from_application_config(
                tenant_id=tenant_id,
                application_uuid=str(application["uuid"]),
                menu_config=application["menu_config"],
                is_active=application.get("is_active", False),
            )

        return application
    
    @staticmethod
    async def uninstall_application(
        tenant_id: int,
        uuid: str
    ) -> ApplicationDict:
        """
        卸载应用
        
        Args:
            tenant_id: 组织ID
            uuid: 应用UUID
            
        Returns:
            Application: 卸载后的应用对象
            
        Raises:
            NotFoundError: 当应用不存在时抛出
            ValidationError: 当应用是系统应用时抛出
        """
        application = await ApplicationService.get_application_by_uuid(tenant_id, uuid)

        if application.get('is_system'):
            raise ValidationError("系统应用不可卸载")

        # ⚠️ application 是 dict（来自 raw SQL），须用 raw SQL 直接更新 is_installed
        conn = await get_db_connection()
        try:
            await conn.execute(
                """
                UPDATE core_applications
                SET is_installed = FALSE, is_active = FALSE, updated_at = NOW()
                WHERE tenant_id = $1 AND uuid = $2 AND deleted_at IS NULL
                """,
                tenant_id,
                uuid,
            )
        finally:
            await conn.close()
        application['is_installed'] = False
        application['is_active'] = False

        from core.services.application.enabled_apps import clear_enabled_apps_cache

        clear_enabled_apps_cache()

        app_code = str(application.get("code") or "")
        from core.services.system.menu_takeover_service import MenuTakeoverService

        await MenuTakeoverService.sync_for_application_lifecycle(
            tenant_id, app_code, enabled=False
        )

        if is_industry_module_app_code(app_code):
            from core.services.application.industry_pack_menu_service import IndustryPackMenuService
            from core.services.application.industry_extension_runtime_service import (
                IndustryExtensionRuntimeService,
            )

            await IndustryExtensionRuntimeService.on_module_deactivated(tenant_id, app_code)
            await IndustryPackMenuService.sync_after_industry_module_lifecycle(
                tenant_id, activate_shell=False
            )
            return application

        # 自动删除关联菜单（软删除）
        from core.models.menu import Menu
        await Menu.filter(
            tenant_id=tenant_id,
            application_uuid=str(uuid),
            deleted_at__isnull=True
        ).update(deleted_at=now_utc())

        # 清除菜单缓存，保证侧边栏/菜单管理页立即反映变化
        from core.services.system.menu_service import MenuService
        await MenuService._clear_menu_cache(tenant_id)

        return application
    
    @staticmethod
    async def _ensure_required_apps_active(
        tenant_id: int,
        app_code: str,
        *,
        _visiting: Optional[Set[str]] = None,
    ) -> None:
        """按 manifest requires_apps 递归安装并启用依赖应用（启用定制包前拉起基础应用）。"""
        from core.services.application.enabled_apps import read_requires_apps_from_manifest

        visiting = _visiting or set()
        code = str(app_code or "").strip()
        if not code or code in visiting:
            return
        visiting.add(code)

        for req_code in read_requires_apps_from_manifest(code):
            req_code = str(req_code or "").strip()
            if not req_code or req_code in visiting:
                continue
            apps = await ApplicationService.list_applications(
                tenant_id=tenant_id,
                skip=0,
                limit=500,
            )
            req_app = next((a for a in apps if str(a.get("code") or "") == req_code), None)
            if not req_app:
                logger.warning(
                    "requires_apps 依赖 {} 未在租户 {} 应用清单中找到，跳过自动启用",
                    req_code,
                    tenant_id,
                )
                continue
            req_uuid = str(req_app.get("uuid") or "")
            if not req_app.get("is_installed"):
                await ApplicationService.install_application(
                    tenant_id,
                    req_uuid,
                    sync_menus_after_install=False,
                )
                req_app = await ApplicationService.get_application_by_uuid(tenant_id, req_uuid)
            if not req_app.get("is_active"):
                await ApplicationService._ensure_required_apps_active(
                    tenant_id, req_code, _visiting=visiting
                )
                await ApplicationService.enable_application(tenant_id, req_uuid)

    @staticmethod
    async def enable_application(
        tenant_id: int,
        uuid: str
    ) -> ApplicationDict:
        """
        启用应用
        
        Args:
            tenant_id: 组织ID
            uuid: 应用UUID
            
        Returns:
            ApplicationDict: 启用后的应用对象
            
        Raises:
            NotFoundError: 当应用不存在时抛出
        """
        application = await ApplicationService.get_application_by_uuid(tenant_id, uuid)
        app_code = str(application.get("code") or "")
        if app_code and not await ApplicationService._can_enable_or_install_app(tenant_id=tenant_id, app_code=app_code):
            controls = await ApplicationService._resolve_package_controls(tenant_id)
            manifest = ApplicationService._get_manifest_by_code(app_code)
            manifest_is_pro = bool(manifest.get("is_pro", False)) if manifest else False
            if not await ApplicationService._is_app_allowed_by_package(tenant_id, app_code):
                raise ValidationError("当前套餐未包含该应用，无法启用。")
            if requires_pro_license_for_app(app_code, is_pro=manifest_is_pro) and not bool(
                controls.get("allow_pro_apps")
            ):
                raise ValidationError("当前套餐不支持 PRO 应用，无法启用该应用。")
            raise ValidationError("PRO 应用未激活 License Key，不允许启用。")

        app_code = str(application.get("code") or "")
        if app_code:
            await ApplicationService._ensure_required_apps_active(tenant_id, app_code)
        
        # 更新数据库
        conn = await get_db_connection()
        try:
            update_query = """
                UPDATE core_applications
                SET is_active = TRUE, updated_at = NOW()
                WHERE tenant_id = $1 AND uuid = $2 AND deleted_at IS NULL
            """
            await conn.execute(update_query, tenant_id, uuid)
        finally:
            await conn.close()
        
        # 更新本地字典
        application['is_active'] = True

        from core.services.application.enabled_apps import clear_enabled_apps_cache

        clear_enabled_apps_cache()
        
        if is_industry_module_app_code(app_code):
            from core.services.application.industry_pack_menu_service import IndustryPackMenuService
            from core.services.application.industry_extension_runtime_service import (
                IndustryExtensionRuntimeService,
            )

            await IndustryPackMenuService.sync_after_industry_module_lifecycle(
                tenant_id,
                activate_shell=True,
                grant_module_code=app_code,
            )
            await IndustryExtensionRuntimeService.on_module_activated(tenant_id, app_code)
        elif is_extension_provider_app_code(app_code):
            from core.services.application.industry_extension_runtime_service import (
                IndustryExtensionRuntimeService,
            )

            await IndustryExtensionRuntimeService.on_module_activated(tenant_id, app_code)
        elif is_industry_pack_shell_code(app_code):
            from core.services.application.industry_pack_menu_service import IndustryPackMenuService

            await IndustryPackMenuService.rebuild_pack_menus(tenant_id)
        elif app_code == "kuaizhizao":
            from core.services.scheduling.scheduled_job_preset_service import (
                ScheduledJobPresetService,
            )

            await ScheduledJobPresetService.sync_presets_for_tenant(tenant_id)
        if application.get('is_installed') and application.get('menu_config') and not is_industry_module_app_code(app_code) and not is_industry_pack_shell_code(app_code):
            from core.services.system.menu_service import MenuService
            # 重新同步菜单，确保菜单状态与应用状态一致
            await MenuService.sync_menus_from_application_config(
                tenant_id=tenant_id,
                application_uuid=str(uuid),
                menu_config=application['menu_config'],
                is_active=True,
                preserve_existing_is_active=False,
            )
        else:
            # 如果应用没有菜单配置，直接更新现有菜单状态
            conn = await get_db_connection()
            try:
                menu_update_query = """
                    UPDATE core_menus
                    SET is_active = TRUE, updated_at = NOW()
                    WHERE tenant_id = $1 AND application_uuid = $2 AND deleted_at IS NULL
                """
                await conn.execute(menu_update_query, tenant_id, str(uuid))
            finally:
                await conn.close()

        from core.services.system.menu_takeover_service import MenuTakeoverService
        await MenuTakeoverService.sync_for_application_lifecycle(
            tenant_id, app_code, enabled=True
        )

        if app_code:
            from core.services.data.data_dictionary_service import DataDictionaryService
            from core.config.audit_registry import node_keys_for_app
            from core.services.approval.audit_binding_service import AuditBindingService
            from loguru import logger

            try:
                await DataDictionaryService.initialize_system_dictionaries_for_app_code(
                    tenant_id, app_code
                )
            except Exception as e:
                logger.warning(
                    "应用 {} 启用后同步系统字典失败 tenant_id={}: {}",
                    app_code,
                    tenant_id,
                    e,
                )

            audit_keys = set(node_keys_for_app(app_code))
            if audit_keys:
                try:
                    await AuditBindingService.ensure_binding_rows(
                        tenant_id,
                        only_node_keys=audit_keys,
                    )
                except Exception as e:
                    logger.warning(
                        "应用 {} 启用后初始化审核绑定行失败 tenant_id={}: {}",
                        app_code,
                        tenant_id,
                        e,
                    )

        # 导航树缓存命中直出；无 menu_config 的启用路径不会走 sync，须在此失效
        from core.services.system.menu_service import MenuService
        await MenuService._clear_menu_cache(tenant_id)

        return application
    
    @staticmethod
    async def disable_application(
        tenant_id: int,
        uuid: str
    ) -> ApplicationDict:
        """
        禁用应用
        
        Args:
            tenant_id: 组织ID
            uuid: 应用UUID
            
        Returns:
            ApplicationDict: 禁用后的应用对象
            
        Raises:
            NotFoundError: 当应用不存在时抛出
        """
        application = await ApplicationService.get_application_by_uuid(tenant_id, uuid)
        
        app_code = str(application.get("code") or "")
        from core.services.application.enabled_apps import list_active_dependents

        dependents = await list_active_dependents(tenant_id, app_code)
        if dependents:
            names = "、".join(name for _, name in dependents)
            raise ValidationError(
                f"应用「{application.get('name') or app_code}」仍被以下已启用应用依赖：{names}。"
                f"请先禁用上述应用后再停用本应用。"
            )

        # 更新数据库
        conn = await get_db_connection()
        try:
            update_query = """
                UPDATE core_applications
                SET is_active = FALSE, updated_at = NOW()
                WHERE tenant_id = $1 AND uuid = $2 AND deleted_at IS NULL
            """
            await conn.execute(update_query, tenant_id, uuid)
        finally:
            await conn.close()
        
        # 更新本地字典
        application['is_active'] = False

        from core.services.application.enabled_apps import clear_enabled_apps_cache

        clear_enabled_apps_cache()

        from core.services.system.menu_service import MenuService
        from core.services.system.menu_takeover_service import MenuTakeoverService

        if is_industry_module_app_code(app_code):
            from core.services.application.industry_pack_menu_service import IndustryPackMenuService
            from core.services.application.industry_extension_runtime_service import (
                IndustryExtensionRuntimeService,
            )

            await IndustryExtensionRuntimeService.on_module_deactivated(tenant_id, app_code)
            await IndustryPackMenuService.sync_after_industry_module_lifecycle(
                tenant_id, activate_shell=False
            )
        elif is_extension_provider_app_code(app_code):
            from core.services.application.industry_extension_runtime_service import (
                IndustryExtensionRuntimeService,
            )

            await IndustryExtensionRuntimeService.on_module_deactivated(tenant_id, app_code)
        elif is_industry_pack_shell_code(app_code):
            from core.services.application.industry_pack_menu_service import IndustryPackMenuService

            await IndustryPackMenuService.rebuild_pack_menus(tenant_id)
        else:
            conn = await get_db_connection()
            try:
                menu_update_query = """
                    UPDATE core_menus
                    SET is_active = FALSE, updated_at = NOW()
                    WHERE tenant_id = $1 AND application_uuid = $2 AND deleted_at IS NULL
                """
                await conn.execute(menu_update_query, tenant_id, str(uuid))
            finally:
                await conn.close()

        await MenuTakeoverService.sync_for_application_lifecycle(
            tenant_id, app_code, enabled=False
        )
        # 导航树缓存命中直出；禁用后必须失效，否则侧栏仍展示已禁用应用菜单。
        # 接管同步仅对 MENU_TAKEOVER_RULES 或 hide_required_app_menus 应用清缓存，快报表/快数采/KU-AI 等不会走到。
        await MenuService._clear_menu_cache(tenant_id)

        return application
    
    @staticmethod
    async def get_installed_applications(
        tenant_id: int,
        is_active: Optional[bool] = None,
    ) -> List[ApplicationDict]:
        """
        获取已安装的应用列表

        注意：会自动过滤掉快速上线模式中停用的应用。

        Args:
            tenant_id: 组织ID
            is_active: 是否启用（可选）

        Returns:
            List[ApplicationDict]: 已安装的应用列表
        """
        # ⚠️ 关键修复：先创建数据库连接
        conn = await get_db_connection()
        try:
            excluded_codes = list(_PLACEHOLDER_APP_CODES)
            # 动态获取停用应用列表：查询数据库中 is_active=False 的应用
            disabled_apps_result = await conn.fetch("""
                SELECT code FROM core_applications
                WHERE tenant_id = $1
                  AND is_installed = TRUE
                  AND is_active = FALSE
                  AND deleted_at IS NULL
            """, tenant_id)

            disabled_apps = {row['code'] for row in disabled_apps_result}

            # 构建基础 SQL 查询
            # ⚠️ 关键修复：处理 disabled_apps 为空的情况
            if disabled_apps:
                base_sql = """
                    SELECT * FROM core_applications
                    WHERE tenant_id = $1
                      AND is_installed = TRUE
                      AND deleted_at IS NULL
                      AND code NOT IN ({})
                      AND code <> ALL(${}::text[])
                """.format(','.join(['${}'.format(i + 2) for i in range(len(disabled_apps))]), len(disabled_apps) + 2)
                params = [tenant_id] + list(disabled_apps) + [excluded_codes]
            else:
                base_sql = """
                    SELECT * FROM core_applications
                    WHERE tenant_id = $1
                      AND is_installed = TRUE
                      AND deleted_at IS NULL
                      AND code <> ALL($2::text[])
                """
                params = [tenant_id, excluded_codes]

            # 如果指定了 is_active，添加过滤条件
            if is_active is not None:
                base_sql = base_sql.rstrip() + f"\n                  AND is_active = ${len(params) + 1}"
                params.append(is_active)

            # 添加排序
            final_sql = base_sql + "\n                ORDER BY sort_order, id"

            # 执行查询
            rows = await conn.fetch(final_sql, *params)

            # 转换为字典列表
            result = []
            for row in rows:
                result.append(dict(row))

            bound = await ApplicationDedicatedBindingService.fetch_bound_codes_for_tenant(tenant_id)
            globally_bound = await ApplicationDedicatedBindingService.fetch_globally_bound_app_codes()
            await ApplicationService.reconcile_is_dedicated_with_manifest(tenant_id, result)
            result = await ApplicationService._filter_apps_by_package_whitelist(tenant_id, result)
            result = ApplicationService._filter_dedicated_for_viewer(
                result,
                bound_codes=bound,
                globally_bound_codes=globally_bound,
            )
            # 定制壳菜单深链到 requires_apps（如 haoligo→kuaioa）：启用列表必须含依赖应用，
            # 否则前端 AppRoutes 不注册 /apps/kuaioa/*，人事等内容区纯白。
            if is_active is True:
                result = await ApplicationService._ensure_requires_apps_in_installed_list(
                    tenant_id, result
                )
            return result
        finally:
            await conn.close()
    
    @staticmethod
    async def _ensure_requires_apps_in_installed_list(
        tenant_id: int,
        applications: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        已启用应用列表补齐 requires_apps 闭包。

        定制壳（如 haoligo）菜单可深链到依赖应用（kuaioa）路径；若依赖应用未在
        is_active=true 列表中，前端不会注册对应 /apps/* 路由，内容区纯白。
        此处按 manifest 拉起并启用缺失依赖，再并入返回列表。
        """
        from core.services.application.enabled_apps import expand_requires_apps

        if not applications:
            return applications

        present = {str(a.get("code") or "") for a in applications if a.get("code")}
        needed = expand_requires_apps(set(present))
        missing = sorted(code for code in needed if code and code not in present)
        if not missing:
            return applications

        for code in missing:
            try:
                row = await ApplicationService.get_application_by_code(tenant_id, code)
                if not row:
                    # 清单中无记录时从 manifest 注册（仍须再安装/启用）
                    row = await ApplicationService.ensure_application_registered_from_manifest(
                        tenant_id, code
                    )
                if not row:
                    logger.warning(
                        "requires_apps 依赖 {} 未在租户 {} 应用清单中找到，跳过补齐",
                        code,
                        tenant_id,
                    )
                    continue
                uuid = str(row.get("uuid") or "")
                if not uuid:
                    continue
                if not row.get("is_installed"):
                    await ApplicationService.install_application(
                        tenant_id, uuid, sync_menus_after_install=False
                    )
                if not row.get("is_active"):
                    # enable 会递归 requires，并写入 is_active
                    row = await ApplicationService.enable_application(tenant_id, uuid)
                else:
                    row = await ApplicationService.get_application_by_code(tenant_id, code)
                if row and row.get("is_active"):
                    code_now = str(row.get("code") or "")
                    if code_now and code_now not in present:
                        applications.append(row)
                        present.add(code_now)
            except Exception as e:  # noqa: BLE001 — 列表接口不可因单个依赖失败而整体 500
                logger.warning(
                    "补齐 requires_apps 失败 tenant_id={} code={}: {}",
                    tenant_id,
                    code,
                    e,
                )

        return applications

    @staticmethod
    async def count_applications(deleted_at_is_null: bool = True) -> int:
        """
        统计应用数量（使用 raw SQL，避免 Tortoise 模型列与数据库不一致）
        """
        conn = await get_db_connection()
        try:
            if deleted_at_is_null:
                row = await conn.fetchrow(
                    "SELECT COUNT(*) FROM core_applications WHERE deleted_at IS NULL"
                )
            else:
                row = await conn.fetchrow("SELECT COUNT(*) FROM core_applications")
            return row[0] or 0
        finally:
            await conn.close()

    @staticmethod
    async def get_applications_uuid_sort_order(tenant_id: int) -> List[Dict[str, Any]]:
        """
        获取应用的 uuid 与 sort_order（用于菜单排序，使用 raw SQL 避免 Tortoise 模型列与数据库不一致）
        """
        conn = await get_db_connection()
        try:
            rows = await conn.fetch(
                """
                SELECT uuid, sort_order FROM core_applications
                WHERE tenant_id = $1 AND deleted_at IS NULL
                ORDER BY sort_order, id
                """,
                tenant_id,
            )
            return [{"uuid": str(r["uuid"]), "sort_order": r["sort_order"] or 0} for r in rows]
        finally:
            await conn.close()

    @staticmethod
    def _get_plugins_directory() -> Path:
        """
        获取应用 manifest 目录（后端为单一来源，生产环境无需部署前端 src）
        
        优先使用环境变量 APPS_MANIFEST_DIR；否则扫描 riveredge-backend/src/apps
        """
        env_dir = os.getenv("APPS_MANIFEST_DIR")
        if env_dir and os.path.isdir(env_dir):
            return Path(env_dir)
        current_file = Path(__file__).resolve()
        # riveredge-backend/src/core/services/application/ -> ... -> riveredge-backend/
        backend_root = current_file.parent.parent.parent.parent.parent  # riveredge-backend/
        # 应用 manifest 以后端 src/apps 为单一来源（后端部署时必含此目录）
        plugins_dir = backend_root / "src" / "apps"
        return plugins_dir
    
    @staticmethod
    def _scan_plugin_manifests() -> List[Dict[str, Any]]:
        """
        扫描插件目录，读取所有插件的 manifest.json 文件
        
        Returns:
            List[Dict[str, Any]]: 插件清单列表，每个元素包含 manifest.json 的内容和插件目录路径
        """
        plugins_dir = ApplicationService._get_plugins_directory()
        plugins = []
        
        if not plugins_dir.exists():
            return plugins
        
        # 遍历 src/apps 目录下的所有子目录
        for plugin_dir in plugins_dir.iterdir():
            if not plugin_dir.is_dir():
                continue
            
            # 查找 manifest.json 文件
            manifest_file = plugin_dir / "manifest.json"
            if not manifest_file.exists():
                continue
            
            try:
                # 读取 manifest.json
                with open(manifest_file, 'r', encoding='utf-8') as f:
                    manifest_data = json.load(f)
                
                # 添加插件目录路径信息
                manifest_data['_plugin_dir'] = str(plugin_dir)
                plugins.append(manifest_data)
            except (json.JSONDecodeError, IOError) as e:
                # 忽略无法读取的 manifest.json
                logger.warning(f"警告: 无法读取插件 {plugin_dir.name} 的 manifest.json: {e}")
                continue
        
        return plugins
    
    @staticmethod
    def _get_manifest_by_code(code: str) -> Optional[Dict[str, Any]]:
        """
        根据应用 code 读取 manifest.json，用于获取 is_pro 等字段。
        
        Args:
            code: 应用代码
            
        Returns:
            manifest 字典，不存在则返回 None
        """
        plugins_dir = ApplicationService._get_plugins_directory()
        # 支持 code 与目录名不一致（如 master-data / master_data）
        for plugin_dir in plugins_dir.iterdir():
            if not plugin_dir.is_dir():
                continue
            manifest_file = plugin_dir / "manifest.json"
            if not manifest_file.exists():
                continue
            try:
                with open(manifest_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                if data.get('code') == code:
                    return data
            except (json.JSONDecodeError, IOError):
                continue
        return None

    @staticmethod
    def resolve_market_category_for_code(code: str) -> Optional[str]:
        """应用中心分类：优先 manifest market_category，行业目录 code 兜底为 industry。"""
        manifest = ApplicationService._get_manifest_by_code(code)
        if manifest:
            category = str(manifest.get("market_category") or "").strip().lower()
            if category:
                return category
        from core.config.industry_app_catalog import is_industry_app_code

        if is_industry_app_code(code):
            return "industry"
        return None

    @staticmethod
    def _resolve_manifest_path(app_code: str) -> Optional[Path]:
        """按应用 code 解析 manifest.json 路径（支持 code 与目录名不一致）。"""
        plugins_dir = ApplicationService._get_plugins_directory()
        for dir_name in (app_code, app_code.replace("-", "_")):
            candidate = plugins_dir / dir_name / "manifest.json"
            if candidate.exists():
                return candidate
        return None

    @staticmethod
    def collect_manifest_menu_paths(menu_config: Any) -> Set[str]:
        """从 manifest menu_config 收集全部叶子路由 path（侧栏可见性比对用）。"""
        paths: Set[str] = set()

        def walk(node: Dict[str, Any]) -> None:
            path = node.get("path")
            if path and str(path).strip():
                paths.add(str(path).strip())
            for child in node.get("children") or []:
                if isinstance(child, dict):
                    walk(child)

        if isinstance(menu_config, dict):
            walk(menu_config)
        elif isinstance(menu_config, list):
            for item in menu_config:
                if isinstance(item, dict):
                    walk(item)
        return paths

    @staticmethod
    def _is_orphaned_manifest_menu_row(
        *,
        name: Optional[str],
        path: Optional[str],
        parent_id: Optional[int],
        application_uuid: Optional[str],
        app_code: str,
    ) -> bool:
        """
        应用 manifest 菜单被误挂到根级（parent_id 为空）时视为待同步。

        路径可能已在 core_menus，但侧栏层级错乱（如「绩效管理」跳出快制造）。
        """
        from core.services.system.menu_service import MenuService

        if not application_uuid:
            return False
        if parent_id is not None:
            return False
        app_root_path = f"/apps/{str(app_code).strip()}"
        normalized_path = str(path or "").strip()
        if normalized_path == app_root_path:
            return False
        if MenuService._is_app_root_menu_path(path):
            return False
        return MenuService._is_synced_i18n_menu_name(name)

    @staticmethod
    async def _application_menu_hierarchy_stale(
        tenant_id: int,
        application_uuid: str,
        app_code: str,
    ) -> bool:
        """manifest 同步菜单是否存在 parent_id 为空的孤儿分组/页面。"""
        from core.models.menu import Menu

        rows = await Menu.filter(
            tenant_id=tenant_id,
            application_uuid=str(application_uuid),
            deleted_at__isnull=True,
        )
        for menu in rows:
            if ApplicationService._is_orphaned_manifest_menu_row(
                name=menu.name,
                path=menu.path,
                parent_id=menu.parent_id,
                application_uuid=menu.application_uuid,
                app_code=app_code,
            ):
                return True
        return False

    @staticmethod
    async def _application_menu_paths_missing(
        tenant_id: int,
        application_uuid: str,
        manifest_menu_config: Any,
    ) -> bool:
        """manifest 声明的路由是否尚未写入 core_menus（清单已新、侧栏仍旧时也为 true）。"""
        from core.models.menu import Menu

        expected = ApplicationService.collect_manifest_menu_paths(manifest_menu_config)
        if not expected:
            return False
        rows = await Menu.filter(
            tenant_id=tenant_id,
            application_uuid=str(application_uuid),
            deleted_at__isnull=True,
        ).values_list("path", flat=True)
        actual = {str(path).strip() for path in rows if path and str(path).strip()}
        return bool(expected - actual)

    @staticmethod
    def stable_menu_config_digest(menu_config: Any) -> str:
        """菜单结构稳定摘要，用于比对 manifest 与库内 menu_config 是否一致。"""
        normalized = ApplicationService._normalize_menu_config_field(menu_config)
        if not normalized:
            return "empty"
        raw = json.dumps(normalized, sort_keys=True, ensure_ascii=False, default=str)
        return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]

    @staticmethod
    async def get_menu_sync_status(tenant_id: int) -> Dict[str, Any]:
        """
        检测已启用应用的库内 menu_config 是否与当前部署 manifest 一致。

        供租户管理员登录后提示「需要同步菜单」；仅读比对，不写库。
        """
        from core.services.system.menu_service import MenuService

        manifest_by_code = {
            str(plugin.get("code") or "").strip(): plugin
            for plugin in ApplicationService._scan_plugin_manifests()
            if plugin.get("code")
        }
        apps = await ApplicationService.list_applications(
            tenant_id=tenant_id,
            skip=0,
            limit=500,
            is_installed=True,
            is_active=True,
        )
        stale_app_codes: List[str] = []
        for app in apps:
            code = str(app.get("code") or "").strip()
            if not code:
                continue
            if is_industry_pack_shell_code(code):
                continue
            manifest = manifest_by_code.get(code)
            if not manifest:
                continue
            manifest_menu_config = manifest.get("menu_config")
            manifest_digest = ApplicationService.stable_menu_config_digest(manifest_menu_config)
            db_digest = ApplicationService.stable_menu_config_digest(app.get("menu_config"))
            config_stale = manifest_digest != db_digest
            rows_stale = False
            hierarchy_stale = False
            app_uuid = app.get("uuid")
            if app_uuid and manifest_menu_config:
                rows_stale = await ApplicationService._application_menu_paths_missing(
                    tenant_id,
                    str(app_uuid),
                    manifest_menu_config,
                )
            if app_uuid:
                hierarchy_stale = await ApplicationService._application_menu_hierarchy_stale(
                    tenant_id,
                    str(app_uuid),
                    code,
                )
            if config_stale or rows_stale or hierarchy_stale:
                stale_app_codes.append(code)

        return {
            "needs_sync": len(stale_app_codes) > 0,
            "stale_app_count": len(stale_app_codes),
            "stale_app_codes": stale_app_codes,
            "manifest_fingerprint": MenuService._get_manifest_fingerprint(),
        }

    @staticmethod
    def _build_manifest_sync_update(app: ApplicationDict, manifest: Dict[str, Any]) -> ApplicationUpdate:
        menu_config = manifest.get("menu_config")
        version = manifest.get("version", app.get("version", "1.0.0"))
        app_name = app.get("name")
        if not app.get("is_custom_name"):
            app_name = manifest.get("name", app_name)
        app_sort_order = app.get("sort_order", 0)
        if not app.get("is_custom_sort"):
            app_sort_order = resolve_application_sort_order(
                app.get("code"),
                manifest.get("sort_order", app_sort_order),
            )
        return ApplicationUpdate(
            name=app_name,
            menu_config=menu_config,
            version=version,
            sort_order=app_sort_order,
        )

    @staticmethod
    async def sync_all_manifests_and_menus(tenant_id: int) -> Dict[str, Any]:
        """
        批量从 manifest.json 刷新已安装应用清单，再一次性写入 core_menus。

        供应用中心「一键同步菜单」使用，避免前端按应用串行 HTTP + 重复菜单/权限同步。
        """
        from core.services.system.menu_service import MenuService

        manifest_by_code = {
            str(plugin.get("code") or "").strip(): plugin
            for plugin in ApplicationService._scan_plugin_manifests()
            if plugin.get("code")
        }

        # 排序唯一真源：各应用 manifest.json 的 sort_order → core_applications（与扫描注册一致）
        apps = await ApplicationService.list_applications(
            tenant_id=tenant_id,
            skip=0,
            limit=500,
        )
        manifest_synced = 0
        manifest_errors: List[Dict[str, str]] = []

        conn = await get_db_connection()
        try:
            for app in apps:
                app_code = str(app.get("code") or "").strip()
                app_uuid = app.get("uuid")
                if not app_code or not app_uuid:
                    continue
                manifest = manifest_by_code.get(app_code)
                if not manifest:
                    manifest_errors.append(
                        {"code": app_code, "detail": f"manifest.json 不存在: {app_code}"}
                    )
                    continue
                try:
                    update_data = ApplicationService._build_manifest_sync_update(app, manifest)
                    fields = update_data.model_dump(exclude_unset=True)
                    if fields:
                        set_clauses = []
                        params: List[Any] = [tenant_id, str(app_uuid)]
                        param_index = 3
                        for key, value in fields.items():
                            if key == "menu_config" and value is not None:
                                set_clauses.append(f"{key} = ${param_index}::jsonb")
                                params.append(json.dumps(value, ensure_ascii=False))
                            else:
                                set_clauses.append(f"{key} = ${param_index}")
                                params.append(value)
                            param_index += 1
                        query = f"""
                            UPDATE core_applications
                            SET {', '.join(set_clauses)}, updated_at = NOW()
                            WHERE tenant_id = $1 AND uuid = $2 AND deleted_at IS NULL
                        """
                        result = await conn.execute(query, *params)
                        if result != "UPDATE 1":
                            raise NotFoundError(f"应用 {app_code} 更新失败")
                    manifest_synced += 1
                except Exception as e:
                    logger.warning("批量清单同步失败 app={}: {}", app_code, e)
                    manifest_errors.append({"code": app_code, "detail": str(e)})
        finally:
            await conn.close()

        menu_count = await MenuService.sync_all_menus_from_applications(
            tenant_id,
            skip_permission_sync=False,
        )
        manifest_total = len([a for a in apps if a.get("code")])

        return {
            "success": menu_count > 0 or manifest_synced > 0,
            "manifest_synced": manifest_synced,
            "manifest_total": manifest_total,
            "manifest_errors": manifest_errors,
            "menu_count": menu_count,
            "message": (
                f"已同步 {manifest_synced}/{manifest_total} 个应用清单，"
                f"写入 {menu_count} 个菜单"
                + (f"（{len(manifest_errors)} 个应用无本地 manifest，排序以库内 sort_order 为准）" if manifest_errors else "")
            ),
        }
    
    @staticmethod
    async def scan_and_register_plugins(tenant_id: int) -> List[ApplicationDict]:
        """
        扫描插件目录并自动注册插件应用

        从 src/apps 目录扫描所有插件的 manifest.json 文件，
        自动在数据库中创建或更新应用记录。
        PRO 应用也会注册，无权限时仅在前端显示锁定、引导升级套餐。

        本方法仅收敛数据库中的应用元数据与安装标记；不写菜单表、不跑权限全量同步，
        避免 HTTP 长时间阻塞。侧边栏与权限请使用「一键同步菜单」或单应用清单同步接口。

        Args:
            tenant_id: 组织ID

        Returns:
            List[Application]: 已注册的应用列表
        """
        plugins = ApplicationService._scan_plugin_manifests()
        logger.info(f"扫描到 {len(plugins)} 个插件清单")

        renamed = await ApplicationService._reconcile_renamed_application_codes(tenant_id)
        if renamed:
            logger.info(
                "组织 {} 已合并改编码应用 {} 组（旧 code 并入新 code，不产生双份）",
                tenant_id,
                renamed,
            )

        removed_dupes = await ApplicationService._reconcile_duplicate_application_rows(tenant_id)
        if removed_dupes:
            logger.warning(
                "组织 {} 存在重复应用行，已软删除 {} 条（保留同 code 最小 id）",
                tenant_id,
                removed_dupes,
            )

        # 一次性按 tenant 取出所有已存在应用（code -> row），消除 N+1 启动期 DB 查询
        existing_by_code: Dict[str, Dict[str, Any]] = {}
        try:
            conn = await get_db_connection()
            try:
                rows = await conn.fetch(
                    "SELECT * FROM core_applications WHERE tenant_id = $1 AND deleted_at IS NULL",
                    tenant_id,
                )
                for row in rows:
                    app_dict = ApplicationService._normalize_application_row(dict(row))
                    app_code = app_dict.get('code')
                    if not app_code:
                        continue
                    prev = existing_by_code.get(app_code)
                    if prev is None:
                        existing_by_code[app_code] = app_dict
                        continue
                    keep, drop = prev, app_dict
                    if int(app_dict.get('id') or 0) < int(prev.get('id') or 0):
                        keep, drop = app_dict, prev
                    existing_by_code[app_code] = keep
                    drop_id = drop.get('id')
                    if drop_id:
                        await conn.execute(
                            """
                            UPDATE core_applications
                            SET deleted_at = NOW(), updated_at = NOW()
                            WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
                            """,
                            drop_id,
                            tenant_id,
                        )
            finally:
                await conn.close()
        except Exception as e:
            logger.warning(f"批量预取 core_applications 失败，降级为按需查询: {e}")

        registered_apps = []
        bound_for_scan = await ApplicationDedicatedBindingService.fetch_bound_codes_for_tenant(tenant_id)
        globally_bound_for_scan = await ApplicationDedicatedBindingService.fetch_globally_bound_app_codes()

        for manifest in plugins:
            logger.debug(f"处理插件: {manifest.get('name', 'unknown')} (code: {manifest.get('code', 'unknown')})")
            try:
                # PRO 应用也注册，无权限时仅在前端显示锁定、引导升级套餐
                # 从 manifest.json 提取应用信息
                code = manifest.get('code')
                if not code:
                    logger.warning(f"警告: 插件 {manifest.get('name', 'unknown')} 缺少 code 字段，跳过注册")
                    continue
                if code in _PLACEHOLDER_APP_CODES:
                    logger.info(f"⏭️ 跳过占位应用注册: {code}")
                    continue
                from core.config.industry_pack import is_industry_module_app_code

                manifest_menu_config = manifest.get("menu_config")
                if is_industry_module_app_code(code):
                    manifest_menu_config = None
                if ApplicationService._manifest_is_dedicated(manifest) and not (
                    ApplicationDedicatedBindingService.is_dedicated_visible_to_tenant(
                        str(code),
                        tenant_bound_codes=bound_for_scan,
                        globally_bound_codes=globally_bound_for_scan,
                    )
                ):
                    logger.info(
                        "⏭️ 跳过当前租户不可见的专用应用: {} (tenant_id={})",
                        code,
                        tenant_id,
                    )
                    continue
                
                # 优先用预取结果；预取失败时回退到单次查询
                if existing_by_code:
                    existing_app = existing_by_code.get(code)
                else:
                    existing_app = await ApplicationService.get_application_by_code(
                        tenant_id=tenant_id,
                        code=code
                    )
                
                # 构建应用数据
                # 已存在的应用保持 is_active；新发现的清单默认停用，启用须走 enable_application（含 PRO License 校验）
                is_installed = existing_app.get('is_installed', False) if existing_app else False
                is_active = (existing_app.get('is_active', True) if existing_app else False) if is_installed else False
                
                # 系统内置应用默认自动安装；但 PRO 应用必须已激活 License Key，避免后台误开。
                should_auto_install = await ApplicationService._can_enable_or_install_app(
                    tenant_id=tenant_id,
                    app_code=code,
                )
                
                app_data = ApplicationCreate(
                    name=manifest.get('name', code),
                    code=code,
                    description=manifest.get('description'),
                    icon=manifest.get('icon'),
                    version=manifest.get('version', '1.0.0'),
                    route_path=manifest.get('route_path'),
                    entry_point=manifest.get('entry_point'),
                    menu_config=manifest_menu_config,
                    permission_code=manifest.get('permission_code') or f"app:{code}",
                    is_system=False,  # 插件应用不是系统应用
                    is_active=is_active,  # 保持现有状态；新注册默认为停用
                    sort_order=resolve_application_sort_order(
                        code,
                        manifest.get("sort_order"),
                    ),
                )
                
                from core.config.app_scan_enable_policy import (
                    should_auto_enable_base_app_after_scan,
                )

                newly_installed = False
                if existing_app:
                    # 更新现有应用（保留 is_active 和 is_installed 状态）
                    # 系统内置应用且未安装时，本轮自动安装（勿先改本地 is_installed 标记，否则会跳过安装）
                    needs_auto_install = bool(should_auto_install and not is_installed)

                    # 决定是否更新名称：如果用户自定义了名称，扫描不应覆盖它
                    app_name = existing_app.get('name')
                    if not existing_app.get('is_custom_name'):
                        app_name = app_data.name

                    # 决定是否更新排序：如果用户自定义了排序，扫描不应覆盖它
                    app_sort_order = existing_app.get('sort_order', 0)
                    if not existing_app.get('is_custom_sort'):
                        app_sort_order = app_data.sort_order

                    update_data = ApplicationUpdate(
                        name=app_name,
                        description=app_data.description,
                        icon=app_data.icon,
                        version=app_data.version,
                        route_path=app_data.route_path,
                        entry_point=app_data.entry_point,
                        menu_config=app_data.menu_config,
                        permission_code=app_data.permission_code,
                        sort_order=app_sort_order,
                    )
                    application = await ApplicationService.update_application(
                        tenant_id=tenant_id,
                        uuid=existing_app.get('uuid'),
                        data=update_data,
                        sync_derived_resources=False,
                    )

                    if needs_auto_install:
                        await ApplicationService.install_application(
                            tenant_id=tenant_id,
                            uuid=existing_app.get('uuid'),
                            sync_menus_after_install=False,
                        )
                        application['is_installed'] = True
                        newly_installed = True
                else:
                    # 创建新应用
                    application = await ApplicationService.create_application(
                        tenant_id=tenant_id,
                        data=app_data
                    )

                    # 如果是系统内置应用，自动安装
                    if should_auto_install:
                        await ApplicationService.install_application(
                            tenant_id=tenant_id,
                            uuid=application.get('uuid'),
                            sync_menus_after_install=False,
                        )
                        application['is_installed'] = True
                        newly_installed = True

                ded = ApplicationService._manifest_is_dedicated(manifest)
                await ApplicationService._persist_is_dedicated(tenant_id, code, ded)
                if isinstance(application, dict):
                    application["is_dedicated"] = ded

                # 仅本轮新安装的基础应用默认打开；已安装但用户关闭的不得重开
                if should_auto_enable_base_app_after_scan(newly_installed=newly_installed):
                    application = await ApplicationService._auto_enable_base_app_if_needed(
                        tenant_id, code, application
                    )

                registered_apps.append(application)
                
            except Exception as e:
                logger.error(f"错误: 注册插件 {manifest.get('name', 'unknown')} 失败: {e}")
                import traceback
                traceback.print_exc()
                # 暂时不跳过，继续处理下一个插件
                continue
        
        # 已安装行业模块时对齐 industry-pack 容器与侧栏菜单
        try:
            from core.services.application.industry_pack_menu_service import (
                IndustryPackMenuService,
            )

            await IndustryPackMenuService.reconcile_for_tenant(tenant_id)
        except Exception as e:
            logger.warning(f"扫描后对齐行业包菜单失败（不影响应用注册）: {e}")

        # 所有应用注册完成后，统一清除菜单缓存，确保菜单一次性刷新
        if registered_apps:
            try:
                from core.services.system.menu_service import MenuService
                await MenuService._clear_menu_cache(tenant_id)
            except Exception as e:
                logger.warning(f"⚠️ 清除菜单缓存失败（不影响应用注册）: {e}")

        # 转换为字典列表，与其他方法保持一致
        result = []
        for app in registered_apps:
            # app 已经是字典，直接使用
            if isinstance(app, dict):
                result.append(app)
            else:
                # 如果是对象，转换为字典
                result.append({
                    'id': app.id,
                    'uuid': str(app.uuid),
                    'tenant_id': app.tenant_id,
                    'name': app.name,
                    'code': app.code,
                    'description': app.description,
                    'icon': app.icon,
                    'version': app.version,
                    'route_path': app.route_path,
                    'entry_point': app.entry_point,
                    'menu_config': app.menu_config,
                    'permission_code': app.permission_code,
                'is_system': app.is_system,
                'is_active': app.is_active,
                'is_installed': app.is_installed,
                'sort_order': app.sort_order,
                'created_at': app.created_at,
                'updated_at': app.updated_at,
                'deleted_at': app.deleted_at,
            })

        return result

    @staticmethod
    async def _can_enable_or_install_app(tenant_id: int, app_code: str) -> bool:
        """应用安装/启用门禁：套餐白名单 + PRO 激活联合校验。"""
        if not await ApplicationService._is_app_allowed_by_package(tenant_id, app_code):
            return False

        controls = await ApplicationService._resolve_package_controls(tenant_id)
        manifest = ApplicationService._get_manifest_by_code(app_code)
        manifest_is_pro = bool(manifest.get("is_pro", False)) if manifest else False
        if requires_pro_license_for_app(app_code, is_pro=manifest_is_pro):
            if not bool(controls.get("allow_pro_apps")):
                return False

        if not requires_pro_license_for_app(app_code, is_pro=manifest_is_pro):
            return True

        # 1) 平台许可证中心激活记录（标准路径）
        conn = await get_db_connection()
        try:
            activated = await conn.fetchval(
                """
                SELECT 1
                FROM infra_license_key_activations
                WHERE tenant_id = $1 AND app_code = $2
                LIMIT 1
                """,
                tenant_id,
                app_code,
            )
            if activated:
                return True
        finally:
            await conn.close()

        # 2) 兼容历史/环境变量激活路径：检查租户激活注册表
        from core.services.system.system_parameter_service import SystemParameterService

        parameter = await SystemParameterService.get_parameter(
            tenant_id=tenant_id,
            key=_PRO_ACTIVATION_REGISTRY_KEY,
            use_cache=True,
        )
        if not parameter:
            return False
        value = parameter.get_value()
        if not isinstance(value, dict):
            return False
        apps = value.get("apps")
        return isinstance(apps, dict) and bool(apps.get(app_code))

