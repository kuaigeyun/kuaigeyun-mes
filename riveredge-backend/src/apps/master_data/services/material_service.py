"""
物料数据服务模块

提供物料数据的业务逻辑处理（物料分组、物料、BOM），支持多组织隔离。
"""

from typing import List, Optional, Dict, Any, TYPE_CHECKING, Tuple, Set
from collections import defaultdict
from decimal import Decimal
import asyncio
import hashlib
import itertools
import json
import re

from tortoise.models import Q
from tortoise.expressions import F
from tortoise.exceptions import IntegrityError
from tortoise.transactions import in_transaction
from apps.common.audit_actor import apply_create_audit, apply_update_audit, audit_response_fields
from apps.master_data.models.material import MaterialGroup, Material, BOM
from infra.models.user import User
from apps.master_data.constants.material_source_type import (
    LEGACY_SOURCE_TYPE_CONFIGURE,
    is_canonical_material_source_type,
    normalize_material_source_type,
    require_canonical_material_source_type,
)
from apps.master_data.models.process import ProcessRoute, Operation
from apps.master_data.models.employee_performance import EmployeePerformanceConfig
from apps.master_data.models.material_code_alias import MaterialCodeAlias
from apps.master_data.services.material_code_service import MaterialCodeService
from apps.master_data.schemas.material_schemas import (
    MaterialGroupCreate, MaterialGroupUpdate, MaterialGroupResponse,
    MaterialCreate, MaterialUpdate, MaterialResponse, MaterialListResponse,
    MaterialBulkTrackingRequest, MaterialBulkTrackingResponse,
    MaterialBulkVariantRequest,
    MaterialGenerateVariantsRequest,
    MaterialGenerateVariantsResponse,
    MaterialMaterializeVariantRequest,
    MaterialMaterializeVariantResponse,
    MaterialBatchDeleteRequest, MaterialBatchDeleteResponse, MaterialBatchDeleteFailedItem,
    MaterialBatchMoveGroupRequest, MaterialBatchMoveGroupResponse,
    MaterialBatchUpdateProcessRouteRequest, MaterialBatchUpdateSourceTypeRequest,
    MaterialBatchFieldUpdateResponse,
    MaterialRewriteMainCodesRequest, MaterialRewriteMainCodesResponse,
    MaterialRewriteMainCodesFailedItem,
    BOMCreate, BOMUpdate, BOMResponse, BOMBatchCreate,
    BOMBatchImport, BOMVersionCreate, BOMVersionCompare,
    BOMRelationImportRequest, BOMRelationImportResponse, BOMRelationImportSummary,
    BOMGroupSummary,
)
from core.services.business.code_generation_service import CodeGenerationService
from core.config.code_rule_pages import CODE_RULE_PAGES
from infra.exceptions.exceptions import NotFoundError, ValidationError
from loguru import logger

# source_type -> 编码回退用 type_code 映射（Buy->RAW, Make/Outsource->SEMI, Phantom->SEMI, Service->SVC，已移除 Configure）
_SOURCE_TYPE_TO_TYPE_CODE = {
    "Buy": "RAW",
    "Make": "SEMI",
    "Outsource": "SEMI",
    "Phantom": "SEMI",
    "Service": "SVC",
}


RELATION_IMPORT_FIELD_ALIASES: Dict[str, List[str]] = {
    "parent_code": [
        "父件编号",
        "父件编码",
        "产品编号",
        "父项编号",
        "parentCode",
        "parent_code",
        "parent code",
    ],
    "component_code": ["子件编号", "子件编码", "componentCode", "component_code", "component code"],
    "quantity": ["子件数量", "数量", "quantity", "qty"],
    "unit": ["子件单位", "单位", "unit"],
    "waste_rate": ["损耗率", "wasteRate", "waste_rate", "waste rate"],
    "is_required": ["是否必选", "isRequired", "is_required", "required"],
    "remark": ["备注", "remark", "notes"],
    "bom_code": ["BOM编号", "BOM编码", "bomCode", "bom_code", "bom code"],
    "bom_name": ["BOM名称", "bomName", "bom_name", "bom name"],
    "version": ["版本号", "版本", "version"],
    "base_quantity": ["基准数量", "baseQuantity", "base_quantity", "base quantity"],
    "material_name": [
        "物料名称",
        "产品名称",
        "materialName",
        "material_name",
        "material name",
    ],
    "specification": ["规格", "产品型号", "规格型号", "specification", "spec"],
    "base_unit": ["基础单位", "baseUnit", "base_unit", "base unit"],
    "process_route_code": [
        "工艺路线编码",
        "processRouteCode",
        "process_route_code",
        "process route code",
    ],
    "process_route_name": [
        "工艺路线名称",
        "processRouteName",
        "process_route_name",
        "process route name",
    ],
    "operation_code": ["工序编码", "operationCode", "operation_code", "operation code"],
    "operation_name": ["工序名称", "operationName", "operation_name", "operation name"],
    "employee_id": ["员工ID", "employeeId", "employee_id", "employee id"],
    "employee_name": ["员工姓名", "employeeName", "employee_name", "employee name"],
    "calc_mode": ["绩效模式", "calcMode", "calc_mode", "calc mode"],
    "hourly_rate": ["工时单价", "hourlyRate", "hourly_rate", "hourly rate"],
    "default_piece_rate": [
        "计件单价",
        "defaultPieceRate",
        "default_piece_rate",
        "default piece rate",
    ],
    "base_salary": ["保障工资", "baseSalary", "base_salary", "base salary"],
}

RELATION_ENTITY_REQUIRED_FIELDS: Dict[str, List[str]] = {
    "material": ["component_code"],
    "processRoute": ["process_route_code"],
    "operation": ["operation_code"],
    "performance": ["employee_id"],
}


def _source_type_to_type_code(source_type: Optional[str]) -> str:
    """将物料来源类型映射为编码规则使用的 type_code（用于回退生成）"""
    if not source_type:
        return "RAW"
    normalized = normalize_material_source_type(source_type) or source_type
    return _SOURCE_TYPE_TO_TYPE_CODE.get(normalized, "RAW")


def _apply_canonical_material_source_type(data: Dict[str, Any]) -> None:
    if "source_type" not in data or data.get("source_type") is None:
        return
    raw = str(data["source_type"]).strip()
    if raw == LEGACY_SOURCE_TYPE_CONFIGURE:
        logger.info("物料来源类型 Configure 已废弃，写入时归并为 Buy")
    normalized = normalize_material_source_type(raw)
    if normalized and not is_canonical_material_source_type(normalized):
        raise ValidationError(f"无效的物料来源类型: {raw}")
    data["source_type"] = normalized


def _material_defaults_as_dict(raw: Any) -> Optional[Dict[str, Any]]:
    """将物料 defaults 规范为 dict（兼容 ORM JSON 偶发返回字符串）。"""
    if raw is None:
        return None
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        s = raw.strip()
        if not s:
            return None
        try:
            parsed = json.loads(s)
            return parsed if isinstance(parsed, dict) else None
        except (json.JSONDecodeError, TypeError):
            return None
    return None


def _normalize_material_logistics_fields(material_data: Dict[str, Any], *, for_create: bool = False) -> None:
    """规范化物流/贸易扩展字段（条码、保质期、重量体积等）。"""
    for key in ("barcode", "country_of_origin", "customs_code"):
        if key in material_data and material_data[key] is not None:
            val = str(material_data[key]).strip()
            material_data[key] = val if val else None

    if "shelf_life_managed" in material_data:
        if not material_data.get("shelf_life_managed"):
            material_data["shelf_life_days"] = None
        elif material_data.get("shelf_life_days") is None:
            raise ValidationError("启用保质期管理时请填写保质期天数")

    for key in ("weight", "volume"):
        if key not in material_data:
            continue
        val = material_data[key]
        if val is None:
            if for_create:
                material_data[key] = 0
            else:
                material_data.pop(key, None)
        else:
            material_data[key] = float(val)

    if "reference_cost" in material_data:
        rc = material_data["reference_cost"]
        if rc is None or rc == "":
            material_data["reference_cost"] = None
        else:
            material_data["reference_cost"] = float(rc)


