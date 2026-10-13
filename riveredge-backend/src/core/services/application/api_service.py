"""
接口管理服务模块

提供接口的 CRUD 操作和接口测试功能。
"""

import httpx  # 仅用于异常类型
import time
from typing import Dict, Any, Optional, List

from infra.infrastructure.http import get_http_client
from uuid import UUID

from tortoise.exceptions import IntegrityError

from core.models.api import API
from core.models.integration_config import IntegrationConfig
from core.models.resource_category import RESOURCE_TYPE_API
from core.schemas.api import APICreate, APIUpdate, APITestRequest, APIResponse
from core.services.resource.resource_category_service import ResourceCategoryService
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.config.infra_config import infra_settings as settings
from core.utils.timezone_utils import resolve_business_datetime
from core.config.integration_type_spec import is_business_system_connector_type
from core.services.integration.connector_request import resolve_connector_request


class APIService:
    """
    接口管理服务类
    
    提供接口的 CRUD 操作和接口测试功能。
    """
    
    async def _resolve_business_connector(
        self,
        tenant_id: int,
        connection_uuid: UUID,
    ) -> IntegrationConfig:
        integration_config = await IntegrationConfig.filter(
            tenant_id=tenant_id,
            uuid=str(connection_uuid),
            deleted_at__isnull=True,
        ).first()
        if not integration_config:
            raise ValidationError(f"应用连接器不存在: {connection_uuid}")
        if not is_business_system_connector_type(integration_config.type):
            raise ValidationError("仅支持绑定业务系统类应用连接器（ERP/PLM/CRM/OA/WMS/IoT）")
        return integration_config

    async def _create_or_revive_api(
        self,
        tenant_id: int,
        *,
        code: str,
        **fields: Any,
    ) -> API:
        """创建接口；若同 code 已软删则恢复，避免撞 unique (tenant_id, code)。"""
        trashed = await API.filter(
            tenant_id=tenant_id,
            code=code,
            deleted_at__isnull=False,
        ).order_by("-deleted_at", "-id").first()
        if trashed:
            trashed.deleted_at = None
            for key, value in fields.items():
                setattr(trashed, key, value)
            await trashed.save()
            return trashed
        return await API.create(tenant_id=tenant_id, code=code, **fields)

    @staticmethod
    def build_api_response(api: API) -> APIResponse:
        connection_uuid = None
        connection_name = None
        connection_type = None
        integration_config = getattr(api, "integration_config", None)
        if integration_config is not None:
            connection_uuid = UUID(str(integration_config.uuid))
            connection_name = integration_config.name
            connection_type = integration_config.type
        elif api.integration_config_id:
            # 未 prefetch 时仅回显 uuid 不可用，调用方应 fetch_related
            pass

        category_uuid = None
        category_name = None
        category = getattr(api, "category", None)
        if category is not None:
            category_uuid = UUID(str(category.uuid))
            category_name = category.name
        elif api.category_id:
            pass

        payload = {
            key: getattr(api, key)
            for key in (
                "uuid",
                "tenant_id",
                "name",
                "code",
                "description",
                "path",
                "method",
                "sync_direction",
                "request_headers",
                "request_params",
                "request_body",
                "response_format",
                "response_example",
                "source_type_conversion_map",
                "is_active",
                "is_system",
                "created_at",
                "updated_at",
            )
        }
        payload["connection_uuid"] = connection_uuid
        payload["connection_name"] = connection_name
        payload["connection_type"] = connection_type
        payload["category_uuid"] = category_uuid
        payload["category_name"] = category_name
        return APIResponse(**payload)

    async def create_api(
        self,
        tenant_id: int,
        api_data: APICreate,
    ) -> API:
        """
        创建接口
        
        Args:
            tenant_id: 组织ID
            api_data: 接口创建数据
            
        Returns:
            API: 创建的接口对象
            
        Raises:
            ValidationError: 接口代码已存在
        """
        # 检查接口代码是否已存在
        existing_api = await API.filter(
            tenant_id=tenant_id,
            code=api_data.code,
            deleted_at__isnull=True,
        ).first()
        
        if existing_api:
            raise ValidationError(f"接口代码 '{api_data.code}' 已存在")
        
        create_data = api_data.model_dump(exclude={"connection_uuid", "category_uuid"})
        integration_config_id = None
        if api_data.connection_uuid:
            integration_config = await self._resolve_business_connector(
                tenant_id,
                api_data.connection_uuid,
            )
            integration_config_id = integration_config.id

        category_id = None
        if api_data.category_uuid:
            category_id = await ResourceCategoryService().resolve_category_id(
                tenant_id,
                RESOURCE_TYPE_API,
                api_data.category_uuid,
            )

        # 创建接口
        api = await API.create(
            tenant_id=tenant_id,
            integration_config_id=integration_config_id,
            category_id=category_id,
            **create_data,
        )
        
        if integration_config_id or category_id:
            await api.fetch_related("integration_config", "category")
        return api

    async def ensure_connector_api_presets(
        self,
        tenant_id: int,
        connection_uuid: UUID,
        *,
        category_id: Optional[int] = None,
        preset_code_suffixes: Optional[List[str]] = None,
        preset_loader: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        按连接器类型加载常用接口预设（已存在 code 则跳过）。

        当前支持：kingdee_galaxy（金蝶AI星空 WebAPI）、
        kingdee_cosmic / kingdee_xinghan / kingdee_ai_suite（苍穹 OpenAPI）
        """
        integration = await self._resolve_business_connector(tenant_id, connection_uuid)
        conn_type = str(integration.type or "").strip()
        if conn_type in ("kingdee_cosmic", "kingdee_xinghan", "kingdee_ai_suite"):
            return await self._ensure_kingdee_cosmic_api_presets(
                tenant_id,
                integration,
                category_id=category_id,
                preset_code_suffixes=preset_code_suffixes,
                preset_loader=preset_loader or "kingdee_cosmic",
            )
        if conn_type != "kingdee_galaxy":
            raise ValidationError(
                "当前仅支持金蝶AI星空或金蝶AI苍穹/星瀚/套件 OpenAPI 连接器加载常用接口"
            )

        from core.services.integration.kingdee_galaxy_api_presets import (
            CUSTOMER_PRESET_CODE_SUFFIX,
            MATERIAL_GROUP_PRESET_CODE_SUFFIX,
            MATERIAL_PRESET_CODE_SUFFIX,
            PRD_MO_PRESET_CODE_SUFFIX,
            PURCHASE_ORDER_PRESET_CODE_SUFFIX,
            SALES_ORDER_PRESET_CODE_SUFFIX,
            SUPPLIER_PRESET_CODE_SUFFIX,
            UNIT_PRESET_CODE_SUFFIX,
            WAREHOUSE_PRESET_CODE_SUFFIX,
            bill_open_preset_needs_upgrade,
            build_customer_query_preset_body,
            build_material_group_query_preset_body,
            build_material_query_preset_body,
            build_prd_mo_query_preset_body,
            build_purchase_order_query_preset_body,
            build_sales_order_query_preset_body,
            build_supplier_query_preset_body,
            build_unit_query_preset_body,
            build_warehouse_query_preset_body,
            customer_preset_needs_upgrade,
            list_kingdee_galaxy_api_presets,
            master_data_scope_preset_needs_upgrade,
            material_group_preset_needs_upgrade,
            material_preset_needs_upgrade,
            purchase_order_preset_needs_upgrade,
            resolve_preset_api_code,
            sales_order_preset_needs_upgrade,
            supplier_preset_needs_upgrade,
        )

        allowed_suffixes: Optional[set[str]] = None
        if preset_code_suffixes is not None:
            allowed_suffixes = {str(suffix).strip() for suffix in preset_code_suffixes if str(suffix).strip()}
            if not allowed_suffixes:
                raise ValidationError("请至少选择一个接口")

        created: List[str] = []
        skipped: List[str] = []
        categorized: List[str] = []
        upgraded: List[str] = []
        for preset in list_kingdee_galaxy_api_presets():
            code_suffix = str(preset["code_suffix"] or "").strip()
            if allowed_suffixes is not None and code_suffix not in allowed_suffixes:
                continue
            code = resolve_preset_api_code(integration.code, preset["code_suffix"])
            existing = await API.filter(
                tenant_id=tenant_id,
                code=code,
                deleted_at__isnull=True,
            ).first()
            if existing:
                if (
                    code_suffix == SALES_ORDER_PRESET_CODE_SUFFIX
                    and sales_order_preset_needs_upgrade(existing.request_body)
                ):
                    existing.request_body = build_sales_order_query_preset_body()
                    existing.description = preset["description"]
                    await existing.save(update_fields=["request_body", "description", "updated_at"])
                    upgraded.append(code)
                elif (
                    code_suffix == MATERIAL_PRESET_CODE_SUFFIX
                    and material_preset_needs_upgrade(existing.request_body)
                ):
                    existing.request_body = build_material_query_preset_body()
                    existing.description = preset["description"]
                    await existing.save(update_fields=["request_body", "description", "updated_at"])
                    upgraded.append(code)
                elif (
                    code_suffix == CUSTOMER_PRESET_CODE_SUFFIX
                    and customer_preset_needs_upgrade(existing.request_body)
                ):
                    existing.request_body = build_customer_query_preset_body()
                    existing.description = preset["description"]
                    await existing.save(update_fields=["request_body", "description", "updated_at"])
                    upgraded.append(code)
                elif (
                    code_suffix == SUPPLIER_PRESET_CODE_SUFFIX
                    and supplier_preset_needs_upgrade(existing.request_body)
                ):
                    existing.request_body = build_supplier_query_preset_body()
                    existing.description = preset["description"]
                    await existing.save(update_fields=["request_body", "description", "updated_at"])
                    upgraded.append(code)
                elif (
                    code_suffix == UNIT_PRESET_CODE_SUFFIX
                    and master_data_scope_preset_needs_upgrade(existing.request_body)
                ):
                    existing.request_body = build_unit_query_preset_body()
                    existing.description = preset["description"]
                    await existing.save(update_fields=["request_body", "description", "updated_at"])
                    upgraded.append(code)
                elif (
                    code_suffix == MATERIAL_GROUP_PRESET_CODE_SUFFIX
                    and material_group_preset_needs_upgrade(existing.request_body)
                ):
                    existing.request_body = build_material_group_query_preset_body()
                    existing.description = preset["description"]
                    await existing.save(update_fields=["request_body", "description", "updated_at"])
                    upgraded.append(code)
                elif (
                    code_suffix == WAREHOUSE_PRESET_CODE_SUFFIX
                    and master_data_scope_preset_needs_upgrade(existing.request_body)
                ):
                    existing.request_body = build_warehouse_query_preset_body()
                    existing.description = preset["description"]
                    await existing.save(update_fields=["request_body", "description", "updated_at"])
                    upgraded.append(code)
                elif (
                    code_suffix == PURCHASE_ORDER_PRESET_CODE_SUFFIX
                    and purchase_order_preset_needs_upgrade(existing.request_body)
                ):
                    existing.request_body = build_purchase_order_query_preset_body()
                    existing.description = preset["description"]
                    await existing.save(update_fields=["request_body", "description", "updated_at"])
                    upgraded.append(code)
                elif (
                    code_suffix == PRD_MO_PRESET_CODE_SUFFIX
                    and bill_open_preset_needs_upgrade(existing.request_body)
                ):
                    existing.request_body = build_prd_mo_query_preset_body()
                    existing.description = preset["description"]
                    await existing.save(update_fields=["request_body", "description", "updated_at"])
                    upgraded.append(code)
                if category_id is not None and existing.category_id is None:
                    existing.category_id = category_id
                    await existing.save(update_fields=["category_id", "updated_at"])
                    categorized.append(code)
                skipped.append(code)
                continue
            api = await self._create_or_revive_api(
                tenant_id,
                code=code,
                name=preset["name"],
                description=preset["description"],
                path=preset["path"],
                method=preset["method"],
                request_headers={"Content-Type": "application/json"},
                request_params=None,
                request_body=preset["request_body"],
                response_format=None,
                response_example=None,
                is_active=True,
                is_system=False,
                integration_config_id=integration.id,
                category_id=category_id,
            )
            created.append(api.code)

        return {
            "connection_uuid": str(integration.uuid),
            "connection_code": integration.code,
            "connection_type": conn_type,
            "created_count": len(created),
            "skipped_count": len(skipped),
            "categorized_count": len(categorized),
            "upgraded_count": len(upgraded),
            "created_codes": created,
            "skipped_codes": skipped,
            "categorized_codes": categorized,
            "upgraded_codes": upgraded,
        }

    async def _ensure_kingdee_cosmic_api_presets(
        self,
        tenant_id: int,
        integration: IntegrationConfig,
        *,
        category_id: Optional[int] = None,
        preset_code_suffixes: Optional[List[str]] = None,
        preset_loader: str = "kingdee_cosmic",
    ) -> Dict[str, Any]:
        """加载金蝶云苍穹 OpenAPI 常用 / 制造链路接口预设。"""
        from core.services.integration.kingdee_cosmic_api_presets import (
            LEGACY_SUPPLIER_LIST_PRESET_CODE_SUFFIX,
            MATERIAL_GROUP_PRESET_CODE_SUFFIX,
            MATERIAL_PRESET_CODE_SUFFIX,
            MEASUREUNITS_PRESET_CODE_SUFFIX,
            SUPPLIER_PRESET_CODE_SUFFIX,
            WAREHOUSE_PRESET_CODE_SUFFIX,
            build_material_group_goods_class_preset,
            kingdee_material_group_api_upgrade_fields,
            kingdee_supplier_api_upgrade_fields,
            list_kingdee_cosmic_api_presets,
            material_group_preset_needs_upgrade,
            material_preset_needs_upgrade,
            measureunits_preset_needs_upgrade,
            resolve_preset_api_code,
            supplier_preset_needs_upgrade,
            warehouse_batch_query_preset_needs_upgrade,
        )
        from core.services.integration.kingdee_cosmic_mfg_api_presets import (
            list_kingdee_cosmic_mfg_api_presets,
        )

        loader = str(preset_loader or "kingdee_cosmic").strip() or "kingdee_cosmic"
        if loader == "kingdee_cosmic_mfg":
            presets = list_kingdee_cosmic_mfg_api_presets()
        else:
            presets = list_kingdee_cosmic_api_presets()

        allowed_suffixes: Optional[set[str]] = None
        if preset_code_suffixes is not None:
            allowed_suffixes = {
                str(suffix).strip() for suffix in preset_code_suffixes if str(suffix).strip()
            }
            if not allowed_suffixes:
                raise ValidationError("请至少选择一个接口")

        created: List[str] = []
        skipped: List[str] = []
        categorized: List[str] = []
        upgraded: List[str] = []
        for preset in presets:
            code_suffix = str(preset["code_suffix"] or "").strip()
            if allowed_suffixes is not None and code_suffix not in allowed_suffixes:
                continue
            code = resolve_preset_api_code(integration.code, preset["code_suffix"])
            existing = await API.filter(
                tenant_id=tenant_id,
                code=code,
                deleted_at__isnull=True,
            ).first()
            if existing:
                if (
                    code_suffix == WAREHOUSE_PRESET_CODE_SUFFIX
                    and warehouse_batch_query_preset_needs_upgrade(existing.request_body)
                ):
                    body = dict(existing.request_body or {}) if isinstance(existing.request_body, dict) else {}
                    data = dict(body.get("data") or {}) if isinstance(body.get("data"), dict) else {}
                    data["createorg_number"] = str(
                        data.get("createorg_number") or data.get("createOrgNumber") or "WANG"
                    ).strip() or "WANG"
                    body["data"] = data
                    if body.get("pageNo") in (None, ""):
                        body["pageNo"] = 1
                    if body.get("pageSize") in (None, ""):
                        body["pageSize"] = 1000
                    existing.request_body = body
                    existing.description = preset["description"]
                    await existing.save(update_fields=["request_body", "description", "updated_at"])
                    upgraded.append(code)
                elif code_suffix == MEASUREUNITS_PRESET_CODE_SUFFIX and measureunits_preset_needs_upgrade(
                    existing.path,
                    existing.request_body,
                    existing.request_params,
                ):
                    existing.path = preset["path"]
                    existing.name = preset["name"]
                    existing.description = preset["description"]
                    existing.method = preset.get("method") or existing.method
                    existing.request_params = preset.get("request_params") or {
                        "select": "number,name,baseunit.number,baseunit.name",
                    }
                    existing.request_body = preset.get("request_body") or {
                        "data": {},
                        "pageNo": 1,
                        "pageSize": 500,
                        "select": "number,name,baseunit.number,baseunit.name",
                    }
                    await existing.save(
                        update_fields=[
                            "path",
                            "name",
                            "description",
                            "method",
                            "request_params",
                            "request_body",
                            "updated_at",
                        ]
                    )
                    upgraded.append(code)
                elif (
                    code_suffix == MATERIAL_GROUP_PRESET_CODE_SUFFIX
                    and material_group_preset_needs_upgrade(
                        existing.path,
                        existing.method,
                        existing.request_body,
                    )
                ):
                    fields = kingdee_material_group_api_upgrade_fields()
                    existing.path = fields["path"]
                    existing.name = fields["name"]
                    existing.description = fields["description"]
                    existing.method = fields["method"]
                    existing.request_params = None
                    existing.request_body = fields["request_body"]
                    await existing.save(
                        update_fields=[
                            "path",
                            "name",
                            "description",
                            "method",
                            "request_params",
                            "request_body",
                            "updated_at",
                        ]
                    )
                    upgraded.append(code)
                elif (
                    code_suffix == "query_goods_class"
                    and "getmalgoodsclass" not in str(existing.path or "").lower()
                ):
                    gmc = build_material_group_goods_class_preset()
                    existing.path = gmc["path"]
                    existing.name = gmc["name"]
                    existing.description = gmc["description"]
                    existing.method = gmc.get("method") or "POST"
                    existing.request_body = gmc.get("request_body") or {
                        "pageNo": 1,
                        "pageSize": 100,
                    }
                    await existing.save(
                        update_fields=[
                            "path",
                            "name",
                            "description",
                            "method",
                            "request_body",
                            "updated_at",
                        ]
                    )
                    upgraded.append(code)
                elif code_suffix == MATERIAL_PRESET_CODE_SUFFIX and material_preset_needs_upgrade(
                    existing.path,
                    existing.request_body,
                    existing.request_params,
                ):
                    existing.path = preset["path"]
                    existing.name = preset["name"]
                    existing.description = preset["description"]
                    existing.method = preset.get("method") or existing.method
                    existing.request_params = preset.get("request_params")
                    existing.request_body = preset.get("request_body") or {
                        "data": {},
                        "pageNo": 1,
                        "pageSize": 100,
                        "select": "number,name,modelnum,baseunit.number,baseunit.name,group.number,group.name",
                    }
                    await existing.save(
                        update_fields=[
                            "path",
                            "name",
                            "description",
                            "method",
                            "request_params",
                            "request_body",
                            "updated_at",
                        ]
                    )
                    upgraded.append(code)
                elif code_suffix == SUPPLIER_PRESET_CODE_SUFFIX and supplier_preset_needs_upgrade(
                    existing.path,
                    existing.method,
                    existing.request_body,
                    existing.request_params,
                ):
                    fields = kingdee_supplier_api_upgrade_fields()
                    existing.path = fields["path"]
                    existing.name = fields["name"]
                    existing.description = fields["description"]
                    existing.method = fields["method"]
                    existing.request_params = fields["request_params"]
                    existing.request_body = fields["request_body"]
                    await existing.save(
                        update_fields=[
                            "path",
                            "name",
                            "description",
                            "method",
                            "request_params",
                            "request_body",
                            "updated_at",
                        ]
                    )
                    upgraded.append(code)
                if category_id is not None and existing.category_id is None:
                    existing.category_id = category_id
                    await existing.save(update_fields=["category_id", "updated_at"])
                    categorized.append(code)
                skipped.append(code)
                continue
            request_params = preset.get("request_params")
            api = await self._create_or_revive_api(
                tenant_id,
                code=code,
                name=preset["name"],
                description=preset["description"],
                path=preset["path"],
                method=preset["method"],
                request_headers={"Content-Type": "application/json"},
                request_params=request_params if request_params else None,
                request_body=preset.get("request_body") or {},
                response_format=None,
                response_example=None,
                is_active=True,
                is_system=False,
                integration_config_id=integration.id,
                category_id=category_id,
            )
            created.append(api.code)

        legacy_code = resolve_preset_api_code(
            integration.code,
            LEGACY_SUPPLIER_LIST_PRESET_CODE_SUFFIX,
        )
        legacy_row = await API.filter(
            tenant_id=tenant_id,
            code=legacy_code,
            deleted_at__isnull=True,
        ).first()
        if legacy_row and supplier_preset_needs_upgrade(
            legacy_row.path,
            legacy_row.method,
            legacy_row.request_body,
            legacy_row.request_params,
        ):
            fields = kingdee_supplier_api_upgrade_fields()
            legacy_row.path = fields["path"]
            legacy_row.name = fields["name"]
            legacy_row.description = (
                f"{fields['description']}（原「同步供应商列表」已合并为与制造链路 basedata_query_2 相同的 query 预置。）"
            )
            legacy_row.method = fields["method"]
            legacy_row.request_params = fields["request_params"]
            legacy_row.request_body = fields["request_body"]
            await legacy_row.save(
                update_fields=[
                    "path",
                    "name",
                    "description",
                    "method",
                    "request_params",
                    "request_body",
                    "updated_at",
                ]
            )
            upgraded.append(legacy_code)

        return {
            "connection_uuid": str(integration.uuid),
            "connection_code": integration.code,
            "connection_type": str(integration.type or "kingdee_cosmic"),
            "created_count": len(created),
            "skipped_count": len(skipped),
            "categorized_count": len(categorized),
            "upgraded_count": len(upgraded),
            "created_codes": created,
            "skipped_codes": skipped,
            "categorized_codes": categorized,
            "upgraded_codes": upgraded,
        }

    async def list_api_library(self) -> Dict[str, Any]:
        """获取系统接口库目录。"""
        from core.services.application.api_library_catalog import list_api_library_catalog

        return {"items": list_api_library_catalog()}

    async def install_api_library_pack(
        self,
        tenant_id: int,
        pack_id: str,
        connection_uuid: UUID,
        item_keys: List[str],
    ) -> Dict[str, Any]:
        """将接口库包安装到当前租户。"""
        from core.services.application.api_library_catalog import (
            get_api_library_pack,
            list_api_library_pack_item_keys,
        )

        pack = get_api_library_pack(pack_id)
        if not pack:
            raise ValidationError(f"接口库包不存在: {pack_id}")

        normalized_keys = [str(key).strip() for key in item_keys if str(key).strip()]
        if not normalized_keys:
            raise ValidationError("请至少选择一个接口")

        valid_keys = set(list_api_library_pack_item_keys(pack))
        invalid_keys = sorted(set(normalized_keys) - valid_keys)
        if invalid_keys:
            raise ValidationError(f"接口条目不存在: {', '.join(invalid_keys)}")

        integration = await self._resolve_business_connector(tenant_id, connection_uuid)
        conn_type = str(integration.type or "").strip()
        if conn_type != pack["connector_type"]:
            raise ValidationError(
                f"接口包「{pack['name']}」需要 {pack['connector_type']} 类型连接器"
            )

        category = await ResourceCategoryService().ensure_category_by_code(
            tenant_id,
            RESOURCE_TYPE_API,
            code=pack["category_code"],
            name=pack["category_name"],
            description=pack["category_description"],
        )

        preset_result = await self.ensure_connector_api_presets(
            tenant_id,
            connection_uuid,
            category_id=category.id,
            preset_code_suffixes=normalized_keys,
            preset_loader=pack.get("preset_loader"),
        )

        return {
            "pack_id": pack["pack_id"],
            "category_uuid": str(category.uuid),
            **preset_result,
        }

    async def list_official_api_library(self, *, request_host: str = "") -> Dict[str, Any]:
        """获取官方接口库目录（域名见 platform_settings.official_api_library_host）。"""
        from infra.services.official_api_library_service import list_official_api_library

        result = await list_official_api_library(request_host=request_host)
        items = result.get("items") or []
        for item in items:
            item["source"] = "official"
        return {
            "items": items,
            "official_host": result.get("official_host"),
            "official_base_url": result.get("official_base_url"),
        }

    async def install_official_api_library_pack(
        self,
        tenant_id: int,
        pack_id: str,
        connection_uuid: UUID,
        item_keys: List[str],
        *,
        request_host: str = "",
    ) -> Dict[str, Any]:
        """从官方接口库安装接口包到当前租户。"""
        from infra.services.official_api_library_service import (
            get_official_api_library_pack,
            normalize_official_api_item,
        )
        from core.services.integration.kingdee_galaxy_api_presets import resolve_preset_api_code

        pack = await get_official_api_library_pack(pack_id, request_host=request_host)
        connector_type = str(pack.get("connector_type") or "").strip()
        if not connector_type:
            raise ValidationError("官方接口包缺少连接器类型")

        normalized_keys = [str(key).strip() for key in item_keys if str(key).strip()]
        if not normalized_keys:
            raise ValidationError("请至少选择一个接口")

        raw_items = pack.get("items") or []
        full_items = [
            normalize_official_api_item(item)
            for item in raw_items
            if isinstance(item, dict)
        ]
        item_map = {item["item_key"]: item for item in full_items}
        invalid_keys = sorted(set(normalized_keys) - set(item_map.keys()))
        if invalid_keys:
            raise ValidationError(f"接口条目不存在: {', '.join(invalid_keys)}")

        integration = await self._resolve_business_connector(tenant_id, connection_uuid)
        conn_type = str(integration.type or "").strip()
        if conn_type != connector_type:
            raise ValidationError(
                f"接口包「{pack.get('name')}」需要 {connector_type} 类型连接器"
            )

        category_name = str(pack.get("category_name") or "官方库").strip() or "官方库"
        category_code = str(pack.get("category_code") or "official").strip() or "official"
        category_description = str(pack.get("category_description") or pack.get("description") or "").strip()
        category = await ResourceCategoryService().ensure_category_by_code(
            tenant_id,
            RESOURCE_TYPE_API,
            code=category_code[:50],
            name=category_name[:50],
            description=category_description or None,
        )

        created: List[str] = []
        skipped: List[str] = []
        categorized: List[str] = []
        for key in normalized_keys:
            item = item_map[key]
            code = resolve_preset_api_code(integration.code, item["item_key"])
            existing = await API.filter(
                tenant_id=tenant_id,
                code=code,
                deleted_at__isnull=True,
            ).first()
            if existing:
                if existing.category_id is None:
                    existing.category_id = category.id
                    await existing.save(update_fields=["category_id", "updated_at"])
                    categorized.append(code)
                skipped.append(code)
                continue
            await self._create_or_revive_api(
                tenant_id,
                code=code,
                name=item["name"],
                description=item.get("description") or None,
                path=item["path"],
                method=item["method"],
                request_headers=item.get("request_headers"),
                request_params=item.get("request_params"),
                request_body=item.get("request_body"),
                response_format=item.get("response_format"),
                response_example=item.get("response_example"),
                is_active=True,
                is_system=False,
                integration_config_id=integration.id,
                category_id=category.id,
            )
            created.append(code)

        return {
            "pack_id": str(pack.get("pack_id") or pack_id),
            "connection_uuid": str(integration.uuid),
            "connection_code": integration.code,
            "connection_type": conn_type,
            "category_uuid": str(category.uuid),
            "created_count": len(created),
            "skipped_count": len(skipped),
            "categorized_count": len(categorized),
            "created_codes": created,
            "skipped_codes": skipped,
            "categorized_codes": categorized,
        }

    async def submit_official_api_library(
        self,
        tenant_id: int,
        *,
        name: str,
        description: str,
        connector_type: str,
        category_name: str,
        category_code: Optional[str],
        category_description: Optional[str],
        api_uuids: List[UUID],
        submitter_hint: Optional[str] = None,
        request_host: str = "",
    ) -> Dict[str, Any]:
        """将本组织接口打包提交到官方接口库。"""
        from infra.services.official_api_library_service import submit_official_api_library_pack

        if not api_uuids:
            raise ValidationError("请至少选择一个接口")

        apis = await API.filter(
            tenant_id=tenant_id,
            uuid__in=[str(u) for u in api_uuids],
            deleted_at__isnull=True,
        ).all()
        if len(apis) != len(set(str(u) for u in api_uuids)):
            raise ValidationError("部分接口不存在或不属于本组织")

        items: List[Dict[str, Any]] = []
        used_keys: set[str] = set()
        for api in apis:
            item_key = str(api.code or "").strip()
            if not item_key:
                raise ValidationError(f"接口「{api.name}」缺少代码，无法提交")
            if item_key in used_keys:
                raise ValidationError(f"接口代码重复，无法提交: {item_key}")
            used_keys.add(item_key)
            items.append(
                {
                    "item_key": item_key,
                    "name": api.name,
                    "description": api.description or "",
                    "path": api.path,
                    "method": api.method,
                    "request_headers": api.request_headers,
                    "request_params": api.request_params,
                    "request_body": api.request_body,
                    "response_format": api.response_format,
                    "response_example": api.response_example,
                }
            )

        return await submit_official_api_library_pack(
            {
                "name": name,
                "description": description,
                "connector_type": connector_type,
                "category_name": category_name,
                "category_code": category_code,
                "category_description": category_description,
                "items": items,
                "submitter_hint": submitter_hint,
            },
            request_host=request_host,
        )
    
    async def get_api_by_uuid(
        self,
        tenant_id: int,
        api_uuid: UUID,
    ) -> API:
        """
        根据 UUID 获取接口
        
        Args:
            tenant_id: 组织ID
            api_uuid: 接口UUID
            
        Returns:
            API: 接口对象
            
        Raises:
            NotFoundError: 接口不存在
        """
        api = await API.filter(
            tenant_id=tenant_id,
            uuid=api_uuid,
            deleted_at__isnull=True,
        ).first()
        
        if not api:
            raise NotFoundError(f"接口不存在: {api_uuid}")
        
        return api
    
    async def list_apis(
        self,
        tenant_id: int,
        page: int = 1,
        page_size: int = 20,
        search: Optional[str] = None,
        method: Optional[str] = None,
        sync_direction: Optional[str] = None,
        is_active: Optional[bool] = None,
        sort_by: Optional[str] = None,
        sort_order: Optional[str] = None,
        category_uuid: Optional[UUID] = None,
        no_category: bool = False,
    ) -> tuple[List[API], int]:
        """
        获取接口列表
        
        Args:
            tenant_id: 组织ID
            page: 页码
            page_size: 每页数量
            search: 搜索关键词（名称、代码、路径）
            method: 请求方法筛选
            sync_direction: 同步方向筛选（pull/push/bidirectional）
            is_active: 是否启用筛选
            
        Returns:
            tuple[List[API], int]: (接口列表, 总数)
        """
        query = API.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        
        # 搜索条件（优化：使用 OR 查询，但限制在索引字段）
        if search:
            from tortoise.expressions import Q
            query = query.filter(
                Q(name__icontains=search) |
                Q(code__icontains=search) |
                Q(path__icontains=search)
            )
        
        # 方法筛选
        if method:
            query = query.filter(method=method.upper())

        if sync_direction:
            from core.schemas.api import normalize_api_sync_direction

            try:
                normalized_direction = normalize_api_sync_direction(sync_direction)
            except ValueError as exc:
                raise ValidationError(str(exc)) from exc
            query = query.filter(sync_direction=normalized_direction)
        
        # 启用状态筛选
        if is_active is not None:
            query = query.filter(is_active=is_active)

        if no_category:
            query = query.filter(category_id__isnull=True)
        elif category_uuid:
            category_id = await ResourceCategoryService().resolve_category_id(
                tenant_id,
                RESOURCE_TYPE_API,
                category_uuid,
            )
            query = query.filter(category_id=category_id)
        
        # 优化分页查询：先查询总数，再查询数据
        total = await query.count()
        
        # 限制分页大小，避免过大查询
        if page_size > 100:
            page_size = 100
        
        # 分页查询（使用索引字段排序）
        offset = (page - 1) * page_size
        allowed_sort = {
            "name",
            "code",
            "path",
            "method",
            "sync_direction",
            "created_at",
            "updated_at",
            "is_active",
        }
        if sort_by in allowed_sort:
            desc = sort_order and str(sort_order).lower() in ("desc", "descend")
            primary = f"-{sort_by}" if desc else sort_by
            order_clause: tuple[str, ...] = (primary, "id")
        else:
            order_clause = ("-created_at", "id")
        apis = await query.order_by(*order_clause).offset(offset).limit(page_size).prefetch_related(
            "integration_config",
            "category",
        ).all()

        return apis, total
    
    async def update_api(
        self,
        tenant_id: int,
        api_uuid: UUID,
        api_data: APIUpdate,
    ) -> API:
        """
        更新接口
        
        Args:
            tenant_id: 组织ID
            api_uuid: 接口UUID
            api_data: 接口更新数据
            
        Returns:
            API: 更新后的接口对象
            
        Raises:
            NotFoundError: 接口不存在
            ValidationError: 接口代码已存在
        """
        # 获取接口
        api = await self.get_api_by_uuid(tenant_id, api_uuid)
        
        # 如果更新了代码，检查是否重复
        if api_data.code and api_data.code != api.code:
            existing_api = await API.filter(
                tenant_id=tenant_id,
                code=api_data.code,
                deleted_at__isnull=True,
            ).exclude(uuid=api_uuid).first()
            
            if existing_api:
                raise ValidationError(f"接口代码 '{api_data.code}' 已存在")
        
        # 记录变更前的状态（用于通知数据集管理）
        old_code = api.code
        old_path = api.path
        old_method = api.method
        old_is_active = api.is_active
        
        # 更新接口
        update_data = api_data.model_dump(exclude_unset=True, exclude={"connection_uuid", "category_uuid"})
        for key, value in update_data.items():
            setattr(api, key, value)

        if "connection_uuid" in api_data.model_fields_set:
            if api_data.connection_uuid is None:
                api.integration_config_id = None
            else:
                integration_config = await self._resolve_business_connector(
                    tenant_id,
                    api_data.connection_uuid,
                )
                api.integration_config_id = integration_config.id

        if "category_uuid" in api_data.model_fields_set:
            if api_data.category_uuid is None:
                api.category_id = None
            else:
                api.category_id = await ResourceCategoryService().resolve_category_id(
                    tenant_id,
                    RESOURCE_TYPE_API,
                    api_data.category_uuid,
                )
        
        await api.save()
        
        await api.fetch_related("integration_config", "category")
        
        # 如果接口代码、路径、方法或状态变更，通知数据集管理（异步，不阻塞主流程）
        code_changed = old_code != api.code
        path_changed = old_path != api.path
        method_changed = old_method != api.method
        status_changed = old_is_active != api.is_active
        
        if code_changed or path_changed or method_changed or status_changed:
            import asyncio
            # 异步通知数据集管理接口变更
            asyncio.create_task(
                APIService._notify_datasets(
                    tenant_id=tenant_id,
                    api_code=old_code if code_changed else api.code,
                    new_api_code=api.code if code_changed else None,
                    is_active=api.is_active,
                    path_changed=path_changed,
                    method_changed=method_changed
                )
            )
        
        return api
    
    async def delete_api(
        self,
        tenant_id: int,
        api_uuid: UUID,
    ) -> None:
        """
        删除接口（软删除）
        
        Args:
            tenant_id: 组织ID
            api_uuid: 接口UUID
            
        Raises:
            NotFoundError: 接口不存在
            ValidationError: 系统接口不可删除
        """
        # 获取接口
        api = await self.get_api_by_uuid(tenant_id, api_uuid)
        
        # 检查是否为系统接口
        if api.is_system:
            raise ValidationError("系统接口不可删除")
        
        # 通知数据集管理接口将被删除（异步，不阻塞主流程）
        import asyncio
        asyncio.create_task(
            APIService._notify_datasets(
                tenant_id=tenant_id,
                api_code=api.code,
                is_active=False,
                is_deleted=True
            )
        )
        
        # 软删除
        from datetime import datetime
        api.deleted_at = resolve_business_datetime()
        await api.save()
    
    @staticmethod
    async def _notify_datasets(
        tenant_id: int,
        api_code: str,
        new_api_code: Optional[str] = None,
        is_active: bool = True,
        path_changed: bool = False,
        method_changed: bool = False,
        is_deleted: bool = False
    ) -> None:
        """
        通知数据集管理接口变更
        
        这是一个预留方法，用于将来实现数据集管理的接口变更通知。
        目前只是记录变更，不执行具体操作。
        
        Args:
            tenant_id: 组织ID
            api_code: 接口代码
            new_api_code: 新接口代码（如果接口代码变更）
            is_active: 是否启用
            path_changed: 路径是否变更
            method_changed: 方法是否变更
            is_deleted: 是否删除
        """
        # TODO: 如果将来需要数据集自动更新，可以在这里实现
        # 例如：
        # 1. 查找所有使用该接口的数据集（query_config 中包含 api_code）
        # 2. 根据新的接口配置更新数据集的 query_config
        # 3. 如果接口被删除或禁用，禁用关联的数据集
        
        # 注意：接口变更通常不应该自动更新数据集的 query_config
        # 因为用户可能有意使用旧的配置
        # 只有在特殊情况下（如接口路径变更）才需要更新
        pass
    
    async def test_api(
        self,
        tenant_id: int,
        api_uuid: UUID,
        test_request: APITestRequest,
        timeout: float = 30.0,
    ) -> Dict[str, Any]:
        """
        测试接口调用
        
        Args:
            tenant_id: 组织ID
            api_uuid: 接口UUID
            test_request: 测试请求数据（可覆盖接口定义的参数）
            timeout: 请求超时时间（秒）
            
        Returns:
            Dict[str, Any]: 测试结果
            {
                "status_code": 200,
                "headers": {...},
                "body": {...},
                "elapsed_time": 0.123
            }
            
        Raises:
            NotFoundError: 接口不存在
        """
        # 获取接口
        api = await self.get_api_by_uuid(tenant_id, api_uuid)
        if not api.is_active:
            raise ValidationError(f"数据接口「{api.name}」已停用，无法调用")
        await api.fetch_related("integration_config")
        if api.integration_config_id and api.integration_config and not api.integration_config.is_active:
            raise ValidationError(
                f"应用连接器「{api.integration_config.name}」已停用，无法调用"
            )
        api_path = str(api.path or "").strip()
        from core.services.integration.kingdee_cosmic_paths import (
            normalize_cosmic_openapi_endpoint,
        )

        api_path = normalize_cosmic_openapi_endpoint(api_path)
        conn_type = str(api.integration_config.type or "").strip() if api.integration_config else ""
        if conn_type in ("kingdee_cosmic", "kingdee_xinghan", "kingdee_ai_suite") and (
            "query_supplier" in str(api.code or "")
            or "bd_supplier" in api_path.lower()
        ):
            from core.services.integration.kingdee_cosmic_api_presets import (
                kingdee_supplier_api_upgrade_fields,
                supplier_preset_needs_upgrade,
            )

            if supplier_preset_needs_upgrade(
                api_path,
                api.method,
                api.request_body,
                api.request_params,
            ):
                fields = kingdee_supplier_api_upgrade_fields()
                api.path = fields["path"]
                api.method = fields["method"]
                api.request_params = fields["request_params"]
                api.request_body = fields["request_body"]
                api.description = fields["description"]
                await api.save(
                    update_fields=[
                        "path",
                        "method",
                        "request_params",
                        "request_body",
                        "description",
                        "updated_at",
                    ]
                )
                api_path = str(api.path or "").strip()
        elif conn_type in ("kingdee_cosmic", "kingdee_xinghan", "kingdee_ai_suite") and (
            "query_material_group" in str(api.code or "")
            or "bd_materialgroup" in api_path.lower()
        ):
            from core.services.integration.kingdee_cosmic_api_presets import (
                kingdee_material_group_api_upgrade_fields,
                material_group_preset_needs_upgrade,
            )

            if material_group_preset_needs_upgrade(
                api_path,
                api.method,
                api.request_body,
            ):
                fields = kingdee_material_group_api_upgrade_fields()
                api.path = fields["path"]
                api.method = fields["method"]
                api.request_body = fields["request_body"]
                api.description = fields["description"]
                await api.save(
                    update_fields=[
                        "path",
                        "method",
                        "request_body",
                        "description",
                        "updated_at",
                    ]
                )
                api_path = str(api.path or "").strip()
        elif api_path != str(api.path or "").strip():
            api.path = api_path
            await api.save(update_fields=["path", "updated_at"])
        path_lower = api_path.lower().replace("\\", "/")
        if "bd_supplier" in path_lower and "/batchquery" in path_lower:
            return {
                "status_code": 0,
                "headers": {},
                "body": {
                    "error": (
                        "本环境网关未发布 bd_supplier/batchQuery（会 2530）。"
                        "请加载常用接口升级「苍穹查询供应商」：路径为 "
                        "kapi/v2/basedata/bd_supplier/query，与制造链路 basedata_query_2 一致；"
                        "物料 batchQuery 在本环境可用，供应商勿沿用物料路径。"
                    ),
                },
                "elapsed_time": 0,
            }
        if path_lower.endswith("/basedata/b") or path_lower.endswith("/basedata/bd"):
            return {
                "status_code": 0,
                "headers": {},
                "body": {
                    "error": (
                        "接口路径不完整（…/basedata/b），网关会 404。"
                        "请加载常用接口升级，路径应为 "
                        "kapi/v2/basedata/bd_supplier/query。"
                    ),
                },
                "elapsed_time": 0,
            }
        if "__API_NUMBER__" in api_path:
            return {
                "status_code": 0,
                "headers": {},
                "body": {
                    "error": (
                        "接口路径仍含占位符 __API_NUMBER__，网关会返回路由未找到。"
                        "请在接口编辑页将路径中的占位符改为贵司苍穹「开放服务云」里已发布、"
                        "且已对第三方应用完成服务授权的实际接口编码后再测试。"
                    ),
                },
                "elapsed_time": 0,
            }
        # 1. 合并请求头（测试请求头优先）
        request_headers = dict(api.request_headers or {})
        
        # 2. 合并请求参数（测试参数优先）
        request_params = api.request_params or {}
        if test_request.params:
            request_params.update(test_request.params)
        
        # 3. 合并请求体（测试请求体优先；深拷贝避免污染 ORM 缓存）
        import copy

        request_body = copy.deepcopy(api.request_body) if api.request_body else {}
        if test_request.body:
            request_body.update(test_request.body)

        cosmic_cfg = None
        is_cosmic_oauth = False
        
        # 4. 构建完整URL
        try:
            if api.integration_config_id and api.integration_config:
                url, connector_headers = resolve_connector_request(
                    api.integration_config,
                    endpoint=api_path,
                    headers=request_headers,
                )
                request_headers = connector_headers
                if test_request.headers:
                    request_headers.update(test_request.headers)
                conn_type = str(api.integration_config.type or "").strip()
                if conn_type == "kingdee_galaxy":
                    from core.services.integration.kingdee_galaxy_service import (
                        apply_kingdee_galaxy_session_headers,
                        login_kingdee_galaxy_session,
                    )

                    try:
                        session = await login_kingdee_galaxy_session(
                            api.integration_config.get_config()
                        )
                        request_headers = apply_kingdee_galaxy_session_headers(
                            request_headers,
                            session_id=str(session["session_id"]),
                        )
                    except ValueError as exc:
                        return {
                            "status_code": 0,
                            "headers": {},
                            "body": {"error": str(exc)},
                            "elapsed_time": 0,
                        }
                elif conn_type in ("kingdee_cosmic", "kingdee_xinghan", "kingdee_ai_suite"):
                    from core.services.integration.kingdee_cosmic_service import (
                        apply_kingdee_cosmic_session_headers,
                        build_kingdee_cosmic_gateway_headers,
                        build_kingdee_cosmic_get_token_payload,
                        login_kingdee_cosmic_session,
                    )

                    try:
                        cfg = api.integration_config.get_config()
                        cosmic_cfg = cfg
                        url_lower = str(url or "").lower()
                        path_lower = str(api.path or "").lower().replace("\\", "/")
                        # getToken 本身不要先换票再带 Bearer 重放；用连接器配置组真实请求体
                        is_oauth_token = (
                            "oauth2/gettoken" in path_lower
                            or url_lower.rstrip("/").endswith("/kapi/oauth2/gettoken")
                        )
                        is_cosmic_oauth = bool(is_oauth_token)
                        # 门户页/绝对非 kapi 地址不是 OpenAPI，带 token 会落到错误数据中心
                        is_open_api = "/kapi/" in url_lower or path_lower.startswith("kapi/")
                        if is_oauth_token:
                            url = str(url or "").rstrip("/")
                            request_headers = build_kingdee_cosmic_gateway_headers(cfg)
                            if test_request.headers:
                                request_headers.update(test_request.headers)
                            live_body = build_kingdee_cosmic_get_token_payload(cfg)
                            if test_request.body:
                                # 测试抽屉显式传入的非空字段覆盖（**** 视为未填）
                                for key, value in test_request.body.items():
                                    text = str(value or "").strip()
                                    if text and text != "****":
                                        live_body[key] = value
                            request_body = live_body
                        elif is_open_api:
                            session = await login_kingdee_cosmic_session(cfg)
                            request_headers = apply_kingdee_cosmic_session_headers(
                                request_headers,
                                config=cfg,
                                access_token=str(session["access_token"]),
                            )
                    except ValueError as exc:
                        return {
                            "status_code": 0,
                            "headers": {},
                            "body": {"error": str(exc)},
                            "elapsed_time": 0,
                        }
            else:
                url = api.path
                if not url.startswith("http://") and not url.startswith("https://"):
                    base_url = (getattr(settings, "BASE_URL", None) or "").strip().rstrip("/")
                    if not base_url:
                        host = getattr(settings, "HOST", "127.0.0.1")
                        port = getattr(settings, "PORT", 8200)
                        bind = "127.0.0.1" if host in ("0.0.0.0", "::") else host
                        base_url = f"http://{bind}:{port}"
                    url = f"{base_url}{url}"
                if test_request.headers:
                    request_headers.update(test_request.headers)
        except ValidationError as exc:
            return {
                "status_code": 0,
                "headers": {},
                "body": {"error": str(exc)},
                "elapsed_time": 0,
            }
        
        # 5. 发送请求
        method_upper = api.method.upper()
        if cosmic_cfg is not None and not is_cosmic_oauth:
            from core.services.integration.kingdee_cosmic_paths import (
                prepare_kingdee_cosmic_outbound,
            )

            try:
                method_upper, url, request_params, request_body = prepare_kingdee_cosmic_outbound(
                    cosmic_cfg,
                    url,
                    method_upper,
                    request_params,
                    request_body,
                )
            except (ValidationError, ValueError) as exc:
                return {
                    "status_code": 0,
                    "headers": {},
                    "body": {"error": str(exc)},
                    "elapsed_time": 0,
                }
        elif "/kapi/v2/" in str(url or "").lower():
            from core.services.integration.kingdee_cosmic_paths import (
                ensure_kingdee_v2_request_body,
            )

            request_body = ensure_kingdee_v2_request_body(url, request_body)

        start_time = time.time()
        try:
            client = get_http_client()

            async def _dispatch_once():
                if method_upper == "GET":
                    return await client.get(
                        url,
                        headers=request_headers,
                        params=request_params,
                        timeout=timeout,
                    )
                if method_upper == "POST":
                    return await client.post(
                        url,
                        headers=request_headers,
                        params=request_params,
                        json=request_body,
                        timeout=timeout,
                    )
                if method_upper == "PUT":
                    return await client.put(
                        url,
                        headers=request_headers,
                        params=request_params,
                        json=request_body,
                        timeout=timeout,
                    )
                if method_upper == "DELETE":
                    return await client.delete(
                        url,
                        headers=request_headers,
                        params=request_params,
                        timeout=timeout,
                    )
                if method_upper == "PATCH":
                    return await client.patch(
                        url,
                        headers=request_headers,
                        params=request_params,
                        json=request_body,
                        timeout=timeout,
                    )
                raise ValueError(f"不支持的请求方法: {api.method}")

            response = await _dispatch_once()
            try:
                response_body = response.json()
            except Exception:
                response_body = response.text

            # 缓存 token 被金蝶提前作废时：强制换票后重试一次
            if cosmic_cfg is not None and not is_cosmic_oauth:
                from core.services.integration.kingdee_cosmic_service import (
                    apply_kingdee_cosmic_session_headers,
                    is_kingdee_cosmic_access_token_rejected,
                    login_kingdee_cosmic_session,
                )

                if is_kingdee_cosmic_access_token_rejected(
                    response_body,
                    http_status=response.status_code,
                ):
                    session = await login_kingdee_cosmic_session(
                        cosmic_cfg,
                        force_refresh=True,
                    )
                    request_headers = apply_kingdee_cosmic_session_headers(
                        request_headers,
                        config=cosmic_cfg,
                        access_token=str(session["access_token"]),
                    )
                    response = await _dispatch_once()
                    try:
                        response_body = response.json()
                    except Exception:
                        response_body = response.text

            elapsed_time = time.time() - start_time

            if (
                isinstance(response_body, dict)
                and str(response_body.get("errorCode") or "") == "2530"
            ):
                extra = ""
                url_lower = str(url or "").lower()
                if "bd_supplier/batchquery" in url_lower:
                    extra = (
                        "本环境供应商未挂 batchQuery（制造链路探活为 "
                        "/v2/basedata/bd_supplier/query）。"
                        "请加载常用接口升级「苍穹查询供应商」，勿使用 …/batchQuery。"
                    )
                elif "bd_supplier" in url_lower:
                    extra = "请以开放平台「查询供应商信息」API 详情中的完整服务地址与请求方式为准。"
                response_body = {
                    **response_body,
                    "说明": (
                        f"网关没有这条路由。本次实际请求：{url}。"
                        "该地址未在开放平台发布或未对第三方应用授权。"
                        f"{extra}"
                    ),
                }

            # 苍穹 batchQuery 常忽略 select；按请求 select 裁剪行字段，避免测试/同步预览全量列
            if isinstance(response_body, (dict, list)):
                from core.services.integration.kingdee_cosmic_paths import (
                    project_response_by_select,
                )

                select_hint = ""
                if isinstance(request_params, dict):
                    select_hint = str(request_params.get("select") or "").strip()
                if not select_hint and isinstance(request_body, dict):
                    select_hint = str(request_body.get("select") or "").strip()
                    data_obj = request_body.get("data")
                    if (
                        not select_hint
                        and isinstance(data_obj, dict)
                        and data_obj.get("select") not in (None, "")
                    ):
                        select_hint = str(data_obj.get("select")).strip()
                if select_hint:
                    response_body = project_response_by_select(response_body, select_hint)

            return {
                "status_code": response.status_code,
                "headers": dict(response.headers),
                "body": response_body,
                "elapsed_time": round(elapsed_time, 3),
            }
        except httpx.TimeoutException:
            elapsed_time = time.time() - start_time
            return {
                "status_code": 0,
                "headers": {},
                "body": {"error": "请求超时"},
                "elapsed_time": round(elapsed_time, 3),
            }
        except httpx.RequestError as e:
            elapsed_time = time.time() - start_time
            return {
                "status_code": 0,
                "headers": {},
                "body": {"error": f"请求失败: {str(e)}"},
                "elapsed_time": round(elapsed_time, 3),
            }
        except Exception as e:
            elapsed_time = time.time() - start_time
            return {
                "status_code": 0,
                "headers": {},
                "body": {"error": f"未知错误: {str(e)}"},
                "elapsed_time": round(elapsed_time, 3),
            }

    async def probe_api_draft(
        self,
        tenant_id: int,
        *,
        connection_uuid: UUID,
        path: str,
        method: str,
        request_headers: Optional[Dict[str, Any]] = None,
        request_params: Optional[Dict[str, Any]] = None,
        request_body: Optional[Dict[str, Any]] = None,
        timeout: float = 30.0,
    ) -> Dict[str, Any]:
        """编辑弹窗草稿探测：按连接器 + 路径 + 报文直接发请求。"""
        integration = await self._resolve_business_connector(tenant_id, connection_uuid)
        request_headers = dict(request_headers or {})
        request_params = dict(request_params or {})
        request_body = dict(request_body or {})
        method_upper = str(method or "POST").upper()
        cosmic_cfg = None

        try:
            url, connector_headers = resolve_connector_request(
                integration,
                endpoint=path,
                headers=request_headers,
            )
            request_headers = connector_headers
            conn_type = str(integration.type or "").strip()
            if conn_type == "kingdee_galaxy":
                from core.services.integration.kingdee_galaxy_service import (
                    apply_kingdee_galaxy_session_headers,
                    login_kingdee_galaxy_session,
                )

                try:
                    session = await login_kingdee_galaxy_session(integration.get_config())
                    request_headers = apply_kingdee_galaxy_session_headers(
                        request_headers,
                        session_id=str(session["session_id"]),
                    )
                except ValueError as exc:
                    return {
                        "status_code": 0,
                        "headers": {},
                        "body": {"error": str(exc)},
                        "elapsed_time": 0,
                    }
            elif conn_type in ("kingdee_cosmic", "kingdee_xinghan", "kingdee_ai_suite"):
                from core.services.integration.kingdee_cosmic_service import (
                    apply_kingdee_cosmic_session_headers,
                    login_kingdee_cosmic_session,
                )

                try:
                    cosmic_cfg = integration.get_config()
                    session = await login_kingdee_cosmic_session(cosmic_cfg)
                    request_headers = apply_kingdee_cosmic_session_headers(
                        request_headers,
                        config=cosmic_cfg,
                        access_token=str(session["access_token"]),
                    )
                    from core.services.integration.kingdee_cosmic_paths import (
                        prepare_kingdee_cosmic_outbound,
                    )

                    method_upper, url, request_params, request_body = prepare_kingdee_cosmic_outbound(
                        cosmic_cfg,
                        url,
                        method_upper,
                        request_params,
                        request_body,
                    )
                except ValueError as exc:
                    return {
                        "status_code": 0,
                        "headers": {},
                        "body": {"error": str(exc)},
                        "elapsed_time": 0,
                    }
        except ValidationError as exc:
            return {
                "status_code": 0,
                "headers": {},
                "body": {"error": str(exc)},
                "elapsed_time": 0,
            }

        start_time = time.time()
        try:
            client = get_http_client()

            async def _dispatch_once():
                if method_upper == "GET":
                    return await client.get(
                        url,
                        headers=request_headers,
                        params=request_params,
                        timeout=timeout,
                    )
                if method_upper == "POST":
                    return await client.post(
                        url,
                        headers=request_headers,
                        params=request_params,
                        json=request_body,
                        timeout=timeout,
                    )
                if method_upper == "PUT":
                    return await client.put(
                        url,
                        headers=request_headers,
                        params=request_params,
                        json=request_body,
                        timeout=timeout,
                    )
                if method_upper == "DELETE":
                    return await client.delete(
                        url,
                        headers=request_headers,
                        params=request_params,
                        timeout=timeout,
                    )
                if method_upper == "PATCH":
                    return await client.patch(
                        url,
                        headers=request_headers,
                        params=request_params,
                        json=request_body,
                        timeout=timeout,
                    )
                raise ValueError(f"不支持的请求方法: {method}")

            response = await _dispatch_once()
            try:
                response_body = response.json()
            except Exception:
                response_body = response.text

            if cosmic_cfg is not None:
                from core.services.integration.kingdee_cosmic_service import (
                    apply_kingdee_cosmic_session_headers,
                    is_kingdee_cosmic_access_token_rejected,
                    login_kingdee_cosmic_session,
                )

                if is_kingdee_cosmic_access_token_rejected(
                    response_body,
                    http_status=response.status_code,
                ):
                    session = await login_kingdee_cosmic_session(
                        cosmic_cfg,
                        force_refresh=True,
                    )
                    request_headers = apply_kingdee_cosmic_session_headers(
                        request_headers,
                        config=cosmic_cfg,
                        access_token=str(session["access_token"]),
                    )
                    response = await _dispatch_once()
                    try:
                        response_body = response.json()
                    except Exception:
                        response_body = response.text

            elapsed_time = time.time() - start_time
            return {
                "status_code": response.status_code,
                "headers": dict(response.headers),
                "body": response_body,
                "elapsed_time": round(elapsed_time, 3),
            }
        except httpx.TimeoutException:
            elapsed_time = time.time() - start_time
            return {
                "status_code": 0,
                "headers": {},
                "body": {"error": "请求超时"},
                "elapsed_time": round(elapsed_time, 3),
            }
        except httpx.RequestError as exc:
            elapsed_time = time.time() - start_time
            return {
                "status_code": 0,
                "headers": {},
                "body": {"error": f"请求失败: {str(exc)}"},
                "elapsed_time": round(elapsed_time, 3),
            }
        except Exception as exc:
            elapsed_time = time.time() - start_time
            return {
                "status_code": 0,
                "headers": {},
                "body": {"error": f"未知错误: {str(exc)}"},
                "elapsed_time": round(elapsed_time, 3),
            }

