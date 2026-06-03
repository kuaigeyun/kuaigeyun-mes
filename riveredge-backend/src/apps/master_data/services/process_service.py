"""
工艺数据服务模块

提供工艺数据的业务逻辑处理（不良品、工序、工艺路线、作业程序），支持多组织隔离。
"""

from typing import List, Optional, Dict, Any, Tuple
import hashlib
import json
import re
from tortoise.exceptions import IntegrityError
from tortoise.expressions import Q

from apps.master_data.models.material import Material, MaterialGroup
from apps.master_data.models.process import DefectType, Operation, OperationDefectType, ProcessRoute, ProcessRouteTemplate, SOP
from apps.master_data.schemas.process_schemas import (
    DefectTypeCreate, DefectTypeUpdate, DefectTypeResponse, DefectTypeMinimal,
    OperationCreate, OperationUpdate, OperationResponse,
    ProcessRouteCreate, ProcessRouteUpdate, ProcessRouteResponse,
    ProcessRouteVersionCreate, ProcessRouteVersionCompare, ProcessRouteVersionCompareResult,
    ProcessRouteTemplateCreate, ProcessRouteTemplateUpdate, ProcessRouteTemplateResponse,
    ProcessRouteTemplateVersionCreate, ProcessRouteFromTemplateCreate,
    SOPCreate, SOPUpdate, SOPResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

from apps.master_data.services.process_preset_catalog import (
    get_industry_by_id,
    get_operation_preset_by_key,
    preset_catalog_for_api,
)
from core.services.business.code_generation_service import CodeGenerationService


async def _resolve_default_operator_uuids(tenant_id: int, default_operator_uuids: Optional[List[str]]) -> List[int]:
    """解析默认生产人员 UUID 列表 -> 用户 ID 列表，校验同组织。"""
    if not default_operator_uuids or not isinstance(default_operator_uuids, list):
        return []
    from infra.models.user import User
    uuids = [str(uuid).strip() for uuid in default_operator_uuids if uuid and str(uuid).strip()]
    if not uuids:
        return []
    users = await User.filter(uuid__in=uuids, tenant_id=tenant_id, deleted_at__isnull=True).all()
    found_uuids = {str(u.uuid) for u in users}
    missing = [uuid for uuid in uuids if uuid not in found_uuids]
    if missing:
        raise ValidationError(f"默认生产人员不存在或不属于当前组织: {', '.join(missing[:3])}{'...' if len(missing) > 3 else ''}")
    return [u.id for u in users]


async def _sync_operation_defect_types(operation_id: int, defect_type_uuids: List[str], tenant_id: int) -> None:
    """同步工序绑定不良品项：清空后按 uuid 列表重建。"""
    await OperationDefectType.filter(operation_id=operation_id).delete()
    if not defect_type_uuids:
        return
    ids_by_uuid = {}
    for dt in await DefectType.filter(tenant_id=tenant_id, uuid__in=defect_type_uuids, deleted_at__isnull=True).all():
        ids_by_uuid[str(dt.uuid)] = dt.id
    for uuid in defect_type_uuids:
        did = ids_by_uuid.get(uuid) or ids_by_uuid.get(str(uuid))
        if did:
            await OperationDefectType.create(operation_id=operation_id, defect_type_id=did)


def _apply_default_operator_ids(op: Operation, default_operator_ids: List[int]) -> None:
    """将解析后的 default_operator_ids 赋给 op（JSON数组）。"""
    op.default_operator_ids = default_operator_ids if default_operator_ids else None


def _defect_type_to_response_data(dt: DefectType) -> Dict[str, Any]:
    """从 DefectType ORM 实例构建 DefectTypeResponse 所需的字典，避免 model_validate(orm) 引发 500。"""
    return {
        "id": dt.id,
        "uuid": str(dt.uuid),
        "tenant_id": dt.tenant_id,
        "code": dt.code,
        "name": dt.name,
        "category": getattr(dt, "category", None),
        "description": getattr(dt, "description", None),
        "is_active": getattr(dt, "is_active", True),
        "created_at": dt.created_at,
        "updated_at": dt.updated_at,
        "deleted_at": getattr(dt, "deleted_at", None),
    }


async def _get_operation_defect_types_via_table(operation_id: int) -> List[Dict[str, Any]]:
    """通过关联表原始 SQL 获取工序绑定的不良品列表，避免依赖 Tortoise 的 through 模型解析。"""
    batch = await batch_get_operation_defect_types_via_table([operation_id])
    return batch.get(operation_id, [])


async def batch_get_operation_defect_types_via_table(
    operation_ids: List[int],
) -> Dict[int, List[Dict[str, Any]]]:
    """
    批量获取多个主数据工序 ID 绑定的不良品类型（工单工序列表展开时避免 N+1）。
    """
    empty: Dict[int, List[Dict[str, Any]]] = {}
    if not operation_ids:
        return empty
    ids = sorted({int(i) for i in operation_ids if i is not None})
    if not ids:
        return empty
    for oid in ids:
        empty[oid] = []
    try:
        from tortoise import Tortoise
        conn = Tortoise.get_connection("default")
        if hasattr(conn, "execute_query_dict"):
            rows = await conn.execute_query_dict(
                "SELECT operation_id, defect_type_id FROM apps_master_data_operation_defect_types "
                "WHERE operation_id = ANY($1::int[])",
                [ids],
            )
        else:
            result = await conn.execute_query(
                "SELECT operation_id, defect_type_id FROM apps_master_data_operation_defect_types "
                "WHERE operation_id = ANY($1::int[])",
                [ids],
            )
            raw = result[1] if isinstance(result, tuple) and len(result) > 1 else result
            rows = [{"operation_id": row[0], "defect_type_id": row[1]} for row in (raw or [])]
        op_to_dt: Dict[int, List[int]] = {}
        all_dt: set = set()
        for r in rows or []:
            oid = r.get("operation_id")
            dtid = r.get("defect_type_id")
            if oid is None or dtid is None:
                continue
            oi, di = int(oid), int(dtid)
            op_to_dt.setdefault(oi, []).append(di)
            all_dt.add(di)
        if not all_dt:
            return empty
        dts = await DefectType.filter(id__in=list(all_dt), deleted_at__isnull=True).all()
        dt_map = {dt.id: {"uuid": str(dt.uuid), "code": dt.code, "name": dt.name} for dt in dts}
        out: Dict[int, List[Dict[str, Any]]] = {oid: [] for oid in ids}
        for oid, dt_list in op_to_dt.items():
            out[oid] = [dt_map[i] for i in dt_list if i in dt_map]
        return out
    except Exception:
        return empty


async def _operation_to_response_data(op: Operation) -> Dict[str, Any]:
    """从 Operation ORM 实例构建 OperationResponse 所需的字典，含绑定不良品项与默认生产人员。"""
    defect_types: List[Dict[str, Any]] = await _get_operation_defect_types_via_table(op.id)
    default_operator_ids: List[int] = []
    default_operator_uuids: List[str] = []
    default_operator_names: List[str] = []
    oids = getattr(op, "default_operator_ids", None)
    if oids:
        try:
            if isinstance(oids, list):
                default_operator_ids = [int(oid) for oid in oids if oid]
            elif isinstance(oids, str):
                import json
                default_operator_ids = json.loads(oids) if oids else []
            if default_operator_ids:
                from infra.models.user import User
                users = await User.filter(id__in=default_operator_ids, deleted_at__isnull=True).all()
                user_map = {u.id: u for u in users}
                for oid in default_operator_ids:
                    u = user_map.get(oid)
                    if u:
                        default_operator_uuids.append(str(u.uuid))
                        default_operator_names.append(u.full_name or u.username)
        except Exception:
            pass
    plan_id = getattr(op, "default_inspection_plan_id", None)
    # 质检模式字段后加：旧数据库中可能为 NULL/none，但有绑定不良品或默认方案，响应中按关联推断以便前后端一致
    _im_raw = getattr(op, "inspection_mode", None)
    _im_s = (str(_im_raw).strip().lower() if _im_raw is not None and str(_im_raw).strip() else "") or "none"
    if _im_s not in ("none", "simple", "plan"):
        _im_s = "none"
    if _im_s == "none" and plan_id:
        _im_s = "plan"
    elif _im_s == "none" and defect_types:
        _im_s = "simple"
    result = {
        "id": op.id,
        "uuid": str(op.uuid),
        "tenant_id": op.tenant_id,
        "code": op.code,
        "name": op.name,
        "description": getattr(op, "description", None),
        "reporting_type": getattr(op, "reporting_type", "quantity"),
        "allow_jump": getattr(op, "allow_jump", False),
        "is_node_operation": getattr(op, "is_node_operation", False),
        "over_report_mode": getattr(op, "over_report_mode", None) or "none",
        "over_report_value": getattr(op, "over_report_value", None) or 0,
        "is_active": getattr(op, "is_active", True),
        "created_at": op.created_at,
        "updated_at": op.updated_at,
        "deleted_at": getattr(op, "deleted_at", None),
        "defect_types": defect_types,
        "default_operator_ids": default_operator_ids,
        "default_operator_uuids": default_operator_uuids,
        "default_operator_names": default_operator_names,
        "default_team_ids": getattr(op, "default_team_ids", []) or [],
        "default_workshop_ids": getattr(op, "default_workshop_ids", []) or [],
        "default_work_center_ids": getattr(op, "default_work_center_ids", []) or [],
        "default_station_ids": getattr(op, "default_station_ids", []) or [],
        "default_equipment_ids": getattr(op, "default_equipment_ids", []) or [],
        "inspection_mode": _im_s,
        "default_inspection_plan_id": plan_id,
        "default_inspection_plan_name": None,
    }
    from apps.kuaizhizao.services.inspection_policy_service import normalize_operation_inspection_stages

    result["inspection_stages"] = normalize_operation_inspection_stages(
        getattr(op, "inspection_stages", None),
        legacy_mode=_im_s,
        legacy_plan_id=plan_id,
    )
    if plan_id:
        try:
            from apps.kuaizhizao.models.inspection_plan import InspectionPlan
            plan = await InspectionPlan.filter(id=plan_id, deleted_at__isnull=True).first()
            if plan:
                result["default_inspection_plan_name"] = plan.plan_name
        except Exception:
            pass
    return result


def _sop_code_token(raw: Optional[str], max_len: int = 40) -> str:
    """SOP 编码片段：仅字母数字与下划线，大写截断。"""
    if raw is None or str(raw).strip() == "":
        return "X"
    s = re.sub(r"[^0-9A-Za-z]+", "_", str(raw).strip()).strip("_").upper()
    if not s:
        return "X"
    return s[:max_len]


def _sop_code_join(parts: List[str], max_len: int = 100) -> str:
    """将多段组合为 SOP 编码；超长时用哈希后缀保证可落库。"""
    tokens = [p for p in parts if p]
    base = "-".join(tokens)
    if len(base) <= max_len:
        return base
    digest = hashlib.sha256(base.encode("utf-8")).hexdigest()[:10].upper()
    keep = max_len - 1 - len(digest)
    if keep < 12:
        keep = 12
    return f"{base[:keep]}-{digest}"[:max_len]


def _sop_name_truncate(name: str, max_len: int = 200) -> str:
    name = (name or "").strip()
    if len(name) <= max_len:
        return name
    return name[: max_len - 1] + "…"


class ProcessService:
    """工艺数据服务"""
    
    @staticmethod
    async def _to_process_route_response(process_route: ProcessRoute) -> ProcessRouteResponse:
        """
        将ProcessRoute模型转换为ProcessRouteResponse
        
        处理parent_route_uuid的转换（从外键关系获取UUID）
        
        Args:
            process_route: ProcessRoute模型对象
            
        Returns:
            ProcessRouteResponse: 响应对象
        """
        response_data = {
            "id": process_route.id,
            "uuid": process_route.uuid,
            "tenant_id": process_route.tenant_id,
            "code": process_route.code,
            "name": process_route.name,
            "description": process_route.description,
            "version": process_route.version,
            "version_description": process_route.version_description,
            "base_version": process_route.base_version,
            "effective_date": process_route.effective_date,
            "operation_sequence": process_route.operation_sequence,
            "parent_route_uuid": None,
            "parent_operation_uuid": process_route.parent_operation_uuid,
            "level": process_route.level or 0,
            "is_active": process_route.is_active,
            "over_report_mode": getattr(process_route, "over_report_mode", None) or "none",
            "over_report_value": getattr(process_route, "over_report_value", None) or 0,
            "allow_operation_jump": bool(getattr(process_route, "allow_operation_jump", False)),
            "created_at": process_route.created_at,
            "updated_at": process_route.updated_at,
            "deleted_at": process_route.deleted_at,
        }
        
        # 处理parent_route_uuid
        if process_route.parent_route_id:
            try:
                parent_route = await ProcessRoute.get(id=process_route.parent_route_id)
                response_data["parent_route_uuid"] = parent_route.uuid
            except:
                response_data["parent_route_uuid"] = None
        
        return ProcessRouteResponse(**response_data)
    
    # ==================== 不良品相关方法 ====================
    
    @staticmethod
    async def create_defect_type(
        tenant_id: int,
        data: DefectTypeCreate
    ) -> DefectTypeResponse:
        """
        创建不良品
        
        Args:
            tenant_id: 租户ID
            data: 不良品创建数据
            
        Returns:
            DefectTypeResponse: 创建的不良品对象
            
        Raises:
            ValidationError: 当编码已存在时抛出
        """
        # 检查编码是否已存在
        existing = await DefectType.filter(
            tenant_id=tenant_id,
            code=data.code,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"不良品编码 {data.code} 已存在")
        
        # 创建不良品（使用 model_dump 兼容 Pydantic v2）
        create_data = data.model_dump(by_alias=False) if hasattr(data, "model_dump") else data.dict()
        try:
            defect_type = await DefectType.create(
                tenant_id=tenant_id,
                **create_data
            )
        except IntegrityError as e:
            # 捕获数据库唯一约束错误，提供友好提示
            if "unique" in str(e).lower() or "duplicate" in str(e).lower():
                raise ValidationError(f"不良品编码 {data.code} 已存在（可能已被软删除，请检查）")
            raise
        
        return DefectTypeResponse.model_validate(_defect_type_to_response_data(defect_type))
    
    @staticmethod
    async def get_defect_type_by_uuid(
        tenant_id: int,
        defect_type_uuid: str
    ) -> DefectTypeResponse:
        """
        根据UUID获取不良品
        
        Args:
            tenant_id: 租户ID
            defect_type_uuid: 不良品UUID
            
        Returns:
            DefectTypeResponse: 不良品对象
            
        Raises:
            NotFoundError: 当不良品不存在时抛出
        """
        defect_type = await DefectType.filter(
            tenant_id=tenant_id,
            uuid=defect_type_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not defect_type:
            raise NotFoundError(f"不良品 {defect_type_uuid} 不存在")
        
        return DefectTypeResponse.model_validate(_defect_type_to_response_data(defect_type))
    
    @staticmethod
    async def list_defect_types(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        category: Optional[str] = None,
        is_active: Optional[bool] = None,
        keyword: Optional[str] = None,
        sort_by: Optional[str] = None,
        sort_order: Optional[str] = None,
    ) -> tuple[List[DefectTypeResponse], int]:
        """
        获取不良品列表（分页，返回列表与总数）
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            category: 分类（可选，用于过滤）
            is_active: 是否启用（可选）
            
        Returns:
            (列表, 总条数)
        """
        query = DefectType.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if category is not None:
            query = query.filter(category=category)
        
        if is_active is not None:
            query = query.filter(is_active=is_active)

        if keyword and keyword.strip():
            kw = keyword.strip()
            query = query.filter(
                Q(code__icontains=kw) | Q(name__icontains=kw) | Q(description__icontains=kw)
            )

        total = await query.count()
        allowed_sort = {"code", "name", "category", "created_at", "is_active"}
        field = sort_by if sort_by in allowed_sort else "code"
        desc = (sort_order or "asc").lower() == "desc"
        order_expr = f"-{field}" if desc else field
        defect_types = await query.offset(skip).limit(limit).order_by(order_expr).all()
        items = [DefectTypeResponse.model_validate(_defect_type_to_response_data(dt)) for dt in defect_types]
        return items, total
    
    @staticmethod
    async def update_defect_type(
        tenant_id: int,
        defect_type_uuid: str,
        data: DefectTypeUpdate
    ) -> DefectTypeResponse:
        """
        更新不良品
        
        Args:
            tenant_id: 租户ID
            defect_type_uuid: 不良品UUID
            data: 不良品更新数据
            
        Returns:
            DefectTypeResponse: 更新后的不良品对象
            
        Raises:
            NotFoundError: 当不良品不存在时抛出
            ValidationError: 当编码已存在时抛出
        """
        defect_type = await DefectType.filter(
            tenant_id=tenant_id,
            uuid=defect_type_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not defect_type:
            raise NotFoundError(f"不良品 {defect_type_uuid} 不存在")
        
        # 如果更新编码，检查是否已存在
        if data.code and data.code != defect_type.code:
            existing = await DefectType.filter(
                tenant_id=tenant_id,
                code=data.code,
                deleted_at__isnull=True
            ).first()
            
            if existing:
                raise ValidationError(f"不良品编码 {data.code} 已存在")
        
        # 更新字段（使用 model_dump 兼容 Pydantic v2）
        update_data = data.model_dump(exclude_unset=True, by_alias=False) if hasattr(data, "model_dump") else data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(defect_type, key, value)
        
        try:
            await defect_type.save()
        except IntegrityError as e:
            if "unique" in str(e).lower() or "duplicate" in str(e).lower():
                raise ValidationError(f"不良品编码 {data.code or defect_type.code} 已存在（可能已被软删除，请检查）")
            raise
        
        return DefectTypeResponse.model_validate(_defect_type_to_response_data(defect_type))
    
    @staticmethod
    async def batch_resolve_or_create_defect_types(
        tenant_id: int,
        items: List[str]
    ) -> Dict[str, str]:
        """
        批量解析或创建不良品项。用于工序导入时：已存在则返回 uuid，不存在则创建（编码按规则自动生成）。
        
        Args:
            tenant_id: 组织ID
            items: 不良品编码或名称列表（支持混合，如 ["尺寸不良", "DIM001"]）
            
        Returns:
            Dict[input, uuid]: 输入字符串 -> 不良品 uuid 的映射
        """
        from core.services.business.code_generation_service import CodeGenerationService
        from core.services.default.default_values_service import DefaultValuesService
        
        result: Dict[str, str] = {}
        seen: Dict[str, str] = {}  # 归一化后的 key -> uuid，用于去重（同一输入只查一次）
        
        # 确保编码规则存在
        await DefaultValuesService.ensure_code_rule_for_page(tenant_id, "master-data-defect-type")
        
        for raw in items:
            if not raw or not str(raw).strip():
                continue
            inp = str(raw).strip()
            key = inp.upper()  # 用于去重（编码不区分大小写）
            if key in seen:
                result[inp] = seen[key]
                continue
            
            # 1. 按编码查找
            dt = await DefectType.filter(
                tenant_id=tenant_id,
                code=key,
                deleted_at__isnull=True
            ).first()
            
            # 2. 按名称查找
            if not dt:
                dt = await DefectType.filter(
                    tenant_id=tenant_id,
                    name=inp,
                    deleted_at__isnull=True
                ).first()
            
            if dt:
                result[inp] = str(dt.uuid)
                seen[key] = str(dt.uuid)
                seen[inp] = str(dt.uuid)
                continue
            
            # 3. 不存在则创建，编码按规则自动生成
            try:
                code = await CodeGenerationService.generate_code(tenant_id, "DEFECT_TYPE_CODE")
                defect_type = await DefectType.create(
                    tenant_id=tenant_id,
                    code=code,
                    name=inp,
                    is_active=True
                )
                uuid_str = str(defect_type.uuid)
                result[inp] = uuid_str
                seen[key] = uuid_str
                seen[inp] = uuid_str
            except Exception as e:
                raise ValidationError(f"不良品项「{inp}」解析或创建失败: {e}")
        
        return result

    @staticmethod
    async def delete_defect_type(
        tenant_id: int,
        defect_type_uuid: str
    ) -> None:
        """
        删除不良品（软删除）
        
        Args:
            tenant_id: 租户ID
            defect_type_uuid: 不良品UUID
            
        Raises:
            NotFoundError: 当不良品不存在时抛出
        """
        defect_type = await DefectType.filter(
            tenant_id=tenant_id,
            uuid=defect_type_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not defect_type:
            raise NotFoundError(f"不良品 {defect_type_uuid} 不存在")
        
        # 软删除
        from tortoise import timezone
        defect_type.deleted_at = timezone.now()
        await defect_type.save()

    @staticmethod
    async def load_preset_defect_types_sme(tenant_id: int, codes: Optional[List[str]] = None) -> int:
        """
        已废弃：不良品预设改由「工序加载预设」按行业一并创建并绑定。
        保留方法签名供历史调用方；不再创建任何记录。
        """
        return 0
    
    # ==================== 工序相关方法 ====================
    
    @staticmethod
    async def create_operation(
        tenant_id: int,
        data: OperationCreate
    ) -> OperationResponse:
        """
        创建工序。支持软删除后重用编码：若编码仅存在于已软删除记录，则恢复该记录并更新。
        """
        code_upper = (data.code or "").strip().upper()
        if not code_upper:
            raise ValidationError("工序编码不能为空")

        # 检查未删除记录
        existing_active = await Operation.filter(
            tenant_id=tenant_id,
            code=code_upper,
            deleted_at__isnull=True
        ).first()
        if existing_active:
            raise ValidationError(f"工序编码 {data.code} 已存在")

        # 检查软删除记录：存在则恢复并更新
        existing_deleted = await Operation.filter(
            tenant_id=tenant_id,
            code=code_upper,
            deleted_at__isnull=False
        ).first()
        if existing_deleted:
            restore_payload = {
                "inspection_stages": getattr(data, "inspection_stages", None) or getattr(data, "inspectionStages", None),
                "inspection_mode": getattr(data, "inspection_mode", None) or getattr(data, "inspectionMode", None),
                "default_inspection_plan_id": getattr(data, "default_inspection_plan_id", None)
                or getattr(data, "defaultInspectionPlanId", None),
            }
            from apps.kuaizhizao.services.inspection_policy_service import (
                assert_master_data_inspection_stages_allowed,
                prepare_operation_inspection_for_write,
            )

            prepare_operation_inspection_for_write(restore_payload)
            await assert_master_data_inspection_stages_allowed(
                tenant_id,
                operation_stages=restore_payload.get("inspection_stages"),
            )
            default_operator_uuids = getattr(data, "default_operator_uuids", None) or getattr(data, "defaultOperatorUuids", None) or []
            oids = await _resolve_default_operator_uuids(tenant_id, default_operator_uuids)
            existing_deleted.deleted_at = None
            existing_deleted.code = data.code.strip().upper()
            existing_deleted.name = data.name.strip()
            existing_deleted.description = (data.description or "").strip() or None
            reporting_type = getattr(data, "reporting_type", None) or getattr(data, "reportingType", None) or "quantity"
            existing_deleted.reporting_type = reporting_type
            existing_deleted.allow_jump = getattr(data, "allow_jump", None) or getattr(data, "allowJump", None) or False
            existing_deleted.is_node_operation = getattr(data, "is_node_operation", None) or getattr(data, "isNodeOperation", None) or False
            existing_deleted.over_report_mode = (
                getattr(data, "over_report_mode", None) or getattr(data, "overReportMode", None) or "none"
            )
            _orv = getattr(data, "over_report_value", None)
            if _orv is None:
                _orv = getattr(data, "overReportValue", None)
            existing_deleted.over_report_value = _orv if _orv is not None else 0
            existing_deleted.is_active = getattr(data, "is_active", None) or getattr(data, "isActive", None) or True
            existing_deleted.inspection_mode = restore_payload["inspection_mode"]
            existing_deleted.default_inspection_plan_id = restore_payload["default_inspection_plan_id"]
            existing_deleted.inspection_stages = restore_payload["inspection_stages"]
            existing_deleted.default_team_ids = getattr(data, "default_team_ids", None) or getattr(data, "defaultTeamIds", None)
            existing_deleted.default_workshop_ids = getattr(data, "default_workshop_ids", None) or getattr(data, "defaultWorkshopIds", None)
            existing_deleted.default_work_center_ids = getattr(data, "default_work_center_ids", None) or getattr(data, "defaultWorkCenterIds", None)
            existing_deleted.default_station_ids = getattr(data, "default_station_ids", None) or getattr(data, "defaultStationIds", None)
            existing_deleted.default_equipment_ids = getattr(data, "default_equipment_ids", None) or getattr(data, "defaultEquipmentIds", None)
            _apply_default_operator_ids(existing_deleted, oids)
            await _sync_operation_defect_types(existing_deleted.id, getattr(data, "defect_type_uuids", None) or [], tenant_id)
            await existing_deleted.save()
            return OperationResponse.model_validate(await _operation_to_response_data(existing_deleted))

        # 使用 exclude_unset=False 确保包含所有字段（包括有默认值的字段）
        create_data = data.model_dump(exclude_unset=False, by_alias=False) if hasattr(data, "model_dump") else data.dict()
        create_data.pop("defect_type_uuids", None)
        default_operator_uuids = create_data.pop("default_operator_uuids", None) or getattr(data, "defaultOperatorUuids", None) or []
        create_data["code"] = code_upper
        create_data["name"] = (data.name or "").strip()
        create_data["description"] = (create_data.get("description") or "").strip() or None
        # 确保 reporting_type、allow_jump、is_active 有正确的值（处理前端可能发送的 camelCase）
        # 如果字段不存在或为 None，使用默认值
        if "reporting_type" not in create_data or create_data.get("reporting_type") is None:
            reporting_type = getattr(data, "reporting_type", None) or getattr(data, "reportingType", None) or "quantity"
            create_data["reporting_type"] = reporting_type
        if "allow_jump" not in create_data or create_data.get("allow_jump") is None:
            allow_jump = getattr(data, "allow_jump", None) or getattr(data, "allowJump", None)
            create_data["allow_jump"] = allow_jump if allow_jump is not None else False
        if "is_node_operation" not in create_data or create_data.get("is_node_operation") is None:
            is_node = getattr(data, "is_node_operation", None) or getattr(data, "isNodeOperation", None)
            create_data["is_node_operation"] = is_node if is_node is not None else False
        if "is_active" not in create_data or create_data.get("is_active") is None:
            is_active = getattr(data, "is_active", None) or getattr(data, "isActive", None)
            create_data["is_active"] = is_active if is_active is not None else True
        create_data["default_operator_ids"] = await _resolve_default_operator_uuids(tenant_id, default_operator_uuids)

        from apps.kuaizhizao.services.inspection_policy_service import (
            assert_master_data_inspection_stages_allowed,
            prepare_operation_inspection_for_write,
        )

        if create_data.get("inspection_stages") is not None or create_data.get("inspection_mode") is not None:
            prepare_operation_inspection_for_write(create_data)
            await assert_master_data_inspection_stages_allowed(
                tenant_id,
                operation_stages=create_data.get("inspection_stages"),
            )

        try:
            operation = await Operation.create(tenant_id=tenant_id, **create_data)
            await _sync_operation_defect_types(operation.id, getattr(data, "defect_type_uuids", None) or [], tenant_id)
            return OperationResponse.model_validate(await _operation_to_response_data(operation))
        except IntegrityError as e:
            err = str(e).lower()
            if "unique" in err or "duplicate" in err:
                retry = await Operation.filter(
                    tenant_id=tenant_id,
                    code=code_upper,
                    deleted_at__isnull=False
                ).first()
                if retry:
                    default_operator_uuids = getattr(data, "default_operator_uuids", None) or getattr(data, "defaultOperatorUuids", None) or []
                    oids = await _resolve_default_operator_uuids(tenant_id, default_operator_uuids)
                    retry.deleted_at = None
                    retry.code = data.code.strip().upper()
                    retry.name = data.name.strip()
                    retry.description = (data.description or "").strip() or None
                    reporting_type = getattr(data, "reporting_type", None) or getattr(data, "reportingType", None) or "quantity"
                    retry.reporting_type = reporting_type
                    retry.allow_jump = getattr(data, "allow_jump", None) or getattr(data, "allowJump", None) or False
                    retry.is_node_operation = getattr(data, "is_node_operation", None) or getattr(data, "isNodeOperation", None) or False
                    retry.over_report_mode = (
                        getattr(data, "over_report_mode", None) or getattr(data, "overReportMode", None) or "none"
                    )
                    _orv2 = getattr(data, "over_report_value", None)
                    if _orv2 is None:
                        _orv2 = getattr(data, "overReportValue", None)
                    retry.over_report_value = _orv2 if _orv2 is not None else 0
                    retry.is_active = getattr(data, "is_active", None) or getattr(data, "isActive", None) or True
                    retry.inspection_mode = getattr(data, "inspection_mode", None) or getattr(data, "inspectionMode", None) or "none"
                    retry.default_inspection_plan_id = getattr(data, "default_inspection_plan_id", None) or getattr(data, "defaultInspectionPlanId", None)
                    retry.default_team_ids = getattr(data, "default_team_ids", None) or getattr(data, "defaultTeamIds", None)
                    retry.default_workshop_ids = getattr(data, "default_workshop_ids", None) or getattr(data, "defaultWorkshopIds", None)
                    retry.default_work_center_ids = getattr(data, "default_work_center_ids", None) or getattr(data, "defaultWorkCenterIds", None)
                    retry.default_equipment_ids = getattr(data, "default_equipment_ids", None) or getattr(data, "defaultEquipmentIds", None)
                    _apply_default_operator_ids(retry, oids)
                    await _sync_operation_defect_types(retry.id, getattr(data, "defect_type_uuids", None) or [], tenant_id)
                    await retry.save()
                    return OperationResponse.model_validate(await _operation_to_response_data(retry))
                raise ValidationError(f"工序编码 {data.code} 已存在（可能已被软删除，请检查）")
            if "pkey" in err or "primary" in err or "键值" in err:
                # 自动修复序列并重试一次
                try:
                    from tortoise import Tortoise
                    db = Tortoise.get_connection("default")
                    # 直接执行序列修复 SQL（使用 DO 块）
                    await db.execute_query("""
                        DO $$
                        DECLARE
                            seq_name text;
                        BEGIN
                            seq_name := pg_get_serial_sequence('apps_master_data_operations', 'id');
                            IF seq_name IS NOT NULL THEN
                                EXECUTE format(
                                    'SELECT setval(%L::regclass, (SELECT COALESCE(MAX(id), 1) FROM apps_master_data_operations))',
                                    seq_name
                                );
                            END IF;
                        END $$;
                    """)
                    # 重试创建
                    operation = await Operation.create(tenant_id=tenant_id, **create_data)
                    await _sync_operation_defect_types(operation.id, getattr(data, "defect_type_uuids", None) or [], tenant_id)
                    return OperationResponse.model_validate(await _operation_to_response_data(operation))
                except Exception as retry_err:
                    raise ValidationError(
                        f"工序主键 id 序列不同步，自动修复失败: {str(retry_err)}。"
                        "请联系管理员执行迁移 64_20260126000000_sync_operations_id_sequence。"
                    )
            raise
    
    @staticmethod
    async def get_operation_by_uuid(
        tenant_id: int,
        operation_uuid: str
    ) -> OperationResponse:
        """
        根据UUID获取工序
        
        Args:
            tenant_id: 租户ID
            operation_uuid: 工序UUID
            
        Returns:
            OperationResponse: 工序对象
            
        Raises:
            NotFoundError: 当工序不存在时抛出
        """
        operation = await Operation.filter(
            tenant_id=tenant_id,
            uuid=operation_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not operation:
            raise NotFoundError(f"工序 {operation_uuid} 不存在")
        
        return OperationResponse.model_validate(await _operation_to_response_data(operation))
    
    @staticmethod
    async def list_operations(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        is_active: Optional[bool] = None,
        keyword: Optional[str] = None,
        sort_by: Optional[str] = None,
        sort_order: Optional[str] = None,
    ) -> Tuple[List[OperationResponse], int]:
        """
        获取工序列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            is_active: 是否启用（可选）
            
        Returns:
            (工序列表, 总条数)
        """
        query = Operation.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if is_active is not None:
            query = query.filter(is_active=is_active)

        if keyword and keyword.strip():
            kw = keyword.strip()
            query = query.filter(
                Q(code__icontains=kw) | Q(name__icontains=kw) | Q(description__icontains=kw)
            )

        total = await query.count()
        allowed_sort = {"code", "name", "created_at", "is_active", "reporting_type"}
        field = sort_by if sort_by in allowed_sort else "code"
        desc = (sort_order or "asc").lower() == "desc"
        order_expr = f"-{field}" if desc else field

        # 不使用 prefetch_related("defect_types")，避免 Tortoise 解析 through 模型失败；不良品列表在 _operation_to_response_data 中通过关联表 SQL 查询
        operations = await query.offset(skip).limit(limit).order_by(order_expr).all()
        out = []
        for op in operations:
            out.append(OperationResponse.model_validate(await _operation_to_response_data(op)))
        return out, total

    @staticmethod
    async def update_operation(
        tenant_id: int,
        operation_uuid: str,
        data: OperationUpdate
    ) -> OperationResponse:
        """
        更新工序
        
        Args:
            tenant_id: 租户ID
            operation_uuid: 工序UUID
            data: 工序更新数据
            
        Returns:
            OperationResponse: 更新后的工序对象
            
        Raises:
            NotFoundError: 当工序不存在时抛出
            ValidationError: 当编码已存在时抛出
        """
        operation = await Operation.filter(
            tenant_id=tenant_id,
            uuid=operation_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not operation:
            raise NotFoundError(f"工序 {operation_uuid} 不存在")
        
        # 如果更新编码，检查是否已存在
        if data.code and data.code != operation.code:
            existing = await Operation.filter(
                tenant_id=tenant_id,
                code=data.code,
                deleted_at__isnull=True
            ).first()
            
            if existing:
                raise ValidationError(f"工序编码 {data.code} 已存在")
        
        update_data = data.model_dump(exclude_unset=True, by_alias=False) if hasattr(data, "model_dump") else data.dict(exclude_unset=True)
        if "inspection_mode" in update_data or getattr(data, "inspection_mode", None) is not None or getattr(data, "inspection_stages", None) is not None:
            from apps.kuaizhizao.services.inspection_policy_service import (
                assert_master_data_inspection_stages_allowed,
                prepare_operation_inspection_for_write,
            )

            patch = dict(update_data)
            if "inspection_stages" not in patch and getattr(data, "inspection_stages", None) is not None:
                patch["inspection_stages"] = getattr(data, "inspection_stages", None) or getattr(
                    data, "inspectionStages", None
                )
            prepare_operation_inspection_for_write(patch)
            await assert_master_data_inspection_stages_allowed(
                tenant_id,
                operation_stages=patch.get("inspection_stages"),
            )
            for k in ("inspection_stages", "inspection_mode", "default_inspection_plan_id"):
                if k in patch:
                    update_data[k] = patch[k]
        # 从 update_data 中移除关系字段，避免 setattr 到 ORM 上；并从 data 上取以保证请求里带了的都能同步
        defect_type_uuids = update_data.pop("defect_type_uuids", None)
        if defect_type_uuids is None:
            defect_type_uuids = getattr(data, "defect_type_uuids", None)
        default_operator_uuids = update_data.pop("default_operator_uuids", None)
        if default_operator_uuids is None:
            default_operator_uuids = getattr(data, "default_operator_uuids", None)
        if default_operator_uuids is not None:
            oids = await _resolve_default_operator_uuids(tenant_id, default_operator_uuids or [])
            operation.default_operator_ids = oids if oids else None
        for key, value in update_data.items():
            setattr(operation, key, value)
        
        try:
            await operation.save()
        except IntegrityError as e:
            if "unique" in str(e).lower() or "duplicate" in str(e).lower():
                raise ValidationError(f"工序编码 {data.code or operation.code} 已存在（可能已被软删除，请检查）")
            raise
        if defect_type_uuids is not None:
            await _sync_operation_defect_types(operation.id, defect_type_uuids or [], tenant_id)
        
        return OperationResponse.model_validate(await _operation_to_response_data(operation))
    
    @staticmethod
    async def delete_operation(
        tenant_id: int,
        operation_uuid: str
    ) -> None:
        """
        删除工序（软删除）
        
        Args:
            tenant_id: 租户ID
            operation_uuid: 工序UUID
            
        Raises:
            NotFoundError: 当工序不存在时抛出
            ValidationError: 当工序被工艺路线或SOP使用时抛出
        """
        operation = await Operation.filter(
            tenant_id=tenant_id,
            uuid=operation_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not operation:
            raise NotFoundError(f"工序 {operation_uuid} 不存在")
        
        # 检查是否被SOP使用
        sops_count = await SOP.filter(
            tenant_id=tenant_id,
            operation_id=operation.id,
            deleted_at__isnull=True
        ).count()
        
        if sops_count > 0:
            raise ValidationError(f"工序被 {sops_count} 个SOP使用，无法删除")
        
        # 软删除
        from tortoise import timezone
        operation.deleted_at = timezone.now()
        await operation.save()

    # 历史扁平工序预设已废弃；结构见 process_preset_catalog.INDUSTRY_PRESETS
    PRESET_OPERATIONS: List[Dict[str, Any]] = []

    @staticmethod
    def get_operation_preset_catalog() -> Dict[str, Any]:
        """工序预设目录（行业树），供 API 序列化。"""
        return preset_catalog_for_api()

    @staticmethod
    async def _resolve_or_create_defect_for_preset(
        tenant_id: int,
        name: str,
        category: Optional[str],
        description: Optional[str],
    ) -> Tuple[str, bool]:
        """
        按名称复用未删除的不良品项；不存在则按 DEFECT_TYPE_CODE 生成编码并创建。
        返回 (uuid_str, created_new)。
        """
        name_st = (name or "").strip()
        if not name_st:
            raise ValidationError("不良品名称不能为空")
        if len(name_st) > 200:
            name_st = name_st[:200]
        existing = (
            await DefectType.filter(tenant_id=tenant_id, name=name_st, deleted_at__isnull=True)
            .order_by("id")
            .first()
        )
        if existing:
            return str(existing.uuid), False
        code = await CodeGenerationService.generate_code(tenant_id, "DEFECT_TYPE_CODE")
        cat = (category or "").strip()[:50] if category else None
        desc = (description or "").strip() or None
        try:
            dt = await DefectType.create(
                tenant_id=tenant_id,
                code=code[:50],
                name=name_st,
                category=cat,
                description=desc,
                is_active=True,
            )
            return str(dt.uuid), True
        except IntegrityError:
            retry = await DefectType.filter(
                tenant_id=tenant_id, name=name_st, deleted_at__isnull=True
            ).first()
            if retry:
                return str(retry.uuid), False
            raise

    @staticmethod
    async def load_preset_operations_by_industry(
        tenant_id: int,
        industry_id: str,
        preset_keys: List[str],
    ) -> Dict[str, Any]:
        """
        按行业加载所选工序预设：工序编码走 OPERATION_CODE，不良品走 DEFECT_TYPE_CODE 或按名称复用；
        工序与不良通过 OperationDefectType 绑定。
        """
        industry = get_industry_by_id(industry_id)
        if not industry:
            raise ValidationError(f"未知行业: {industry_id}")
        if not preset_keys:
            return {
                "created_operations": 0,
                "skipped_operations": 0,
                "created_defect_types": 0,
                "reused_defect_types": 0,
                "linked_pairs": 0,
                "message": "未选择任何工序",
            }
        valid = {op["preset_key"] for op in industry["operations"]}
        for k in preset_keys:
            if k not in valid:
                raise ValidationError(f"presetKey 不属于所选行业: {k}")

        created_ops = 0
        skipped_ops = 0
        created_dt = 0
        reused_dt = 0
        linked_pairs = 0

        for preset_key in preset_keys:
            op_def = get_operation_preset_by_key(preset_key)
            if not op_def:
                continue
            op_name = (op_def["name"] or "").strip()
            if not op_name:
                continue
            exists_op = await Operation.filter(
                tenant_id=tenant_id, name=op_name, deleted_at__isnull=True
            ).first()
            if exists_op:
                skipped_ops += 1
                continue
            op_code = await CodeGenerationService.generate_code(tenant_id, "OPERATION_CODE")
            op_code = (op_code or "").strip()[:50]
            if not op_code:
                raise ValidationError("工序编码生成失败，请检查编码规则 OPERATION_CODE 是否启用")

            operation = await Operation.create(
                tenant_id=tenant_id,
                code=op_code,
                name=op_name[:200],
                reporting_type="quantity",
                allow_jump=False,
                is_node_operation=False,
                is_active=True,
            )
            created_ops += 1

            defect_uuids: List[str] = []
            for d in op_def.get("defect_presets") or []:
                dn = (d.get("name") or "").strip()
                if not dn:
                    continue
                cat_raw = (d.get("category") or "").strip()
                dc = cat_raw[:50] if cat_raw else None
                ddesc = (d.get("description") or "").strip() or None
                uid, was_new = await ProcessService._resolve_or_create_defect_for_preset(
                    tenant_id, dn, dc, ddesc
                )
                defect_uuids.append(uid)
                if was_new:
                    created_dt += 1
                else:
                    reused_dt += 1

            await _sync_operation_defect_types(operation.id, defect_uuids, tenant_id)
            linked_pairs += len(defect_uuids)

        msg = (
            f"已创建 {created_ops} 个工序，新建不良品 {created_dt} 个，复用不良品 {reused_dt} 个"
            f"{f'，跳过同名工序 {skipped_ops} 个' if skipped_ops else ''}"
        )
        return {
            "created_operations": created_ops,
            "skipped_operations": skipped_ops,
            "created_defect_types": created_dt,
            "reused_defect_types": reused_dt,
            "linked_pairs": linked_pairs,
            "message": msg.strip(),
        }

    @staticmethod
    async def load_preset_operations_sme(tenant_id: int, codes: Optional[List[str]] = None) -> int:
        """
        已废弃：硬编码工序预设不再写入。
        租户初始化等历史入口不应再依赖本方法创建数据；请使用 load_preset_operations_by_industry。
        """
        return 0
    
    # ==================== 工艺路线相关方法 ====================
    
    @staticmethod
    async def create_process_route(
        tenant_id: int,
        data: ProcessRouteCreate
    ) -> ProcessRouteResponse:
        """
        创建工艺路线。支持软删除后重用编码：若编码仅存在于已软删除记录，则恢复该记录并更新。
        
        Args:
            tenant_id: 租户ID
            data: 工艺路线创建数据
            
        Returns:
            ProcessRouteResponse: 创建的工艺路线对象
            
        Raises:
            ValidationError: 当编码已存在时抛出
        """
        code_upper = (data.code or "").strip().upper()
        if not code_upper:
            raise ValidationError("工艺路线编码不能为空")
        
        # 检查编码+版本是否已存在（同一编码可以有多个版本）
        version = data.version if hasattr(data, 'version') and data.version else "1.0"
        
        # 检查未删除记录
        existing_active = await ProcessRoute.filter(
            tenant_id=tenant_id,
            code=code_upper,
            version=version,
            deleted_at__isnull=True
        ).first()
        
        if existing_active:
            raise ValidationError(f"工艺路线编码 {data.code} 版本 {version} 已存在")
        
        # 检查软删除记录：存在则恢复并更新
        existing_deleted = await ProcessRoute.filter(
            tenant_id=tenant_id,
            code=code_upper,
            version=version,
            deleted_at__isnull=False
        ).first()
        
        if existing_deleted:
            # 恢复软删除的记录并更新
            existing_deleted.deleted_at = None
            existing_deleted.code = code_upper
            existing_deleted.name = data.name
            existing_deleted.description = getattr(data, 'description', None)
            existing_deleted.is_active = getattr(data, 'is_active', True)
            existing_deleted.operation_sequence = getattr(data, 'operation_sequence', None)
            await existing_deleted.save()
            
            # 返回恢复的记录
            return ProcessRouteResponse.from_orm(existing_deleted)
        
        # 创建工艺路线
        route_data = data.dict(exclude={'parent_route_uuid'})
        if 'version' not in route_data or not route_data.get('version'):
            route_data['version'] = "1.0"
        
        # 处理父工艺路线关联
        if hasattr(data, 'parent_route_uuid') and data.parent_route_uuid:
            parent_route = await ProcessRoute.filter(
                tenant_id=tenant_id,
                uuid=data.parent_route_uuid,
                deleted_at__isnull=True
            ).first()
            if not parent_route:
                raise NotFoundError(f"父工艺路线 {data.parent_route_uuid} 不存在")
            
            # 检查嵌套层级
            parent_level = parent_route.level or 0
            new_level = data.level if hasattr(data, 'level') and data.level is not None else parent_level + 1
            if new_level > 3:
                raise ValidationError("嵌套层级不能超过3层")
            
            route_data['parent_route_id'] = parent_route.id
            route_data['level'] = new_level
        
        process_route = await ProcessRoute.create(
            tenant_id=tenant_id,
            **route_data
        )
        
        return await ProcessService._to_process_route_response(process_route)
    
    @staticmethod
    async def get_process_route_by_uuid(
        tenant_id: int,
        process_route_uuid: str
    ) -> ProcessRouteResponse:
        """
        根据UUID获取工艺路线
        
        Args:
            tenant_id: 租户ID
            process_route_uuid: 工艺路线UUID
            
        Returns:
            ProcessRouteResponse: 工艺路线对象
            
        Raises:
            NotFoundError: 当工艺路线不存在时抛出
        """
        process_route = await ProcessRoute.filter(
            tenant_id=tenant_id,
            uuid=process_route_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not process_route:
            raise NotFoundError(f"工艺路线 {process_route_uuid} 不存在")
        
        return await ProcessService._to_process_route_response(process_route)
    
    @staticmethod
    async def list_process_routes(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        is_active: Optional[bool] = None,
        keyword: Optional[str] = None,
        sort_by: Optional[str] = None,
        sort_order: Optional[str] = None,
    ) -> Tuple[List[ProcessRouteResponse], int]:
        """
        获取工艺路线列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            is_active: 是否启用（可选）
            
        Returns:
            (工艺路线列表, 总条数)
        """
        query = ProcessRoute.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if is_active is not None:
            query = query.filter(is_active=is_active)

        if keyword and keyword.strip():
            kw = keyword.strip()
            query = query.filter(
                Q(code__icontains=kw) | Q(name__icontains=kw) | Q(description__icontains=kw)
            )

        total = await query.count()
        allowed_sort = {"code", "name", "created_at", "is_active"}
        field = sort_by if sort_by in allowed_sort else "code"
        desc = (sort_order or "asc").lower() == "desc"
        order_expr = f"-{field}" if desc else field

        process_routes = await query.offset(skip).limit(limit).order_by(order_expr).all()

        items = [await ProcessService._to_process_route_response(pr) for pr in process_routes]
        return items, total
    
    @staticmethod
    async def update_process_route(
        tenant_id: int,
        process_route_uuid: str,
        data: ProcessRouteUpdate
    ) -> ProcessRouteResponse:
        """
        更新工艺路线
        
        Args:
            tenant_id: 租户ID
            process_route_uuid: 工艺路线UUID
            data: 工艺路线更新数据
            
        Returns:
            ProcessRouteResponse: 更新后的工艺路线对象
            
        Raises:
            NotFoundError: 当工艺路线不存在时抛出
            ValidationError: 当编码已存在时抛出
        """
        process_route = await ProcessRoute.filter(
            tenant_id=tenant_id,
            uuid=process_route_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not process_route:
            raise NotFoundError(f"工艺路线 {process_route_uuid} 不存在")
        
        # 如果更新编码，检查是否已存在
        if data.code and data.code != process_route.code:
            existing = await ProcessRoute.filter(
                tenant_id=tenant_id,
                code=data.code,
                deleted_at__isnull=True
            ).first()
            
            if existing:
                raise ValidationError(f"工艺路线编码 {data.code} 已存在")
        
        # 更新字段
        update_data = (
            data.model_dump(exclude_unset=True, by_alias=False)
            if hasattr(data, "model_dump")
            else data.dict(exclude_unset=True)
        )
        for key, value in update_data.items():
            setattr(process_route, key, value)
        
        try:
            await process_route.save()
        except IntegrityError as e:
            # 捕获数据库唯一约束错误，提供友好提示
            if "unique" in str(e).lower() or "duplicate" in str(e).lower():
                raise ValidationError(f"工艺路线编码 {data.code or process_route.code} 已存在（可能已被软删除，请检查）")
            raise
        
        return await ProcessService._to_process_route_response(process_route)
    
    @staticmethod
    async def delete_process_route(
        tenant_id: int,
        process_route_uuid: str
    ) -> None:
        """
        删除工艺路线（软删除）
        
        Args:
            tenant_id: 租户ID
            process_route_uuid: 工艺路线UUID
            
        Raises:
            NotFoundError: 当工艺路线不存在时抛出
        """
        process_route = await ProcessRoute.filter(
            tenant_id=tenant_id,
            uuid=process_route_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not process_route:
            raise NotFoundError(f"工艺路线 {process_route_uuid} 不存在")
        
        # 软删除
        from tortoise import timezone
        process_route.deleted_at = timezone.now()
        await process_route.save()
    
    # ==================== 级联查询相关方法 ====================
    
    @staticmethod
    async def get_process_route_tree(
        tenant_id: int,
        is_active: Optional[bool] = None
    ) -> List["ProcessRouteTreeResponse"]:
        """
        获取工艺路线树形结构（工艺路线→工序）
        
        返回完整的工艺路线层级结构，每个工艺路线包含其工序序列中的工序信息。
        用于级联选择等场景。
        
        Args:
            tenant_id: 租户ID
            is_active: 是否只查询启用的数据（可选）
            
        Returns:
            List[ProcessRouteTreeResponse]: 工艺路线树形列表，每个工艺路线包含工序列表（按序列顺序）
        """
        # 延迟导入避免循环依赖
        from apps.master_data.schemas.process_schemas import (
            ProcessRouteTreeResponse,
            OperationTreeResponse
        )
        
        # 查询所有工艺路线
        route_query = ProcessRoute.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        if is_active is not None:
            route_query = route_query.filter(is_active=is_active)
        
        process_routes = await route_query.order_by("code").all()
        
        # 查询所有工序（用于构建映射）
        operation_query = Operation.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        if is_active is not None:
            operation_query = operation_query.filter(is_active=is_active)
        
        operations = await operation_query.all()
        
        # 构建工序映射（按ID）
        operation_map: Dict[int, Operation] = {op.id: op for op in operations}
        
        # 构建工艺路线树形结构
        result: List[ProcessRouteTreeResponse] = []
        for route in process_routes:
            # 创建工艺路线响应对象
            route_response = ProcessRouteTreeResponse.model_validate(route)
            route_response.operations = []
            
            # 解析工序序列（JSON格式）
            if route.operation_sequence:
                # operation_sequence 可能是列表或字典格式
                # 假设格式为: [{"operation_id": 1, "sequence": 1}, ...] 或 {"1": {"sequence": 1}, ...}
                sequence_data = route.operation_sequence
                
                # 处理不同的JSON格式
                operation_list = []
                if isinstance(sequence_data, list):
                    # 列表格式：[{"operation_id": 1, "sequence": 1}, ...]
                    for item in sequence_data:
                        if isinstance(item, dict):
                            op_id = item.get("operation_id") or item.get("operationId")
                            if op_id and op_id in operation_map:
                                operation_list.append((item.get("sequence", 0), operation_map[op_id]))
                elif isinstance(sequence_data, dict):
                    # 字典格式：{"1": {"sequence": 1}, ...} 或 {"operation_ids": [1, 2, 3]}
                    if "operation_ids" in sequence_data or "operationIds" in sequence_data:
                        # 简单列表格式
                        op_ids = sequence_data.get("operation_ids") or sequence_data.get("operationIds", [])
                        for idx, op_id in enumerate(op_ids):
                            if op_id in operation_map:
                                operation_list.append((idx, operation_map[op_id]))
                    else:
                        # 键值对格式
                        for key, value in sequence_data.items():
                            if isinstance(value, dict):
                                op_id = value.get("operation_id") or value.get("operationId") or int(key)
                            else:
                                op_id = int(key) if key.isdigit() else None
                            
                            if op_id and op_id in operation_map:
                                seq = value.get("sequence", 0) if isinstance(value, dict) else 0
                                operation_list.append((seq, operation_map[op_id]))
                
                # 按序列顺序排序
                operation_list.sort(key=lambda x: x[0])
                
                # 构建工序响应列表
                route_response.operations = [
                    OperationTreeResponse.model_validate(op) for _, op in operation_list
                ]
            
            result.append(route_response)
        
        return result
    
    # ==================== 作业程序（SOP）相关方法 ====================
    
    @staticmethod
    async def create_sop(
        tenant_id: int,
        data: SOPCreate
    ) -> SOPResponse:
        """
        创建作业程序（SOP）
        
        Args:
            tenant_id: 租户ID
            data: SOP创建数据
            
        Returns:
            SOPResponse: 创建的SOP对象
            
        Raises:
            ValidationError: 当编码已存在或工序不存在时抛出
        """
        # 如果指定了工序，检查工序是否存在
        if data.operation_id:
            operation = await Operation.filter(
                tenant_id=tenant_id,
                id=data.operation_id,
                deleted_at__isnull=True
            ).first()
            
            if not operation:
                raise ValidationError(f"工序 {data.operation_id} 不存在")
        
        # 检查编码是否已存在
        existing = await SOP.filter(
            tenant_id=tenant_id,
            code=data.code,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"SOP编码 {data.code} 已存在")
        
        # 创建SOP（仅传模型字段；dict 已包含 schema 中定义的绑定与融合字段）
        create_data = data.model_dump() if hasattr(data, "model_dump") else data.dict()
        try:
            sop = await SOP.create(
                tenant_id=tenant_id,
                **create_data
            )
        except IntegrityError as e:
            # 捕获数据库唯一约束错误，提供友好提示
            if "unique" in str(e).lower() or "duplicate" in str(e).lower():
                raise ValidationError(f"SOP编码 {data.code} 已存在（可能已被软删除，请检查）")
            raise
        
        return SOPResponse.model_validate(sop)
    
    @staticmethod
    async def batch_create_sops_from_route(
        tenant_id: int,
        data: "SOPBatchCreateFromRouteRequest"
    ) -> List[SOPResponse]:
        """
        按工艺路线批量创建 SOP 草稿

        编号策略（与物料/组解耦，避免同路线多物料冲突）：
        - 未选物料/组：编码 `{路线}-{工序}`，名称 `{路线名} - {工序名}`（通用）。
        - 选多个物料：每个物料 × 每道工序一条 SOP；编码 `{路线}-{工序}-M-{主编码}`，
          名称带「物料名｜主编码」；`material_uuids` 仅含该料一条；`bom_load_mode=by_material`。
        - 选多个物料组：每组 × 每道工序一条；编码含 `G-{组编码}`；`bom_load_mode=by_material_group`。
        物料与物料组不可同时传入。

        Args:
            tenant_id: 租户ID
            data: 批量创建请求（process_route_uuid, material_uuids, material_group_uuids）

        Returns:
            List[SOPResponse]: 创建的 SOP 列表
        """
        # 获取工艺路线
        process_route = await ProcessRoute.filter(
            tenant_id=tenant_id,
            uuid=data.process_route_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not process_route:
            raise NotFoundError(f"工艺路线 {data.process_route_uuid} 不存在")
        
        # 解析工序序列（保持顺序）
        operation_list = []
        seq_data = process_route.operation_sequence
        
        if isinstance(seq_data, list):
            for item in seq_data:
                if isinstance(item, dict):
                    op_id = item.get("operation_id") or item.get("operationId")
                    seq = item.get("sequence", len(operation_list) + 1)
                    if op_id:
                        operation_list.append({"operation_id": op_id, "sequence": seq})
        elif isinstance(seq_data, dict):
            if "operation_ids" in seq_data or "operationIds" in seq_data:
                op_ids = seq_data.get("operation_ids") or seq_data.get("operationIds", [])
                for idx, op_id in enumerate(op_ids, 1):
                    if op_id:
                        operation_list.append({"operation_id": op_id, "sequence": idx})
            elif "sequence" in seq_data or "operations" in seq_data:
                # 前端格式：{sequence: [uuid...], operations: [{uuid, code, name}...]}
                op_uuids = seq_data.get("sequence") or []
                if not op_uuids and seq_data.get("operations"):
                    op_uuids = [o.get("uuid") for o in seq_data["operations"] if isinstance(o, dict) and o.get("uuid")]
                if op_uuids:
                    ops_by_uuid = {
                        str(op.uuid): op for op in await Operation.filter(
                            uuid__in=[str(u) for u in op_uuids],
                            tenant_id=tenant_id,
                            deleted_at__isnull=True
                        ).all()
                    }
                    for idx, op_uuid in enumerate(op_uuids, 1):
                        op = ops_by_uuid.get(str(op_uuid))
                        if op:
                            operation_list.append({"operation_id": op.id, "sequence": idx})
            else:
                for key, value in seq_data.items():
                    if isinstance(value, dict):
                        op_id = value.get("operation_id") or value.get("operationId") or (int(key) if str(key).isdigit() else None)
                    else:
                        op_id = int(key) if str(key).isdigit() else None
                    if op_id:
                        seq = value.get("sequence", len(operation_list) + 1) if isinstance(value, dict) else len(operation_list) + 1
                        operation_list.append({"operation_id": op_id, "sequence": seq})
        
        operation_list.sort(key=lambda x: x["sequence"])
        
        if not operation_list:
            raise ValidationError("工艺路线没有工序序列，无法创建 SOP")
        
        # 获取工序信息
        operation_ids = [op["operation_id"] for op in operation_list]
        operations = await Operation.filter(
            id__in=operation_ids,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        ).all()
        operation_map = {op.id: op for op in operations}
        
        route_code = process_route.code or "ROUTE"
        route_tok = _sop_code_token(route_code, 36)
        route_name = (process_route.name or route_code).strip()

        mat_req = list(dict.fromkeys(data.material_uuids or []))
        grp_req = list(dict.fromkeys(data.material_group_uuids or []))
        if mat_req and grp_req:
            raise ValidationError("批量创建请只选择物料或只选择物料组，不能同时传入两类范围")

        materials: List[Material] = []
        groups: List[MaterialGroup] = []
        if mat_req:
            found_m = await Material.filter(
                tenant_id=tenant_id, uuid__in=mat_req, deleted_at__isnull=True
            ).all()
            by_mu = {str(m.uuid): m for m in found_m}
            missing_m = [u for u in mat_req if u not in by_mu]
            if missing_m:
                raise ValidationError(
                    f"以下物料不存在或已删除：{', '.join(missing_m[:5])}"
                    f"{'…' if len(missing_m) > 5 else ''}"
                )
            materials = [by_mu[u] for u in mat_req]
        if grp_req:
            found_g = await MaterialGroup.filter(
                tenant_id=tenant_id, uuid__in=grp_req, deleted_at__isnull=True
            ).all()
            by_gu = {str(g.uuid): g for g in found_g}
            missing_g = [u for u in grp_req if u not in by_gu]
            if missing_g:
                raise ValidationError(
                    f"以下物料组不存在或已删除：{', '.join(missing_g[:5])}"
                    f"{'…' if len(missing_g) > 5 else ''}"
                )
            groups = [by_gu[u] for u in grp_req]

        # 每个物料或每个物料组 × 每道工序 各生成一条 SOP；无绑定则为「通用」一条/道工序
        scopes: List[Tuple[str, Optional[Any]]] = []
        if materials:
            for m in materials:
                scopes.append(("material", m))
        elif groups:
            for g in groups:
                scopes.append(("group", g))
        else:
            scopes.append(("generic", None))

        created_sops: List[SOPResponse] = []
        used_codes: set = set()

        for scope_kind, entity in scopes:
            for op_data in operation_list:
                op_id = op_data["operation_id"]
                if op_id not in operation_map:
                    continue
                operation = operation_map[op_id]
                op_tok = _sop_code_token(operation.code or f"OP{op_id}", 36)

                mat_uuids_arg: Optional[List[str]] = None
                grp_uuids_arg: Optional[List[str]] = None
                bom_mode = "by_material"
                title_extra = ""
                scope_parts: List[str] = []

                if scope_kind == "material" and entity is not None:
                    mc = (getattr(entity, "main_code", None) or getattr(entity, "code", None) or str(entity.uuid))[:48]
                    scope_parts.append(f"M-{_sop_code_token(mc, 32)}")
                    mat_uuids_arg = [str(entity.uuid)]
                    bom_mode = "by_material"
                    title_extra = f"（{getattr(entity, 'name', '') or mc}｜{mc}）"
                elif scope_kind == "group" and entity is not None:
                    gc = (getattr(entity, "code", None) or str(entity.uuid))[:48]
                    scope_parts.append(f"G-{_sop_code_token(gc, 32)}")
                    grp_uuids_arg = [str(entity.uuid)]
                    bom_mode = "by_material_group"
                    title_extra = f"（{getattr(entity, 'name', '') or gc}｜{gc}）"

                code_parts = [route_tok, op_tok] + scope_parts
                base_code = _sop_code_join(code_parts, 100)

                code = base_code
                suffix = 0
                while code in used_codes or await SOP.filter(
                    tenant_id=tenant_id, code=code, deleted_at__isnull=True
                ).exists():
                    suffix += 1
                    suf = f"-{suffix}"
                    code = (base_code[: 100 - len(suf)] + suf)[:100]
                used_codes.add(code)

                op_display = operation.name or operation.code or str(op_id)
                base_name = f"{route_name} - {op_display}"
                name = _sop_name_truncate(base_name + title_extra)

                sop = await SOP.create(
                    tenant_id=tenant_id,
                    code=code,
                    name=name,
                    operation_id=op_id,
                    material_uuids=mat_uuids_arg,
                    material_group_uuids=grp_uuids_arg,
                    route_uuids=[data.process_route_uuid],
                    bom_load_mode=bom_mode,
                    is_active=True,
                )
                created_sops.append(SOPResponse.model_validate(sop))

        return created_sops
    
    @staticmethod
    async def get_sop_by_uuid(
        tenant_id: int,
        sop_uuid: str
    ) -> SOPResponse:
        """
        根据UUID获取作业程序（SOP）
        
        Args:
            tenant_id: 租户ID
            sop_uuid: SOP UUID
            
        Returns:
            SOPResponse: SOP对象
            
        Raises:
            NotFoundError: 当SOP不存在时抛出
        """
        sop = await SOP.filter(
            tenant_id=tenant_id,
            uuid=sop_uuid,
            deleted_at__isnull=True
        ).prefetch_related("operation").first()
        
        if not sop:
            raise NotFoundError(f"SOP {sop_uuid} 不存在")
        
        return SOPResponse.model_validate(sop)
    
    @staticmethod
    async def list_sops(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        operation_id: Optional[int] = None,
        is_active: Optional[bool] = None,
        material_uuid: Optional[str] = None,
        material_group_uuid: Optional[str] = None,
        route_uuid: Optional[str] = None,
        keyword: Optional[str] = None,
        sort_by: Optional[str] = None,
        sort_order: Optional[str] = None,
    ) -> Tuple[List[SOPResponse], int]:
        """
        获取作业程序（SOP）列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            operation_id: 工序ID（可选，用于过滤）
            is_active: 是否启用（可选）
            material_uuid: 物料UUID（可选，筛选绑定该物料的 SOP，JSONB 数组包含）
            material_group_uuid: 物料组UUID（可选，筛选绑定该物料组的 SOP）
            route_uuid: 工艺路线UUID（可选，筛选载入该工艺路线的 SOP）
            
        Returns:
            (SOP列表, 总条数)
        """
        query = SOP.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if operation_id is not None:
            query = query.filter(operation_id=operation_id)
        
        if is_active is not None:
            query = query.filter(is_active=is_active)
        
        if material_uuid:
            query = query.filter(material_uuids__contains=[material_uuid])
        if material_group_uuid:
            query = query.filter(material_group_uuids__contains=[material_group_uuid])
        if route_uuid:
            query = query.filter(route_uuids__contains=[route_uuid])

        if keyword and keyword.strip():
            kw = keyword.strip()
            query = query.filter(
                Q(code__icontains=kw)
                | Q(name__icontains=kw)
                | Q(version__icontains=kw)
                | Q(content__icontains=kw)
            )

        total = await query.count()
        allowed_sort = {"code", "name", "version", "created_at", "is_active", "operation_id"}
        field = sort_by if sort_by in allowed_sort else "code"
        desc = (sort_order or "asc").lower() == "desc"
        order_expr = f"-{field}" if desc else field

        sops = await query.offset(skip).limit(limit).order_by(order_expr).prefetch_related("operation").all()

        return [SOPResponse.model_validate(s) for s in sops], total
    
    @staticmethod
    async def update_sop(
        tenant_id: int,
        sop_uuid: str,
        data: SOPUpdate
    ) -> SOPResponse:
        """
        更新作业程序（SOP）
        
        Args:
            tenant_id: 租户ID
            sop_uuid: SOP UUID
            data: SOP更新数据
            
        Returns:
            SOPResponse: 更新后的SOP对象
            
        Raises:
            NotFoundError: 当SOP不存在时抛出
            ValidationError: 当编码已存在或工序不存在时抛出
        """
        sop = await SOP.filter(
            tenant_id=tenant_id,
            uuid=sop_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not sop:
            raise NotFoundError(f"SOP {sop_uuid} 不存在")
        
        # 如果更新工序ID，检查工序是否存在
        if data.operation_id is not None and data.operation_id != sop.operation_id:
            if data.operation_id:
                operation = await Operation.filter(
                    tenant_id=tenant_id,
                    id=data.operation_id,
                    deleted_at__isnull=True
                ).first()
                
                if not operation:
                    raise ValidationError(f"工序 {data.operation_id} 不存在")
        
        # 如果更新编码，检查是否已存在
        if data.code and data.code != sop.code:
            existing = await SOP.filter(
                tenant_id=tenant_id,
                code=data.code,
                deleted_at__isnull=True
            ).first()
            
            if existing:
                raise ValidationError(f"SOP编码 {data.code} 已存在")
        
        # 更新字段（含绑定与融合字段）
        update_data = data.model_dump(exclude_unset=True) if hasattr(data, "model_dump") else data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(sop, key, value)
        
        try:
            await sop.save()
        except IntegrityError as e:
            # 捕获数据库唯一约束错误，提供友好提示
            if "unique" in str(e).lower() or "duplicate" in str(e).lower():
                raise ValidationError(f"SOP编码 {data.code or sop.code} 已存在（可能已被软删除，请检查）")
            raise
        
        return SOPResponse.model_validate(sop)
    
    @staticmethod
    async def delete_sop(
        tenant_id: int,
        sop_uuid: str
    ) -> None:
        """
        删除作业程序（SOP）（软删除）
        
        Args:
            tenant_id: 租户ID
            sop_uuid: SOP UUID
            
        Raises:
            NotFoundError: 当SOP不存在时抛出
        """
        sop = await SOP.filter(
            tenant_id=tenant_id,
            uuid=sop_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not sop:
            raise NotFoundError(f"SOP {sop_uuid} 不存在")
        
        # 软删除
        from tortoise import timezone
        sop.deleted_at = timezone.now()
        await sop.save()

    @staticmethod
    async def get_sop_for_material(
        tenant_id: int,
        material_uuid: str,
        operation_uuid: Optional[str] = None,
    ) -> Optional[SOPResponse]:
        """
        按物料匹配 SOP，供工单/报工「以 SOP 为依据生成流程单据」使用。
        匹配规则：具体物料优先于物料组。
        """
        # 1) 优先：绑定该具体物料的 SOP
        q = SOP.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            is_active=True,
            material_uuids__contains=[material_uuid],
        )
        if operation_uuid:
            op = await Operation.filter(
                tenant_id=tenant_id, uuid=operation_uuid, deleted_at__isnull=True
            ).first()
            if op:
                q = q.filter(operation_id=op.id)
        sop = await q.order_by("code").prefetch_related("operation").first()
        if sop:
            return SOPResponse.model_validate(sop)
        # 2) 其次：绑定该物料所属物料组的 SOP
        from apps.master_data.models.material import Material, MaterialGroup
        material = await Material.filter(
            tenant_id=tenant_id, uuid=material_uuid, deleted_at__isnull=True
        ).first()
        if not material or not getattr(material, "group_id", None):
            return None
        group = await MaterialGroup.filter(
            id=material.group_id, tenant_id=tenant_id, deleted_at__isnull=True
        ).first()
        if not group:
            return None
        group_uuid = str(group.uuid)
        q2 = SOP.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            is_active=True,
            material_group_uuids__contains=[group_uuid],
        )
        if operation_uuid:
            op = await Operation.filter(
                tenant_id=tenant_id, uuid=operation_uuid, deleted_at__isnull=True
            ).first()
            if op:
                q2 = q2.filter(operation_id=op.id)
        sop2 = await q2.order_by("code").prefetch_related("operation").first()
        if sop2:
            return SOPResponse.model_validate(sop2)
        # 3) fallback：仅按工序匹配（兼容仅关联工序的 SOP）
        if operation_uuid:
            op = await Operation.filter(
                tenant_id=tenant_id, uuid=operation_uuid, deleted_at__isnull=True
            ).first()
            if op:
                q3 = SOP.filter(
                    tenant_id=tenant_id,
                    deleted_at__isnull=True,
                    is_active=True,
                    operation_id=op.id,
                )
                sop3 = await q3.order_by("code").prefetch_related("operation").first()
                return SOPResponse.model_validate(sop3) if sop3 else None
        return None

    @staticmethod
    async def get_sop_for_reporting(
        tenant_id: int,
        work_order_id: int,
        operation_id: int,
    ) -> Optional[SOPResponse]:
        """
        按工单+工序匹配 SOP，供报工使用。
        逻辑：取工单产品 -> 物料 UUID -> get_sop_for_material（含 fallback 仅工序）。
        """
        from apps.kuaizhizao.models.work_order import WorkOrder
        from apps.master_data.models.material import Material

        work_order = await WorkOrder.filter(
            id=work_order_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not work_order:
            return None

        product_id = work_order.product_id
        material = await Material.filter(
            id=product_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not material:
            # 工单产品无对应物料，fallback 仅按工序
            op = await Operation.filter(
                tenant_id=tenant_id, id=operation_id, deleted_at__isnull=True
            ).first()
            if not op:
                return None
            q = SOP.filter(
                tenant_id=tenant_id,
                deleted_at__isnull=True,
                is_active=True,
                operation_id=op.id,
            )
            sop = await q.order_by("code").prefetch_related("operation").first()
            return SOPResponse.model_validate(sop) if sop else None

        material_uuid = str(material.uuid)
        op = await Operation.filter(
            tenant_id=tenant_id, id=operation_id, deleted_at__isnull=True
        ).first()
        operation_uuid = str(op.uuid) if op else None

        return await ProcessService.get_sop_for_material(
            tenant_id, material_uuid, operation_uuid=operation_uuid
        )

    # ==================== 工艺路线版本管理相关方法 ====================
    
    @staticmethod
    async def create_process_route_version(
        tenant_id: int,
        process_route_code: str,
        data: ProcessRouteVersionCreate
    ) -> ProcessRouteResponse:
        """
        创建工艺路线新版本
        
        根据《工艺路线和标准作业流程优化设计规范.md》设计。
        
        Args:
            tenant_id: 租户ID
            process_route_code: 工艺路线编码
            data: 版本创建数据
            
        Returns:
            ProcessRouteResponse: 新创建的工艺路线版本对象
            
        Raises:
            NotFoundError: 当工艺路线不存在时抛出
            ValidationError: 当版本号已存在时抛出
        """
        from datetime import datetime
        import re
        
        # 获取当前最新版本的工艺路线
        current_route = await ProcessRoute.filter(
            tenant_id=tenant_id,
            code=process_route_code,
            deleted_at__isnull=True
        ).order_by("-version").first()
        
        if not current_route:
            raise NotFoundError(f"工艺路线 {process_route_code} 不存在")
        
        # 检查新版本号是否已存在
        existing_version = await ProcessRoute.filter(
            tenant_id=tenant_id,
            code=process_route_code,
            version=data.version,
            deleted_at__isnull=True
        ).first()
        
        if existing_version:
            raise ValidationError(f"版本号 '{data.version}' 已存在，请使用其他版本号")
        
        # 创建新版本的工艺路线（复制当前版本）
        new_route = await ProcessRoute.create(
            tenant_id=tenant_id,
            code=current_route.code,
            name=current_route.name,
            description=current_route.description,
            version=data.version,
            version_description=data.version_description,
            base_version=current_route.version,
            effective_date=data.effective_date or datetime.now(),
            operation_sequence=current_route.operation_sequence,
            is_active=current_route.is_active,
            over_report_mode=getattr(current_route, "over_report_mode", None) or "none",
            over_report_value=getattr(current_route, "over_report_value", None) or 0,
            allow_operation_jump=bool(getattr(current_route, "allow_operation_jump", False)),
        )
        
        return await ProcessService._to_process_route_response(new_route)
    
    @staticmethod
    async def get_process_route_versions(
        tenant_id: int,
        process_route_code: str
    ) -> List[ProcessRouteResponse]:
        """
        获取工艺路线的所有版本
        
        Args:
            tenant_id: 租户ID
            process_route_code: 工艺路线编码
            
        Returns:
            List[ProcessRouteResponse]: 版本列表（按版本号降序排列）
        """
        routes = await ProcessRoute.filter(
            tenant_id=tenant_id,
            code=process_route_code,
            deleted_at__isnull=True
        ).order_by("-version").all()
        
        result = []
        for r in routes:
            result.append(await ProcessService._to_process_route_response(r))
        return result
    
    @staticmethod
    async def compare_process_route_versions(
        tenant_id: int,
        process_route_code: str,
        data: ProcessRouteVersionCompare
    ) -> ProcessRouteVersionCompareResult:
        """
        对比工艺路线版本
        
        根据《工艺路线和标准作业流程优化设计规范.md》设计。
        
        Args:
            tenant_id: 租户ID
            process_route_code: 工艺路线编码
            data: 版本对比数据
            
        Returns:
            ProcessRouteVersionCompareResult: 版本对比结果
            
        Raises:
            NotFoundError: 当版本不存在时抛出
        """
        # 获取两个版本的工艺路线
        version1_route = await ProcessRoute.filter(
            tenant_id=tenant_id,
            code=process_route_code,
            version=data.version1,
            deleted_at__isnull=True
        ).first()
        
        version2_route = await ProcessRoute.filter(
            tenant_id=tenant_id,
            code=process_route_code,
            version=data.version2,
            deleted_at__isnull=True
        ).first()
        
        if not version1_route:
            raise NotFoundError(f"工艺路线 {process_route_code} 版本 {data.version1} 不存在")
        if not version2_route:
            raise NotFoundError(f"工艺路线 {process_route_code} 版本 {data.version2} 不存在")
        
        # 解析工序序列
        seq1 = version1_route.operation_sequence or {}
        seq2 = version2_route.operation_sequence or {}
        
        # 提取工序ID列表（保持顺序）
        ops1 = seq1.get("operations", []) if isinstance(seq1, dict) else []
        ops2 = seq2.get("operations", []) if isinstance(seq2, dict) else []
        
        # 构建工序ID到索引的映射
        ops1_map = {op.get("uuid") or op.get("id"): idx for idx, op in enumerate(ops1) if op}
        ops2_map = {op.get("uuid") or op.get("id"): idx for idx, op in enumerate(ops2) if op}
        
        # 找出差异
        added_operations = []
        removed_operations = []
        modified_operations = []
        sequence_changes = []
        
        # 检查版本2中新增或修改的工序
        for idx2, op2 in enumerate(ops2):
            op_id = op2.get("uuid") or op2.get("id")
            if op_id not in ops1_map:
                # 新增工序
                added_operations.append({
                    "operation": op2,
                    "position": idx2 + 1,
                })
            else:
                # 检查是否修改或位置变化
                idx1 = ops1_map[op_id]
                op1 = ops1[idx1]
                
                # 检查位置是否变化
                if idx1 != idx2:
                    sequence_changes.append({
                        "operation": op2,
                        "old_position": idx1 + 1,
                        "new_position": idx2 + 1,
                    })
                
                # 检查工序配置是否变化（如果有其他配置字段）
                if op1 != op2:
                    changes = {}
                    for key in set(list(op1.keys()) + list(op2.keys())):
                        if op1.get(key) != op2.get(key):
                            changes[key] = {
                                "old": op1.get(key),
                                "new": op2.get(key),
                            }
                    if changes:
                        modified_operations.append({
                            "operation": op2,
                            "changes": changes,
                        })
        
        # 检查版本1中删除的工序
        for idx1, op1 in enumerate(ops1):
            op_id = op1.get("uuid") or op1.get("id")
            if op_id not in ops2_map:
                removed_operations.append({
                    "operation": op1,
                    "old_position": idx1 + 1,
                })
        
        return ProcessRouteVersionCompareResult(
            version1=data.version1,
            version2=data.version2,
            added_operations=added_operations,
            removed_operations=removed_operations,
            modified_operations=modified_operations,
            sequence_changes=sequence_changes,
        )
    
    @staticmethod
    async def rollback_process_route_version(
        tenant_id: int,
        process_route_code: str,
        target_version: str,
        new_version: Optional[str] = None
    ) -> ProcessRouteResponse:
        """
        回退工艺路线到指定版本
        
        根据《工艺路线和标准作业流程优化设计规范.md》设计。
        回退时创建新版本，内容与目标版本相同，保留历史记录。
        
        Args:
            tenant_id: 租户ID
            process_route_code: 工艺路线编码
            target_version: 目标版本（要回退到的版本）
            new_version: 新版本号（可选，如果不提供则自动生成）
            
        Returns:
            ProcessRouteResponse: 新创建的工艺路线版本对象（内容与目标版本相同）
            
        Raises:
            NotFoundError: 当目标版本不存在时抛出
            ValidationError: 当新版本号已存在时抛出
        """
        from datetime import datetime
        import re
        
        # 获取目标版本的工艺路线
        target_route = await ProcessRoute.filter(
            tenant_id=tenant_id,
            code=process_route_code,
            version=target_version,
            deleted_at__isnull=True
        ).first()
        
        if not target_route:
            raise NotFoundError(f"工艺路线 {process_route_code} 版本 {target_version} 不存在")
        
        # 如果没有提供新版本号，自动生成
        if not new_version:
            # 获取当前最新版本
            current_route = await ProcessRoute.filter(
                tenant_id=tenant_id,
                code=process_route_code,
                deleted_at__isnull=True
            ).order_by("-version").first()
            
            if current_route:
                current_version = current_route.version or "1.0"
                version_match = re.match(r'^v?(\d+)\.(\d+)$', current_version) if isinstance(current_version, str) else None
                if version_match:
                    major = int(version_match.group(1))
                    minor = int(version_match.group(2))
                    new_version = f"v{major}.{minor + 1}"
                else:
                    new_version = f"{current_version}.1"
            else:
                new_version = "v1.1"
        
        # 检查新版本号是否已存在
        existing_version = await ProcessRoute.filter(
            tenant_id=tenant_id,
            code=process_route_code,
            version=new_version,
            deleted_at__isnull=True
        ).first()
        
        if existing_version:
            raise ValidationError(f"版本号 '{new_version}' 已存在，请使用其他版本号")
        
        # 创建新版本的工艺路线（内容与目标版本相同）
        new_route = await ProcessRoute.create(
            tenant_id=tenant_id,
            code=target_route.code,
            name=target_route.name,
            description=target_route.description,
            version=new_version,
            version_description=f"回退到版本 {target_version}",
            base_version=target_version,
            effective_date=datetime.now(),
            operation_sequence=target_route.operation_sequence,
            is_active=target_route.is_active,
            over_report_mode=getattr(target_route, "over_report_mode", None) or "none",
            over_report_value=getattr(target_route, "over_report_value", None) or 0,
            allow_operation_jump=bool(getattr(target_route, "allow_operation_jump", False)),
        )
        
        return await ProcessService._to_process_route_response(new_route)
    
    # ==================== 工艺路线绑定管理相关方法 ====================
    
    @staticmethod
    async def bind_material_group(
        tenant_id: int,
        process_route_uuid: str,
        material_group_uuid: str
    ) -> None:
        """
        绑定工艺路线到物料分组
        
        根据《工艺路线和标准作业流程优化设计规范.md》设计。
        
        Args:
            tenant_id: 租户ID
            process_route_uuid: 工艺路线UUID
            material_group_uuid: 物料分组UUID
            
        Raises:
            NotFoundError: 当工艺路线或物料分组不存在时抛出
        """
        from apps.master_data.models.material import MaterialGroup
        
        # 获取工艺路线
        process_route = await ProcessRoute.filter(
            tenant_id=tenant_id,
            uuid=process_route_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not process_route:
            raise NotFoundError(f"工艺路线 {process_route_uuid} 不存在")
        
        # 获取物料分组
        material_group = await MaterialGroup.filter(
            tenant_id=tenant_id,
            uuid=material_group_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not material_group:
            raise NotFoundError(f"物料分组 {material_group_uuid} 不存在")
        
        # 绑定工艺路线到物料分组
        material_group.process_route_id = process_route.id
        await material_group.save()
    
    @staticmethod
    async def unbind_material_group(
        tenant_id: int,
        material_group_uuid: str
    ) -> None:
        """
        解绑物料分组的工艺路线
        
        Args:
            tenant_id: 租户ID
            material_group_uuid: 物料分组UUID
            
        Raises:
            NotFoundError: 当物料分组不存在时抛出
        """
        from apps.master_data.models.material import MaterialGroup
        
        # 获取物料分组
        material_group = await MaterialGroup.filter(
            tenant_id=tenant_id,
            uuid=material_group_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not material_group:
            raise NotFoundError(f"物料分组 {material_group_uuid} 不存在")
        
        # 解绑工艺路线
        material_group.process_route_id = None
        await material_group.save()
    
    @staticmethod
    async def bind_material(
        tenant_id: int,
        process_route_uuid: str,
        material_uuid: str
    ) -> None:
        """
        绑定工艺路线到物料
        
        根据《工艺路线和标准作业流程优化设计规范.md》设计。
        物料绑定优先级高于物料分组绑定。
        
        Args:
            tenant_id: 租户ID
            process_route_uuid: 工艺路线UUID
            material_uuid: 物料UUID
            
        Raises:
            NotFoundError: 当工艺路线或物料不存在时抛出
        """
        from apps.master_data.models.material import Material
        
        # 获取工艺路线
        process_route = await ProcessRoute.filter(
            tenant_id=tenant_id,
            uuid=process_route_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not process_route:
            raise NotFoundError(f"工艺路线 {process_route_uuid} 不存在")
        
        # 获取物料
        material = await Material.filter(
            tenant_id=tenant_id,
            uuid=material_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not material:
            raise NotFoundError(f"物料 {material_uuid} 不存在")
        
        # 绑定工艺路线到物料
        material.process_route_id = process_route.id
        await material.save()
    
    @staticmethod
    async def unbind_material(
        tenant_id: int,
        material_uuid: str
    ) -> None:
        """
        解绑物料的工艺路线
        
        Args:
            tenant_id: 租户ID
            material_uuid: 物料UUID
            
        Raises:
            NotFoundError: 当物料不存在时抛出
        """
        from apps.master_data.models.material import Material
        
        # 获取物料
        material = await Material.filter(
            tenant_id=tenant_id,
            uuid=material_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not material:
            raise NotFoundError(f"物料 {material_uuid} 不存在")
        
        # 解绑工艺路线
        material.process_route_id = None
        await material.save()
    
    @staticmethod
    async def _process_route_from_material_defaults(
        tenant_id: int, material
    ) -> Optional[ProcessRoute]:
        """物料 defaults 中的默认工艺路线（与表单写入的 defaultProcessRoute* 一致）。"""
        raw = getattr(material, "defaults", None)
        if isinstance(raw, str):
            try:
                raw = json.loads(raw.strip() or "null")
            except (json.JSONDecodeError, TypeError):
                raw = None
        if not isinstance(raw, dict):
            return None
        d = raw
        rid = d.get("defaultProcessRoute") or d.get("default_process_route")
        if rid is not None:
            try:
                pr = await ProcessRoute.filter(
                    id=int(rid),
                    tenant_id=tenant_id,
                    deleted_at__isnull=True,
                    is_active=True,
                ).first()
                if pr:
                    return pr
            except (TypeError, ValueError):
                pass
        u = d.get("defaultProcessRouteUuid") or d.get("default_process_route_uuid")
        if u:
            return await ProcessRoute.filter(
                uuid=str(u),
                tenant_id=tenant_id,
                deleted_at__isnull=True,
                is_active=True,
            ).first()
        return None

    @staticmethod
    async def get_process_route_for_material(
        tenant_id: int,
        material_uuid: str
    ) -> Optional[ProcessRouteResponse]:
        """
        获取物料匹配的工艺路线。

        优先级：产品工艺指派 > 物料 FK/defaults > 物料分组 > source_config。
        """
        from apps.master_data.models.material import Material
        from apps.master_data.services.material_product_process_service import (
            MaterialProductProcessService,
        )

        material = await Material.filter(
            tenant_id=tenant_id,
            uuid=material_uuid,
            deleted_at__isnull=True,
        ).first()

        if not material:
            raise NotFoundError(f"物料 {material_uuid} 不存在")

        process_route = await MaterialProductProcessService.resolve_process_route_for_material(
            tenant_id, material.id
        )
        if process_route:
            return await ProcessService._to_process_route_response(process_route)

        return None
    
    @staticmethod
    async def get_process_route_for_material_group(
        tenant_id: int,
        material_group_uuid: str
    ) -> Optional[ProcessRouteResponse]:
        """
        获取物料组匹配的工艺路线
        
        物料组通过 process_route_id 直接绑定工艺路线。
        
        Args:
            tenant_id: 租户ID
            material_group_uuid: 物料组UUID
            
        Returns:
            Optional[ProcessRouteResponse]: 匹配的工艺路线，如果没有则返回None
        """
        from apps.master_data.models.material import MaterialGroup
        
        material_group = await MaterialGroup.filter(
            tenant_id=tenant_id,
            uuid=material_group_uuid,
            deleted_at__isnull=True
        ).prefetch_related("process_route").first()
        
        if not material_group:
            raise NotFoundError(f"物料组 {material_group_uuid} 不存在")
        
        if material_group.process_route_id:
            process_route = await ProcessRoute.filter(
                id=material_group.process_route_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
                is_active=True
            ).first()
            if process_route:
                return await ProcessService._to_process_route_response(process_route)
        
        return None
    
    @staticmethod
    async def get_bound_materials(
        tenant_id: int,
        process_route_uuid: str
    ) -> Dict[str, Any]:
        """
        获取工艺路线绑定的物料和物料分组
        
        Args:
            tenant_id: 租户ID
            process_route_uuid: 工艺路线UUID
            
        Returns:
            Dict[str, Any]: 包含绑定的物料列表和物料分组列表
        """
        from apps.master_data.models.material import Material, MaterialGroup
        
        # 获取工艺路线
        process_route = await ProcessRoute.filter(
            tenant_id=tenant_id,
            uuid=process_route_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not process_route:
            raise NotFoundError(f"工艺路线 {process_route_uuid} 不存在")
        
        # 获取绑定的物料
        materials = await Material.filter(
            tenant_id=tenant_id,
            process_route_id=process_route.id,
            deleted_at__isnull=True
        ).all()
        
        # 获取绑定的物料分组
        material_groups = await MaterialGroup.filter(
            tenant_id=tenant_id,
            process_route_id=process_route.id,
            deleted_at__isnull=True
        ).all()
        
        return {
            "materials": [
                {
                    "uuid": m.uuid,
                    "code": m.main_code,
                    "name": m.name,
                }
                for m in materials
            ],
            "material_groups": [
                {
                    "uuid": mg.uuid,
                    "code": mg.code,
                    "name": mg.name,
                }
                for mg in material_groups
            ],
        }
    
    # ==================== 子工艺路线管理相关方法 ====================
    
    @staticmethod
    async def create_sub_route(
        tenant_id: int,
        parent_route_uuid: str,
        parent_operation_uuid: str,
        data: ProcessRouteCreate
    ) -> ProcessRouteResponse:
        """
        创建子工艺路线
        
        根据《工艺路线和标准作业流程优化设计规范.md》设计。
        
        Args:
            tenant_id: 租户ID
            parent_route_uuid: 父工艺路线UUID
            parent_operation_uuid: 父工序UUID（此子工艺路线所属的父工序）
            data: 子工艺路线创建数据
            
        Returns:
            ProcessRouteResponse: 创建的子工艺路线对象
            
        Raises:
            NotFoundError: 当父工艺路线或父工序不存在时抛出
            ValidationError: 当嵌套层级超过3层时抛出
        """
        # 获取父工艺路线
        parent_route = await ProcessRoute.filter(
            tenant_id=tenant_id,
            uuid=parent_route_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not parent_route:
            raise NotFoundError(f"父工艺路线 {parent_route_uuid} 不存在")
        
        # 检查嵌套层级
        parent_level = parent_route.level or 0
        if parent_level >= 3:
            raise ValidationError("嵌套层级不能超过3层（最多支持3层嵌套）")
        
        # 验证父工序是否存在（在父工艺路线的工序序列中）
        if parent_route.operation_sequence:
            operations = []
            if isinstance(parent_route.operation_sequence, dict):
                operations = parent_route.operation_sequence.get("operations", [])
            elif isinstance(parent_route.operation_sequence, list):
                operations = parent_route.operation_sequence
            
            operation_found = False
            for op in operations:
                if isinstance(op, dict):
                    if op.get("uuid") == parent_operation_uuid or op.get("operation_uuid") == parent_operation_uuid:
                        operation_found = True
                        break
                elif isinstance(op, str) and op == parent_operation_uuid:
                    operation_found = True
                    break
            
            if not operation_found:
                raise NotFoundError(f"父工序 {parent_operation_uuid} 在父工艺路线中不存在")
        
        # 创建子工艺路线
        route_data = data.dict(exclude={'parent_route_uuid'})
        route_data['parent_route_id'] = parent_route.id
        route_data['parent_operation_uuid'] = parent_operation_uuid
        route_data['level'] = parent_level + 1
        
        if 'version' not in route_data or not route_data.get('version'):
            route_data['version'] = "1.0"
        
        sub_route = await ProcessRoute.create(
            tenant_id=tenant_id,
            **route_data
        )
        
        return await ProcessService._to_process_route_response(sub_route)
    
    @staticmethod
    async def get_sub_routes(
        tenant_id: int,
        parent_route_uuid: str,
        parent_operation_uuid: Optional[str] = None
    ) -> List[ProcessRouteResponse]:
        """
        获取子工艺路线列表
        
        Args:
            tenant_id: 租户ID
            parent_route_uuid: 父工艺路线UUID
            parent_operation_uuid: 父工序UUID（可选，如果提供则只返回该工序的子工艺路线）
            
        Returns:
            List[ProcessRouteResponse]: 子工艺路线列表
        """
        # 获取父工艺路线
        parent_route = await ProcessRoute.filter(
            tenant_id=tenant_id,
            uuid=parent_route_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not parent_route:
            raise NotFoundError(f"父工艺路线 {parent_route_uuid} 不存在")
        
        # 查询子工艺路线
        query = ProcessRoute.filter(
            tenant_id=tenant_id,
            parent_route_id=parent_route.id,
            deleted_at__isnull=True
        )
        
        if parent_operation_uuid:
            query = query.filter(parent_operation_uuid=parent_operation_uuid)
        
        sub_routes = await query.order_by("code").all()
        
        result = []
        for r in sub_routes:
            result.append(await ProcessService._to_process_route_response(r))
        return result
    
    @staticmethod
    async def delete_sub_route(
        tenant_id: int,
        sub_route_uuid: str
    ) -> None:
        """
        删除子工艺路线（软删除）
        
        Args:
            tenant_id: 租户ID
            sub_route_uuid: 子工艺路线UUID
            
        Raises:
            NotFoundError: 当子工艺路线不存在时抛出
        """
        sub_route = await ProcessRoute.filter(
            tenant_id=tenant_id,
            uuid=sub_route_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not sub_route:
            raise NotFoundError(f"子工艺路线 {sub_route_uuid} 不存在")
        
        # 检查是否有嵌套子工艺路线
        nested_sub_routes = await ProcessRoute.filter(
            tenant_id=tenant_id,
            parent_route_id=sub_route.id,
            deleted_at__isnull=True
        ).count()
        
        if nested_sub_routes > 0:
            raise ValidationError(f"无法删除：此子工艺路线下还有 {nested_sub_routes} 个嵌套子工艺路线，请先删除嵌套子工艺路线")
        
        # 软删除
        from tortoise import timezone
        sub_route.deleted_at = timezone.now()
        await sub_route.save()

    # ==================== 工艺路线模板管理相关方法 ====================

    async def create_process_route_template(
        self,
        tenant_id: int,
        template_data: ProcessRouteTemplateCreate,
        created_by: int
    ) -> ProcessRouteTemplateResponse:
        """
        创建工艺路线模板
        
        Args:
            tenant_id: 组织ID
            template_data: 模板创建数据
            created_by: 创建人ID
            
        Returns:
            ProcessRouteTemplateResponse: 创建的模板对象
        """
        # 检查编码是否已存在
        existing = await ProcessRouteTemplate.filter(
            tenant_id=tenant_id,
            code=template_data.code,
            version=template_data.version,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"模板编码 {template_data.code} 版本 {template_data.version} 已存在")
        
        # 创建模板
        template = await ProcessRouteTemplate.create(
            tenant_id=tenant_id,
            **template_data.dict()
        )
        
        return ProcessRouteTemplateResponse.model_validate(template)

    async def list_process_route_templates(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        category: Optional[str] = None,
        is_active: Optional[bool] = None
    ) -> List[ProcessRouteTemplateResponse]:
        """
        获取工艺路线模板列表
        
        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            category: 模板分类
            is_active: 是否启用
            
        Returns:
            List[ProcessRouteTemplateResponse]: 模板列表
        """
        query = ProcessRouteTemplate.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if category:
            query = query.filter(category=category)
        
        if is_active is not None:
            query = query.filter(is_active=is_active)
        
        templates = await query.order_by("-created_at").offset(skip).limit(limit).all()
        
        return [ProcessRouteTemplateResponse.model_validate(t) for t in templates]

    async def get_process_route_template(
        self,
        tenant_id: int,
        template_uuid: str
    ) -> ProcessRouteTemplateResponse:
        """
        获取工艺路线模板详情
        
        Args:
            tenant_id: 组织ID
            template_uuid: 模板UUID
            
        Returns:
            ProcessRouteTemplateResponse: 模板对象
            
        Raises:
            NotFoundError: 当模板不存在时抛出
        """
        template = await ProcessRouteTemplate.filter(
            tenant_id=tenant_id,
            uuid=template_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not template:
            raise NotFoundError(f"工艺路线模板 {template_uuid} 不存在")
        
        return ProcessRouteTemplateResponse.model_validate(template)

    async def create_process_route_from_template(
        self,
        tenant_id: int,
        route_data: ProcessRouteFromTemplateCreate,
        created_by: int
    ) -> ProcessRouteResponse:
        """
        基于模板创建工艺路线
        
        Args:
            tenant_id: 组织ID
            route_data: 工艺路线创建数据（包含template_uuid）
            created_by: 创建人ID
            
        Returns:
            ProcessRouteResponse: 创建的工艺路线对象
        """
        # 获取模板
        template = await ProcessRouteTemplate.filter(
            tenant_id=tenant_id,
            uuid=route_data.template_uuid,
            deleted_at__isnull=True,
            is_active=True
        ).first()
        
        if not template:
            raise NotFoundError(f"工艺路线模板 {route_data.template_uuid} 不存在或已禁用")
        
        # 从模板配置创建工艺路线
        template_config = template.process_route_config or {}
        
        route_create_data = ProcessRouteCreate(
            code=route_data.code,
            name=route_data.name,
            description=route_data.description,
            is_active=route_data.is_active,
            operation_sequence=template_config.get("operation_sequence"),
            version="1.0",
            allow_operation_jump=bool(template_config.get("allow_operation_jump", template_config.get("allowOperationJump", False))),
        )
        
        # 创建工艺路线
        return await self.create_process_route(tenant_id, route_create_data, created_by)