async def resolve_primary_default_warehouse_from_material(
    tenant_id: int,
    material_id: Optional[int] = None,
    *,
    material: Optional[Material] = None,
) -> Optional[Tuple[int, str]]:
    """
    从物料 defaults.defaultWarehouses 按 priority 解析首个启用且未删除的仓库。

    与前端 MaterialForm「默认仓库（可多选，按优先级排序）」写入格式一致。
    """
    from apps.master_data.models.warehouse import Warehouse

    if material is None:
        if not material_id:
            return None
        material = await Material.get_or_none(
            id=material_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
    if not material:
        return None

    defaults = _material_defaults_as_dict(getattr(material, "defaults", None))
    if not defaults:
        return None

    raw_list = defaults.get("defaultWarehouses") or defaults.get("default_warehouses")
    if not isinstance(raw_list, list) or not raw_list:
        return None

    def _priority(entry: dict) -> int:
        try:
            return int(entry.get("priority") or 999)
        except (TypeError, ValueError):
            return 999

    sorted_entries = sorted(
        [e for e in raw_list if isinstance(e, dict)],
        key=_priority,
    )

    for entry in sorted_entries:
        wh_id = entry.get("warehouseId") or entry.get("warehouse_id")
        if wh_id is None:
            continue
        try:
            wh_id_int = int(wh_id)
        except (TypeError, ValueError):
            continue
        wh = await Warehouse.get_or_none(
            id=wh_id_int,
            tenant_id=tenant_id,
            is_active=True,
            deleted_at__isnull=True,
        )
        if wh:
            return (wh.id, wh.name)

    return None


async def _enrich_inspection_plan_name(resp_data: Dict[str, Any]) -> None:
    """当有 default_inspection_plan_id 时，填充 default_inspection_plan_name"""
    plan_id = resp_data.get("default_inspection_plan_id")
    if not plan_id:
        return
    try:
        from apps.kuaizhizao.models.inspection_plan import InspectionPlan
        plan = await InspectionPlan.filter(id=plan_id, deleted_at__isnull=True).first()
        if plan:
            resp_data["default_inspection_plan_name"] = plan.plan_name
    except Exception:
        pass


async def _get_process_route_from_defaults_dict(
    tenant_id: int, defaults: Optional[Any]
) -> Optional[ProcessRoute]:
    """从物料 defaults 中解析默认工艺路线（与前端 defaultProcessRoute / defaultProcessRouteUuid 一致）。"""
    defaults = _material_defaults_as_dict(defaults)
    if not defaults:
        return None
    rid = defaults.get("defaultProcessRoute") or defaults.get("default_process_route")
    if rid is not None:
        try:
            return await ProcessRoute.filter(
                id=int(rid), tenant_id=tenant_id, deleted_at__isnull=True
            ).first()
        except (TypeError, ValueError):
            pass
    u = defaults.get("defaultProcessRouteUuid") or defaults.get("default_process_route_uuid")
    if u:
        return await ProcessRoute.filter(
            uuid=str(u), tenant_id=tenant_id, deleted_at__isnull=True
        ).first()
    return None


async def _resolve_process_route_id_from_defaults_dict(
    tenant_id: int, defaults: Optional[Any]
) -> Optional[int]:
    pr = await _get_process_route_from_defaults_dict(tenant_id, defaults)
    return pr.id if pr else None


async def _enrich_material_process_route_display(
    tenant_id: int, material: Any, resp_data: Dict[str, Any]
) -> None:
    """补齐 process_route_name；若仅有 defaults 中的路线引用则回填 id+name（列表/详情/保存后响应）。"""
    pr_id = resp_data.get("process_route_id")
    pr_name = resp_data.get("process_route_name")
    if pr_id and not pr_name:
        pr = await ProcessRoute.filter(
            id=pr_id, tenant_id=tenant_id, deleted_at__isnull=True
        ).first()
        if pr:
            resp_data["process_route_name"] = pr.name
        return
    if pr_id:
        return
    pr = await _get_process_route_from_defaults_dict(tenant_id, getattr(material, "defaults", None))
    if pr:
        resp_data["process_route_id"] = pr.id
        resp_data["process_route_name"] = pr.name


async def _batch_enrich_process_route_for_material_list(
    tenant_id: int, materials: List[Any], resp_dicts: List[Dict[str, Any]]
) -> None:
    """列表页批量补齐工艺路线展示，避免 N+1；含「仅写在 defaults」的历史数据。"""
    if not materials or len(materials) != len(resp_dicts):
        return
    need_by_id: Dict[int, List[int]] = defaultdict(list)
    need_by_uuid: Dict[str, List[int]] = defaultdict(list)
    for idx, (m, rd) in enumerate(zip(materials, resp_dicts)):
        if rd.get("process_route_id") and not rd.get("process_route_name"):
            need_by_id[int(rd["process_route_id"])].append(idx)
            continue
        if rd.get("process_route_id"):
            continue
        d = _material_defaults_as_dict(getattr(m, "defaults", None))
        if not d:
            continue
        rid = d.get("defaultProcessRoute") or d.get("default_process_route")
        routed_by_id = False
        if rid is not None:
            try:
                need_by_id[int(rid)].append(idx)
                routed_by_id = True
            except (TypeError, ValueError):
                pass
        if not routed_by_id:
            u = d.get("defaultProcessRouteUuid") or d.get("default_process_route_uuid")
            if u:
                need_by_uuid[str(u)].append(idx)
    if need_by_id:
        ids = list(need_by_id.keys())
        routes = await ProcessRoute.filter(
            tenant_id=tenant_id, id__in=ids, deleted_at__isnull=True
        ).all()
        id_map = {r.id: r for r in routes}
        for rid, indices in need_by_id.items():
            r = id_map.get(rid)
            if not r:
                # defaults 里 id 已失效或跨环境不一致时，尝试同条 JSON 中的 UUID
                for i in indices:
                    d = _material_defaults_as_dict(getattr(materials[i], "defaults", None))
                    u = (d.get("defaultProcessRouteUuid") or d.get("default_process_route_uuid")) if d else None
                    if u:
                        need_by_uuid[str(u)].append(i)
                continue
            for i in indices:
                resp_dicts[i]["process_route_id"] = r.id
                resp_dicts[i]["process_route_name"] = r.name
    if need_by_uuid:
        uuids = list(need_by_uuid.keys())
        routes_u = await ProcessRoute.filter(
            tenant_id=tenant_id, uuid__in=uuids, deleted_at__isnull=True
        ).all()
        uuid_map = {str(r.uuid): r for r in routes_u}
        for u, indices in need_by_uuid.items():
            r = uuid_map.get(u)
            if not r:
                continue
            for i in indices:
                if resp_dicts[i].get("process_route_name"):
                    continue
                resp_dicts[i]["process_route_id"] = r.id
                resp_dicts[i]["process_route_name"] = r.name


async def _resolve_variant_material_code(
    tenant_id: int,
    main_code: str,
    variant_attributes: Dict[str, Any],
) -> str:
    """
    为属性 SKU 行生成组织内唯一的 code：{main_code}-SKU001 递增序号。
    main_code 可与主物料相同，code 必须组织内唯一。
    """
    _ = variant_attributes  # 组合唯一性由业务层校验，编码仅按序号递增
    prefix = f"{main_code}-SKU"
    existing_codes = await Material.filter(
        tenant_id=tenant_id,
        code__startswith=prefix,
        deleted_at__isnull=True,
    ).values_list("code", flat=True)

    max_seq = 0
    seq_pattern = re.compile(re.escape(prefix) + r"(\d+)$")
    for existing in existing_codes:
        matched = seq_pattern.match(existing or "")
        if matched:
            max_seq = max(max_seq, int(matched.group(1)))

    for seq in range(max_seq + 1, max_seq + 1000):
        candidate = f"{prefix}{seq:03d}"
        exists = await Material.filter(
            tenant_id=tenant_id,
            code=candidate,
            deleted_at__isnull=True,
        ).exists()
        if not exists:
            return candidate

    raise ValidationError("无法生成唯一的属性物料编码，请检查属性组合或联系管理员")


def _material_orm_matches_keyword(material, keyword: str) -> bool:
    """判断物料行是否匹配列表关键词（含 SKU 子编码 code）。"""
    kw = keyword.strip().lower()
    if not kw:
        return True
    for val in (
        material.main_code,
        material.name,
        material.specification,
        getattr(material, "code", None),
    ):
        if val and kw in str(val).lower():
            return True
    attrs = getattr(material, "variant_attributes", None)
    if attrs:
        try:
            attrs_text = json.dumps(attrs, ensure_ascii=False).lower()
            if kw in attrs_text:
                return True
        except (TypeError, ValueError):
            pass
    return False


def _partner_id_from_code_mapping_payload(payload: Dict[str, Any], *keys: str) -> Optional[int]:
    """从编号映射请求体读取客户/供应商 ID（兼容 snake_case 与 camelCase）。"""
    for key in keys:
        if key not in payload or payload[key] is None or payload[key] == "":
            continue
        try:
            return int(payload[key])
        except (TypeError, ValueError):
            continue
    return None


def _material_to_response_data(material) -> Dict[str, Any]:
    """
    从 Material ORM 实例构建 MaterialResponse 所需的字典（不含 code_aliases）。
    model_validate 不支持 exclude，故用字典校验避免 ReverseRelation 传入。
    """
    pr = getattr(material, "process_route", None)
    from apps.kuaizhizao.services.inspection_policy_service import normalize_material_inspection_stages

    return {
        "id": material.id,
        "uuid": str(material.uuid),
        "tenant_id": material.tenant_id,
        "main_code": material.main_code or (getattr(material, "code", None) or ""),
        "code": getattr(material, "code", None),
        "name": material.name,
        "group_id": getattr(material, "group_id", None),
        "specification": getattr(material, "specification", None),
        "base_unit": material.base_unit,
        "units": getattr(material, "units", None),
        "batch_managed": getattr(material, "batch_managed", False),
        "default_batch_rule_id": getattr(material, "default_batch_rule_id", None),
        "serial_managed": getattr(material, "serial_managed", False),
        "default_serial_rule_id": getattr(material, "default_serial_rule_id", None),
        "variant_managed": getattr(material, "variant_managed", False),
        "variant_attributes": getattr(material, "variant_attributes", None),
        "description": getattr(material, "description", None),
        "brand": getattr(material, "brand", None),
        "model": getattr(material, "model", None),
        "texture": getattr(material, "texture", None),
        "images": getattr(material, "images", None),
        "weight": getattr(material, "weight", None),
        "volume": getattr(material, "volume", None),
        "barcode": getattr(material, "barcode", None),
        "shelf_life_managed": getattr(material, "shelf_life_managed", False),
        "shelf_life_days": getattr(material, "shelf_life_days", None),
        "reference_cost": getattr(material, "reference_cost", None),
        "country_of_origin": getattr(material, "country_of_origin", None),
        "customs_code": getattr(material, "customs_code", None),
        "is_active": getattr(material, "is_active", True),
        "defaults": getattr(material, "defaults", None),
        "source_type": getattr(material, "source_type", None),
        "source_config": getattr(material, "source_config", None),
        "inspection_mode": getattr(material, "inspection_mode", None) or "none",
        "default_inspection_plan_id": getattr(material, "default_inspection_plan_id", None),
        "inspection_stages": normalize_material_inspection_stages(
            getattr(material, "inspection_stages", None),
            legacy_mode=getattr(material, "inspection_mode", None),
            legacy_plan_id=getattr(material, "default_inspection_plan_id", None),
        ),
        "process_route_id": getattr(material, "process_route_id", None) or (getattr(pr, "id", None) if pr else None),
        "process_route_name": getattr(pr, "name", None) if pr else None,
        "created_at": material.created_at,
        "updated_at": material.updated_at,
        **audit_response_fields(material),
        "deleted_at": getattr(material, "deleted_at", None),
    }


async def _build_material_response(tenant_id: int, material: Material) -> "MaterialResponse":
    """从 ORM 实例构建 MaterialResponse（含别名与展示字段）。"""
    from apps.master_data.schemas.material_schemas import MaterialCodeAliasResponse, MaterialResponse

    aliases = await MaterialCodeService.get_material_aliases(
        tenant_id=tenant_id,
        material_id=material.id,
    )
    resp_data = _material_to_response_data(material)
    resp_data["code_aliases"] = [MaterialCodeAliasResponse.model_validate(a) for a in aliases]
    await _enrich_inspection_plan_name(resp_data)
    await _enrich_material_process_route_display(tenant_id, material, resp_data)
    return MaterialResponse.model_validate(resp_data)


if TYPE_CHECKING:
    from apps.master_data.schemas.material_schemas import (
        MaterialGroupTreeResponse,
        MaterialTreeResponse
    )


class MaterialService:
    """物料数据服务"""
    
    # ==================== 物料分组相关方法 ====================

    @staticmethod
    async def _validate_material_group_process_route_id(
        tenant_id: int,
        process_route_id: Optional[int],
    ) -> None:
        if process_route_id is None:
            return
        from apps.master_data.models.process import ProcessRoute

        route = await ProcessRoute.filter(
            id=int(process_route_id),
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            is_active=True,
        ).first()
        if not route:
            raise ValidationError("所选默认工艺路线不存在、已删除或未启用")

    @staticmethod
    async def _material_group_to_response(material_group: MaterialGroup) -> MaterialGroupResponse:
        from apps.kuaizhizao.services.inspection_policy_service import normalize_material_inspection_stages

        group_data = MaterialGroupResponse.model_validate(material_group)
        group_data.process_route_id = getattr(material_group, "process_route_id", None)
        pr = getattr(material_group, "process_route", None)
        if pr:
            group_data.process_route_name = getattr(pr, "name", None)
        group_data.inspection_stages = normalize_material_inspection_stages(
            getattr(material_group, "inspection_stages", None),
        )
        return group_data
    
    @staticmethod
    async def create_material_group(
        tenant_id: int,
        data: MaterialGroupCreate,
        current_user: Optional[User] = None,
    ) -> MaterialGroupResponse:
        """
        创建物料分组
        
        Args:
            tenant_id: 租户ID
            data: 物料分组创建数据
            current_user: 当前用户（写入审计字段）
            
        Returns:
            MaterialGroupResponse: 创建的物料分组对象
            
        Raises:
            ValidationError: 当编码已存在或父分组不存在时抛出
        """
        # 如果指定了父分组，检查父分组是否存在
        if data.parent_id:
            parent = await MaterialGroup.filter(
                tenant_id=tenant_id,
                id=data.parent_id,
                deleted_at__isnull=True
            ).first()
            
            if not parent:
                raise ValidationError(f"父分组 {data.parent_id} 不存在")
        
        # 检查编码是否已存在
        existing = await MaterialGroup.filter(
            tenant_id=tenant_id,
            code=data.code,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"物料分组编码 {data.code} 已存在")

        await MaterialService._validate_material_group_process_route_id(
            tenant_id, data.process_route_id
        )

        from apps.kuaizhizao.services.inspection_policy_service import (
            assert_master_data_inspection_stages_allowed,
            prepare_material_group_inspection_for_write,
        )

        group_data = data.model_dump(exclude_unset=True)
        if group_data.get("inspection_stages") is not None:
            prepare_material_group_inspection_for_write(group_data)
            await assert_master_data_inspection_stages_allowed(
                tenant_id,
                material_stages=group_data.get("inspection_stages"),
            )
        
        apply_create_audit(group_data, current_user)
        # 创建物料分组
        material_group = await MaterialGroup.create(
            tenant_id=tenant_id,
            **group_data
        )
        await material_group.fetch_related("process_route")
        return await MaterialService._material_group_to_response(material_group)
    
    @staticmethod
    async def get_material_group_by_uuid(
        tenant_id: int,
        group_uuid: str
    ) -> MaterialGroupResponse:
        """
        根据UUID获取物料分组
        
        Args:
            tenant_id: 租户ID
            group_uuid: 物料分组UUID
            
        Returns:
            MaterialGroupResponse: 物料分组对象
            
        Raises:
            NotFoundError: 当物料分组不存在时抛出
        """
        material_group = await MaterialGroup.filter(
            tenant_id=tenant_id,
            uuid=group_uuid,
            deleted_at__isnull=True
        ).prefetch_related("process_route", "parent").first()
        
        if not material_group:
            raise NotFoundError(f"物料分组 {group_uuid} 不存在")
        
        return await MaterialService._material_group_to_response(material_group)
    
    @staticmethod
    async def list_material_groups(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        parent_id: Optional[int] = None,
        is_active: Optional[bool] = None
    ) -> List[MaterialGroupResponse]:
        """
        获取物料分组列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            parent_id: 父分组ID（可选，用于过滤）
            is_active: 是否启用（可选）
            
        Returns:
            List[MaterialGroupResponse]: 物料分组列表
        """
        query = MaterialGroup.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if parent_id is not None:
            query = query.filter(parent_id=parent_id)
        
        if is_active is not None:
            query = query.filter(is_active=is_active)
        
        # 预加载关联关系（优化，修复500错误）
        material_groups = await query.prefetch_related("process_route").offset(skip).limit(limit).order_by("code").all()
        
        # 构建响应数据（包含process_route_id和process_route_name）
        result = []
        for mg in material_groups:
            try:
                result.append(await MaterialService._material_group_to_response(mg))
            except Exception as e:
                # 如果序列化失败，记录错误并跳过
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f"序列化物料分组 {mg.id if hasattr(mg, 'id') else 'unknown'} 失败: {str(e)}")
                # 尝试手动构建响应数据
                try:
                    group_dict = {
                        "id": mg.id,
                        "uuid": str(mg.uuid),
                        "tenant_id": mg.tenant_id,
                        "code": mg.code,
                        "alias": getattr(mg, "alias", None),
                        "name": mg.name,
                        "parent_id": getattr(mg, 'parent_id', None),
                        "description": getattr(mg, 'description', None),
                        "is_active": getattr(mg, 'is_active', True),
                        "created_at": mg.created_at,
                        "updated_at": mg.updated_at,
                        **audit_response_fields(mg),
                        "deleted_at": getattr(mg, 'deleted_at', None),
                        "process_route_id": getattr(mg, 'process_route_id', None) if hasattr(mg, 'process_route_id') else (getattr(mg.process_route, 'id', None) if hasattr(mg, 'process_route') and mg.process_route else None),
                        "process_route_name": getattr(mg.process_route, 'name', None) if hasattr(mg, 'process_route') and mg.process_route else None,
                    }
                    group_data = MaterialGroupResponse.model_validate(group_dict)
                    result.append(group_data)
                except Exception as e2:
                    logger.error(f"手动构建物料分组 {mg.id if hasattr(mg, 'id') else 'unknown'} 响应数据失败: {str(e2)}")
                    # 跳过该分组，继续处理下一个
                    continue
        
        return result
    
    @staticmethod
    async def update_material_group(
        tenant_id: int,
        group_uuid: str,
        data: MaterialGroupUpdate,
        current_user: Optional[User] = None,
    ) -> MaterialGroupResponse:
        """
        更新物料分组
        
        Args:
            tenant_id: 租户ID
            group_uuid: 物料分组UUID
            data: 物料分组更新数据
            current_user: 当前用户（写入审计字段）
            
        Returns:
            MaterialGroupResponse: 更新后的物料分组对象
            
        Raises:
            NotFoundError: 当物料分组不存在时抛出
            ValidationError: 当编码已存在或父分组不存在时抛出
        """
        material_group = await MaterialGroup.filter(
            tenant_id=tenant_id,
            uuid=group_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not material_group:
            raise NotFoundError(f"物料分组 {group_uuid} 不存在")
        
        # 如果更新父分组ID，检查父分组是否存在且不能是自己
        if data.parent_id is not None:
            if data.parent_id == material_group.id:
                raise ValidationError("不能将自己设置为父分组")
            
            if data.parent_id:
                parent = await MaterialGroup.filter(
                    tenant_id=tenant_id,
                    id=data.parent_id,
                    deleted_at__isnull=True
                ).first()
                
                if not parent:
                    raise ValidationError(f"父分组 {data.parent_id} 不存在")
        
        # 如果更新编码，检查是否已存在
        if data.code and data.code != material_group.code:
            existing = await MaterialGroup.filter(
                tenant_id=tenant_id,
                code=data.code,
                deleted_at__isnull=True
            ).first()
            
            if existing:
                raise ValidationError(f"物料分组编码 {data.code} 已存在")
        
        # 更新字段
        update_data = data.model_dump(exclude_unset=True)
        if "process_route_id" in update_data:
            await MaterialService._validate_material_group_process_route_id(
                tenant_id, update_data.get("process_route_id")
            )
        if "inspection_stages" in update_data:
            from apps.kuaizhizao.services.inspection_policy_service import (
                assert_master_data_inspection_stages_allowed,
                prepare_material_group_inspection_for_write,
            )

            if update_data["inspection_stages"] is not None:
                prepare_material_group_inspection_for_write(update_data)
            await assert_master_data_inspection_stages_allowed(
                tenant_id,
                material_stages=update_data.get("inspection_stages"),
            )
        for key, value in update_data.items():
            setattr(material_group, key, value)
        
        apply_update_audit(material_group, current_user)
        await material_group.save()
        await material_group.fetch_related("process_route")
        return await MaterialService._material_group_to_response(material_group)
    
    @staticmethod
    async def delete_material_group(
        tenant_id: int,
        group_uuid: str
    ) -> None:
        """
        删除物料分组（软删除）
        
        Args:
            tenant_id: 租户ID
            group_uuid: 物料分组UUID
            
        Raises:
            NotFoundError: 当物料分组不存在时抛出
            ValidationError: 当分组下有关联的子分组或物料时抛出
        """
        material_group = await MaterialGroup.filter(
            tenant_id=tenant_id,
            uuid=group_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not material_group:
            raise NotFoundError(f"物料分组 {group_uuid} 不存在")
        
        # 检查是否有关联的子分组
        children_count = await MaterialGroup.filter(
            tenant_id=tenant_id,
            parent_id=material_group.id,
            deleted_at__isnull=True
        ).count()
        
        if children_count > 0:
            raise ValidationError(f"物料分组下存在 {children_count} 个子分组，无法删除")
        
        # 检查是否有关联的物料
        materials_count = await Material.filter(
            tenant_id=tenant_id,
            group_id=material_group.id,
            deleted_at__isnull=True
        ).count()
        
        if materials_count > 0:
            raise ValidationError(f"物料分组下存在 {materials_count} 个物料，无法删除")
        
        # 软删除
        from tortoise import timezone
        material_group.deleted_at = timezone.now()
        await material_group.save()
    
    # ==================== 物料相关方法 ====================
    
    @staticmethod
    async def create_material(
        tenant_id: int,
        data: MaterialCreate,
        current_user: Optional[User] = None,
    ) -> MaterialResponse:
        """
        创建物料
        
        Args:
            tenant_id: 租户ID
            data: 物料创建数据
            
        Returns:
            MaterialResponse: 创建的物料对象
            
        Raises:
            ValidationError: 当编码已存在或分组不存在时抛出
        """
        # 如果指定了分组，检查分组是否存在并获取分组信息
        group = None
        if data.group_id:
            group = await MaterialGroup.filter(
                tenant_id=tenant_id,
                id=data.group_id,
                deleted_at__isnull=True
            ).first()
            
            if not group:
                raise ValidationError(f"物料分组 {data.group_id} 不存在")
        
        # 主编码：strip 后空串视为未提供（与前端一致），仅非空才视为用户/预览指定，避免走 generate_code 覆盖
        if data.main_code is not None and isinstance(data.main_code, str):
            _mc = data.main_code.strip()
            data.main_code = _mc if _mc else None
        is_manual_code = bool(data.main_code)
        
        # 生成主编码（如果未提供或为空字符串）
        if not is_manual_code:
            # 首先尝试使用编码规则生成编码
            material_page_config = next(
                (page for page in CODE_RULE_PAGES if page.get("page_code") == "master-data-material"),
                None
            )
            
            if material_page_config and material_page_config.get("rule_code"):
                if not group:
                    raise ValidationError(
                        "创建物料须选择末级物料分组，才能按分组编号生成主编码"
                    )
                context = await CodeGenerationService.build_material_code_context_from_group(
                    tenant_id,
                    group,
                    source_type=getattr(data, "source_type", None),
                    name=data.name,
                )
                if not context.get("leaf_group_code"):
                    raise ValidationError("所选物料分组未配置分组编号，无法生成主编码")
                data.main_code = await CodeGenerationService.generate_code(
                    tenant_id=tenant_id,
                    rule_code=material_page_config["rule_code"],
                    context=context,
                )
                logger.info(f"使用编码规则生成物料主编码: {data.main_code}")
            else:
                data.main_code = await MaterialCodeService.generate_main_code(
                    tenant_id=tenant_id,
                    material_type=_source_type_to_type_code(getattr(data, "source_type", None)),
                )
        else:
            logger.info(f"使用用户手动输入的物料主编码: {data.main_code}")
        
        # 属性管理相关验证
        master_material = None
        if data.variant_managed and data.variant_attributes:
            # 如果是属性物料，需要找到主物料
            # 主物料：variant_managed=True, variant_attributes=null
            master_material = await Material.filter(
                tenant_id=tenant_id,
                main_code=data.main_code,
                variant_managed=True,
                variant_attributes__isnull=True,  # 主物料的variant_attributes为null
                deleted_at__isnull=True
            ).first()
            
            if not master_material:
                raise ValidationError(
                    f"属性物料必须关联到已存在的主物料。主编码 {data.main_code} 对应的主物料不存在。"
                    f"请先创建主物料（variant_managed=True, variant_attributes=null）"
                )
            
            # 验证属性值
            from core.services.business.material_variant_attribute_service import MaterialVariantAttributeService
            for attr_name, attr_value in data.variant_attributes.items():
                is_valid, error_message = await MaterialVariantAttributeService.validate_attribute_value(
                    tenant_id=tenant_id,
                    attribute_name=attr_name,
                    attribute_value=attr_value,
                )
                if not is_valid:
                    raise ValidationError(f"属性验证失败: {error_message}")
            
            # 检查属性组合唯一性；已存在则幂等返回（避免批量导入/重试报 500）
            normalized_attrs = MaterialService._normalize_variant_attributes_dict(data.variant_attributes)
            if not normalized_attrs:
                raise ValidationError("属性物料须包含至少一项有效属性")
            data.variant_attributes = normalized_attrs
            existing_variant = await MaterialService.find_variant_by_attributes(
                tenant_id=tenant_id,
                main_code=data.main_code,
                variant_attributes=normalized_attrs,
            )
            if existing_variant:
                logger.info(
                    f"属性组合已存在，返回已有 SKU: {existing_variant.code} (main_code={data.main_code})"
                )
                return await _build_material_response(tenant_id, existing_variant)
        else:
            # 如果不是属性物料，检查主编码是否已存在（主编码必须唯一，除非是属性物料）
            existing = await Material.filter(
                tenant_id=tenant_id,
                main_code=data.main_code,
                deleted_at__isnull=True
            ).first()
            
            if existing:
                # 如果已存在的物料是主物料（variant_managed=True, variant_attributes=null）
                # 则允许创建属性物料，但当前逻辑不允许创建非属性物料
                if existing.variant_managed and existing.variant_attributes is None:
                    raise ValidationError(
                        f"主编码 {data.main_code} 已存在主物料。"
                        f"如需创建属性物料，请设置 variant_managed=True 并提供 variant_attributes"
                    )
                else:
                    # 如果是用户手动输入的编码，直接报错，不自动重新生成
                    if is_manual_code:
                        raise ValidationError(
                            f"物料主编码 {data.main_code} 已存在，请使用其他编码。"
                            f"已存在的物料: {existing.name}"
                        )
                    
                    # 如果是自动生成的编码且已存在，循环重新生成直到得到未占用的编码（处理并发、序号未递增等场景）
                    logger.warning(f"主编码 {data.main_code} 已存在，自动重新生成新编码")
                    
                    # 获取物料分组信息（如果之前没有获取）
                    if not group and data.group_id:
                        group = await MaterialGroup.filter(
                            tenant_id=tenant_id,
                            id=data.group_id,
                            deleted_at__isnull=True
                        ).first()
                    
                    material_page_config = next(
                        (page for page in CODE_RULE_PAGES if page.get("page_code") == "master-data-material"),
                        None
                    )
                    
                    context = await CodeGenerationService.build_material_code_context_from_group(
                        tenant_id,
                        group,
                        source_type=getattr(data, "source_type", None),
                        name=data.name,
                    )
                    max_attempts = 20
                    for attempt in range(max_attempts):
                        data.main_code = await CodeGenerationService.generate_code(
                            tenant_id=tenant_id,
                            rule_code=material_page_config["rule_code"],
                            context=context,
                        )
                        logger.info(
                            f"自动重新生成物料主编码(尝试 {attempt + 1}/{max_attempts}): {data.main_code}"
                        )
                        
                        existing_check = await Material.filter(
                            tenant_id=tenant_id,
                            main_code=data.main_code,
                            deleted_at__isnull=True
                        ).first()
                        if not existing_check:
                            break
                        logger.warning(f"生成的编码 {data.main_code} 仍已存在，第 {attempt + 1} 次重试")
                    
                    else:
                        raise ValidationError(
                            f"连续 {max_attempts} 次生成的编码均已存在，"
                            f"请检查编码规则配置或联系系统管理员"
                        )
        
        # 智能识别重复物料
        duplicates = await MaterialCodeService.find_duplicate_materials(
            tenant_id=tenant_id,
            name=data.name,
            specification=data.specification,
            base_unit=data.base_unit
        )
        
        # 如果有高置信度的重复物料，记录警告（但不阻止创建）
        if duplicates:
            high_confidence_duplicates = [d for d in duplicates if d["confidence"] == "high"]
            if high_confidence_duplicates:
                logger.warning(
                    f"检测到高置信度重复物料: {data.name}，"
                    f"可能重复的物料: {[d['material'].main_code for d in high_confidence_duplicates]}"
                )
        
        # 准备创建数据
        # 使用 model_dump 方法（Pydantic v2）或 dict 方法（Pydantic v1）
        # 使用 by_alias=False 确保使用字段名（下划线命名）而不是别名（驼峰命名）
        if hasattr(data, 'model_dump'):
            material_data = data.model_dump(
                exclude={"department_codes", "customer_codes", "supplier_codes", "defaults"},
                by_alias=False  # 使用字段名而不是别名
            )
        else:
            material_data = data.dict(
                exclude={"department_codes", "customer_codes", "supplier_codes", "defaults"},
                by_alias=False  # 使用字段名而不是别名
            )
        # 兼容处理：如果提供了code但没有main_code，将code作为main_code（向后兼容）
        if (not material_data.get("main_code") or (isinstance(material_data.get("main_code"), str) and not material_data.get("main_code").strip())) and material_data.get("code"):
            material_data["main_code"] = material_data["code"]
        
        # 确保 main_code 必填（生成逻辑已设置 data.main_code，此处兜底）
        main_code_val = material_data.get("main_code") or getattr(data, "main_code", None)
        if not main_code_val or (isinstance(main_code_val, str) and not main_code_val.strip()):
            raise ValidationError("物料主编码不能为空，请检查编码规则或手动填写")
        material_data["main_code"] = main_code_val.strip() if isinstance(main_code_val, str) else main_code_val

        _normalize_material_logistics_fields(material_data, for_create=True)
        _apply_canonical_material_source_type(material_data)
        material_data["source_type"] = require_canonical_material_source_type(
            material_data.get("source_type"),
            material_code=material_data.get("main_code") or material_data.get("code"),
            material_name=material_data.get("name"),
        )
        
        # 同步 code：主物料 code=main_code；属性 SKU 在创建循环内分配唯一编码
        is_variant_sku = bool(material_data.get("variant_attributes"))
        if not is_variant_sku:
            material_data["code"] = material_data["main_code"]
        
        # 处理属性：规范化键序与空值（与 find_variant_by_attributes 一致）
        if material_data.get("variant_attributes"):
            material_data["variant_attributes"] = MaterialService._normalize_variant_attributes_dict(
                material_data["variant_attributes"]
            )
        
        # 处理默认值
        if data.defaults:
            material_data["defaults"] = data.defaults

        # 自制件：默认工艺路线可能仅写在 defaults（前端未带 process_route_id），创建时同步 FK
        if (
            not material_data.get("process_route_id")
            and material_data.get("source_type") == "Make"
            and _material_defaults_as_dict(data.defaults)
        ):
            resolved_pr_id = await _resolve_process_route_id_from_defaults_dict(tenant_id, data.defaults)
            if resolved_pr_id:
                material_data["process_route_id"] = resolved_pr_id

        from apps.kuaizhizao.services.inspection_policy_service import (
            assert_master_data_inspection_stages_allowed,
            prepare_material_inspection_for_write,
        )

        if material_data.get("inspection_stages") is not None or material_data.get("inspection_mode") is not None:
            prepare_material_inspection_for_write(material_data)
            await assert_master_data_inspection_stages_allowed(
                tenant_id,
                material_stages=material_data.get("inspection_stages"),
            )
        
        # 创建物料（属性 SKU 并发导入时 code 可能冲突，自动重试下一序号或返回已存在组合）
        material = None
        create_attempts = 10 if is_variant_sku else 1
        for attempt in range(create_attempts):
            if is_variant_sku:
                material_data["code"] = await _resolve_variant_material_code(
                    tenant_id,
                    material_data["main_code"],
                    material_data["variant_attributes"],
                )
            try:
                apply_create_audit(material_data, current_user)
                material = await Material.create(
                    tenant_id=tenant_id,
                    **material_data
                )
                break
            except IntegrityError as exc:
                err_text = str(exc).lower()
                is_code_conflict = "tenant_code" in err_text or "(tenant_id, code)" in err_text
                if is_variant_sku and is_code_conflict:
                    existing_variant = await MaterialService.find_variant_by_attributes(
                        tenant_id=tenant_id,
                        main_code=material_data["main_code"],
                        variant_attributes=material_data["variant_attributes"],
                    )
                    if existing_variant:
                        logger.info(
                            f"SKU 编码冲突后命中已有组合: {existing_variant.code} (attempt={attempt + 1})"
                        )
                        return await _build_material_response(tenant_id, existing_variant)

                    conflict_code = material_data.get("code")
                    if conflict_code:
                        conflict_row = await Material.filter(
                            tenant_id=tenant_id,
                            code=conflict_code,
                            deleted_at__isnull=True,
                        ).first()
                        if conflict_row and conflict_row.main_code == material_data["main_code"]:
                            target_json = json.dumps(
                                MaterialService._normalize_variant_attributes_dict(
                                    material_data["variant_attributes"]
                                ),
                                sort_keys=True,
                            )
                            conflict_json = json.dumps(
                                MaterialService._normalize_variant_attributes_dict(
                                    conflict_row.variant_attributes
                                ),
                                sort_keys=True,
                            )
                            if target_json == conflict_json:
                                logger.info(
                                    f"SKU 编码冲突且属性一致，幂等返回: {conflict_row.code} (attempt={attempt + 1})"
                                )
                                return await _build_material_response(tenant_id, conflict_row)

                    if attempt < create_attempts - 1:
                        logger.warning(
                            f"SKU 编码冲突，重试分配: {material_data.get('code')} (attempt={attempt + 1})"
                        )
                        continue
                raise

        if material is None:
            raise ValidationError("创建物料失败，请稍后重试")
        
        # 如果是属性物料，自动生成属性编码并作为部门编码（类型：VARIANT）存储
        if data.variant_managed and data.variant_attributes and master_material:
            try:
                variant_code = material.code or await _resolve_variant_material_code(
                    tenant_id,
                    material.main_code,
                    data.variant_attributes,
                )
                if material.code != variant_code:
                    material.code = variant_code
                    await material.save(update_fields=["code", "updated_at"])

                # 将属性编码作为部门编码（类型：VARIANT）存储
                await MaterialCodeService.create_code_alias(
                    tenant_id=tenant_id,
                    material_id=material.id,
                    code_type="VARIANT",
                    code=variant_code,
                    description=f"属性编码：{', '.join([f'{k}={v}' for k, v in sorted(data.variant_attributes.items())])}"
                )
                logger.info(f"自动生成属性编码: {variant_code} (material_id={material.id})")
            except Exception as e:
                # 如果属性编码生成失败，记录警告但不阻止创建
                logger.warning(f"生成属性编码失败: {e}")
        
        # 创建部门编码别名（如果提供了部门编码）
        if data.department_codes:
            for alias_data in data.department_codes:
                try:
                    await MaterialCodeService.create_code_alias(
                        tenant_id=tenant_id,
                        material_id=material.id,
                        code_type=alias_data.get("code_type", "CUSTOM"),
                        code=alias_data.get("code"),
                        department=alias_data.get("department"),
                        description=alias_data.get("description"),
                        is_primary=alias_data.get("is_primary", False)
                    )
                except ValidationError as e:
                    # 如果编码已存在，记录警告但不阻止创建
                    logger.warning(f"创建编码别名失败: {e}")
        
        # 创建客户编码别名（如果提供了客户编码）
        if data.customer_codes:
            for customer_code_data in data.customer_codes:
                try:
                    await MaterialCodeService.create_code_alias(
                        tenant_id=tenant_id,
                        material_id=material.id,
                        code_type="CUSTOMER",
                        code=customer_code_data.get("code"),
                        name=customer_code_data.get("name"),
                        description=customer_code_data.get("description"),
                        external_entity_type="customer",
                        external_entity_id=_partner_id_from_code_mapping_payload(
                            customer_code_data, "customer_id", "customerId"
                        ),
                    )
                except ValidationError as e:
                    logger.warning(f"创建客户编码别名失败: {e}")
        
        # 创建供应商编码别名（如果提供了供应商编码）
        if data.supplier_codes:
            for supplier_code_data in data.supplier_codes:
                try:
                    await MaterialCodeService.create_code_alias(
                        tenant_id=tenant_id,
                        material_id=material.id,
                        code_type="SUPPLIER",
                        code=supplier_code_data.get("code"),
                        name=supplier_code_data.get("name"),
                        description=supplier_code_data.get("description"),
                        external_entity_type="supplier",
                        external_entity_id=_partner_id_from_code_mapping_payload(
                            supplier_code_data, "supplier_id", "supplierId"
                        ),
                    )
                except ValidationError as e:
                    logger.warning(f"创建供应商编码别名失败: {e}")
        
        # 构建响应
        return await _build_material_response(tenant_id, material)

    @staticmethod
    def get_standard_parts_preset_catalog() -> Dict[str, Any]:
        """标准件预设目录（行业/一级/二级），供 GET standard-parts/preset-preview。"""
        from apps.master_data.services.material_standard_parts_catalog import (
            standard_parts_preset_catalog_for_api,
        )

        return standard_parts_preset_catalog_for_api()

    @staticmethod
    def _preset_category_group_code(category_id: str) -> str:
        """预设分类对应物料分组编码（组织内唯一，≤50）。"""
        raw = re.sub(r"[^0-9A-Za-z]+", "_", (category_id or "").strip().upper())
        raw = re.sub(r"_+", "_", raw).strip("_")
        code = f"SP_{raw}" if raw else "SP_UNKNOWN"
        if len(code) <= 50:
            return code
        digest = hashlib.sha256(category_id.encode("utf-8")).hexdigest()[:16].upper()
        return f"SP_{digest}"

    @staticmethod
    async def _get_or_create_preset_category_group(
        tenant_id: int,
        parent_id: Optional[int],
        category_id: str,
        category_name: str,
        category_description: Optional[str],
    ) -> Tuple[MaterialGroup, str]:
        code = MaterialService._preset_category_group_code(category_id)
        existing = await MaterialGroup.filter(
            tenant_id=tenant_id, code=code, deleted_at__isnull=True
        ).first()
        if existing:
            return existing, "reused"
        desc = (category_description or "").strip() or None
        data = MaterialGroupCreate(
            code=code,
            name=category_name[:200],
            parent_id=parent_id,
            description=desc,
            is_active=True,
        )
        resp = await MaterialService.create_material_group(tenant_id, data)
        mg = await MaterialGroup.filter(id=resp.id, tenant_id=tenant_id, deleted_at__isnull=True).first()
        if not mg:
            raise ValidationError("创建预设分类物料分组失败")
        return mg, "created"

    @staticmethod
    async def load_standard_parts_preset(
        tenant_id: int,
        preset_keys: List[str],
        code_mode: str,
        *,
        group_mode: str = "single",
        material_group_uuid: Optional[str] = None,
        parent_material_group_uuid: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        按勾选导入标准件物料；主编码为系统编码(auto) 或目录国标码(gb)。
        group_mode=single：全部写入 material_group_uuid 对应分组。
        group_mode=preset_by_category：按预设库二级分类各建/复用一个物料分组（编码 SP_*），再写入对应分组；
        可选 parent_material_group_uuid 作为这些分组的父级。
        """
        from apps.master_data.services.material_standard_parts_catalog import (
            get_standard_part_by_preset_key,
            get_preset_key_category_lookup,
            validate_preset_keys,
        )

        mode = (code_mode or "auto").strip().lower()
        if mode not in ("auto", "gb"):
            raise ValidationError("codeMode 须为 auto（系统编码）或 gb（国标推荐编号作主数据主编码）")

        gm = (group_mode or "single").strip().lower()
        if gm not in ("single", "preset_by_category"):
            raise ValidationError("groupMode 须为 single（指定分组）或 preset_by_category（按预设分类建分组）")

        empty_out = {
            "created": 0,
            "skipped_duplicate_code": 0,
            "skipped_duplicate_item": 0,
            "failed": 0,
            "groups_created": 0,
            "groups_reused": 0,
            "message": "未选择任何标准件",
        }
        if not preset_keys:
            return empty_out

        if gm == "single":
            uid = (material_group_uuid or "").strip()
            if not uid:
                raise ValidationError("指定分组模式下须选择目标物料分组")

        validate_preset_keys(preset_keys)

        single_group: Optional[MaterialGroup] = None
        category_to_group_id: Dict[str, int] = {}
        groups_created = 0
        groups_reused = 0
        meta_lookup = get_preset_key_category_lookup()

        if gm == "single":
            uid = (material_group_uuid or "").strip()
            single_group = await MaterialGroup.filter(
                tenant_id=tenant_id, uuid=uid, deleted_at__isnull=True
            ).first()
            if not single_group:
                raise ValidationError("物料分组不存在或已删除")
        else:
            parent_id: Optional[int] = None
            puid = (parent_material_group_uuid or "").strip()
            if puid:
                parent_mg = await MaterialGroup.filter(
                    tenant_id=tenant_id, uuid=puid, deleted_at__isnull=True
                ).first()
                if not parent_mg:
                    raise ValidationError("父级物料分组不存在或已删除")
                parent_id = parent_mg.id

            needed: Dict[str, Tuple[str, str]] = {}
            for key in preset_keys:
                meta = meta_lookup.get(key)
                if not meta:
                    continue
                cid = meta["category_id"]
                if cid not in needed:
                    needed[cid] = (meta["category_name"], meta.get("category_description") or "")

            for cid, (cname, cdesc) in needed.items():
                grp, st = await MaterialService._get_or_create_preset_category_group(
                    tenant_id, parent_id, cid, cname, cdesc or None
                )
                category_to_group_id[cid] = grp.id
                if st == "created":
                    groups_created += 1
                else:
                    groups_reused += 1

        created = 0
        skipped_duplicate_code = 0
        skipped_duplicate_item = 0
        failed = 0

        for key in preset_keys:
            item = get_standard_part_by_preset_key(key)
            if not item:
                failed += 1
                continue

            if gm == "preset_by_category":
                cmeta = meta_lookup.get(key)
                if not cmeta:
                    failed += 1
                    continue
                cid = cmeta["category_id"]
                target_gid = category_to_group_id.get(cid)
                if not target_gid:
                    failed += 1
                    continue
            else:
                assert single_group is not None
                target_gid = single_group.id

            name = (item.get("name") or "").strip()
            if not name:
                failed += 1
                continue

            spec_raw = item.get("specification")
            spec = (spec_raw or "").strip() or None
            gb_code = ((item.get("gb_code") or "").strip())[:50]
            gb_std = (item.get("gb_standard") or "").strip()
            base_unit = (item.get("base_unit") or "件").strip() or "件"
            texture = (item.get("texture") or "").strip() or None
            desc_extra = (item.get("description") or "").strip()
            desc = desc_extra or (f"标准件｜{gb_std}" if gb_std else "标准件预设导入")

            if mode == "gb":
                if not gb_code:
                    failed += 1
                    continue
                exists_code = await Material.filter(
                    tenant_id=tenant_id, main_code=gb_code, deleted_at__isnull=True
                ).exists()
                if exists_code:
                    skipped_duplicate_code += 1
                    continue
            else:
                q = Material.filter(
                    tenant_id=tenant_id,
                    group_id=target_gid,
                    name=name,
                    deleted_at__isnull=True,
                )
                if spec:
                    dup = await q.filter(specification=spec).exists()
                else:
                    dup = await q.filter(Q(specification__isnull=True) | Q(specification="")).exists()
                if dup:
                    skipped_duplicate_item += 1
                    continue

            create_data = MaterialCreate(
                name=name,
                specification=spec,
                base_unit=base_unit,
                group_id=target_gid,
                source_type="Buy",
                description=desc,
                texture=texture,
                is_active=True,
                main_code=gb_code if mode == "gb" else None,
            )

            try:
                await MaterialService.create_material(tenant_id, create_data)
                created += 1
            except ValidationError as e:
                logger.warning(f"标准件预设导入失败 presetKey={key}: {e}")
                failed += 1
            except Exception as e:
                logger.warning(f"标准件预设导入异常 presetKey={key}: {e}")
                failed += 1

        parts = [f"新建 {created} 条"]
        if skipped_duplicate_code:
            parts.append(f"跳过主编码已存在 {skipped_duplicate_code} 条")
        if skipped_duplicate_item:
            parts.append(f"跳过同组同名同规格 {skipped_duplicate_item} 条")
        if failed:
            parts.append(f"失败 {failed} 条")
        if gm == "preset_by_category" and (groups_created or groups_reused):
            parts.append(f"预设分类分组 新建 {groups_created} 个、复用 {groups_reused} 个")
        msg = "，".join(parts) + "。"

        return {
            "created": created,
            "skipped_duplicate_code": skipped_duplicate_code,
            "skipped_duplicate_item": skipped_duplicate_item,
            "failed": failed,
            "groups_created": groups_created,
            "groups_reused": groups_reused,
            "message": msg,
        }

    @staticmethod
    async def get_material_variants(
        tenant_id: int,
        master_material_id: Optional[int] = None,
        master_material_uuid: Optional[str] = None,
        main_code: Optional[str] = None
    ) -> List[MaterialResponse]:
        """
        获取主物料的所有属性物料
        
        Args:
            tenant_id: 租户ID
            master_material_id: 主物料ID（可选）
            master_material_uuid: 主物料UUID（可选）
            main_code: 主编码（可选，如果提供，将查询该主编码下的所有属性物料）
            
        Returns:
            List[MaterialResponse]: 属性物料列表
            
        Raises:
            NotFoundError: 当主物料不存在时抛出
            ValidationError: 当参数不足时抛出
        """
        # 确定主物料
        master_material = None
        
        if master_material_id:
            master_material = await Material.filter(
                tenant_id=tenant_id,
                id=master_material_id,
                deleted_at__isnull=True
            ).first()
        elif master_material_uuid:
            master_material = await Material.filter(
                tenant_id=tenant_id,
                uuid=master_material_uuid,
                deleted_at__isnull=True
            ).first()
        elif main_code:
            # 通过主编码查找主物料（variant_managed=True, variant_attributes=null）
            master_material = await Material.filter(
                tenant_id=tenant_id,
                main_code=main_code,
                variant_managed=True,
                variant_attributes__isnull=True,
                deleted_at__isnull=True
            ).first()
        else:
            raise ValidationError("必须提供 master_material_id、master_material_uuid 或 main_code 之一")
        
        if not master_material:
            identifier = master_material_id or master_material_uuid or main_code
            raise NotFoundError(f"主物料不存在: {identifier}")
        
        # 查询该主物料的所有属性物料（variant_managed=True, variant_attributes不为null）
        variants = await Material.filter(
            tenant_id=tenant_id,
            main_code=master_material.main_code,
            variant_managed=True,
            variant_attributes__isnull=False,  # 属性物料的variant_attributes不为null
            deleted_at__isnull=True
        ).prefetch_related("group").all()
        
        # 加载编码别名并构建响应
        from apps.master_data.schemas.material_schemas import MaterialCodeAliasResponse
        result = []
        for variant in variants:
            aliases = await MaterialCodeService.get_material_aliases(
                tenant_id=tenant_id,
                material_id=variant.id
            )
            resp_data = _material_to_response_data(variant)
            resp_data["code_aliases"] = [MaterialCodeAliasResponse.model_validate(a) for a in aliases]
            result.append(MaterialResponse.model_validate(resp_data))
        
        return result

    @staticmethod
    def _normalize_variant_attributes_dict(attrs: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        if not attrs:
            return {}
        cleaned: Dict[str, Any] = {}
        for key, value in attrs.items():
            if value is None or value == "":
                continue
            if isinstance(value, list) and len(value) == 0:
                continue
            cleaned[str(key)] = value
        return dict(sorted(cleaned.items()))

    @classmethod
    async def find_variant_by_attributes(
        cls,
        tenant_id: int,
        main_code: str,
        variant_attributes: Dict[str, Any],
    ) -> Optional[Material]:
        target_json = json.dumps(cls._normalize_variant_attributes_dict(variant_attributes), sort_keys=True)
        variants = await Material.filter(
            tenant_id=tenant_id,
            main_code=main_code,
            variant_managed=True,
            variant_attributes__isnull=False,
            deleted_at__isnull=True,
        ).all()
        for variant in variants:
            if not variant.variant_attributes:
                continue
            existing_json = json.dumps(
                cls._normalize_variant_attributes_dict(variant.variant_attributes),
                sort_keys=True,
            )
            if existing_json == target_json:
                return variant
        return None

    @classmethod
    async def _resolve_master_material(
        cls,
        tenant_id: int,
        master_material_uuid: Optional[str] = None,
        main_code: Optional[str] = None,
    ) -> Material:
        master_material = None
        if master_material_uuid:
            master_material = await Material.filter(
                tenant_id=tenant_id,
                uuid=master_material_uuid,
                deleted_at__isnull=True,
            ).first()
        elif main_code:
            master_material = await Material.filter(
                tenant_id=tenant_id,
                main_code=main_code,
                variant_managed=True,
                variant_attributes__isnull=True,
                deleted_at__isnull=True,
            ).first()
        if not master_material:
            identifier = master_material_uuid or main_code
            raise NotFoundError(f"主物料不存在: {identifier}")
        if not master_material.variant_managed or master_material.variant_attributes is not None:
            raise ValidationError("目标物料不是属性管理主物料（须 variant_managed=true 且无属性值）")
        return master_material

    @classmethod
    async def materialize_variant_combo(
        cls,
        tenant_id: int,
        data: MaterialMaterializeVariantRequest,
    ) -> MaterialMaterializeVariantResponse:
        from core.services.business.material_variant_attribute_service import MaterialVariantAttributeService

        master_material = await cls._resolve_master_material(
            tenant_id,
            data.master_material_uuid,
            data.main_code,
        )
        normalized_attrs = cls._normalize_variant_attributes_dict(data.variant_attributes)
        if not normalized_attrs:
            raise ValidationError("variantAttributes 须包含至少一项有效属性")

        for attr_name, attr_value in normalized_attrs.items():
            is_valid, error_message = await MaterialVariantAttributeService.validate_attribute_value(
                tenant_id=tenant_id,
                attribute_name=attr_name,
                attribute_value=attr_value,
            )
            if not is_valid:
                raise ValidationError(f"属性验证失败: {error_message}")

        existing = await cls.find_variant_by_attributes(
            tenant_id, master_material.main_code, normalized_attrs
        )
        if existing:
            resp = await cls.get_material_by_uuid(tenant_id, str(existing.uuid))
            return MaterialMaterializeVariantResponse(
                material=resp,
                created=False,
                matched_existing=True,
            )

        if not data.create_if_missing:
            raise NotFoundError("未找到匹配的属性 SKU，且 createIfMissing=false")

        create_data = MaterialCreate(
            main_code=master_material.main_code,
            name=master_material.name,
            group_id=master_material.group_id,
            specification=master_material.specification,
            base_unit=master_material.base_unit,
            units=master_material.units,
            batch_managed=master_material.batch_managed,
            default_batch_rule_id=master_material.default_batch_rule_id,
            serial_managed=master_material.serial_managed,
            default_serial_rule_id=master_material.default_serial_rule_id,
            variant_managed=True,
            variant_attributes=normalized_attrs,
            description=master_material.description,
            brand=master_material.brand,
            model=master_material.model,
            texture=master_material.texture,
            is_active=master_material.is_active,
            defaults=master_material.defaults,
            source_type=master_material.source_type,
            source_config=master_material.source_config,
            inspection_mode=master_material.inspection_mode,
            default_inspection_plan_id=master_material.default_inspection_plan_id,
            over_report_mode=master_material.over_report_mode,
            over_report_value=master_material.over_report_value,
        )
        created = await cls.create_material(tenant_id, create_data)
        return MaterialMaterializeVariantResponse(
            material=created,
            created=True,
            matched_existing=False,
        )

    @classmethod
    async def generate_variant_skus(
        cls,
        tenant_id: int,
        master_material_uuid: str,
        data: MaterialGenerateVariantsRequest,
    ) -> MaterialGenerateVariantsResponse:
        from core.services.business.material_variant_attribute_service import MaterialVariantAttributeService

        master_material = await cls._resolve_master_material(tenant_id, master_material_uuid, None)
        definitions, _ = await MaterialVariantAttributeService.list_attribute_definitions(
            tenant_id=tenant_id,
            is_active=True,
            limit=10000,
        )
        enum_defs = [
            d
            for d in definitions
            if d.attribute_type == "enum" and d.get_enum_values()
        ]
        if data.attribute_names:
            name_set = set(data.attribute_names)
            enum_defs = [d for d in enum_defs if d.attribute_name in name_set]

        if not enum_defs:
            raise ValidationError("没有可用于组合的枚举型属性定义")

        max_auto_attrs = 3
        if not data.attribute_names and len(enum_defs) > max_auto_attrs:
            raise ValidationError(
                f"参与自动组合的枚举属性为 {len(enum_defs)} 个，超过上限 {max_auto_attrs}。"
                "请使用「新增行」手工维护，或通过 attributeNames 指定不超过 3 个属性"
            )

        attr_names = [d.attribute_name for d in enum_defs]
        value_lists = [d.get_enum_values() for d in enum_defs]
        combos = [
            dict(zip(attr_names, combo))
            for combo in itertools.product(*value_lists)
        ]

        max_auto_combos = 100
        if len(combos) > max_auto_combos:
            raise ValidationError(
                f"自动组合数量为 {len(combos)}，超过上限 {max_auto_combos}。"
                f"请使用「新增行」手工维护，或通过 attributeNames 指定不超过 3 个枚举属性且组合数≤{max_auto_combos}"
            )

        created_uuids: List[str] = []
        skipped_count = 0
        failed_count = 0
        created_count = 0

        for combo in combos:
            existing = await cls.find_variant_by_attributes(
                tenant_id, master_material.main_code, combo
            )
            if existing:
                if data.skip_existing:
                    skipped_count += 1
                    continue
                created_uuids.append(str(existing.uuid))
                continue
            try:
                create_data = MaterialCreate(
                    main_code=master_material.main_code,
                    name=master_material.name,
                    group_id=master_material.group_id,
                    specification=master_material.specification,
                    base_unit=master_material.base_unit,
                    units=master_material.units,
                    batch_managed=master_material.batch_managed,
                    default_batch_rule_id=master_material.default_batch_rule_id,
                    serial_managed=master_material.serial_managed,
                    default_serial_rule_id=master_material.default_serial_rule_id,
                    variant_managed=True,
                    variant_attributes=combo,
                    description=master_material.description,
                    brand=master_material.brand,
                    model=master_material.model,
                    texture=master_material.texture,
                    is_active=master_material.is_active,
                    defaults=master_material.defaults,
                    source_type=master_material.source_type,
                    source_config=master_material.source_config,
                    inspection_mode=master_material.inspection_mode,
                    default_inspection_plan_id=master_material.default_inspection_plan_id,
                    over_report_mode=master_material.over_report_mode,
                    over_report_value=master_material.over_report_value,
                )
                created = await cls.create_material(tenant_id, create_data)
                created_uuids.append(str(created.uuid))
                created_count += 1
            except ValidationError:
                failed_count += 1

        message = (
            f"生成完成：新建 {created_count} 个，跳过 {skipped_count} 个，失败 {failed_count} 个"
        )
        return MaterialGenerateVariantsResponse(
            created_count=created_count,
            skipped_count=skipped_count,
            failed_count=failed_count,
            created_uuids=created_uuids,
            message=message,
        )
    
    @staticmethod
    async def get_material_by_uuid(
        tenant_id: int,
        material_uuid: str
    ) -> MaterialResponse:
        """
        根据UUID获取物料
        
        Args:
            tenant_id: 租户ID
            material_uuid: 物料UUID
            
        Returns:
            MaterialResponse: 物料对象
            
        Raises:
            NotFoundError: 当物料不存在时抛出
        """
        material = await Material.filter(
            tenant_id=tenant_id,
            uuid=material_uuid,
            deleted_at__isnull=True
        ).prefetch_related("group", "process_route").first()
        
        if not material:
            raise NotFoundError(f"物料 {material_uuid} 不存在")
        
        # 加载编码别名
        aliases = await MaterialCodeService.get_material_aliases(
            tenant_id=tenant_id,
            material_id=material.id
        )
        
        # 构建响应
        from apps.master_data.schemas.material_schemas import MaterialCodeAliasResponse
        resp_data = _material_to_response_data(material)
        resp_data["code_aliases"] = [MaterialCodeAliasResponse.model_validate(a) for a in aliases]
        await _enrich_inspection_plan_name(resp_data)
        await _enrich_material_process_route_display(tenant_id, material, resp_data)
        return MaterialResponse.model_validate(resp_data)
    
    @staticmethod
    async def _list_materials_tree(
        tenant_id: int,
        query,
        keyword: Optional[str],
        skip: int,
        limit: int,
        db_sort: str,
        desc: bool,
    ) -> MaterialListResponse:
        """树形列表：仅分页主行（variant_attributes 为空），属性 SKU 挂到 children。"""
        keyword_norm = (keyword or "").strip()
        root_query = query.filter(variant_attributes__isnull=True)
        root_matched_codes: set = set()

        if keyword_norm:
            matched_rows = await query.values("main_code", "variant_attributes")
            show_main_codes: set = set()
            for row in matched_rows:
                mc = row.get("main_code")
                if not mc:
                    continue
                show_main_codes.add(mc)
                if row.get("variant_attributes") is None:
                    root_matched_codes.add(mc)
            if not show_main_codes:
                return MaterialListResponse(items=[], total=0)
            root_query = root_query.filter(main_code__in=list(show_main_codes))

        total = await root_query.count()
        order_expr = f"-{db_sort}" if desc else db_sort
        roots = (
            await root_query.prefetch_related("group", "process_route")
            .offset(skip)
            .limit(limit)
            .order_by(order_expr)
            .all()
        )

        variant_main_codes = [r.main_code for r in roots if r.variant_managed]
        children_by_main: Dict[str, List[Any]] = defaultdict(list)
        if variant_main_codes:
            children = (
                await Material.filter(
                    tenant_id=tenant_id,
                    main_code__in=variant_main_codes,
                    variant_managed=True,
                    variant_attributes__isnull=False,
                    deleted_at__isnull=True,
                )
                .prefetch_related("group", "process_route")
                .order_by("code", "id")
                .all()
            )
            for child in children:
                if keyword_norm and child.main_code not in root_matched_codes:
                    if not _material_orm_matches_keyword(child, keyword_norm):
                        continue
                children_by_main[child.main_code].append(child)

        all_rows: List[Any] = list(roots)
        for kids in children_by_main.values():
            all_rows.extend(kids)

        raw_rows: List[Dict[str, Any]] = []
        materials_for_rows: List[Any] = []
        for m in all_rows:
            resp_data = _material_to_response_data(m)
            resp_data["code_aliases"] = []
            raw_rows.append(resp_data)
            materials_for_rows.append(m)
        await _batch_enrich_process_route_for_material_list(tenant_id, materials_for_rows, raw_rows)

        row_by_id = {r["id"]: r for r in raw_rows}
        items: List[MaterialResponse] = []
        for root in roots:
            root_data = row_by_id.get(root.id)
            if not root_data:
                raise ValidationError(
                    f"物料树节点序列化缺失: id={getattr(root, 'id', None)} "
                    f"code={getattr(root, 'code', None)}"
                )
            kids_data = []
            for child in children_by_main.get(root.main_code, []):
                cd = row_by_id.get(child.id)
                if cd:
                    kids_data.append(MaterialResponse.model_validate(cd))
            if kids_data:
                root_data = {**root_data, "children": kids_data}
            items.append(MaterialResponse.model_validate(root_data))

        return MaterialListResponse(items=items, total=total)

    @staticmethod
    async def list_materials(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        group_id: Optional[int] = None,
        is_active: Optional[bool] = None,
        keyword: Optional[str] = None,
        code: Optional[str] = None,
        name: Optional[str] = None,
        source_type: Optional[str] = None,
        specification: Optional[str] = None,
        brand: Optional[str] = None,
        model: Optional[str] = None,
        base_unit: Optional[str] = None,
        sort_by: Optional[str] = None,
        sort_order: Optional[str] = None,
        no_group: Optional[bool] = None,
        tree_view: Optional[bool] = None,
        masters_only: Optional[bool] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
        updated_start_date: Optional[str] = None,
        updated_end_date: Optional[str] = None,
        ids: Optional[List[int]] = None,
    ) -> MaterialListResponse:
        """
        获取物料列表

        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            group_id: 物料分组ID（可选，用于过滤）
            is_active: 是否启用（可选）
            keyword: 搜索关键词（物料编码、名称或规格）
            code: 物料编码（精确匹配）
            name: 物料名称（模糊匹配）
            source_type: 物料来源类型（可选，用于过滤）
            specification: 规格（可选，模糊匹配）
            brand: 品牌（可选，模糊匹配）
            model: 型号（可选，模糊匹配）
            base_unit: 基础单位（可选，精确匹配）
            ids: 按物料主键批量精确查询（可选，用于 BOM 等场景补齐名称）

        Returns:
            MaterialListResponse: 物料列表响应（含总数）
        """
        query = Material.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        if ids is not None:
            unique_ids = list(dict.fromkeys(int(i) for i in ids if i is not None))
            if not unique_ids:
                return MaterialListResponse(items=[], total=0)
            query = query.filter(id__in=unique_ids)

        if no_group:
            query = query.filter(group_id__isnull=True)
        elif group_id is not None:
            # 递归获取所有子分组ID（包括当前分组本身）
            async def get_all_child_group_ids(parent_group_id: int) -> List[int]:
                """递归获取所有子分组ID（包括父分组本身）"""
                group_ids = [parent_group_id]
                # 获取直接子分组
                child_groups = await MaterialGroup.filter(
                    tenant_id=tenant_id,
                    parent_id=parent_group_id,
                    deleted_at__isnull=True
                ).values_list("id", flat=True)
                
                # 递归获取子分组的子分组
                for child_id in child_groups:
                    child_ids = await get_all_child_group_ids(child_id)
                    group_ids.extend(child_ids)
                
                return group_ids
            
            # 获取当前分组及其所有子分组的ID
            all_group_ids = await get_all_child_group_ids(group_id)
            # 使用 in 查询，查询所有相关分组的物料
            query = query.filter(group_id__in=all_group_ids)

        if is_active is not None:
            query = query.filter(is_active=is_active)

        if source_type is not None:
            query = query.filter(source_type=source_type)

        if base_unit is not None:
            query = query.filter(base_unit=base_unit)

        # 添加搜索条件（支持主编码和部门编码搜索）
        if keyword:
            # 主编码、名称、规格；部门编码见下方别名表
            main_code_query = (
                Q(main_code__icontains=keyword)
                | Q(name__icontains=keyword)
                | Q(specification__icontains=keyword)
                | Q(code__icontains=keyword)
            )
            # 如果有关键词，也尝试通过部门编码搜索
            code_aliases = await MaterialCodeAlias.filter(
                tenant_id=tenant_id,
                code__icontains=keyword,
                deleted_at__isnull=True
            ).values_list("material_id", flat=True)
            
            if code_aliases:
                # 如果找到部门编码匹配，添加到查询条件
                query = query.filter(main_code_query | Q(id__in=code_aliases))
            else:
                query = query.filter(main_code_query)

        if code:
            # 首先尝试通过主编码匹配
            material_by_code = await MaterialCodeService.get_material_by_code(
                tenant_id=tenant_id,
                code=code
            )
            if material_by_code:
                # 如果找到物料，只返回该物料
                query = query.filter(id=material_by_code.id)
            else:
                # 如果未找到，尝试模糊匹配主编码
                query = query.filter(main_code__icontains=code)

        if name:
            # 模糊匹配物料名称
            query = query.filter(name__icontains=name)

        if specification:
            # 模糊匹配规格
            query = query.filter(specification__icontains=specification)

        if brand:
            # 模糊匹配品牌
            query = query.filter(brand__icontains=brand)

        if model:
            # 模糊匹配型号
            query = query.filter(model__icontains=model)

        from apps.master_data.services.master_data_list_core import (
            apply_master_crud_created_date_range,
            apply_master_crud_updated_date_range,
        )

        query = apply_master_crud_created_date_range(
            query,
            start_date=created_start_date,
            end_date=created_end_date,
        )
        query = apply_master_crud_updated_date_range(
            query,
            start_date=updated_start_date,
            end_date=updated_end_date,
        )

        # 下拉选择等场景：仅主物料/非属性 SKU 行（code=main_code 或未启用属性管理）
        if masters_only:
            query = query.filter(Q(variant_managed=False) | Q(code=F("main_code")))
        
        sort_field_map = {
            "main_code": "main_code",
            "name": "name",
            "created_at": "created_at",
            "updated_at": "updated_at",
        }
        db_sort = sort_field_map.get(sort_by or "", "main_code")
        desc = (sort_order or "asc").lower() == "desc"
        order_expr = f"-{db_sort}" if desc else db_sort

        if tree_view:
            return await MaterialService._list_materials_tree(
                tenant_id=tenant_id,
                query=query,
                keyword=keyword,
                skip=skip,
                limit=limit,
                db_sort=db_sort,
                desc=desc,
            )

        # 获取总数
        total = await query.count()

        # 预加载关联关系（优化，修复500错误）
        materials = await query.prefetch_related("group", "process_route").offset(skip).limit(limit).order_by(order_expr).all()
        
        # 构建响应数据（用 _material_to_response_data 避免 ReverseRelation 的 code_aliases；列表不加载别名）
        raw_rows: List[Dict[str, Any]] = []
        materials_for_rows: List[Any] = []
        for m in materials:
            resp_data = _material_to_response_data(m)
            resp_data["code_aliases"] = []
            raw_rows.append(resp_data)
            materials_for_rows.append(m)
        await _batch_enrich_process_route_for_material_list(tenant_id, materials_for_rows, raw_rows)
        items = [MaterialResponse.model_validate(resp_data) for resp_data in raw_rows]

        return MaterialListResponse(items=items, total=total)

    @staticmethod
    async def bulk_update_material_tracking(
        tenant_id: int,
        data: MaterialBulkTrackingRequest,
    ) -> MaterialBulkTrackingResponse:
        """
        批量更新物料的批号/序列号管理开关及默认规则（单条 SQL 更新，避免 N 次 HTTP）。
        """
        from core.services.business.batch_rule_service import BatchRuleService
        from core.services.business.serial_rule_service import SerialRuleService

        uuids = list(dict.fromkeys(data.material_uuids))
        materials = await Material.filter(
            tenant_id=tenant_id,
            uuid__in=uuids,
            deleted_at__isnull=True,
        ).all()
        found_uuid_set = {str(m.uuid) for m in materials}
        not_found = [u for u in uuids if u not in found_uuid_set]

        if not materials:
            return MaterialBulkTrackingResponse(
                updated_count=0,
                requested_count=len(uuids),
                not_found_uuids=not_found,
            )

        if data.batch_managed is True and data.default_batch_rule_id is not None:
            rule = await BatchRuleService.get_rule_by_id(tenant_id, data.default_batch_rule_id)
            if not rule:
                raise ValidationError(f"批号规则 id={data.default_batch_rule_id} 不存在或未启用")

        if data.serial_managed is True and data.default_serial_rule_id is not None:
            rule = await SerialRuleService.get_rule_by_id(tenant_id, data.default_serial_rule_id)
            if not rule:
                raise ValidationError(f"序列号规则 id={data.default_serial_rule_id} 不存在或未启用")

        update_fields: Dict[str, Any] = {}
        if data.batch_managed is not None:
            update_fields["batch_managed"] = data.batch_managed
            if data.batch_managed:
                update_fields["default_batch_rule_id"] = data.default_batch_rule_id
            else:
                update_fields["default_batch_rule_id"] = None
        if data.serial_managed is not None:
            update_fields["serial_managed"] = data.serial_managed
            if data.serial_managed:
                update_fields["default_serial_rule_id"] = data.default_serial_rule_id
            else:
                update_fields["default_serial_rule_id"] = None

        if not update_fields:
            return MaterialBulkTrackingResponse(
                updated_count=0,
                requested_count=len(uuids),
                not_found_uuids=not_found,
            )

        ids = [m.id for m in materials]
        await Material.filter(id__in=ids).update(**update_fields)

        return MaterialBulkTrackingResponse(
            updated_count=len(ids),
            requested_count=len(uuids),
            not_found_uuids=not_found,
        )

    @staticmethod
    async def bulk_update_material_variant(
        tenant_id: int,
        data: MaterialBulkVariantRequest,
    ) -> MaterialBulkTrackingResponse:
        """批量开启/关闭属性管理（不批量写入属性值；开启时主物料 variant_attributes=null）。"""
        from tortoise import timezone

        uuids = list(dict.fromkeys(str(u).strip() for u in data.material_uuids if u))
        if not uuids:
            return MaterialBulkTrackingResponse(
                updated_count=0,
                requested_count=0,
                not_found_uuids=[],
            )

        materials = await Material.filter(
            tenant_id=tenant_id,
            uuid__in=uuids,
            deleted_at__isnull=True,
        ).all()
        found_uuid_set = {str(m.uuid) for m in materials}
        not_found = [u for u in uuids if u not in found_uuid_set]

        if not materials:
            return MaterialBulkTrackingResponse(
                updated_count=0,
                requested_count=len(uuids),
                not_found_uuids=not_found,
            )

        now = timezone.now()
        ids = [m.id for m in materials]
        update_fields: Dict[str, Any] = {
            "updated_at": now,
            "variant_managed": data.variant_managed,
            "variant_attributes": None,
        }

        await Material.filter(tenant_id=tenant_id, id__in=ids).update(**update_fields)

        return MaterialBulkTrackingResponse(
            updated_count=len(ids),
            requested_count=len(uuids),
            not_found_uuids=not_found,
        )

    @staticmethod
    async def update_material(
        tenant_id: int,
        material_uuid: str,
        data: MaterialUpdate,
        updated_by: Optional[int] = None,
        current_user: Optional[User] = None,
    ) -> MaterialResponse:
        """
        更新物料
        
        Args:
            tenant_id: 租户ID
            material_uuid: 物料UUID
            data: 物料更新数据
            
        Returns:
            MaterialResponse: 更新后的物料对象
            
        Raises:
            NotFoundError: 当物料不存在时抛出
            ValidationError: 当编码已存在或分组不存在时抛出
        """
        material = await Material.filter(
            tenant_id=tenant_id,
            uuid=material_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not material:
            raise NotFoundError(f"物料 {material_uuid} 不存在")
        
        # 如果更新分组ID，检查分组是否存在
        if data.group_id is not None and data.group_id != material.group_id:
            if data.group_id:
                group = await MaterialGroup.filter(
                    tenant_id=tenant_id,
                    id=data.group_id,
                    deleted_at__isnull=True
                ).first()
                
                if not group:
                    raise ValidationError(f"物料分组 {data.group_id} 不存在")
        
        # 如果更新编码，检查是否已存在
        if data.code and data.code != material.code:
            existing = await Material.filter(
                tenant_id=tenant_id,
                code=data.code,
                deleted_at__isnull=True
            ).first()
            
            if existing:
                raise ValidationError(f"物料编码 {data.code} 已存在")
        
        # 如果是属性物料，验证属性组合唯一性和属性值
        if data.variant_managed is not None and data.variant_managed and data.variant_attributes is not None:
            # 验证属性值
            from core.services.business.material_variant_attribute_service import MaterialVariantAttributeService
            for attr_name, attr_value in data.variant_attributes.items():
                is_valid, error_message = await MaterialVariantAttributeService.validate_attribute_value(
                    tenant_id=tenant_id,
                    attribute_name=attr_name,
                    attribute_value=attr_value,
                )
                if not is_valid:
                    raise ValidationError(f"属性验证失败: {error_message}")
            
            # 检查属性组合唯一性（排除当前物料）
            variant_attributes_json = json.dumps(data.variant_attributes, sort_keys=True)
            existing_variants = await Material.filter(
                tenant_id=tenant_id,
                main_code=material.main_code,
                variant_managed=True,
                variant_attributes__isnull=False,
                deleted_at__isnull=True
            ).exclude(id=material.id).all()  # 排除当前物料
            
            # 检查是否有相同的属性组合
            for existing in existing_variants:
                if existing.variant_attributes:
                    existing_attrs_json = json.dumps(existing.variant_attributes, sort_keys=True)
                    if existing_attrs_json == variant_attributes_json:
                        raise ValidationError(
                            f"属性组合已存在: {data.variant_attributes}，"
                            f"已存在的物料: {existing.name} ({existing.main_code})"
                        )
        
        # 更新字段（排除编码映射和默认值，单独处理）
        # 使用 model_dump 方法（Pydantic v2）或 dict 方法（Pydantic v1）
        if hasattr(data, 'model_dump'):
            update_data = data.model_dump(exclude_unset=True, exclude={"department_codes", "customer_codes", "supplier_codes", "defaults"})
        else:
            update_data = data.dict(exclude_unset=True, exclude={"department_codes", "customer_codes", "supplier_codes", "defaults"})

        from apps.kuaizhizao.services.inspection_policy_service import (
            assert_master_data_inspection_stages_allowed,
            prepare_material_inspection_for_write,
        )

        stages_in_request = (
            "inspection_stages" in update_data
            or getattr(data, "inspection_stages", None) is not None
            or getattr(data, "inspectionStages", None) is not None
        )
        legacy_in_request = (
            "inspection_mode" in update_data
            or getattr(data, "inspection_mode", None) is not None
            or getattr(data, "inspectionMode", None) is not None
        )
        if stages_in_request or legacy_in_request:
            patch = dict(update_data)
            if stages_in_request and "inspection_stages" not in patch:
                patch["inspection_stages"] = getattr(data, "inspection_stages", None) or getattr(
                    data, "inspectionStages", None
                )
            prepare_material_inspection_for_write(patch)
            await assert_master_data_inspection_stages_allowed(
                tenant_id,
                material_stages=patch.get("inspection_stages"),
            )
            for k in ("inspection_stages", "inspection_mode", "default_inspection_plan_id"):
                if k in patch:
                    update_data[k] = patch[k]
        
        # 处理属性：确保JSON键顺序一致（用于数据库唯一性索引）
        if "variant_attributes" in update_data and update_data["variant_attributes"]:
            sorted_attrs = dict(sorted(update_data["variant_attributes"].items()))
            update_data["variant_attributes"] = sorted_attrs

        _normalize_material_logistics_fields(update_data, for_create=False)
        _apply_canonical_material_source_type(update_data)
        
        for key, value in update_data.items():
            setattr(material, key, value)
        
        # 仅当请求体显式包含 process_route_id 时才更新（避免未传时误清空）
        if "process_route_id" in update_data:
            material.process_route_id = data.process_route_id
        
        # 处理默认值
        if data.defaults is not None:
            material.defaults = data.defaults

        # 自制件：未显式传 process_route_id 时，从 defaults 中的默认工艺路线同步 FK（修复列表/SOP 只认 process_route_id）
        if (
            getattr(material, "source_type", None) == "Make"
            and "process_route_id" not in update_data
            and _material_defaults_as_dict(getattr(material, "defaults", None))
        ):
            resolved_pr_id = await _resolve_process_route_id_from_defaults_dict(tenant_id, material.defaults)
            if resolved_pr_id:
                material.process_route_id = resolved_pr_id

        apply_update_audit(material, current_user)
        await material.save()
        
        # 处理编码映射更新
        # 如果提供了编码映射，先删除旧的编码别名，然后创建新的
        if data.department_codes is not None or data.customer_codes is not None or data.supplier_codes is not None:
            # 删除旧的编码别名（软删除）
            from datetime import datetime
            from tortoise import timezone
            
            # 确定要删除的编码类型
            code_types_to_delete = []
            if data.department_codes is not None:
                # 获取所有部门编码类型
                existing_dept_aliases = await MaterialCodeAlias.filter(
                    tenant_id=tenant_id,
                    material_id=material.id,
                    code_type__in=["SALE", "DES", "PUR", "WH", "PROD"],
                    deleted_at__isnull=True
                ).all()
                for alias in existing_dept_aliases:
                    alias.deleted_at = timezone.now()
                    await alias.save()
            
            if data.customer_codes is not None:
                # 删除旧的客户编码
                existing_customer_aliases = await MaterialCodeAlias.filter(
                    tenant_id=tenant_id,
                    material_id=material.id,
                    code_type="CUSTOMER",
                    deleted_at__isnull=True
                ).all()
                for alias in existing_customer_aliases:
                    alias.deleted_at = timezone.now()
                    await alias.save()
            
            if data.supplier_codes is not None:
                # 删除旧的供应商编码
                existing_supplier_aliases = await MaterialCodeAlias.filter(
                    tenant_id=tenant_id,
                    material_id=material.id,
                    code_type="SUPPLIER",
                    deleted_at__isnull=True
                ).all()
                for alias in existing_supplier_aliases:
                    alias.deleted_at = timezone.now()
                    await alias.save()
            
            # 创建新的编码别名
            if data.department_codes:
                for alias_data in data.department_codes:
                    try:
                        await MaterialCodeService.create_code_alias(
                            tenant_id=tenant_id,
                            material_id=material.id,
                            code_type=alias_data.get("code_type", "CUSTOM"),
                            code=alias_data.get("code"),
                            department=alias_data.get("department"),
                            description=alias_data.get("description"),
                            is_primary=alias_data.get("is_primary", False)
                        )
                    except ValidationError as e:
                        logger.warning(f"创建编码别名失败: {e}")
            
            if data.customer_codes:
                for customer_code_data in data.customer_codes:
                    try:
                        await MaterialCodeService.create_code_alias(
                            tenant_id=tenant_id,
                            material_id=material.id,
                            code_type="CUSTOMER",
                            code=customer_code_data.get("code"),
                            name=customer_code_data.get("name"),
                            description=customer_code_data.get("description"),
                            external_entity_type="customer",
                            external_entity_id=_partner_id_from_code_mapping_payload(
                            customer_code_data, "customer_id", "customerId"
                        ),
                        )
                    except ValidationError as e:
                        logger.warning(f"创建客户编码别名失败: {e}")
            
            if data.supplier_codes:
                for supplier_code_data in data.supplier_codes:
                    try:
                        await MaterialCodeService.create_code_alias(
                            tenant_id=tenant_id,
                            material_id=material.id,
                            code_type="SUPPLIER",
                            code=supplier_code_data.get("code"),
                            name=supplier_code_data.get("name"),
                            description=supplier_code_data.get("description"),
                            external_entity_type="supplier",
                            external_entity_id=_partner_id_from_code_mapping_payload(
                            supplier_code_data, "supplier_id", "supplierId"
                        ),
                        )
                    except ValidationError as e:
                        logger.warning(f"创建供应商编码别名失败: {e}")
        
        # 加载编码别名
        aliases = await MaterialCodeService.get_material_aliases(
            tenant_id=tenant_id,
            material_id=material.id
        )
        
        # 构建响应
        from apps.master_data.schemas.material_schemas import MaterialCodeAliasResponse
        resp_data = _material_to_response_data(material)
        resp_data["code_aliases"] = [MaterialCodeAliasResponse.model_validate(a) for a in aliases]
        await _enrich_inspection_plan_name(resp_data)
        await _enrich_material_process_route_display(tenant_id, material, resp_data)
        response = MaterialResponse.model_validate(resp_data)

        return response

    @staticmethod
    async def delete_material(
        tenant_id: int,
        material_uuid: str
    ) -> None:
        """
        删除物料（软删除）
        
        Args:
            tenant_id: 租户ID
            material_uuid: 物料UUID
            
        Raises:
            NotFoundError: 当物料不存在时抛出
            ValidationError: 当物料被BOM使用时抛出
        """
        material = await Material.filter(
            tenant_id=tenant_id,
            uuid=material_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not material:
            raise NotFoundError(f"物料 {material_uuid} 不存在")
        
        # 检查是否被BOM使用（作为主物料或子物料）
        bom_as_material_count = await BOM.filter(
            tenant_id=tenant_id,
            material_id=material.id,
            deleted_at__isnull=True
        ).count()
        
        bom_as_component_count = await BOM.filter(
            tenant_id=tenant_id,
            component_id=material.id,
            deleted_at__isnull=True
        ).count()
        
        if bom_as_material_count > 0 or bom_as_component_count > 0:
            raise ValidationError(f"物料被 {bom_as_material_count + bom_as_component_count} 个BOM使用，无法删除")
        
        # 软删除
        from tortoise import timezone
        material.deleted_at = timezone.now()
        await material.save()

    @staticmethod
    async def bulk_delete_materials(
        tenant_id: int,
        data: MaterialBatchDeleteRequest,
    ) -> MaterialBatchDeleteResponse:
        """
        批量软删除物料：一次加载物料、一次 BOM 占用检查、一次 UPDATE，避免 N 次单条删除接口。
        """
        from tortoise import timezone

        raw = [str(u).strip() for u in data.material_uuids if u is not None and str(u).strip()]
        uuids = list(dict.fromkeys(raw))
        if not uuids:
            return MaterialBatchDeleteResponse(deleted_count=0, failed_count=0, failed_items=[])

        materials = await Material.filter(
            tenant_id=tenant_id,
            uuid__in=uuids,
            deleted_at__isnull=True,
        ).all()
        id_to_uuid = {m.id: str(m.uuid) for m in materials}
        uuid_to_material_id = {str(m.uuid): m.id for m in materials}
        found_uuid_set = set(uuid_to_material_id.keys())

        failed_items: List[MaterialBatchDeleteFailedItem] = []
        for u in uuids:
            if u not in found_uuid_set:
                failed_items.append(MaterialBatchDeleteFailedItem(uuid=u, reason="物料不存在"))

        material_ids = list(id_to_uuid.keys())
        blocked_ids: set[int] = set()
        if material_ids:
            conflict_rows = await BOM.filter(
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            ).filter(
                Q(material_id__in=material_ids) | Q(component_id__in=material_ids)
            ).only("material_id", "component_id")
            id_set = set(material_ids)
            for row in conflict_rows:
                if row.material_id in id_set:
                    blocked_ids.add(row.material_id)
                if row.component_id in id_set:
                    blocked_ids.add(row.component_id)

        for mid in blocked_ids:
            failed_items.append(
                MaterialBatchDeleteFailedItem(
                    uuid=id_to_uuid[mid],
                    reason="物料被 BOM 使用，无法删除",
                )
            )

        to_delete_ids = [mid for mid in material_ids if mid not in blocked_ids]
        now = timezone.now()
        if to_delete_ids:
            await Material.filter(tenant_id=tenant_id, id__in=to_delete_ids).update(
                deleted_at=now,
                updated_at=now,
            )

        return MaterialBatchDeleteResponse(
            deleted_count=len(to_delete_ids),
            failed_count=len(failed_items),
            failed_items=failed_items,
        )

    @staticmethod
    async def bulk_move_material_group(
        tenant_id: int,
        data: MaterialBatchMoveGroupRequest,
    ) -> MaterialBatchMoveGroupResponse:
        """批量将物料移动到指定分组（单次 UPDATE）。"""
        from tortoise import timezone

        uuids = list(dict.fromkeys(str(u).strip() for u in data.material_uuids if u))
        if not uuids:
            return MaterialBatchMoveGroupResponse(
                updated_count=0,
                requested_count=0,
                not_found_uuids=[],
            )

        group = await MaterialGroup.filter(
            tenant_id=tenant_id,
            id=data.group_id,
            deleted_at__isnull=True,
        ).first()
        if not group:
            raise ValidationError(f"物料分组 {data.group_id} 不存在")

        materials = await Material.filter(
            tenant_id=tenant_id,
            uuid__in=uuids,
            deleted_at__isnull=True,
        ).all()
        found_uuid_set = {str(m.uuid) for m in materials}
        not_found = [u for u in uuids if u not in found_uuid_set]

        if not materials:
            return MaterialBatchMoveGroupResponse(
                updated_count=0,
                requested_count=len(uuids),
                not_found_uuids=not_found,
            )

        ids = [m.id for m in materials]
        now = timezone.now()
        await Material.filter(tenant_id=tenant_id, id__in=ids).update(
            group_id=data.group_id,
            updated_at=now,
        )

        return MaterialBatchMoveGroupResponse(
            updated_count=len(ids),
            requested_count=len(uuids),
            not_found_uuids=not_found,
        )

    @staticmethod
    async def bulk_update_material_process_route(
        tenant_id: int,
        data: MaterialBatchUpdateProcessRouteRequest,
    ) -> MaterialBatchFieldUpdateResponse:
        """批量更新物料绑定的工艺路线（单次 UPDATE）。"""
        from tortoise import timezone
        from apps.master_data.models.process import ProcessRoute

        uuids = list(dict.fromkeys(str(u).strip() for u in data.material_uuids if u))
        if not uuids:
            return MaterialBatchFieldUpdateResponse(
                updated_count=0,
                requested_count=0,
                not_found_uuids=[],
            )

        if data.process_route_id is not None:
            route = await ProcessRoute.filter(
                tenant_id=tenant_id,
                id=data.process_route_id,
                deleted_at__isnull=True,
            ).first()
            if not route:
                raise ValidationError(f"工艺路线 {data.process_route_id} 不存在")

        materials = await Material.filter(
            tenant_id=tenant_id,
            uuid__in=uuids,
            deleted_at__isnull=True,
        ).all()
        found_uuid_set = {str(m.uuid) for m in materials}
        not_found = [u for u in uuids if u not in found_uuid_set]

        if not materials:
            return MaterialBatchFieldUpdateResponse(
                updated_count=0,
                requested_count=len(uuids),
                not_found_uuids=not_found,
            )

        ids = [m.id for m in materials]
        now = timezone.now()
        await Material.filter(tenant_id=tenant_id, id__in=ids).update(
            process_route_id=data.process_route_id,
            updated_at=now,
        )

        return MaterialBatchFieldUpdateResponse(
            updated_count=len(ids),
            requested_count=len(uuids),
            not_found_uuids=not_found,
        )

    @staticmethod
    async def bulk_update_material_source_type(
        tenant_id: int,
        data: MaterialBatchUpdateSourceTypeRequest,
    ) -> MaterialBatchFieldUpdateResponse:
        """批量更新物料来源类型（单次 UPDATE）。"""
        from tortoise import timezone

        source_type = normalize_material_source_type((data.source_type or "").strip())
        if not source_type or not is_canonical_material_source_type(source_type):
            raise ValidationError(f"无效的物料来源类型: {data.source_type}")

        uuids = list(dict.fromkeys(str(u).strip() for u in data.material_uuids if u))
        if not uuids:
            return MaterialBatchFieldUpdateResponse(
                updated_count=0,
                requested_count=0,
                not_found_uuids=[],
            )

        materials = await Material.filter(
            tenant_id=tenant_id,
            uuid__in=uuids,
            deleted_at__isnull=True,
        ).all()
        found_uuid_set = {str(m.uuid) for m in materials}
        not_found = [u for u in uuids if u not in found_uuid_set]

        if not materials:
            return MaterialBatchFieldUpdateResponse(
                updated_count=0,
                requested_count=len(uuids),
                not_found_uuids=not_found,
            )

        ids = [m.id for m in materials]
        now = timezone.now()
        await Material.filter(tenant_id=tenant_id, id__in=ids).update(
            source_type=source_type,
            updated_at=now,
        )

        return MaterialBatchFieldUpdateResponse(
            updated_count=len(ids),
            requested_count=len(uuids),
            not_found_uuids=not_found,
        )

    @staticmethod
    async def bulk_patch_material_defaults(
        tenant_id: int,
        data: Any,
    ) -> MaterialBatchFieldUpdateResponse:
        """批量合并更新物料 defaults JSON（仅覆盖请求中显式传入的键）。"""
        from tortoise import timezone
        from apps.master_data.models.warehouse import Warehouse

        uuids = list(dict.fromkeys(str(u).strip() for u in data.material_uuids if u))
        if not uuids:
            return MaterialBatchFieldUpdateResponse(
                updated_count=0,
                requested_count=0,
                not_found_uuids=[],
            )

        materials = await Material.filter(
            tenant_id=tenant_id,
            uuid__in=uuids,
            deleted_at__isnull=True,
        ).all()
        found_uuid_set = {str(m.uuid) for m in materials}
        not_found = [u for u in uuids if u not in found_uuid_set]

        if not materials:
            return MaterialBatchFieldUpdateResponse(
                updated_count=0,
                requested_count=len(uuids),
                not_found_uuids=not_found,
            )

        patch: Dict[str, Any] = {}
        if data.default_tax_rate is not None:
            patch["defaultTaxRate"] = int(data.default_tax_rate)

        if data.default_warehouse_ids is not None:
            wh_ids = list(dict.fromkeys(int(i) for i in data.default_warehouse_ids))
            if wh_ids:
                warehouses = await Warehouse.filter(
                    tenant_id=tenant_id,
                    id__in=wh_ids,
                    deleted_at__isnull=True,
                    is_active=True,
                ).all()
                wh_by_id = {w.id: w for w in warehouses}
                missing = [i for i in wh_ids if i not in wh_by_id]
                if missing:
                    raise ValidationError(f"仓库不存在或未启用: {missing}")
                patch["defaultWarehouses"] = [
                    {
                        "warehouseId": wh_by_id[wid].id,
                        "warehouseName": wh_by_id[wid].name,
                        "priority": idx + 1,
                    }
                    for idx, wid in enumerate(wh_ids)
                ]
            else:
                patch["__clear_defaultWarehouses"] = True

        if data.safety_stock is not None:
            patch["safetyStock"] = float(data.safety_stock)
        if data.max_stock is not None:
            patch["maxStock"] = float(data.max_stock)
        if data.default_sale_price is not None:
            patch["defaultSalePrice"] = float(data.default_sale_price)
        if data.default_location is not None:
            loc = (data.default_location or "").strip()
            patch["defaultLocation"] = loc if loc else None

        now = timezone.now()
        updated = 0
        for material in materials:
            merged = dict(_material_defaults_as_dict(material.defaults) or {})
            for key, value in patch.items():
                if key == "__clear_defaultWarehouses":
                    merged.pop("defaultWarehouses", None)
                    merged.pop("default_warehouses", None)
                    merged.pop("defaultWarehouseIds", None)
                else:
                    merged[key] = value
            material.defaults = merged if merged else None
            material.updated_at = now
            await material.save(update_fields=["defaults", "updated_at"])
            updated += 1

        return MaterialBatchFieldUpdateResponse(
            updated_count=updated,
            requested_count=len(uuids),
            not_found_uuids=not_found,
        )

    _REWRITE_MAIN_CODES_MAX = 2000

    @staticmethod
    async def _get_all_child_group_ids(tenant_id: int, parent_group_id: int) -> List[int]:
        """递归获取分组及其所有子分组 ID。"""
        group_ids = [parent_group_id]
        child_groups = await MaterialGroup.filter(
            tenant_id=tenant_id,
            parent_id=parent_group_id,
            deleted_at__isnull=True,
        ).values_list("id", flat=True)
        for child_id in child_groups:
            group_ids.extend(
                await MaterialService._get_all_child_group_ids(tenant_id, child_id)
            )
        return group_ids

    @staticmethod
    async def _rewrite_with_reset_sequence(
        tenant_id: int,
        materials_sorted: List["Material"],
        all_rewrite_ids: set,
        groups: dict,
        failed_items: list,
        now: Any,
    ) -> tuple:
        """
        reset_sequence=True 的重写路径。

        绕过 CodeGenerationService.generate_code（其内部的 _recalibrate_sequence_from_db
        会扫描数据库最大编号，导致重置无效），改为直接调用 render_components 并手动维护
        每个末级分组的计数器，从 seq_start 从头分配编码。

        处理完每个分组后，将最终使用的计数器值写回 core_code_sequences，
        使后续手工新建物料能正确接续编号（校准机制会基于新编码重新对齐）。
        """
        from core.models.code_sequence import CodeSequence
        from core.services.business.code_rule_service import CodeRuleService
        from core.services.code_rule.code_rule_component_service import CodeRuleComponentService

        # 加载编码规则
        material_page_config = next(
            (page for page in CODE_RULE_PAGES if page.get("page_code") == "master-data-material"),
            None,
        )
        if not material_page_config or not material_page_config.get("rule_code"):
            raise ValidationError("未配置物料主编码规则（MATERIAL_CODE），无法重写")

        rule_code = material_page_config["rule_code"]
        rule = await CodeRuleService.get_rule_by_code(tenant_id, rule_code)
        if not rule:
            raise ValidationError(f"编码规则 {rule_code} 不存在或未启用")

        components = rule.get_rule_components()
        if not components:
            raise ValidationError(f"编码规则 {rule_code} 缺少组件配置，请在编码规则页面重新保存")

        counter_config = CodeRuleComponentService.get_counter_component_config(components)
        seq_start = counter_config.get("initial_value", 1) if counter_config else (rule.seq_start or 1)

        updated_families = 0
        updated_material_count = 0
        processed_material_ids: set = set()

        # 按分组分批处理，每个分组独立计数器
        current_group_id: Optional[int] = None
        group_counter: int = seq_start - 1
        # 本批次已分配的编码（用于批内去重）
        assigned_in_batch: set = set()

        for material in materials_sorted:
            if material.id in processed_material_ids:
                continue
            if material.variant_managed and material.variant_attributes:
                continue

            rep_uuid = str(material.uuid)

            if not material.group_id:
                failed_items.append(
                    MaterialRewriteMainCodesFailedItem(uuid=rep_uuid, reason="未设置物料分组")
                )
                continue

            group = groups.get(material.group_id)
            if not group:
                group = await MaterialGroup.filter(
                    tenant_id=tenant_id,
                    id=material.group_id,
                    deleted_at__isnull=True,
                ).first()
                if group:
                    groups[group.id] = group
            if not group:
                failed_items.append(
                    MaterialRewriteMainCodesFailedItem(uuid=rep_uuid, reason="物料末级分组不存在")
                )
                continue
            if not (group.code or "").strip():
                failed_items.append(
                    MaterialRewriteMainCodesFailedItem(uuid=rep_uuid, reason="物料末级分组未配置分组编号")
                )
                continue

            # 切换到新分组时重置计数器，并将上一分组最终计数写回 core_code_sequences
            if material.group_id != current_group_id:
                if current_group_id is not None:
                    prev_group = groups.get(current_group_id)
                    if prev_group and (prev_group.code or "").strip():
                        await MaterialService._save_sequence_for_group(
                            tenant_id, rule, prev_group.code.strip(), group_counter
                        )
                current_group_id = material.group_id
                group_counter = seq_start - 1

            # 构建编码上下文
            context = await CodeGenerationService.build_material_code_context_from_group(
                tenant_id,
                group,
                source_type=material.source_type,
                name=material.name or "",
            )
            if not context.get("leaf_group_code"):
                failed_items.append(
                    MaterialRewriteMainCodesFailedItem(uuid=rep_uuid, reason="物料末级分组未配置分组编号")
                )
                continue

            # 查找同主编码族
            all_family = await Material.filter(
                tenant_id=tenant_id,
                main_code=material.main_code,
                deleted_at__isnull=True,
            ).all()
            family_ids = {m.id for m in all_family}
            # 不属于本批次的外部物料 ID（冲突检测排除批内）
            external_ids = all_rewrite_ids - family_ids

            # 手动递增计数，渲染编码，仅对批外物料做冲突检测
            max_attempts = 200
            new_code = None
            for _ in range(max_attempts):
                group_counter += 1
                candidate = CodeRuleComponentService.render_components(components, group_counter, context)
                # 批内已分配 → 跳过
                if candidate in assigned_in_batch:
                    continue
                # 与批外现有编码冲突 → 跳过
                conflict = await Material.filter(
                    tenant_id=tenant_id,
                    main_code=candidate,
                    deleted_at__isnull=True,
                ).exclude(id__in=list(external_ids) if external_ids else [-1]).first()
                if not conflict:
                    new_code = candidate
                    break

            if not new_code:
                failed_items.append(
                    MaterialRewriteMainCodesFailedItem(
                        uuid=rep_uuid,
                        reason=f"连续 {max_attempts} 次均冲突，请检查编码规则配置",
                    )
                )
                continue

            assigned_in_batch.add(new_code)
            await Material.filter(tenant_id=tenant_id, id__in=list(family_ids)).update(
                main_code=new_code,
                code=new_code,
                updated_at=now,
            )
            processed_material_ids.update(family_ids)
            updated_families += 1
            updated_material_count += len(all_family)

        # 写回最后一个分组的流水计数
        if current_group_id is not None:
            last_group = groups.get(current_group_id)
            if last_group and (last_group.code or "").strip():
                await MaterialService._save_sequence_for_group(
                    tenant_id, rule, last_group.code.strip(), group_counter
                )

        return updated_families, updated_material_count, processed_material_ids, failed_items

    @staticmethod
    async def _save_sequence_for_group(
        tenant_id: int,
        rule: Any,
        group_code: str,
        last_seq: int,
    ) -> None:
        """将分组最终使用的流水计数写回 core_code_sequences。"""
        from core.models.code_sequence import CodeSequence

        seq = await CodeSequence.get_or_none(
            code_rule_id=rule.id,
            tenant_id=tenant_id,
            scope_key=group_code,
            deleted_at__isnull=True,
        )
        if seq:
            seq.current_seq = last_seq
            seq.reset_date = None
            await seq.save()
        else:
            await CodeSequence.create(
                code_rule_id=rule.id,
                tenant_id=tenant_id,
                scope_key=group_code,
                current_seq=last_seq,
            )

    @staticmethod
    async def _generate_rewrite_main_code(
        tenant_id: int,
        *,
        group: Optional[MaterialGroup],
        source_type: Optional[str],
        name: str,
        exclude_ids: set,
    ) -> str:
        """按编码规则 MATERIAL_CODE 与末级分组编号生成新主编码（禁止回退 MAT-RAW）。"""
        material_page_config = next(
            (page for page in CODE_RULE_PAGES if page.get("page_code") == "master-data-material"),
            None,
        )
        if not material_page_config or not material_page_config.get("rule_code"):
            raise ValidationError("未配置物料主编码规则（MATERIAL_CODE），无法重写")
        if not group:
            raise ValidationError("物料未设置末级分组")
        context = await CodeGenerationService.build_material_code_context_from_group(
            tenant_id,
            group,
            source_type=source_type,
            name=name,
        )
        if not context.get("leaf_group_code"):
            raise ValidationError("物料末级分组未配置分组编号")

        rule_code = material_page_config["rule_code"]
        max_attempts = 20
        for attempt in range(max_attempts):
            new_code = await CodeGenerationService.generate_code(
                tenant_id=tenant_id,
                rule_code=rule_code,
                context=context,
            )

            conflict = await Material.filter(
                tenant_id=tenant_id,
                main_code=new_code,
                deleted_at__isnull=True,
            ).exclude(id__in=exclude_ids).first()
            if not conflict:
                return new_code
            logger.warning(
                f"重写物料编码：{new_code} 已被占用，重试 {attempt + 1}/{max_attempts}"
            )

        raise ValidationError(
            f"连续 {max_attempts} 次生成的编码均已存在，请检查编码规则配置"
        )

    @staticmethod
    async def bulk_rewrite_main_codes(
        tenant_id: int,
        data: MaterialRewriteMainCodesRequest,
    ) -> MaterialRewriteMainCodesResponse:
        """
        试运营模式：按各物料所属末级分组的编号（group.code）重新生成主编码。

        同一主编码族（主物料 + 属性变体）一并更新。
        支持 reset_sequence=True 时在重写前按末级分组重置流水号。
        """
        from infra.services.business_config_service import BusinessConfigService
        from tortoise import timezone

        if not await BusinessConfigService().is_trial_run_mode_enabled(tenant_id):
            raise ValidationError("试运营模式未开启，无法使用重写物料编号")

        uuids = list(dict.fromkeys(str(u).strip() for u in (data.material_uuids or []) if u))
        materials: List[Material] = []

        if uuids:
            materials = await Material.filter(
                tenant_id=tenant_id,
                uuid__in=uuids,
                deleted_at__isnull=True,
            ).all()
            found = {str(m.uuid) for m in materials}
            not_found = [u for u in uuids if u not in found]
            failed_items = [
                MaterialRewriteMainCodesFailedItem(uuid=u, reason="物料不存在")
                for u in not_found
            ]
        else:
            failed_items = []
            group = await MaterialGroup.filter(
                tenant_id=tenant_id,
                id=data.group_id,
                deleted_at__isnull=True,
            ).first()
            if not group:
                raise ValidationError(f"物料分组 {data.group_id} 不存在")
            all_group_ids = await MaterialService._get_all_child_group_ids(
                tenant_id, data.group_id
            )
            materials = await Material.filter(
                tenant_id=tenant_id,
                group_id__in=all_group_ids,
                deleted_at__isnull=True,
            ).all()

        requested_count = len(materials)
        if requested_count > MaterialService._REWRITE_MAIN_CODES_MAX:
            raise ValidationError(
                f"单次最多重写 {MaterialService._REWRITE_MAIN_CODES_MAX} 条物料，"
                f"当前范围共 {requested_count} 条，请缩小选择范围"
            )

        if not materials:
            return MaterialRewriteMainCodesResponse(
                updated_count=0,
                updated_material_count=0,
                requested_count=requested_count,
                failed_count=len(failed_items),
                failed_items=failed_items,
            )

        group_ids = {m.group_id for m in materials if m.group_id}
        groups = {
            g.id: g
            for g in await MaterialGroup.filter(
                tenant_id=tenant_id,
                id__in=list(group_ids),
                deleted_at__isnull=True,
            ).all()
        }

        # 按末级分组 + 稳定顺序逐条重写（每条物料按其 group_id 对应叶分组编号生成）
        materials_sorted = sorted(
            materials,
            key=lambda m: (m.group_id or 0, m.id),
        )
        updated_families = 0
        updated_material_count = 0
        processed_material_ids: set = set()
        now = timezone.now()

        if data.reset_sequence:
            # 重置流水号路径：绕过 generate_code 的 DB 校准，手动维护每分组计数器，
            # 从初始值开始分配编码，处理完各分组后将最终计数写回 core_code_sequences。
            updated_families, updated_material_count, processed_material_ids, failed_items = (
                await MaterialService._rewrite_with_reset_sequence(
                    tenant_id=tenant_id,
                    materials_sorted=materials_sorted,
                    all_rewrite_ids={m.id for m in materials},
                    groups=groups,
                    failed_items=failed_items,
                    now=now,
                )
            )
        else:
            for material in materials_sorted:
                if material.id in processed_material_ids:
                    continue

                rep_uuid = str(material.uuid)

                if material.variant_managed and material.variant_attributes:
                    continue

                if not material.group_id:
                    failed_items.append(
                        MaterialRewriteMainCodesFailedItem(
                            uuid=rep_uuid,
                            reason="未设置物料分组",
                        )
                    )
                    continue

                group = groups.get(material.group_id)
                if not group:
                    group = await MaterialGroup.filter(
                        tenant_id=tenant_id,
                        id=material.group_id,
                        deleted_at__isnull=True,
                    ).first()
                    if group:
                        groups[group.id] = group
                if not group:
                    failed_items.append(
                        MaterialRewriteMainCodesFailedItem(
                            uuid=rep_uuid,
                            reason="物料末级分组不存在",
                        )
                    )
                    continue
                if not (group.code or "").strip():
                    failed_items.append(
                        MaterialRewriteMainCodesFailedItem(
                            uuid=rep_uuid,
                            reason="物料末级分组未配置分组编号",
                        )
                    )
                    continue

                all_family = await Material.filter(
                    tenant_id=tenant_id,
                    main_code=material.main_code,
                    deleted_at__isnull=True,
                ).all()
                family_ids = {m.id for m in all_family}

                try:
                    new_code = await MaterialService._generate_rewrite_main_code(
                        tenant_id,
                        group=group,
                        source_type=material.source_type,
                        name=material.name or "",
                        exclude_ids=family_ids,
                    )
                except ValidationError as e:
                    failed_items.append(
                        MaterialRewriteMainCodesFailedItem(uuid=rep_uuid, reason=str(e))
                    )
                    continue
                except Exception as e:
                    logger.exception(f"重写物料主编码失败: {material.main_code}")
                    failed_items.append(
                        MaterialRewriteMainCodesFailedItem(
                            uuid=rep_uuid,
                            reason=f"生成编码失败: {e}",
                        )
                    )
                    continue

                await Material.filter(tenant_id=tenant_id, id__in=list(family_ids)).update(
                    main_code=new_code,
                    code=new_code,
                    updated_at=now,
                )
                processed_material_ids.update(family_ids)
                updated_families += 1
                updated_material_count += len(all_family)

        return MaterialRewriteMainCodesResponse(
            updated_count=updated_families,
            updated_material_count=updated_material_count,
            requested_count=requested_count,
            failed_count=len(failed_items),
            failed_items=failed_items,
        )
    
    # ==================== BOM相关方法 ====================
    
    @staticmethod
    async def create_bom(
        tenant_id: int,
        data: BOMCreate,
        current_user: Optional[User] = None,
    ) -> BOMResponse:
        """
        创建BOM（单个）
        
        Args:
            tenant_id: 租户ID
            data: BOM创建数据
            
        Returns:
            BOMResponse: 创建的BOM对象
            
        Raises:
            ValidationError: 当主物料或子物料不存在时抛出
        """
        # 检查主物料是否存在
        material = await Material.filter(
            tenant_id=tenant_id,
            id=data.material_id,
            deleted_at__isnull=True
        ).first()
        
        if not material:
            raise ValidationError(f"主物料 {data.material_id} 不存在")
        
        # 检查子物料是否存在
        component = await Material.filter(
            tenant_id=tenant_id,
            id=data.component_id,
            deleted_at__isnull=True
        ).first()
        
        if not component:
            raise ValidationError(f"子物料 {data.component_id} 不存在")
        
        # 检查主物料和子物料不能相同
        if data.material_id == data.component_id:
            raise ValidationError("主物料和子物料不能相同")
        
        # 循环依赖检测（PLM 最佳实践：禁止成环）
        has_cycle = await MaterialService.detect_bom_cycle(
            tenant_id, data.material_id, data.component_id
        )
        if has_cycle:
            raise ValidationError(
                f"添加子物料 {data.component_id} 将导致 BOM 循环依赖，请检查层级关系"
            )
        
        # 显式设置层级：直接子件 level 1，path 父/子
        payload = data.dict()
        payload["level"] = 1
        payload["path"] = f"{data.material_id}/{data.component_id}"
        apply_create_audit(payload, current_user)
        bom = await BOM.create(tenant_id=tenant_id, **payload)
        return BOMResponse.model_validate(bom)
    
    @staticmethod
    def build_default_bom_name(
        material: Material,
        bom_code: Optional[str],
    ) -> str:
        """默认 BOM 名称：主件名称 + 空格 + BOM编号（版本号已在编号中，不再重复）。"""
        main_label = (material.name or material.main_code or material.code or "").strip()
        code = (bom_code or "").strip()
        if main_label and code:
            return f"{main_label} {code}"
        return main_label or code

    @staticmethod
    def resolve_version_bom_name(
        bom_name: Optional[str],
        material: Material,
        bom_code: Optional[str],
        version: str,
    ) -> Optional[str]:
        """未传 bom_name 时自动生成；显式空字符串存为 None。"""
        if bom_name is None:
            default = MaterialService.build_default_bom_name(material, bom_code)
            return default or None
        stripped = str(bom_name).strip()
        return stripped or None

    @staticmethod
    def _pick_consistent_import_field(
        items: List[Any],
        attr: str,
        parent_label: str,
        field_label: str,
    ) -> Optional[str]:
        """同父件多行时，取首个非空值并校验一致。"""
        values: List[str] = []
        for item in items:
            raw = getattr(item, attr, None)
            if raw is None:
                continue
            text = str(raw).strip()
            if text:
                values.append(text)
        if not values:
            return None
        first = values[0]
        if any(v != first for v in values):
            raise ValidationError(f"父件 {parent_label} 的{field_label}在同批次导入中不一致")
        return first

    @staticmethod
    def _resolve_parent_bom_import_meta(
        items: List[Any],
        data: "BOMBatchImport",
        parent_material: Material,
        parent_label: str,
    ) -> tuple:
        """解析单个父件分组的 BOM 头表字段（版本/编号/名称/基准数量）。"""
        version = (
            MaterialService._pick_consistent_import_field(items, "version", parent_label, "版本号")
            or data.version
            or "1.0"
        )
        bom_code = (
            MaterialService._pick_consistent_import_field(items, "bom_code", parent_label, "BOM编号")
            or data.bom_code
        )
        row_bom_name = MaterialService._pick_consistent_import_field(
            items, "bom_name", parent_label, "BOM名称"
        )
        bom_name_source = row_bom_name if row_bom_name is not None else data.bom_name
        bom_name = MaterialService.resolve_version_bom_name(
            bom_name_source,
            parent_material,
            bom_code,
            version,
        )

        explicit_bases = [
            Decimal(str(getattr(item, "base_quantity")))
            for item in items
            if getattr(item, "base_quantity", None) is not None
        ]
        if explicit_bases:
            parent_base_qty = explicit_bases[0]
            if any(bq != parent_base_qty for bq in explicit_bases):
                raise ValidationError(f"父件 {parent_label} 的基准数量在同批次导入中不一致")
        else:
            parent_base_qty = Decimal(str(data.base_quantity or 1))

        return version, bom_code, bom_name, parent_base_qty

    @staticmethod
    def _assert_bom_components_have_source_type(components: List[Material]) -> None:
        """BOM 子件须在物料主数据已维护来源类型，禁止在 BOM 保存/审核时静默回写或兜底。"""
        missing_labels: List[str] = []
        for component in components:
            try:
                require_canonical_material_source_type(
                    component.source_type,
                    material_id=component.id,
                    material_code=component.main_code or component.code,
                    material_name=component.name,
                )
            except ValidationError:
                label = component.main_code or component.code or str(component.id)
                if component.name:
                    label = f"{label}（{component.name}）"
                missing_labels.append(label)
        if missing_labels:
            preview = "、".join(missing_labels[:10])
            suffix = f" 等共 {len(missing_labels)} 个" if len(missing_labels) > 10 else ""
            raise ValidationError(
                f"以下 BOM 子件未配置物料来源类型：{preview}{suffix}，请在物料主数据中维护 source_type"
            )

    @staticmethod
    async def _assert_bom_version_components_have_source_type(
        tenant_id: int,
        material_id: int,
        version: str,
    ) -> None:
        component_ids = await BOM.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            version=version,
            deleted_at__isnull=True,
        ).values_list("component_id", flat=True)
        if not component_ids:
            return
        components = await Material.filter(
            tenant_id=tenant_id,
            id__in=list(component_ids),
            deleted_at__isnull=True,
        ).all()
        MaterialService._assert_bom_components_have_source_type(list(components))

    @staticmethod
    async def create_bom_batch(
        tenant_id: int,
        data: BOMBatchCreate,
        current_user: Optional[User] = None,
    ) -> List[BOMResponse]:
        """
        批量创建BOM（为一个主物料添加多个子物料）
        
        Args:
            tenant_id: 租户ID
            data: 批量创建BOM数据
            
        Returns:
            List[BOMResponse]: 创建的BOM对象列表
            
        Raises:
            ValidationError: 当主物料或子物料不存在时抛出
        """
        # 检查主物料是否存在
        material = await Material.filter(
            tenant_id=tenant_id,
            id=data.material_id,
            deleted_at__isnull=True
        ).first()
        
        if not material:
            raise ValidationError(f"主物料 {data.material_id} 不存在")
        
        # 检查所有子物料是否存在，并检查主物料和子物料不能相同
        component_ids = [item.component_id for item in data.items]
        components = await Material.filter(
            tenant_id=tenant_id,
            id__in=component_ids,
            deleted_at__isnull=True
        ).all()
        
        found_component_ids = {c.id for c in components}
        missing_ids = set(component_ids) - found_component_ids
        if missing_ids:
            raise ValidationError(f"子物料 {missing_ids} 不存在")
        
        MaterialService._assert_bom_components_have_source_type(list(components))
        
        # 检查主物料和子物料不能相同
        if data.material_id in component_ids:
            raise ValidationError("主物料和子物料不能相同")
        
        # 循环依赖检测（PLM 最佳实践：禁止成环）
        for item in data.items:
            has_cycle = await MaterialService.detect_bom_cycle(
                tenant_id, data.material_id, item.component_id
            )
            if has_cycle:
                raise ValidationError(
                    f"添加子物料 {item.component_id} 将导致 BOM 循环依赖，请检查层级关系"
                )
        
        # 获取主物料信息（用于编码生成上下文）
        material = await Material.filter(
            tenant_id=tenant_id,
            id=data.material_id,
            deleted_at__isnull=True
        ).first()
        if not material:
            raise ValidationError("主物料不存在")
        
        # 自动生成BOM编码（如果未提供）
        if not data.bom_code:
            try:
                # 构建编码规则的上下文
                context: Dict[str, Any] = {
                    "version": data.version or "1.0",
                }
                
                # 添加主物料信息到上下文
                if material.main_code:
                    context["material_code"] = material.main_code
                elif material.code:
                    context["material_code"] = material.code
                if material.name:
                    context["material_name"] = material.name
                
                # 使用编码规则服务生成BOM编码
                data.bom_code = await CodeGenerationService.generate_code(
                    tenant_id=tenant_id,
                    rule_code="ENGINEERING_BOM_CODE",
                    context=context
                )
            except ValidationError as e:
                # 如果编码规则不存在或未启用，使用备用方案
                logger.warning(f"BOM编码规则生成失败，使用备用方案: {e}")
                from datetime import datetime
                timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
                material_code = material.main_code or material.code or "UNKNOWN"
                data.bom_code = f"BOM-{material_code}-{timestamp}"
        
        # 批量创建BOM（PLM 层级：根主料 level 0，直接子件 level 1；path 为 父/子 路径）
        bom_list = []
        version_base_qty = data.base_quantity or Decimal("1")
        version_bom_name = MaterialService.resolve_version_bom_name(
            data.bom_name,
            material,
            data.bom_code,
            data.version or "1.0",
        )
        for item in data.items:
            bom_payload = {
                "tenant_id": tenant_id,
                "material_id": data.material_id,
                "component_id": item.component_id,
                "quantity": item.quantity,
                "base_quantity": version_base_qty,
                "unit": item.unit,
                "waste_rate": item.waste_rate if hasattr(item, 'waste_rate') else Decimal("0.00"),
                "is_required": item.is_required if hasattr(item, 'is_required') else True,
                "issue_method": getattr(item, 'issue_method', None) or "pick",
                "level": 1,  # 直接子件深度 1（根主料为 0）
                "path": f"{data.material_id}/{item.component_id}",
                "version": data.version,
                "bom_code": data.bom_code,
                "bom_name": version_bom_name,
                "effective_date": data.effective_date,
                "expiry_date": data.expiry_date,
                "approval_status": data.approval_status,
                "is_alternative": item.is_alternative,
                "alternative_group_id": item.alternative_group_id,
                "priority": item.priority,
                "is_configurable": item.is_configurable,
                "configurable_group_id": item.configurable_group_id,
                "is_default_configurable": item.is_default_configurable,
                "description": data.description,
                "remark": item.remark or data.remark,
                "is_active": data.is_active,
            }
            apply_create_audit(bom_payload, current_user)
            bom = await BOM.create(**bom_payload)
            bom_list.append(bom)
        
        return [BOMResponse.model_validate(bom) for bom in bom_list]
    
    @staticmethod
    async def get_bom_by_uuid(
        tenant_id: int,
        bom_uuid: str
    ) -> BOMResponse:
        """
        根据UUID获取BOM
        
        Args:
            tenant_id: 租户ID
            bom_uuid: BOM UUID
            
        Returns:
            BOMResponse: BOM对象
            
        Raises:
            NotFoundError: 当BOM不存在时抛出
        """
        bom = await BOM.filter(
            tenant_id=tenant_id,
            uuid=bom_uuid,
            deleted_at__isnull=True
        ).prefetch_related("material", "component").first()
        
        if not bom:
            raise NotFoundError(f"BOM {bom_uuid} 不存在")
        
        return BOMResponse.model_validate(bom)
    
    @staticmethod
    async def list_bom(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        material_id: Optional[int] = None,
        is_active: Optional[bool] = None,
        include_obsolete: bool = False
    ) -> List[BOMResponse]:
        """
        获取BOM列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            material_id: 主物料ID（可选，用于过滤）
            is_active: 是否启用（可选）
            include_obsolete: 是否包含已失效版本（默认不包含）
            
        Returns:
            List[BOMResponse]: BOM列表
        """
        query = BOM.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if material_id is not None:
            query = query.filter(material_id=material_id)
        
        if is_active is not None:
            query = query.filter(is_active=is_active)
        
        if not include_obsolete:
            query = query.filter(is_obsolete=False)
        
        bom_list = await query.offset(skip).limit(limit).order_by(
            "level", "path", "priority", "id"
        ).all()
        
        result = []
        for b in bom_list:
            # 手动构建 dict，确保 uuid/unit 等类型正确，避免 ORM 与 Pydantic 类型差异导致 500
            d = {
                "id": b.id,
                "uuid": str(b.uuid) if b.uuid else "",
                "tenant_id": b.tenant_id,
                "material_id": b.material_id,
                "component_id": b.component_id,
                "quantity": b.quantity,
                "base_quantity": getattr(b, "base_quantity", None) or Decimal("1"),
                "unit": (b.unit and str(b.unit).strip()) or None,
                "waste_rate": getattr(b, "waste_rate", None) or Decimal("0"),
                "is_required": getattr(b, "is_required", True),
                "level": getattr(b, "level", 0),
                "path": b.path,
                "version": b.version or "1.0",
                "bom_code": b.bom_code,
                "bom_name": getattr(b, "bom_name", None),
                "is_default": getattr(b, "is_default", False),
                "effective_date": b.effective_date,
                "expiry_date": b.expiry_date,
                "is_obsolete": getattr(b, "is_obsolete", False),
                "obsoleted_at": getattr(b, "obsoleted_at", None),
                "obsolete_reason": getattr(b, "obsolete_reason", None),
                "approval_status": (b.approval_status or "draft").lower() if b.approval_status else "draft",
                "approved_by": b.approved_by,
                "approved_at": b.approved_at,
                "approval_comment": b.approval_comment,
                "is_alternative": getattr(b, "is_alternative", False),
                "alternative_group_id": b.alternative_group_id,
                "priority": getattr(b, "priority", 0),
                "is_configurable": getattr(b, "is_configurable", False),
                "configurable_group_id": getattr(b, "configurable_group_id", None),
                "is_default_configurable": getattr(b, "is_default_configurable", False),
                "description": b.description,
                "remark": b.remark,
                "is_active": getattr(b, "is_active", True),
                "created_at": b.created_at,
                "updated_at": b.updated_at,
                **audit_response_fields(b),
                "deleted_at": b.deleted_at,
            }
            result.append(BOMResponse.model_validate(d))
        return result

    @staticmethod
    async def list_bom_groups(
        tenant_id: int,
        include_obsolete: bool = False
    ) -> List[BOMGroupSummary]:
        """
        按 material_id + version 分组返回 BOM 摘要（不拉取明细），用于列表树首屏与按需加载子件。
        """
        from tortoise import Tortoise
        conn = Tortoise.get_connection("default")
        table = BOM._meta.db_table
        obsolete_filter = "" if include_obsolete else " AND is_obsolete = FALSE"
        sql = f"""
            SELECT material_id, version,
                   MAX(bom_code) AS bom_code,
                   MAX(bom_name) AS bom_name,
                   MAX(base_quantity) AS base_quantity,
                   MAX(approval_status) AS approval_status,
                   BOOL_OR(is_default) AS is_default,
                   BOOL_OR(is_obsolete) AS is_obsolete,
                   COUNT(*)::int AS item_count
            FROM "{table}"
            WHERE tenant_id = $1 AND deleted_at IS NULL{obsolete_filter}
            GROUP BY material_id, version
            ORDER BY material_id, version
        """
        if hasattr(conn, "execute_query_dict"):
            rows = await conn.execute_query_dict(sql, [tenant_id])
        else:
            result = await conn.execute_query(sql, [tenant_id])
            raw = result[1] if isinstance(result, tuple) and len(result) > 1 else result
            if not raw:
                return []
            rows = [
                {
                    "material_id": r[0],
                    "version": r[1] or "1.0",
                    "bom_code": r[2],
                    "bom_name": r[3],
                    "base_quantity": r[4],
                    "approval_status": (r[5] or "draft").lower(),
                    "is_default": bool(r[6]) if r[6] is not None else False,
                    "is_obsolete": bool(r[7]) if r[7] is not None else False,
                    "item_count": int(r[8]) if r[8] is not None else 0,
                }
                for r in raw
            ]
        return [BOMGroupSummary.model_validate(r) for r in rows]

    @staticmethod
    async def list_bom_component_ids(tenant_id: int, include_obsolete: bool = False) -> List[int]:
        """
        返回在 BOM 中作为子件（component_id）出现过的物料 ID 集合，用于列表区分成品/半成品。
        """
        from tortoise import Tortoise
        conn = Tortoise.get_connection("default")
        table = BOM._meta.db_table
        obsolete_filter = "" if include_obsolete else " AND is_obsolete = FALSE"
        sql = f'''
            SELECT DISTINCT component_id FROM "{table}"
            WHERE tenant_id = $1 AND deleted_at IS NULL{obsolete_filter}
        '''
        if hasattr(conn, "execute_query_dict"):
            rows = await conn.execute_query_dict(sql, [tenant_id])
            return [r["component_id"] for r in rows if r.get("component_id") is not None]
        result = await conn.execute_query(sql, [tenant_id])
        raw = result[1] if isinstance(result, tuple) and len(result) > 1 else result
        return [r[0] for r in (raw or []) if r and r[0] is not None]

    @staticmethod
    async def list_bom_items_by_materials_batch(
        tenant_id: int,
        material_versions: List[Dict[str, Any]],
        include_obsolete: bool = False,
    ) -> Dict[str, List[BOMResponse]]:
        """
        批量按 (material_id, version) 拉取 BOM 子件明细，用于列表树一次构建完整层级。
        material_versions: [{"material_id": 1, "version": "1.0"}, ...]
        返回: {"material_id|version": [BOMResponse, ...], ...}
        """
        if not material_versions:
            return {}
        keys = [(m["material_id"], m["version"] or "1.0") for m in material_versions]
        query = BOM.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        if not include_obsolete:
            query = query.filter(is_obsolete=False)
        # 构建 (material_id, version) 的 OR 条件
        from tortoise.expressions import Q
        q = Q(material_id=keys[0][0], version=keys[0][1])
        for mid, ver in keys[1:]:
            q = q | Q(material_id=mid, version=ver)
        query = query.filter(q)
        bom_list = await query.order_by("priority", "id").all()
        out: Dict[str, List[BOMResponse]] = {}
        for b in bom_list:
            k = f"{b.material_id}|{b.version or '1.0'}"
            if k not in out:
                out[k] = []
            d = {
                "id": b.id,
                "uuid": str(b.uuid) if b.uuid else "",
                "tenant_id": b.tenant_id,
                "material_id": b.material_id,
                "component_id": b.component_id,
                "quantity": b.quantity,
                "base_quantity": getattr(b, "base_quantity", None) or Decimal("1"),
                "unit": (b.unit and str(b.unit).strip()) or None,
                "waste_rate": getattr(b, "waste_rate", None) or Decimal("0"),
                "is_required": getattr(b, "is_required", True),
                "level": getattr(b, "level", 0),
                "path": b.path,
                "version": b.version or "1.0",
                "bom_code": b.bom_code,
                "bom_name": getattr(b, "bom_name", None),
                "is_default": getattr(b, "is_default", False),
                "effective_date": b.effective_date,
                "expiry_date": b.expiry_date,
                "is_obsolete": getattr(b, "is_obsolete", False),
                "obsoleted_at": getattr(b, "obsoleted_at", None),
                "obsolete_reason": getattr(b, "obsolete_reason", None),
                "approval_status": (b.approval_status or "draft").lower() if b.approval_status else "draft",
                "approved_by": b.approved_by,
                "approved_at": b.approved_at,
                "approval_comment": b.approval_comment,
                "is_alternative": getattr(b, "is_alternative", False),
                "alternative_group_id": b.alternative_group_id,
                "priority": getattr(b, "priority", 0),
                "is_configurable": getattr(b, "is_configurable", False),
                "configurable_group_id": getattr(b, "configurable_group_id", None),
                "is_default_configurable": getattr(b, "is_default_configurable", False),
                "description": b.description,
                "remark": b.remark,
                "is_active": getattr(b, "is_active", True),
                "created_at": b.created_at,
                "updated_at": b.updated_at,
                **audit_response_fields(b),
                "deleted_at": b.deleted_at,
            }
            out[k].append(BOMResponse.model_validate(d))
        return out
    
    @staticmethod
    async def update_bom(
        tenant_id: int,
        bom_uuid: str,
        data: BOMUpdate,
        current_user: Optional[User] = None,
    ) -> BOMResponse:
        """
        更新BOM
        
        Args:
            tenant_id: 租户ID
            bom_uuid: BOM UUID
            data: BOM更新数据
            
        Returns:
            BOMResponse: 更新后的BOM对象
            
        Raises:
            NotFoundError: 当BOM不存在时抛出
            ValidationError: 当主物料或子物料不存在时抛出
        """
        bom = await BOM.filter(
            tenant_id=tenant_id,
            uuid=bom_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not bom:
            raise NotFoundError(f"BOM {bom_uuid} 不存在")
        
        # 兼容 Pydantic v1/v2，并统一为 snake_case
        if hasattr(data, "model_dump"):
            update_data = data.model_dump(exclude_unset=True, by_alias=False)
        else:
            update_data = data.dict(exclude_unset=True)
        # 前端可能传 isDefault (camelCase)，统一转为 is_default
        if "isDefault" in update_data and "is_default" not in update_data:
            update_data["is_default"] = update_data.pop("isDefault")
        # 检查BOM状态：已审核的BOM不可编辑（但允许仅更新 is_default 设为默认版本）
        if bom.approval_status == 'approved':
            only_set_default = (
                set(update_data.keys()) <= {"is_default"}
                and update_data.get("is_default") is True
            )
            if not only_set_default:
                raise ValidationError(f"BOM {bom.bom_code} (版本 {bom.version}) 已审核通过，禁止修改。请先撤销审核或创建新版本。")
        
        # 如果更新主物料ID，检查主物料是否存在
        if data.material_id and data.material_id != bom.material_id:
            material = await Material.filter(
                tenant_id=tenant_id,
                id=data.material_id,
                deleted_at__isnull=True
            ).first()
            
            if not material:
                raise ValidationError(f"主物料 {data.material_id} 不存在")
        
        # 如果更新子物料ID，检查子物料是否存在
        if data.component_id and data.component_id != bom.component_id:
            component = await Material.filter(
                tenant_id=tenant_id,
                id=data.component_id,
                deleted_at__isnull=True
            ).first()
            
            if not component:
                raise ValidationError(f"子物料 {data.component_id} 不存在")
        
        # 检查主物料和子物料不能相同
        material_id = data.material_id if data.material_id else bom.material_id
        component_id = data.component_id if data.component_id else bom.component_id
        
        if material_id == component_id:
            raise ValidationError("主物料和子物料不能相同")
        
        # 更新字段
        is_default_updated = "is_default" in update_data and update_data["is_default"] is True
        
        if is_default_updated:
            # 设为默认版本时：先清除该物料其他版本的 is_default，再设置当前版本所有行为默认
            await BOM.filter(
                tenant_id=tenant_id,
                material_id=bom.material_id,
                deleted_at__isnull=True
            ).update(is_default=False)
            await BOM.filter(
                tenant_id=tenant_id,
                material_id=bom.material_id,
                version=bom.version,
                deleted_at__isnull=True
            ).update(is_default=True)
            # 已批量更新，跳过单条 setattr；必须同步内存对象，否则 bom.save() 会覆盖数据库
            update_data.pop("is_default", None)
            bom.is_default = True
        
        for key, value in update_data.items():
            setattr(bom, key, value)
        apply_update_audit(bom, current_user)
        await bom.save()
        
        return BOMResponse.model_validate(bom)
    
    @staticmethod
    async def delete_bom(
        tenant_id: int,
        bom_uuid: str
    ) -> None:
        """
        删除BOM（软删除）
        
        Args:
            tenant_id: 租户ID
            bom_uuid: BOM UUID
            
        Raises:
            NotFoundError: 当BOM不存在时抛出
        """
        bom = await BOM.filter(
            tenant_id=tenant_id,
            uuid=bom_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not bom:
            raise NotFoundError(f"BOM {bom_uuid} 不存在")
            
        # 检查BOM状态：已审核的BOM不可删除
        if bom.approval_status == 'approved':
            raise ValidationError(f"BOM {bom.bom_code} (版本 {bom.version}) 已审核通过，禁止删除。请先撤销审核。")
        
        # 软删除
        from tortoise import timezone
        bom.deleted_at = timezone.now()
        await bom.save()
    
    @staticmethod
    async def approve_bom(
        tenant_id: int,
        bom_uuid: str,
        approved_by: int,
        approval_comment: Optional[str] = None,
        approved: bool = True
    ) -> BOMResponse:
        """
        审核BOM
        
        Args:
            tenant_id: 租户ID
            bom_uuid: BOM UUID
            approved_by: 审核人ID
            approval_comment: 审核意见
            approved: 是否通过（True=通过，False=拒绝）
            
        Returns:
            BOMResponse: 审核后的BOM对象
            
        Raises:
            NotFoundError: 当BOM不存在时抛出
        """
        bom = await BOM.filter(
            tenant_id=tenant_id,
            uuid=bom_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not bom:
            raise NotFoundError(f"BOM {bom_uuid} 不存在")

        if approved:
            await MaterialService._assert_bom_version_components_have_source_type(
                tenant_id,
                bom.material_id,
                bom.version,
            )
        
        from tortoise import timezone
        bom.approval_status = "approved" if approved else "rejected"
        bom.approved_by = approved_by
        bom.approved_at = timezone.now()
        bom.approval_comment = approval_comment
        
        await bom.save()
        
        return BOMResponse.model_validate(bom)
    
    @staticmethod
    async def batch_approve_bom(
        tenant_id: int,
        bom_uuids: List[str],
        approved_by: int,
        approval_comment: Optional[str] = None,
        approved: bool = True,
        recursive: bool = False,
        is_reverse: bool = False
    ) -> List[BOMResponse]:
        """
        批量审核BOM
        
        Args:
            tenant_id: 租户ID
            bom_uuids: BOM UUID列表
            approved_by: 审核人ID
            approval_comment: 审核意见
            approved: 是否通过（True=通过，False=拒绝）
            recursive: 是否递归处理子BOM
            is_reverse: 是否撤销审核（True=重置为草稿）
            
        Returns:
            List[BOMResponse]: 审核后的BOM对象列表
        """
        if not bom_uuids:
            return []
            
        from tortoise import timezone
        
        # 查找所有BOM
        boms = await BOM.filter(
            tenant_id=tenant_id,
            uuid__in=bom_uuids,
            deleted_at__isnull=True
        ).all()
        
        target_ids = set(b.id for b in boms)
        
        # 递归查找子BOM
        if recursive:
            ids_to_process = list(target_ids)
            processed_materials = set() # 防止无限循环（虽然有循环检测，但防万一）
            
            while ids_to_process:
                current_batch_ids = ids_to_process
                ids_to_process = []
                
                # 获取当前批次BOM的子物料和版本
                current_boms = await BOM.filter(id__in=current_batch_ids).all()
                
                for b in current_boms:
                    # key = (material_id, version)
                    # 查找以该component为父件的BOM（且版本一致）
                    if b.component_id in processed_materials:
                        continue
                    
                    # 查找子BOM
                    child_boms = await BOM.filter(
                        tenant_id=tenant_id,
                        material_id=b.component_id,
                        version=b.version, # 假设版本同步
                        deleted_at__isnull=True
                    ).all()
                    
                    if child_boms:
                        processed_materials.add(b.component_id)
                        for child in child_boms:
                            if child.id not in target_ids:
                                target_ids.add(child.id)
                                ids_to_process.append(child.id)
        
        # 确定新状态
        new_status = "approved"
        if is_reverse:
            new_status = "draft"
        elif not approved:
            new_status = "rejected"

        if target_ids:
            if approved and not is_reverse:
                version_pairs = {(b.material_id, b.version) for b in boms}
                for material_id, version in version_pairs:
                    await MaterialService._assert_bom_version_components_have_source_type(
                        tenant_id,
                        material_id,
                        version,
                    )

            # Prepare for bulk update
            update_data = {
                "approval_status": new_status,
                "approved_by": approved_by,
                "approved_at": timezone.now(),
            }
            
            if approval_comment is not None:
                 update_data["approval_comment"] = approval_comment
                 
            await BOM.filter(
               id__in=list(target_ids)
            ).update(**update_data)
            
            # Re-fetch updated records to return
            # 只返回最初请求的BOM
            result = await BOM.filter(
               uuid__in=bom_uuids,
               deleted_at__isnull=True
            ).all()
            return [BOMResponse.model_validate(b) for b in result]
        
        return []
    
    @staticmethod
    async def copy_bom(
        tenant_id: int,
        bom_uuid: str,
        new_version: Optional[str] = None,
        version_remark: Optional[str] = None
    ) -> BOMResponse:
        """
        复制BOM（创建新版本）
        
        Args:
            tenant_id: 租户ID
            bom_uuid: 源BOM UUID
            new_version: 新版本号（可选，如果不提供则自动升版）
            
        Returns:
            BOMResponse: 新创建的BOM（第一个条目）
        """
        bom = await BOM.filter(
            tenant_id=tenant_id,
            uuid=bom_uuid
        ).first()
        
        if not bom:
             raise NotFoundError(f"BOM {bom_uuid} 不存在")
        
        # 1. 自动计算新版本号
        if not new_version:
             # 简单的版本自增逻辑：X.Y -> X.Y+1
             # 这里假设版本号格式为 numeric.numeric
             try:
                major, minor = bom.version.split('.')
                new_version = f"{major}.{int(minor) + 1}"
             except ValueError:
                 # 如果不是标准格式，使用后缀
                 new_version = f"{bom.version}_rev1"
                 
             # 检查新版本号是否已存在
             exists = await BOM.filter(
                 tenant_id=tenant_id,
                 material_id=bom.material_id,
                 version=new_version,
                 deleted_at__isnull=True
             ).exists()
             
             if exists:
                 raise ValidationError(f"新版本 {new_version} 已存在")
        
        # 2. 查找源BOM的所有组成部分（同一 material_id + version，仅当前主件，不包含子件自己的BOM）
        source_boms = await BOM.filter(
            tenant_id=tenant_id,
            material_id=bom.material_id,
            version=bom.version,
            deleted_at__isnull=True
        ).all()
        
        from tortoise import timezone
        from datetime import datetime
        
        # 3. 升版时 BOM 编码随版本更新（如 BOM-EBK0002-1.0 -> BOM-EBK0002-1.1）
        parent_material = await Material.get(id=bom.material_id)
        new_bom_code = None
        try:
            context = {
                "date": datetime.now().strftime("%Y%m%d"),
                "material_code": parent_material.main_code,
                "version": new_version,
            }
            new_bom_code = await CodeGenerationService.generate_code(
                tenant_id=tenant_id,
                rule_code="ENGINEERING_BOM_CODE",
                context=context
            )
        except Exception as e:
            logger.warning(f"BOM编码生成失败，使用降级方案: {e}")
        if not new_bom_code:
            # 降级：物料编码 + 新版本号
            new_bom_code = f"BOM-{parent_material.main_code}-{new_version}"
        
        # 4. 创建新版本BOM列表
        new_boms = []
        for source in source_boms:
             new_bom = BOM(
                 tenant_id=tenant_id,
                 material_id=source.material_id,
                 component_id=source.component_id,
                 quantity=source.quantity,
                 base_quantity=source.base_quantity or Decimal("1"),
                 unit=source.unit,
                 waste_rate=source.waste_rate,
                 is_required=source.is_required,
                 level=source.level,
                 path=source.path,
                 version=new_version,
                 bom_code=new_bom_code,  # 升版时 BOM 编码随版本更新
                 bom_name=source.bom_name,
                 effective_date=timezone.now(), # 生效日期更新为当前
                 description=source.description,
                 remark=version_remark if version_remark else source.remark,
                 is_active=True,
                 approval_status="draft", # 重置为草稿
                 approved_by=None,
                 approved_at=None,
                 approval_comment=None
             )
             await new_bom.save()
             new_boms.append(new_bom)
             
        return BOMResponse.model_validate(new_boms[0] if new_boms else bom)
        
    @staticmethod
    async def revise_bom(
        tenant_id: int,
        bom_uuid: str,
        new_version: Optional[str] = None,
        version_remark: Optional[str] = None
    ) -> BOMResponse:
        """
        BOM升版（Revise）

        Args:
            tenant_id: 租户ID
            bom_uuid: 源BOM UUID
            new_version: 新版本号（可选）
            version_remark: 版本变更备注（可选）
        """
        return await MaterialService.copy_bom(tenant_id, bom_uuid, new_version, version_remark)


    
    @staticmethod
    async def get_bom_by_material(
        tenant_id: int,
        material_id: int,
        version: Optional[str] = None,
        only_active: bool = True,
        include_obsolete: bool = False
    ) -> List[BOMResponse]:
        """
        根据主物料获取BOM列表（支持版本过滤）
        
        Args:
            tenant_id: 租户ID
            material_id: 主物料ID
            version: 版本号（可选）
            only_active: 是否只返回已审核的BOM
            include_obsolete: 是否包含已失效的BOM版本（默认不包含）
            
        Returns:
            List[BOMResponse]: BOM列表
        """
        query = BOM.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            deleted_at__isnull=True
        )
        
        if version:
            query = query.filter(version=version)
        
        if not include_obsolete:
            query = query.filter(is_obsolete=False)
        
        if only_active:
            query = query.filter(approval_status="approved", is_active=True)
        
        bom_list = await query.order_by("priority", "id").all()
        
        return [BOMResponse.model_validate(b) for b in bom_list]

    @staticmethod
    async def batch_check_has_bom(
        tenant_id: int,
        material_ids: List[int],
        only_active: bool = True
    ) -> Dict[int, bool]:
        """
        批量检查物料是否有BOM配置（用于销售订单明细视图等批量检查场景）

        复用 get_bom_by_material 的查询逻辑，确保与单次检查结果完全一致。

        Args:
            tenant_id: 租户ID
            material_ids: 物料ID列表
            only_active: 是否只检查已审核的BOM（默认：true）

        Returns:
            Dict[int, bool]: 物料ID -> 是否有BOM
        """
        if not material_ids:
            return {}

        async def check_one(mid: int) -> tuple[int, bool]:
            bom_list = await MaterialService.get_bom_by_material(
                tenant_id=tenant_id,
                material_id=mid,
                only_active=only_active
            )
            return (mid, len(bom_list) > 0)

        results = await asyncio.gather(*[check_one(mid) for mid in material_ids])
        return dict(results)
    
    @staticmethod
    async def get_bom_versions(
        tenant_id: int,
        bom_code: str,
        include_obsolete: bool = True
    ) -> List[BOMResponse]:
        """
        获取指定BOM编码的所有版本
        
        Args:
            tenant_id: 租户ID
            bom_code: BOM编码
            include_obsolete: 是否包含已失效版本（默认包含，便于版本列表展示）
            
        Returns:
            List[BOMResponse]: BOM版本列表
        """
        query = BOM.filter(
            tenant_id=tenant_id,
            bom_code=bom_code,
            deleted_at__isnull=True
        )
        if not include_obsolete:
            query = query.filter(is_obsolete=False)
        bom_list = await query.order_by("-version").all()
        return [BOMResponse.model_validate(b) for b in bom_list]

    @staticmethod
    async def set_bom_version_obsolete(
        tenant_id: int,
        material_id: int,
        version: str,
        reason: Optional[str] = None
    ) -> int:
        """
        将指定物料的指定BOM版本设为失效。
        若该版本为默认版本，会清除 is_default，避免失效版本仍被选为默认。
        
        Args:
            tenant_id: 租户ID
            material_id: 主物料ID
            version: BOM版本号
            reason: 失效原因（可选）
            
        Returns:
            int: 更新的BOM行数
        """
        from datetime import datetime
        qs = BOM.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            version=version,
            deleted_at__isnull=True
        )
        count = await qs.count()
        if count == 0:
            raise NotFoundError(f"未找到物料 {material_id} 版本 {version} 的 BOM")
        await qs.update(
            is_obsolete=True,
            obsoleted_at=datetime.utcnow(),
            obsolete_reason=reason or None,
            is_default=False
        )
        return count
    
    # ==================== 级联查询相关方法 ====================
    
    @staticmethod
    async def get_material_group_tree(
        tenant_id: int,
        is_active: Optional[bool] = None
    ) -> List["MaterialGroupTreeResponse"]:
        """
        获取物料分组树形结构（物料分组→物料）
        
        返回完整的物料分组层级结构，支持多级分组，用于级联选择等场景。
        
        Args:
            tenant_id: 租户ID
            is_active: 是否只查询启用的数据（可选）
            
        Returns:
            List[MaterialGroupTreeResponse]: 物料分组树形列表，每个分组包含子分组列表和物料列表
        """
        # 延迟导入避免循环依赖
        from apps.master_data.schemas.material_schemas import (
            MaterialGroupTreeResponse,
            MaterialTreeResponse
        )
        
        # 查询所有物料分组（预加载关联关系，修复500错误）
        group_query = MaterialGroup.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        if is_active is not None:
            group_query = group_query.filter(is_active=is_active)
        
        groups = await group_query.prefetch_related("process_route").order_by("code").all()
        
        # 查询所有物料
        material_query = Material.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        if is_active is not None:
            material_query = material_query.filter(is_active=is_active)
        
        # 预加载关联关系（优化，修复500错误）
        materials = await material_query.prefetch_related("group", "process_route").order_by("code").all()
        
        # 构建物料映射（按分组ID分组）
        material_map: dict[Optional[int], List[MaterialTreeResponse]] = {}
        for material in materials:
            group_id = material.group_id
            if group_id not in material_map:
                material_map[group_id] = []
            # 构建物料响应数据（用 _material_to_response_data 避免 ReverseRelation；树形接口不加载 code_aliases）
            try:
                resp_data = _material_to_response_data(material)
                resp_data["code_aliases"] = []
                material_map[group_id].append(MaterialTreeResponse.model_validate(resp_data))
            except Exception as e:
                logger.warning(f"序列化物料 {material.id if hasattr(material, 'id') else 'unknown'} 失败: {str(e)}")
                continue
        
        # 构建分组映射（按父分组ID分组）
        group_map: dict[Optional[int], List[MaterialGroupTreeResponse]] = {}
        for group in groups:
            parent_id = group.parent_id
            if parent_id not in group_map:
                group_map[parent_id] = []
            
            # 获取该分组的物料列表
            group_materials = material_map.get(group.id, [])
            
            # 创建分组响应对象（包含物料列表，子分组稍后添加）
            # 使用 model_validate 创建响应对象，然后手动设置 children 和 materials
            group_dict = {
                "id": group.id,
                "uuid": group.uuid,
                "tenant_id": group.tenant_id,
                "code": group.code,
                "alias": group.alias,
                "name": group.name,
                "parent_id": group.parent_id,
                "description": group.description,
                "is_active": group.is_active,
                "created_at": group.created_at,
                "updated_at": group.updated_at,
                **audit_response_fields(group),
                "deleted_at": group.deleted_at,
                "children": [],  # 先初始化为空，稍后递归填充
                "materials": group_materials,
                # 添加process_route_id和process_route_name（修复500错误）
                # 注意：使用getattr安全访问，避免字段不存在时出错
                "process_route_id": getattr(group, 'process_route_id', None) if hasattr(group, 'process_route_id') else (getattr(group.process_route, 'id', None) if hasattr(group, 'process_route') and group.process_route else None),
                "process_route_name": getattr(group.process_route, 'name', None) if hasattr(group, 'process_route') and group.process_route else None,
                "inspection_stages": getattr(group, "inspection_stages", None),
            }
            group_response = MaterialGroupTreeResponse.model_validate(group_dict)
            group_map[parent_id].append(group_response)
        
        # 递归构建分组树形结构
        def build_tree(parent_id: Optional[int]) -> List[MaterialGroupTreeResponse]:
            """递归构建分组树"""
            result: List[MaterialGroupTreeResponse] = []
            if parent_id not in group_map:
                return result
            
            for group_response in group_map[parent_id]:
                # 递归获取子分组
                group_response.children = build_tree(group_response.id)
                result.append(group_response)
            
            return result
        
        # 从根分组（parent_id 为 None）开始构建树
        return build_tree(None)
    
    # ==================== BOM批量导入和验证相关方法（根据优化设计规范新增） ====================
    
    @staticmethod
    async def batch_import_bom(
        tenant_id: int,
        data: BOMBatchImport
    ) -> List[BOMResponse]:
        """
        批量导入BOM（支持universheet批量导入，支持部门编码自动映射）
        
        根据《工艺路线和标准作业流程优化设计规范.md》设计。
        
        Args:
            tenant_id: 租户ID
            data: BOM批量导入数据
            
        Returns:
            List[BOMResponse]: 创建的BOM对象列表
            
        Raises:
            ValidationError: 当编码不存在、循环依赖、重复子件等时抛出
        """
        from collections import defaultdict
        
        # 步骤1：编码映射 - 将部门编码映射到物料ID
        code_to_material = {}  # 编码 -> 物料ID的映射
        material_id_to_code = {}  # 物料ID -> 编码的映射（用于错误提示）
        
        # 收集所有需要查询的编码
        all_codes = set()
        for item in data.items:
            all_codes.add(item.parent_code)
            all_codes.add(item.component_code)
        
        # 批量查询物料（通过主编码和部门编码）
        for code in all_codes:
            material = await MaterialCodeService.get_material_by_code(
                tenant_id=tenant_id,
                code=code
            )
            if not material:
                raise ValidationError(f"编码不存在：{code}，请先创建物料")
            code_to_material[code] = material.id
            material_id_to_code[material.id] = code
        
        # 步骤2：数据完整性验证
        # 验证父件编码是否存在（已在步骤1完成）
        # 验证子件编码是否存在（已在步骤1完成）
        # 验证子件数量是否大于0（已在Schema验证）
        # 验证损耗率（已在Schema验证）
        
        # 步骤3：检测重复子件（同一父件下，非配置位且非替代料时子件编码不能重复；配置位/替代料同组内可有多行）
        parent_component_map = defaultdict(set)  # 父件ID -> 子件ID集合（排除配置位、替代料）
        for item in data.items:
            parent_id = code_to_material[item.parent_code]
            component_id = code_to_material[item.component_code]
            is_cfg = getattr(item, "is_configurable", False) or False
            is_alt = getattr(item, "is_alternative", False) or False
            if not is_cfg and not is_alt and component_id in parent_component_map[parent_id]:
                raise ValidationError(
                    f"父件 {item.parent_code} 下，子件 {item.component_code} 重复"
                )
            if not is_cfg and not is_alt:
                parent_component_map[parent_id].add(component_id)
        
        # 步骤4：检测循环依赖
        # 构建物料依赖图
        dependency_graph = defaultdict(set)  # 物料ID -> 依赖的物料ID集合
        for item in data.items:
            parent_id = code_to_material[item.parent_code]
            component_id = code_to_material[item.component_code]
            dependency_graph[parent_id].add(component_id)
        
        # 检测循环依赖（使用DFS）
        def has_cycle(node: int, visited: set, rec_stack: set) -> bool:
            """检测从node开始的路径是否有循环"""
            visited.add(node)
            rec_stack.add(node)
            
            for neighbor in dependency_graph.get(node, set()):
                if neighbor not in visited:
                    if has_cycle(neighbor, visited, rec_stack):
                        return True
                elif neighbor in rec_stack:
                    # 找到循环
                    return True
            
            rec_stack.remove(node)
            return False
        
        # 检查所有节点是否有循环
        all_nodes = set(dependency_graph.keys()) | set(
            component_id for components in dependency_graph.values() for component_id in components
        )
        visited = set()
        for node in all_nodes:
            if node not in visited:
                if has_cycle(node, visited, set()):
                    # 找到循环，构建循环路径用于提示
                    cycle_path = []
                    rec_stack = set()
                    def find_cycle_path(node: int, path: list):
                        if node in rec_stack:
                            # 找到循环起点
                            cycle_start = path.index(node)
                            cycle_path.extend(path[cycle_start:] + [node])
                            return True
                        rec_stack.add(node)
                        path.append(node)
                        for neighbor in dependency_graph.get(node, set()):
                            if find_cycle_path(neighbor, path):
                                return True
                        path.pop()
                        rec_stack.remove(node)
                        return False
                    find_cycle_path(node, [])
                    cycle_codes = [material_id_to_code.get(nid, str(nid)) for nid in cycle_path]
                    raise ValidationError(
                        f"检测到循环依赖：{' -> '.join(cycle_codes)}，请检查BOM配置"
                    )
        
        # 步骤5：生成BOM层级结构
        # 构建父件到子件的映射（用于计算层级）
        parent_to_children = defaultdict(list)
        for item in data.items:
            parent_id = code_to_material[item.parent_code]
            component_id = code_to_material[item.component_code]
            parent_to_children[parent_id].append((component_id, item))
        
        # 计算层级和路径
        def calculate_level_and_path(
            material_id: int,
            current_level: int = 0,
            current_path: str = ""
        ) -> tuple:
            """递归计算层级和路径"""
            if current_path:
                new_path = f"{current_path}/{material_id}"
            else:
                new_path = str(material_id)
            
            return current_level, new_path
        
        # 步骤5.5：校验已审核版本不可直接修改（按父件+解析后的版本）
        parent_items_map_pre: Dict[int, List[Any]] = defaultdict(list)
        for item in data.items:
            parent_items_map_pre[code_to_material[item.parent_code]].append(item)
        for parent_id, items in parent_items_map_pre.items():
            parent_material = await Material.get(id=parent_id)
            parent_label = material_id_to_code.get(parent_id, str(parent_id))
            target_version, _, _, _ = MaterialService._resolve_parent_bom_import_meta(
                items, data, parent_material, parent_label
            )
            approved_exists = await BOM.filter(
                tenant_id=tenant_id,
                material_id=parent_id,
                version=target_version,
                approval_status="approved",
                deleted_at__isnull=True,
            ).exists()
            if approved_exists:
                raise ValidationError(
                    f"父件 {parent_label} 的版本 {target_version} 已审核通过，禁止直接修改。请先升版或使用「另存为新版本」。"
                )
        
        # 步骤6：创建BOM数据 (Refactored: Clean Replace & Auto-Numbering)
        # 版本策略：请求中的每个 parent_id 都会按 target_version 做全量替换。
        # 设计器「另存为新版本」时应只传当前主件的直接子件（根级），避免未改动的半成品被误升版。
        from tortoise import timezone
        from datetime import datetime
        
        bom_list = []
        # 按父件ID分组处理
        parent_items_map = defaultdict(list)
        for item in data.items:
            parent_id = code_to_material[item.parent_code]
            parent_items_map[parent_id].append(item)
            
        for parent_id, items in parent_items_map.items():
            parent_material = await Material.get(id=parent_id)
            parent_label = material_id_to_code.get(parent_id, str(parent_id))
            target_version, bom_code_hint, parent_bom_name, parent_base_qty = (
                MaterialService._resolve_parent_bom_import_meta(
                    items, data, parent_material, parent_label
                )
            )
            # 2. 确定 BOM 编码 (Auto-Numbering)
            bom_code = bom_code_hint
            
            # 如果请求未指定，尝试查找该父件该版本的现有编码
            if not bom_code:
                existing_version_bom = await BOM.filter(
                    tenant_id=tenant_id,
                    material_id=parent_id,
                    version=target_version,
                    deleted_at__isnull=True
                ).first()
                if existing_version_bom:
                    bom_code = existing_version_bom.bom_code
            
            # 如果当前版本没有（如新版本），尝试查找该父件的其他版本以继承 BOM 编码
            # 根据模型定义：同一主物料的不同版本使用相同编码
            if not bom_code:
                any_existing_bom = await BOM.filter(
                    tenant_id=tenant_id,
                    material_id=parent_id,
                    deleted_at__isnull=True
                ).first()
                if any_existing_bom:
                    bom_code = any_existing_bom.bom_code

            # 如果仍无编码，生成新编码
            if not bom_code:
                try:
                    parent_material = await Material.get(id=parent_id)
                    context = {
                        "date": datetime.now().strftime("%Y%m%d"),
                        "material_code": parent_material.main_code,
                        "version": target_version
                    }
                    bom_code = await CodeGenerationService.generate_code(
                        tenant_id=tenant_id,
                        rule_code="ENGINEERING_BOM_CODE",
                        context=context
                    )
                except Exception as e:
                    # 降级方案：使用时间戳
                    logger.warning(f"BOM编码生成失败，使用降级方案: {e}")
                    # 重新获父物料信息（如果上面try块失败）
                    parent_material = await Material.get(id=parent_id)
                    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
                    bom_code = f"BOM-{parent_material.main_code}-{timestamp}"

            # 3. 全量替换 (Clean Replace)
            # 软删除当前父件+当前版本的所有现有BOM行
            # 注意：这会删除旧的结构，用新的结构完全替代
            await BOM.filter(
                tenant_id=tenant_id,
                material_id=parent_id,
                version=target_version,
                deleted_at__isnull=True
            ).update(deleted_at=timezone.now())

            # 4. 创建新条目
            for item in items:
                component_id = code_to_material[item.component_code]
                
                # 检查主物料和子物料不能相同
                if parent_id == component_id:
                     # 理论上前面检查过了，这里双重保险或忽略
                    continue

                level = 1
                path = f"{parent_id}/{component_id}"

                is_cfg = getattr(item, "is_configurable", False) or False
                cfg_group_id = getattr(item, "configurable_group_id", None)
                is_default_cfg = getattr(item, "is_default_configurable", False) or False
                is_alt = getattr(item, "is_alternative", False) or False
                alt_group_id = getattr(item, "alternative_group_id", None)
                prio = getattr(item, "priority", 0) or 0
                row_remark = getattr(data, "version_remark", None) or item.remark
                bom = await BOM.create(
                    tenant_id=tenant_id,
                    material_id=parent_id,
                    component_id=component_id,
                    quantity=item.quantity,
                    base_quantity=parent_base_qty,
                    unit=item.unit,
                    waste_rate=item.waste_rate or Decimal("0.00"),
                    is_required=item.is_required if item.is_required is not None else True,
                    level=level,
                    path=path,
                    version=target_version,
                    bom_code=bom_code,
                    bom_name=parent_bom_name,
                    effective_date=data.effective_date,
                    description=data.description,
                    remark=row_remark,
                    is_active=item.is_active if item.is_active is not None else True,
                    is_configurable=is_cfg,
                    configurable_group_id=cfg_group_id if is_cfg else None,
                    is_default_configurable=is_default_cfg if is_cfg else False,
                    is_alternative=is_alt,
                    alternative_group_id=alt_group_id if is_alt else None,
                    priority=prio,
                    issue_method=getattr(item, "issue_method", None) or "pick",
                )
                bom_list.append(bom)
        
        logger.info(f"批量导入BOM成功 (Clean Replace)，共创建 {len(bom_list)} 条BOM记录")
        
        return [BOMResponse.model_validate(bom) for bom in bom_list]

    @staticmethod
    async def relation_import_bom(
        tenant_id: int,
        data: BOMRelationImportRequest,
        current_user: Optional[User] = None,
    ) -> BOMRelationImportResponse:
        """BOM 高级关联导入：物料/工艺路线/工序/绩效 + BOM 明细一体化导入。"""
        return await MaterialService._relation_import_bom_v2(
            tenant_id, data, current_user=current_user
        )

        def _norm(value: Any) -> str:
            return str(value or "").strip()

        if not data.rows or len(data.rows) < 3:
            raise ValidationError("导入数据至少需要表头、示例和一行业务数据")

        raw_headers = data.rows[0] or []
        headers = [_norm(h).lstrip("*") for h in raw_headers]
        index_map = {h: idx for idx, h in enumerate(headers) if h}

        def _idx(*keys: str) -> Optional[int]:
            for k in keys:
                if k in index_map:
                    return index_map[k]
            return None

        parent_idx = _idx("父件编号", "parentCode", "parent_code")
        comp_idx = _idx("子件编号", "componentCode", "component_code")
        qty_idx = _idx("子件数量", "quantity", "qty")
        unit_idx = _idx("子件单位", "unit")
        waste_idx = _idx("损耗率", "wasteRate", "waste_rate")
        required_idx = _idx("是否必选", "isRequired", "is_required")
        remark_idx = _idx("备注", "remark")

        material_name_idx = _idx("物料名称", "materialName", "material_name")
        material_spec_idx = _idx("规格", "specification")
        material_unit_idx = _idx("基础单位", "baseUnit", "base_unit")
        route_code_idx = _idx("工艺路线编码", "processRouteCode", "process_route_code")
        route_name_idx = _idx("工艺路线名称", "processRouteName", "process_route_name")
        op_code_idx = _idx("工序编码", "operationCode", "operation_code")
        op_name_idx = _idx("工序名称", "operationName", "operation_name")
        employee_id_idx = _idx("员工ID", "employeeId", "employee_id")
        employee_name_idx = _idx("员工姓名", "employeeName", "employee_name")
        calc_mode_idx = _idx("绩效模式", "calcMode", "calc_mode")
        hourly_rate_idx = _idx("工时单价", "hourlyRate", "hourly_rate")
        piece_rate_idx = _idx("计件单价", "defaultPieceRate", "default_piece_rate")
        base_salary_idx = _idx("保障工资", "baseSalary", "base_salary")

        business_rows = [
            row for row in data.rows[2:]
            if row and any(_norm(c) for c in row)
        ]
        if not business_rows:
            raise ValidationError("没有可导入的数据行")

        summary = BOMRelationImportSummary()
        warnings: List[str] = []
        errors: List[str] = []
        entities = set(data.entities or [])
        strategy = data.write_strategy

        material_codes: set[str] = set()
        for row in business_rows:
            if parent_idx is not None:
                pc = _norm(row[parent_idx] if parent_idx < len(row) else "")
                if pc:
                    material_codes.add(pc)
            if comp_idx is not None:
                cc = _norm(row[comp_idx] if comp_idx < len(row) else "")
                if cc:
                    material_codes.add(cc)

        code_to_material: Dict[str, Material] = {}
        if material_codes:
            mats = await Material.filter(
                tenant_id=tenant_id,
                main_code__in=list(material_codes),
                deleted_at__isnull=True,
            ).all()
            code_to_material = {m.main_code: m for m in mats}

        created_material_codes: set[str] = set()

        async def _ensure_material(code: str, row: List[Any]) -> Optional[Material]:
            if not code:
                return None
            existing = code_to_material.get(code)
            if existing:
                if strategy == "upsert" and "material" in entities:
                    updates: Dict[str, Any] = {}
                    if material_name_idx is not None and material_name_idx < len(row):
                        n = _norm(row[material_name_idx])
                        if n and n != (existing.name or ""):
                            updates["name"] = n
                    if material_spec_idx is not None and material_spec_idx < len(row):
                        s = _norm(row[material_spec_idx])
                        if s and s != (existing.specification or ""):
                            updates["specification"] = s
                    if material_unit_idx is not None and material_unit_idx < len(row):
                        u = _norm(row[material_unit_idx])
                        if u and u != (existing.base_unit or ""):
                            updates["base_unit"] = u
                    if updates and not data.dry_run:
                        await existing.update_from_dict(updates).save()
                    if updates:
                        summary.updated += 1
                return existing

            if strategy in ("link_only", "strict_fail"):
                errors.append(f"物料编码不存在：{code}")
                return None

            if "material" not in entities:
                errors.append(f"物料编码不存在且未启用物料导入：{code}")
                return None

            unit = _norm(row[material_unit_idx]) if material_unit_idx is not None and material_unit_idx < len(row) else "个"
            name = _norm(row[material_name_idx]) if material_name_idx is not None and material_name_idx < len(row) else code
            spec = _norm(row[material_spec_idx]) if material_spec_idx is not None and material_spec_idx < len(row) else None

            if data.dry_run:
                summary.created += 1
                return None

            created = await Material.create(
                tenant_id=tenant_id,
                main_code=code,
                code=code,
                name=name or code,
                specification=spec or None,
                base_unit=unit or "个",
                source_type="Make",
                is_active=True,
            )
            code_to_material[code] = created
            created_material_codes.add(code)
            summary.created += 1
            return created

        route_map: Dict[str, ProcessRoute] = {}
        op_map: Dict[str, Operation] = {}
        if "processRoute" in entities:
            route_codes = {
                _norm(r[route_code_idx]) for r in business_rows
                if route_code_idx is not None and route_code_idx < len(r) and _norm(r[route_code_idx])
            }
            if route_codes:
                routes = await ProcessRoute.filter(
                    tenant_id=tenant_id,
                    code__in=list(route_codes),
                    deleted_at__isnull=True,
                ).all()
                route_map = {r.code: r for r in routes}

        if "operation" in entities:
            op_codes = {
                _norm(r[op_code_idx]) for r in business_rows
                if op_code_idx is not None and op_code_idx < len(r) and _norm(r[op_code_idx])
            }
            if op_codes:
                operations = await Operation.filter(
                    tenant_id=tenant_id,
                    code__in=list(op_codes),
                    deleted_at__isnull=True,
                ).all()
                op_map = {o.code: o for o in operations}

        if "performance" in entities:
            employee_ids = []
            for row in business_rows:
                if employee_id_idx is None or employee_id_idx >= len(row):
                    continue
                val = _norm(row[employee_id_idx])
                if val.isdigit():
                    employee_ids.append(int(val))
            config_map: Dict[int, EmployeePerformanceConfig] = {}
            if employee_ids:
                configs = await EmployeePerformanceConfig.filter(
                    tenant_id=tenant_id,
                    employee_id__in=list(set(employee_ids)),
                    deleted_at__isnull=True,
                ).all()
                config_map = {c.employee_id: c for c in configs}

            for row in business_rows:
                if employee_id_idx is None or employee_id_idx >= len(row):
                    continue
                emp_str = _norm(row[employee_id_idx])
                if not emp_str:
                    continue
                if not emp_str.isdigit():
                    errors.append(f"员工ID非法：{emp_str}")
                    continue
                employee_id = int(emp_str)
                existed = config_map.get(employee_id)

                calc_mode = _norm(row[calc_mode_idx]) if calc_mode_idx is not None and calc_mode_idx < len(row) else "time"
                hourly_rate = _norm(row[hourly_rate_idx]) if hourly_rate_idx is not None and hourly_rate_idx < len(row) else ""
                piece_rate = _norm(row[piece_rate_idx]) if piece_rate_idx is not None and piece_rate_idx < len(row) else ""
                base_salary = _norm(row[base_salary_idx]) if base_salary_idx is not None and base_salary_idx < len(row) else ""
                employee_name = _norm(row[employee_name_idx]) if employee_name_idx is not None and employee_name_idx < len(row) else None

                if existed is None:
                    if strategy in ("link_only", "strict_fail"):
                        errors.append(f"绩效配置不存在：employee_id={employee_id}")
                        continue
                    summary.created += 1
                    if not data.dry_run:
                        cfg = await EmployeePerformanceConfig.create(
                            tenant_id=tenant_id,
                            employee_id=employee_id,
                            employee_name=employee_name,
                            calc_mode=calc_mode or "time",
                            hourly_rate=Decimal(hourly_rate) if hourly_rate else None,
                            default_piece_rate=Decimal(piece_rate) if piece_rate else None,
                            base_salary=Decimal(base_salary) if base_salary else None,
                            is_active=True,
                        )
                        config_map[employee_id] = cfg
                    continue

                if strategy == "upsert":
                    updates: Dict[str, Any] = {}
                    if employee_name and employee_name != (existed.employee_name or ""):
                        updates["employee_name"] = employee_name
                    if calc_mode:
                        updates["calc_mode"] = calc_mode
                    if hourly_rate:
                        updates["hourly_rate"] = Decimal(hourly_rate)
                    if piece_rate:
                        updates["default_piece_rate"] = Decimal(piece_rate)
                    if base_salary:
                        updates["base_salary"] = Decimal(base_salary)
                    if updates:
                        summary.updated += 1
                        if not data.dry_run:
                            await existed.update_from_dict(updates).save()

        bom_items_payload: List[Dict[str, Any]] = []
        for row_no, row in enumerate(business_rows, start=3):
            parent_code = _norm(row[parent_idx]) if parent_idx is not None and parent_idx < len(row) else ""
            component_code = _norm(row[comp_idx]) if comp_idx is not None and comp_idx < len(row) else ""
            qty_str = _norm(row[qty_idx]) if qty_idx is not None and qty_idx < len(row) else ""

            if not parent_code or not component_code or not qty_str:
                errors.append(f"第 {row_no} 行缺少 BOM 必填字段（父件/子件/数量）")
                continue

            try:
                qty = Decimal(qty_str.replace(",", ""))
            except Exception:
                errors.append(f"第 {row_no} 行数量格式非法：{qty_str}")
                continue

            if qty <= 0:
                errors.append(f"第 {row_no} 行数量必须大于 0")
                continue

            # 物料存在性校验/补齐
            await _ensure_material(parent_code, row)
            await _ensure_material(component_code, row)

            waste_rate = None
            if waste_idx is not None and waste_idx < len(row):
                waste_str = _norm(row[waste_idx]).replace("%", "")
                if waste_str:
                    try:
                        waste_rate = Decimal(waste_str)
                    except Exception:
                        errors.append(f"第 {row_no} 行损耗率格式非法：{waste_str}")

            is_required = True
            if required_idx is not None and required_idx < len(row):
                required_str = _norm(row[required_idx]).lower()
                if required_str in ("否", "false", "0", "no", "n"):
                    is_required = False

            bom_items_payload.append({
                "parent_code": parent_code,
                "component_code": component_code,
                "quantity": qty,
                "unit": _norm(row[unit_idx]) if unit_idx is not None and unit_idx < len(row) else None,
                "waste_rate": waste_rate,
                "is_required": is_required,
                "remark": _norm(row[remark_idx]) if remark_idx is not None and remark_idx < len(row) else None,
            })

            # process route upsert + material-link
            if "processRoute" in entities and route_code_idx is not None and route_code_idx < len(row):
                route_code = _norm(row[route_code_idx])
                route_name = _norm(row[route_name_idx]) if route_name_idx is not None and route_name_idx < len(row) else route_code
                if route_code:
                    route = route_map.get(route_code)
                    if route is None:
                        if strategy in ("link_only", "strict_fail"):
                            errors.append(f"工艺路线不存在：{route_code}")
                        else:
                            summary.created += 1
                            if not data.dry_run:
                                route = await ProcessRoute.create(
                                    tenant_id=tenant_id,
                                    code=route_code,
                                    name=route_name or route_code,
                                    version="1.0",
                                    is_active=True,
                                )
                                route_map[route_code] = route
                    elif strategy == "upsert" and route_name and route_name != route.name:
                        summary.updated += 1
                        if not data.dry_run:
                            await route.update_from_dict({"name": route_name}).save()

                    parent_mat = code_to_material.get(parent_code)
                    route_obj = route_map.get(route_code)
                    if parent_mat and route_obj and strategy in ("upsert", "link_only"):
                        if parent_mat.process_route_id != route_obj.id:
                            summary.linked += 1
                            if not data.dry_run:
                                await parent_mat.update_from_dict({"process_route_id": route_obj.id}).save()

            if "operation" in entities and op_code_idx is not None and op_code_idx < len(row):
                op_code = _norm(row[op_code_idx])
                op_name = _norm(row[op_name_idx]) if op_name_idx is not None and op_name_idx < len(row) else op_code
                if op_code:
                    operation = op_map.get(op_code)
                    if operation is None:
                        if strategy in ("link_only", "strict_fail"):
                            errors.append(f"工序不存在：{op_code}")
                        else:
                            summary.created += 1
                            if not data.dry_run:
                                operation = await Operation.create(
                                    tenant_id=tenant_id,
                                    code=op_code,
                                    name=op_name or op_code,
                                    is_active=True,
                                )
                                op_map[op_code] = operation
                    elif strategy == "upsert" and op_name and op_name != operation.name:
                        summary.updated += 1
                        if not data.dry_run:
                            await operation.update_from_dict({"name": op_name}).save()

        if errors:
            summary.failed += len(errors)
            return BOMRelationImportResponse(
                success=False,
                message="关联导入校验未通过",
                summary=summary,
                errors=errors,
                warnings=warnings,
            )

        if bom_items_payload:
            summary.linked += len(bom_items_payload)
            if not data.dry_run:
                batch_data = BOMBatchImport.model_validate({
                    "items": bom_items_payload,
                    "version": "1.0",
                })
                await MaterialService.batch_import_bom(tenant_id, batch_data)
        else:
            warnings.append("未检测到有效 BOM 明细行，已跳过 BOM 导入")

        msg = "预检通过" if data.dry_run else "关联导入成功"
        return BOMRelationImportResponse(
            success=True,
            message=msg,
            summary=summary,
            errors=[],
            warnings=warnings,
        )

    @staticmethod
    async def _relation_import_bom_v2(
        tenant_id: int,
        data: BOMRelationImportRequest,
        current_user: Optional[User] = None,
    ) -> BOMRelationImportResponse:
        """BOM 关联导入 v2：规范化契约解析 + 统一预检/提交链路 + 事务回滚保护。"""

        class _RelationImportRollback(Exception):
            def __init__(self, result: BOMRelationImportResponse):
                super().__init__(result.message or "relation import rollback")
                self.result = result

        def _norm(value: Any) -> str:
            return str(value or "").strip()

        def _header_token(value: Any) -> str:
            return _norm(value).lstrip("*").strip().lower()

        def _cell(row: List[Any], idx: Optional[int]) -> str:
            if idx is None or idx < 0 or idx >= len(row):
                return ""
            return _norm(row[idx])

        def _parse_decimal(value: str, field_label: str, row_no: int, errors: List[str]) -> Optional[Decimal]:
            if not value:
                return None
            try:
                return Decimal(value.replace(",", ""))
            except Exception:
                errors.append(f"第 {row_no} 行{field_label}格式非法：{value}")
                return None

        if not data.rows or len(data.rows) < 3:
            raise ValidationError("导入数据至少需要表头、示例和一行业务数据")

        entities: Set[str] = set(data.entities or [])
        strategy = data.write_strategy
        allow_create = strategy in ("upsert", "create_only")
        allow_update = strategy == "upsert"
        allow_link = strategy in ("upsert", "link_only")

        header_map: Dict[str, int] = {}
        for idx, header in enumerate(data.rows[0] or []):
            token = _header_token(header)
            if token and token not in header_map:
                header_map[token] = idx

        canonical_idx: Dict[str, Optional[int]] = {}
        for key, aliases in RELATION_IMPORT_FIELD_ALIASES.items():
            canonical_idx[key] = None
            for alias in aliases:
                token = _header_token(alias)
                if token in header_map:
                    canonical_idx[key] = header_map[token]
                    break

        summary = BOMRelationImportSummary()
        warnings: List[str] = []
        header_errors: List[str] = []

        for base_required in ("parent_code", "component_code", "quantity"):
            if canonical_idx.get(base_required) is None:
                header_errors.append(f"缺少必需表头：{RELATION_IMPORT_FIELD_ALIASES[base_required][0]}")

        effective_entities: Set[str] = set(entities)
        if "processRoute" in effective_entities and canonical_idx.get("process_route_code") is None:
            effective_entities.discard("processRoute")
            warnings.append("未包含工艺路线编码列，已跳过工艺路线关联")

        if header_errors:
            summary.failed = len(header_errors)
            return BOMRelationImportResponse(
                success=False,
                message="关联导入校验未通过",
                summary=summary,
                errors=header_errors,
                warnings=warnings,
            )

        business_rows = [row for row in data.rows[2:] if row and any(_norm(c) for c in row)]
        if not business_rows:
            raise ValidationError("没有可导入的数据行")

        async def _run_pipeline() -> BOMRelationImportResponse:
            errors: List[str] = []
            material_cache: Dict[str, Optional[Material]] = {}
            route_map: Dict[str, ProcessRoute] = {}
            operation_map: Dict[str, Operation] = {}
            perf_map: Dict[int, EmployeePerformanceConfig] = {}
            bom_payload: List[Dict[str, Any]] = []

            async def _resolve_material_by_code(code: str) -> Optional[Material]:
                if not code:
                    return None
                if code in material_cache:
                    return material_cache[code]
                mat = await MaterialCodeService.get_material_by_code(tenant_id, code)
                material_cache[code] = mat
                return mat

            async def _ensure_material(code: str, row: List[Any], row_no: int) -> Optional[Material]:
                if not code:
                    return None
                existing = await _resolve_material_by_code(code)
                if existing:
                    if "material" in effective_entities and allow_update:
                        updates: Dict[str, Any] = {}
                        name_val = _cell(row, canonical_idx["material_name"])
                        spec_val = _cell(row, canonical_idx["specification"])
                        unit_val = _cell(row, canonical_idx["base_unit"])
                        if name_val and name_val != (existing.name or ""):
                            updates["name"] = name_val
                        if spec_val and spec_val != (existing.specification or ""):
                            updates["specification"] = spec_val
                        if unit_val and unit_val != (existing.base_unit or ""):
                            updates["base_unit"] = unit_val
                        if updates:
                            summary.updated += 1
                            await existing.update_from_dict(updates).save()
                    return existing

                if "material" not in effective_entities:
                    errors.append(f"第 {row_no} 行物料编码不存在且未启用物料导入：{code}")
                    return None
                if not allow_create:
                    errors.append(f"第 {row_no} 行物料编码不存在：{code}")
                    return None

                created_payload = {
                    "tenant_id": tenant_id,
                    "main_code": code,
                    "code": code,
                    "name": _cell(row, canonical_idx["material_name"]) or code,
                    "specification": _cell(row, canonical_idx["specification"]) or None,
                    "base_unit": _cell(row, canonical_idx["base_unit"]) or "个",
                    "source_type": "Make",
                    "is_active": True,
                }
                apply_create_audit(created_payload, current_user)
                created = await Material.create(**created_payload)
                summary.created += 1
                material_cache[code] = created
                return created

            if "processRoute" in effective_entities:
                route_codes = {
                    _cell(row, canonical_idx["process_route_code"])
                    for row in business_rows
                    if _cell(row, canonical_idx["process_route_code"])
                }
                if route_codes:
                    routes = await ProcessRoute.filter(
                        tenant_id=tenant_id,
                        code__in=list(route_codes),
                        deleted_at__isnull=True,
                    ).all()
                    route_map = {route.code: route for route in routes}

            if "operation" in effective_entities:
                operation_codes = {
                    _cell(row, canonical_idx["operation_code"])
                    for row in business_rows
                    if _cell(row, canonical_idx["operation_code"])
                }
                if operation_codes:
                    operations = await Operation.filter(
                        tenant_id=tenant_id,
                        code__in=list(operation_codes),
                        deleted_at__isnull=True,
                    ).all()
                    operation_map = {operation.code: operation for operation in operations}

            if "performance" in effective_entities:
                employee_ids = []
                for row in business_rows:
                    raw_emp = _cell(row, canonical_idx["employee_id"])
                    if raw_emp and raw_emp.isdigit():
                        employee_ids.append(int(raw_emp))
                if employee_ids:
                    rows = await EmployeePerformanceConfig.filter(
                        tenant_id=tenant_id,
                        employee_id__in=list(set(employee_ids)),
                        deleted_at__isnull=True,
                    ).all()
                    perf_map = {cfg.employee_id: cfg for cfg in rows}

            for row_no, row in enumerate(business_rows, start=3):
                parent_code = _cell(row, canonical_idx["parent_code"])
                component_code = _cell(row, canonical_idx["component_code"])
                qty_raw = _cell(row, canonical_idx["quantity"])
                row_has_error = False

                if not parent_code or not component_code or not qty_raw:
                    errors.append(f"第 {row_no} 行缺少 BOM 必填字段（父件/子件/数量）")
                    continue

                for entity in effective_entities:
                    for req in RELATION_ENTITY_REQUIRED_FIELDS.get(entity, []):
                        col_idx = canonical_idx.get(req)
                        if col_idx is None:
                            continue
                        if not _cell(row, col_idx):
                            row_has_error = True
                            errors.append(
                                f"第 {row_no} 行缺少 {entity} 关联必填字段：{RELATION_IMPORT_FIELD_ALIASES[req][0]}"
                            )
                if row_has_error:
                    continue

                qty = _parse_decimal(qty_raw, "子件数量", row_no, errors)
                if qty is None:
                    continue
                if qty <= 0:
                    errors.append(f"第 {row_no} 行数量必须大于 0")
                    continue

                parent_material = await _ensure_material(parent_code, row, row_no)
                component_material = await _ensure_material(component_code, row, row_no)
                if parent_material is None or component_material is None:
                    continue

                waste_raw = _cell(row, canonical_idx["waste_rate"]).replace("%", "")
                waste_rate = _parse_decimal(waste_raw, "损耗率", row_no, errors) if waste_raw else None
                if waste_raw and waste_rate is None:
                    continue

                if "processRoute" in effective_entities:
                    route_code = _cell(row, canonical_idx["process_route_code"])
                    route_name = _cell(row, canonical_idx["process_route_name"]) or route_code
                    route = route_map.get(route_code)
                    if route is None:
                        if allow_create:
                            route = await ProcessRoute.create(
                                tenant_id=tenant_id,
                                code=route_code,
                                name=route_name or route_code,
                                version="1.0",
                                is_active=True,
                            )
                            route_map[route_code] = route
                            summary.created += 1
                        else:
                            errors.append(f"第 {row_no} 行工艺路线不存在：{route_code}")
                            continue
                    elif allow_update and route_name and route_name != route.name:
                        await route.update_from_dict({"name": route_name}).save()
                        summary.updated += 1

                    if allow_link and parent_material.process_route_id != route.id:
                        await parent_material.update_from_dict({"process_route_id": route.id}).save()
                        summary.linked += 1

                if "operation" in effective_entities:
                    operation_code = _cell(row, canonical_idx["operation_code"])
                    operation_name = _cell(row, canonical_idx["operation_name"]) or operation_code
                    operation = operation_map.get(operation_code)
                    if operation is None:
                        if allow_create:
                            operation = await Operation.create(
                                tenant_id=tenant_id,
                                code=operation_code,
                                name=operation_name or operation_code,
                                is_active=True,
                            )
                            operation_map[operation_code] = operation
                            summary.created += 1
                        else:
                            errors.append(f"第 {row_no} 行工序不存在：{operation_code}")
                            continue
                    elif allow_update and operation_name and operation_name != operation.name:
                        await operation.update_from_dict({"name": operation_name}).save()
                        summary.updated += 1

                if "performance" in effective_entities:
                    employee_raw = _cell(row, canonical_idx["employee_id"])
                    if not employee_raw.isdigit():
                        errors.append(f"第 {row_no} 行员工ID非法：{employee_raw}")
                        continue
                    employee_id = int(employee_raw)
                    calc_mode = _cell(row, canonical_idx["calc_mode"]) or "time"
                    employee_name = _cell(row, canonical_idx["employee_name"]) or None
                    hourly_raw = _cell(row, canonical_idx["hourly_rate"])
                    piece_raw = _cell(row, canonical_idx["default_piece_rate"])
                    salary_raw = _cell(row, canonical_idx["base_salary"])
                    hourly_rate = _parse_decimal(hourly_raw, "工时单价", row_no, errors) if hourly_raw else None
                    piece_rate = _parse_decimal(piece_raw, "计件单价", row_no, errors) if piece_raw else None
                    base_salary = _parse_decimal(salary_raw, "保障工资", row_no, errors) if salary_raw else None
                    if (hourly_raw and hourly_rate is None) or (piece_raw and piece_rate is None) or (
                        salary_raw and base_salary is None
                    ):
                        continue

                    cfg = perf_map.get(employee_id)
                    if cfg is None:
                        if not allow_create:
                            errors.append(f"第 {row_no} 行绩效配置不存在：employee_id={employee_id}")
                            continue
                        cfg = await EmployeePerformanceConfig.create(
                            tenant_id=tenant_id,
                            employee_id=employee_id,
                            employee_name=employee_name,
                            calc_mode=calc_mode,
                            hourly_rate=hourly_rate,
                            default_piece_rate=piece_rate,
                            base_salary=base_salary,
                            is_active=True,
                        )
                        perf_map[employee_id] = cfg
                        summary.created += 1
                    elif allow_update:
                        updates: Dict[str, Any] = {}
                        if employee_name and employee_name != (cfg.employee_name or ""):
                            updates["employee_name"] = employee_name
                        if calc_mode:
                            updates["calc_mode"] = calc_mode
                        if hourly_rate is not None:
                            updates["hourly_rate"] = hourly_rate
                        if piece_rate is not None:
                            updates["default_piece_rate"] = piece_rate
                        if base_salary is not None:
                            updates["base_salary"] = base_salary
                        if updates:
                            await cfg.update_from_dict(updates).save()
                            summary.updated += 1

                required_val = _cell(row, canonical_idx["is_required"]).lower()
                is_required = required_val not in ("否", "false", "0", "no", "n")

                version_val = _cell(row, canonical_idx.get("version")) or None
                bom_code_val = _cell(row, canonical_idx.get("bom_code")) or None
                bom_name_raw = _cell(row, canonical_idx.get("bom_name"))
                # 有列但为空时传 ""，让 resolve_version_bom_name 区分「未传」与「显式清空」
                bom_name_val = (
                    bom_name_raw
                    if canonical_idx.get("bom_name") is not None
                    else None
                )
                base_qty_raw = _cell(row, canonical_idx.get("base_quantity"))
                base_qty_val = (
                    _parse_decimal(base_qty_raw, "基准数量", row_no, errors)
                    if base_qty_raw
                    else None
                )
                if base_qty_raw and base_qty_val is None:
                    continue
                if base_qty_val is not None and base_qty_val <= 0:
                    errors.append(f"第 {row_no} 行基准数量必须大于 0")
                    continue

                bom_payload.append(
                    {
                        "parent_code": parent_code,
                        "component_code": component_code,
                        "quantity": qty,
                        "unit": _cell(row, canonical_idx["unit"]) or None,
                        "waste_rate": waste_rate,
                        "is_required": is_required,
                        "remark": _cell(row, canonical_idx["remark"]) or None,
                        "version": version_val,
                        "bom_code": bom_code_val,
                        "bom_name": bom_name_val,
                        "base_quantity": base_qty_val,
                    }
                )

            if errors:
                summary.failed = len(errors)
                return BOMRelationImportResponse(
                    success=False,
                    message="关联导入校验未通过",
                    summary=summary,
                    errors=errors,
                    warnings=warnings,
                )

            if bom_payload:
                summary.linked += len(bom_payload)
                try:
                    batch_data = BOMBatchImport.model_validate(
                        {
                            "items": bom_payload,
                            "version": "1.0",
                        }
                    )
                    await MaterialService.batch_import_bom(tenant_id, batch_data)
                except ValidationError as exc:
                    fail_errors = [str(exc)]
                    summary.failed = len(fail_errors)
                    return BOMRelationImportResponse(
                        success=False,
                        message="关联导入校验未通过",
                        summary=summary,
                        errors=fail_errors,
                        warnings=warnings,
                    )
            else:
                warnings.append("未检测到有效 BOM 明细行，已跳过 BOM 导入")

            return BOMRelationImportResponse(
                success=True,
                message="预检通过" if data.dry_run else "关联导入成功",
                summary=summary,
                errors=[],
                warnings=warnings,
            )

        try:
            async with in_transaction():
                result = await _run_pipeline()
                if data.dry_run or not result.success:
                    raise _RelationImportRollback(result)
                return result
        except _RelationImportRollback as rollback:
            return rollback.result
    
    @staticmethod
    async def detect_bom_cycle(
        tenant_id: int,
        material_id: int,
        component_id: int
    ) -> bool:
        """
        检测BOM循环依赖
        
        根据《工艺路线和标准作业流程优化设计规范.md》设计。
        
        Args:
            tenant_id: 租户ID
            material_id: 主物料ID（父件）
            component_id: 子物料ID（子件）
            
        Returns:
            bool: 如果添加该BOM关系会导致循环依赖，返回True
        """
        from collections import defaultdict
        
        # 构建依赖图：component_id -> 它作为父件时的所有子件ID集合
        dependency_graph = defaultdict(set)
        
        # 查询所有BOM关系
        all_boms = await BOM.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        ).all()
        
        for bom in all_boms:
            dependency_graph[bom.component_id].add(bom.material_id)
        
        # 检查添加 material_id -> component_id 是否会导致循环
        # 即检查从 component_id 开始，是否能到达 material_id
        def can_reach(start: int, target: int, visited: set) -> bool:
            """检查从start是否能到达target"""
            if start == target:
                return True
            
            visited.add(start)
            for neighbor in dependency_graph.get(start, set()):
                if neighbor not in visited:
                    if can_reach(neighbor, target, visited):
                        return True
            return False
        
        # 检查从component_id是否能到达material_id
        # 如果能到达，说明添加 material_id -> component_id 会形成循环
        return can_reach(component_id, material_id, set())
    
    @staticmethod
    async def generate_bom_hierarchy(
        tenant_id: int,
        material_id: int,
        version: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        生成BOM层级结构
        
        根据《工艺路线和标准作业流程优化设计规范.md》设计。
        
        Args:
            tenant_id: 租户ID
            material_id: 主物料ID
            version: BOM版本（可选，如果不提供则使用最新版本）
            
        Returns:
            Dict[str, Any]: BOM层级结构
        """
        from collections import defaultdict
        
        # 查询BOM数据（不含已失效版本）
        query = BOM.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            deleted_at__isnull=True,
            is_active=True,
            is_obsolete=False
        )
        
        resolved_version = version
        if not resolved_version:
            # 与列表页一致：优先使用默认版本（is_default），否则使用最新版本（均不含失效版本）
            default_bom = await query.filter(is_default=True).first()
            if default_bom:
                resolved_version = default_bom.version
            else:
                latest_bom = await query.order_by("-version").first()
                if latest_bom:
                    resolved_version = latest_bom.version
            if resolved_version:
                query = query.filter(version=resolved_version)
        else:
            query = query.filter(version=version)
        
        bom_items = await query.prefetch_related("component").all()
        
        if not bom_items:
            return {
                "material_id": material_id,
                "version": resolved_version or version or "1.0",
                "items": []
            }
        
        # 构建层级结构
        async def build_tree(parent_id: int, level: int = 0, path: str = "", use_version: Optional[str] = None) -> List[Dict[str, Any]]:
            """递归构建BOM树"""
            result = []
            
            # 查找所有以parent_id为父件的BOM项
            # 第一层使用预加载的 bom_items，后续层级需要重新查询
            if level == 0:
                # 第一层：使用预加载的 bom_items
                current_bom_items = [b for b in bom_items if b.material_id == parent_id]
            else:
                # 后续层级：查询子物料的BOM（优先请求版本，若无则回退到最新版本以实现「升版后子BOM自动获取」）
                effective_version = use_version or resolved_version or version
                current_bom_items = await BOM.filter(
                    tenant_id=tenant_id,
                    material_id=parent_id,
                    version=effective_version,
                    deleted_at__isnull=True,
                    is_active=True,
                    is_obsolete=False
                ).prefetch_related("component").all()
                if not current_bom_items and effective_version:
                    # 子BOM在请求版本下不存在时，回退到该物料的最新版本（不含失效）
                    latest_child = await BOM.filter(
                        tenant_id=tenant_id,
                        material_id=parent_id,
                        deleted_at__isnull=True,
                        is_active=True,
                        is_obsolete=False
                    ).order_by("-version").first()
                    if latest_child:
                        current_bom_items = await BOM.filter(
                            tenant_id=tenant_id,
                            material_id=parent_id,
                            version=latest_child.version,
                            deleted_at__isnull=True,
                            is_active=True,
                            is_obsolete=False
                        ).prefetch_related("component").all()
            
            for bom in current_bom_items:
                # 使用预加载的component，避免重复查询
                component = bom.component
                if not component:
                    # 如果预加载失败，则查询
                    component = await Material.get(id=bom.component_id)
                current_path = f"{path}/{bom.component_id}" if path else str(bom.component_id)
                # 开启属性的物料自动视为配置件（与列表/设计器展示一致）
                is_cfg = getattr(bom, "is_configurable", False) or getattr(component, "variant_managed", False)
                item_data = {
                    "component_id": bom.component_id,
                    "component_code": component.main_code,
                    "component_name": component.name,
                    "quantity": float(bom.quantity),
                    "unit": bom.unit,
                    "waste_rate": float(bom.waste_rate),
                    "is_required": bom.is_required,
                    "level": level,
                    "path": current_path,
                    "is_configurable": is_cfg,
                    "configurable_group_id": getattr(bom, "configurable_group_id", None) if is_cfg else None,
                    "is_default_configurable": getattr(bom, "is_default_configurable", False) if is_cfg else False,
                    "is_alternative": getattr(bom, "is_alternative", False),
                    "alternative_group_id": getattr(bom, "alternative_group_id", None),
                    "priority": getattr(bom, "priority", 0),
                    "issue_method": getattr(bom, "issue_method", None) or "pick",
                    "children": []
                }
                
                # 递归查找子件：查询子物料是否有自己的BOM（优先请求版本，若无则回退最新版本）
                child_version = use_version or resolved_version or version or bom.version
                child_bom_items = await BOM.filter(
                    tenant_id=tenant_id,
                    material_id=bom.component_id,
                    version=child_version,
                    deleted_at__isnull=True,
                    is_active=True,
                    is_obsolete=False
                ).prefetch_related("component").all()
                effective_child_version = child_version
                if not child_bom_items:
                    latest_child_bom = await BOM.filter(
                        tenant_id=tenant_id,
                        material_id=bom.component_id,
                        deleted_at__isnull=True,
                        is_active=True,
                        is_obsolete=False
                    ).order_by("-version").first()
                    if latest_child_bom:
                        child_bom_items = await BOM.filter(
                            tenant_id=tenant_id,
                            material_id=bom.component_id,
                            version=latest_child_bom.version,
                            deleted_at__isnull=True,
                            is_active=True,
                            is_obsolete=False
                        ).prefetch_related("component").all()
                        effective_child_version = latest_child_bom.version
                
                if child_bom_items:
                    # 成品/半成品节点：记录其 BOM 版本，供前端在节点上显示
                    item_data["bom_version"] = effective_child_version
                    # 递归构建子树
                    item_data["children"] = await build_tree(
                        bom.component_id,
                        level + 1,
                        current_path,
                        effective_child_version
                    )
                
                result.append(item_data)
            
            return result
        
        tree = await build_tree(material_id)
        
        material = await Material.get(id=material_id)
        from apps.kuaizhizao.utils.bom_helper import bom_item_base_quantity
        
        return {
            "material_id": material_id,
            "material_code": material.main_code,
            "material_name": material.name,
            "version": resolved_version or bom_items[0].version,
            "base_quantity": float(bom_item_base_quantity(bom_items[0])),
            "bom_name": bom_items[0].bom_name,
            "approval_status": bom_items[0].approval_status,
            "items": tree
        }

    
    @staticmethod
    async def calculate_bom_quantity(
        tenant_id: int,
        material_id: int,
        parent_quantity: Decimal = Decimal("1.0"),
        version: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        计算BOM用量（考虑多层级和损耗率）
        
        根据《工艺路线和标准作业流程优化设计规范.md》设计。
        
        Args:
            tenant_id: 租户ID
            material_id: 主物料ID
            parent_quantity: 父物料数量（默认1.0）
            version: BOM版本（可选）
            
        Returns:
            Dict[str, Any]: 计算结果，包含每个子物料的实际用量
        """
        from collections import defaultdict
        from apps.kuaizhizao.utils.bom_helper import (
            bom_line_unit_quantity,
            bom_line_required_quantity_decimal,
            bom_item_base_quantity,
        )
        
        # 查询BOM数据
        query = BOM.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            deleted_at__isnull=True,
            is_active=True
        )
        
        if version:
            query = query.filter(version=version)
        else:
            # 使用最新版本
            latest_bom = await query.order_by("-version").first()
            if latest_bom:
                query = query.filter(version=latest_bom.version)
        
        bom_items = await query.prefetch_related("component").all()
        
        version_base_qty = (
            bom_item_base_quantity(bom_items[0]) if bom_items else Decimal("1")
        )
        result = {
            "material_id": material_id,
            "parent_quantity": float(parent_quantity),
            "base_quantity": float(version_base_qty),
            "components": []
        }
        
        # 计算直接子物料的用量
        component_quantities = defaultdict(Decimal)
        
        for bom in bom_items:
            if bom.is_required:
                line_base = bom_item_base_quantity(bom)
                unit_qty = bom_line_unit_quantity(bom.quantity, line_base)
                actual_qty = bom_line_required_quantity_decimal(
                    bom.quantity,
                    line_base,
                    parent_quantity,
                    bom.waste_rate or Decimal("0.00"),
                )
                component_quantities[bom.component_id] += actual_qty
                
                component = await Material.get(id=bom.component_id)
                result["components"].append({
                    "component_id": bom.component_id,
                    "component_code": component.main_code,
                    "component_name": component.name,
                    "line_quantity": float(bom.quantity),
                    "base_quantity": float(line_base),
                    "unit_quantity": float(unit_qty),
                    "waste_rate": float(bom.waste_rate or Decimal("0.00")),
                    "actual_quantity": float(actual_qty),
                    "unit": bom.unit,
                    "level": 0
                })
                
                # 递归计算子物料的子物料用量
                child_boms = await BOM.filter(
                    tenant_id=tenant_id,
                    material_id=bom.component_id,
                    version=version or bom.version,
                    deleted_at__isnull=True,
                    is_active=True
                ).all()
                
                if child_boms:
                    child_result = await MaterialService.calculate_bom_quantity(
                        tenant_id=tenant_id,
                        material_id=bom.component_id,
                        parent_quantity=actual_qty,
                        version=version or bom.version
                    )
                    
                    # 合并子物料的用量
                    for child_comp in child_result["components"]:
                        child_comp_id = child_comp["component_id"]
                        if child_comp_id in component_quantities:
                            component_quantities[child_comp_id] += Decimal(str(child_comp["actual_quantity"]))
                        else:
                            component_quantities[child_comp_id] = Decimal(str(child_comp["actual_quantity"]))
                            child_comp["level"] = 1
                            result["components"].append(child_comp)
        
        return result
    
    @staticmethod
    async def create_bom_version(
        tenant_id: int,
        material_id: int,
        data: BOMVersionCreate
    ) -> List[BOMResponse]:
        """
        创建BOM新版本
        
        根据《工艺路线和标准作业流程优化设计规范.md》设计。
        
        Args:
            tenant_id: 租户ID
            material_id: 主物料ID
            data: BOM版本创建数据
            
        Returns:
            List[BOMResponse]: 新版本的BOM对象列表
        """
        # 查找当前版本的BOM
        current_boms = await BOM.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            deleted_at__isnull=True
        ).order_by("-version").all()
        
        if not current_boms:
            raise NotFoundError(f"物料 {material_id} 的BOM不存在")
        
        # 获取当前版本号
        current_version = current_boms[0].version
        current_bom_code = current_boms[0].bom_code
        
        # 创建新版本的BOM（复制当前版本）
        new_bom_list = []
        for bom in current_boms:
            if bom.version == current_version:
                new_bom = await BOM.create(
                    tenant_id=tenant_id,
                    material_id=bom.material_id,
                    component_id=bom.component_id,
                    quantity=bom.quantity,
                    base_quantity=bom.base_quantity or Decimal("1"),
                    unit=bom.unit,
                    waste_rate=bom.waste_rate,
                    is_required=bom.is_required,
                    level=bom.level,
                    path=bom.path,
                    version=data.version,
                    bom_code=current_bom_code,  # 使用相同的BOM编码
                    bom_name=bom.bom_name,
                    effective_date=data.effective_date or bom.effective_date,
                    expiry_date=bom.expiry_date,
                    approval_status="draft",  # 新版本默认为草稿
                    is_alternative=bom.is_alternative,
                    alternative_group_id=bom.alternative_group_id,
                    priority=bom.priority,
                    is_configurable=getattr(bom, "is_configurable", False),
                    configurable_group_id=getattr(bom, "configurable_group_id", None),
                    is_default_configurable=getattr(bom, "is_default_configurable", False),
                    description=data.version_description or bom.description,
                    remark=bom.remark,
                    is_active=bom.is_active,
                )
                new_bom_list.append(new_bom)
        
        logger.info(
            f"创建BOM新版本成功：物料 {material_id}，"
            f"从版本 {current_version} 创建版本 {data.version}"
        )
        
        return [BOMResponse.model_validate(bom) for bom in new_bom_list]
    
    @staticmethod
    async def compare_bom_versions(
        tenant_id: int,
        material_id: int,
        data: BOMVersionCompare
    ) -> Dict[str, Any]:
        """
        对比BOM版本
        
        根据《工艺路线和标准作业流程优化设计规范.md》设计。
        
        Args:
            tenant_id: 租户ID
            material_id: 主物料ID
            data: BOM版本对比数据
            
        Returns:
            Dict[str, Any]: 版本对比结果
        """
        # 查询两个版本的BOM
        version1_boms = await BOM.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            version=data.version1,
            deleted_at__isnull=True
        ).prefetch_related("component").all()
        
        version2_boms = await BOM.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            version=data.version2,
            deleted_at__isnull=True
        ).prefetch_related("component").all()
        
        # 按 path 匹配同一树位置的行，避免同一 component_id 多行时错配（如配置位/替代料导致同物料多行）
        def _row_key(bom, fallback_id):
            return bom.path if (bom.path and bom.path.strip()) else f"__id_{fallback_id}"
        
        version1_map = {_row_key(b, b.id): b for b in version1_boms}
        version2_map = {_row_key(b, b.id): b for b in version2_boms}
        
        # 找出差异
        added = []  # 新增的子件
        removed = []  # 删除的子件
        modified = []  # 修改的子件
        
        def _bom_extra(bom) -> dict:
            """配置位、替代料等扩展字段，用于比对与展示"""
            return {
                "is_configurable": bom.is_configurable,
                "configurable_group_id": bom.configurable_group_id,
                "is_default_configurable": getattr(bom, "is_default_configurable", False),
                "is_alternative": bom.is_alternative,
                "alternative_group_id": bom.alternative_group_id,
                "priority": int(bom.priority or 0),
            }

        # 检查版本2中新增或修改的子件（按 path 匹配同一树位置）
        for bom2 in version2_boms:
            key2 = _row_key(bom2, bom2.id)
            component = await Material.get(id=bom2.component_id)
            extra2 = _bom_extra(bom2)
            bom1 = version1_map.get(key2)
            if bom1 is None:
                # 该 path 在版本1中不存在，视为新增
                added.append({
                    "component_id": bom2.component_id,
                    "component_code": component.main_code,
                    "component_name": component.name,
                    "quantity": float(bom2.quantity),
                    "unit": bom2.unit,
                    "waste_rate": float(bom2.waste_rate or Decimal("0.00")),
                    **extra2,
                })
            else:
                # 同一 path 存在，检查是否修改（含配置位、替代料）
                extra1 = _bom_extra(bom1)
                v1_quantity = float(bom1.quantity)
                v2_quantity = float(bom2.quantity)
                v1_waste = float(bom1.waste_rate or Decimal("0.00"))
                v2_waste = float(bom2.waste_rate or Decimal("0.00"))
                quantity_changed = v1_quantity != v2_quantity
                unit_changed = bom1.unit != bom2.unit
                waste_changed = v1_waste != v2_waste
                required_changed = bom1.is_required != bom2.is_required
                configurable_changed = (
                    bom1.is_configurable != bom2.is_configurable
                    or bom1.configurable_group_id != bom2.configurable_group_id
                    or getattr(bom1, "is_default_configurable", False) != getattr(bom2, "is_default_configurable", False)
                )
                alternative_changed = (
                    bom1.is_alternative != bom2.is_alternative
                    or bom1.alternative_group_id != bom2.alternative_group_id
                    or (int(bom1.priority or 0) != int(bom2.priority or 0))
                )
                if (
                    quantity_changed or unit_changed or waste_changed or required_changed
                    or configurable_changed or alternative_changed
                ):
                    modified.append({
                        "component_id": bom2.component_id,
                        "component_code": component.main_code,
                        "component_name": component.name,
                        "version1": {
                            "quantity": v1_quantity,
                            "unit": bom1.unit,
                            "waste_rate": v1_waste,
                            "is_required": bom1.is_required,
                            **extra1,
                        },
                        "version2": {
                            "quantity": v2_quantity,
                            "unit": bom2.unit,
                            "waste_rate": v2_waste,
                            "is_required": bom2.is_required,
                            **extra2,
                        }
                    })
        
        # 检查版本1中删除的子件（按 path 匹配）
        for bom1 in version1_boms:
            key1 = _row_key(bom1, bom1.id)
            if key1 not in version2_map:
                component = await Material.get(id=bom1.component_id)
                removed.append({
                    "component_id": bom1.component_id,
                    "component_code": component.main_code,
                    "component_name": component.name,
                    "quantity": float(bom1.quantity),
                    "unit": bom1.unit,
                    "waste_rate": float(bom1.waste_rate or Decimal("0.00")),
                    **_bom_extra(bom1),
                })
        
        return {
            "material_id": material_id,
            "version1": data.version1,
            "version2": data.version2,
            "added": added,
            "removed": removed,
            "modified": modified
        }

