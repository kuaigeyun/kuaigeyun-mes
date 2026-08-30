"""主数据关联同步编排：先跑独立同步服务，再执行业务 upsert。"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from infra.exceptions.exceptions import ValidationError
from infra.models.user import User
from tortoise.expressions import Q

from apps.common.audit_actor import apply_create_audit, apply_update_audit
from apps.master_data.models.customer import Customer
from apps.master_data.models.material import Material, MaterialGroup
from apps.master_data.models.master_data_sync_binding import (
    CustomerSyncBinding,
    MaterialSyncBinding,
    SupplierSyncBinding,
)
from apps.master_data.models.supplier import Supplier
from apps.master_data.models.unit import MaterialUnit
from apps.master_data.schemas.master_data_sync import (
    MasterDataSyncFromSourceOut,
    MasterDataSyncFromSourceRequest,
)
from apps.master_data.services.customer_sync_service import CustomerSyncService
from apps.master_data.services.material_group_sync_service import MaterialGroupSyncService
from apps.master_data.services.master_data_sync_common import cell_str
from apps.master_data.services.supplier_sync_service import SupplierSyncService
from apps.master_data.services.unit_sync_service import MaterialUnitSyncService
from apps.kuaizhizao.models.sales_order import SalesOrder
from apps.kuaizhizao.models.sales_order_sync_binding import SalesOrderSyncBinding

# 客户/供应商/物料：单据前置按成功水位增量（无水位仍全量）；禁止每次硬全量重扫
_PREREQUISITE_SYNC_REQUEST = MasterDataSyncFromSourceRequest(
    incremental=True,
    active_only=True,
)
# 单位/物料分组体量小，仍全量，避免物料增量行引用到未变更的旧分组缺失
_MASTER_DEP_FULL_SYNC_REQUEST = MasterDataSyncFromSourceRequest(
    incremental=False,
    active_only=True,
)
# 物料与客商同策略：有水位增量，缺码时由单据同步显式报错，再去主数据页全量补齐
_MATERIAL_PREREQUISITE_SYNC_REQUEST = MasterDataSyncFromSourceRequest(
    incremental=True,
    active_only=True,
)


def _merge_prerequisite_errors(
    label: str,
    result: MasterDataSyncFromSourceOut,
) -> List[str]:
    errors: List[str] = []
    if result.failed:
        errors.extend(f"[{label}] {item}" for item in result.errors)
    return errors


async def run_material_prerequisite_syncs(
    tenant_id: int,
    current_user: User,
) -> List[str]:
    """物料同步前：按已保存绑定依次全量同步单位、物料分组。"""
    errors: List[str] = []
    unit_service = MaterialUnitSyncService()
    if await unit_service.has_binding(tenant_id):
        unit_result = await unit_service.sync_from_source(
            tenant_id, current_user, _MASTER_DEP_FULL_SYNC_REQUEST
        )
        errors.extend(_merge_prerequisite_errors("单位同步", unit_result))

    group_service = MaterialGroupSyncService()
    if await group_service.has_binding(tenant_id):
        group_result = await group_service.sync_from_source(
            tenant_id, current_user, _MASTER_DEP_FULL_SYNC_REQUEST
        )
        errors.extend(_merge_prerequisite_errors("物料分组同步", group_result))

    return errors


async def run_sales_order_prerequisite_syncs(
    tenant_id: int,
    current_user: User,
) -> List[str]:
    """销售订单同步前：客户（增量）→ 单位/分组（全量）→ 物料（增量）。"""
    errors: List[str] = []

    customer_binding = await CustomerSyncBinding.filter(tenant_id=tenant_id).first()
    if customer_binding and (customer_binding.source_type or "").strip():
        customer_result = await CustomerSyncService().sync_from_source(
            tenant_id, current_user, _PREREQUISITE_SYNC_REQUEST
        )
        errors.extend(_merge_prerequisite_errors("客户同步", customer_result))

    material_binding = await MaterialSyncBinding.filter(tenant_id=tenant_id).first()
    if material_binding and (material_binding.source_type or "").strip():
        from apps.master_data.services.material_sync_service import MaterialSyncService

        errors.extend(await run_material_prerequisite_syncs(tenant_id, current_user))
        material_result = await MaterialSyncService().sync_from_source(
            tenant_id,
            current_user,
            _MATERIAL_PREREQUISITE_SYNC_REQUEST,
            skip_prerequisite_syncs=True,
        )
        errors.extend(_merge_prerequisite_errors("物料同步", material_result))

    return errors


async def run_purchase_order_prerequisite_syncs(
    tenant_id: int,
    current_user: User,
) -> List[str]:
    """采购订单同步前：供应商（增量）→ 单位/分组（全量）→ 物料（增量）。"""
    errors: List[str] = []

    supplier_binding = await SupplierSyncBinding.filter(tenant_id=tenant_id).first()
    if supplier_binding and (supplier_binding.source_type or "").strip():
        supplier_result = await SupplierSyncService().sync_from_source(
            tenant_id, current_user, _PREREQUISITE_SYNC_REQUEST
        )
        errors.extend(_merge_prerequisite_errors("供应商同步", supplier_result))

    material_binding = await MaterialSyncBinding.filter(tenant_id=tenant_id).first()
    if material_binding and (material_binding.source_type or "").strip():
        from apps.master_data.services.material_sync_service import MaterialSyncService

        errors.extend(await run_material_prerequisite_syncs(tenant_id, current_user))
        material_result = await MaterialSyncService().sync_from_source(
            tenant_id,
            current_user,
            _MATERIAL_PREREQUISITE_SYNC_REQUEST,
            skip_prerequisite_syncs=True,
        )
        errors.extend(_merge_prerequisite_errors("物料同步", material_result))

    return errors


async def run_work_order_prerequisite_syncs(
    tenant_id: int,
    current_user: User,
) -> List[str]:
    """生产工单同步前：单位/分组（全量）→ 物料（增量）→ 销售订单。"""
    errors: List[str] = []

    material_binding = await MaterialSyncBinding.filter(tenant_id=tenant_id).first()
    if material_binding and (material_binding.source_type or "").strip():
        from apps.master_data.services.material_sync_service import MaterialSyncService

        errors.extend(await run_material_prerequisite_syncs(tenant_id, current_user))
        material_result = await MaterialSyncService().sync_from_source(
            tenant_id,
            current_user,
            _MATERIAL_PREREQUISITE_SYNC_REQUEST,
            skip_prerequisite_syncs=True,
        )
        errors.extend(_merge_prerequisite_errors("物料同步", material_result))

    sales_order_binding = await SalesOrderSyncBinding.filter(tenant_id=tenant_id).first()
    if sales_order_binding and (sales_order_binding.source_type or "").strip():
        from apps.kuaizhizao.schemas.sales_order_sync import SalesOrderSyncFromSourceRequest
        from apps.kuaizhizao.services.sales_order_sync_service import SalesOrderSyncService

        sales_order_result = await SalesOrderSyncService().sync_from_source(
            tenant_id,
            int(current_user.id),
            SalesOrderSyncFromSourceRequest(
                skip_prerequisite_syncs=True,
                incremental=True,
            ),
        )
        if sales_order_result.failed:
            errors.extend(f"[销售订单同步] {item}" for item in sales_order_result.errors)

    return errors


async def find_material_by_code(tenant_id: int, material_code: str) -> Optional[Material]:
    code = cell_str(material_code)
    if not code:
        return None
    return await Material.filter(
        tenant_id=tenant_id,
        deleted_at__isnull=True,
    ).filter(Q(main_code=code) | Q(code=code)).first()


async def resolve_material_base_unit(
    tenant_id: int,
    unit_code: str = "",
    unit_name: str = "",
) -> str:
    """
    将外部单位解析为本地 MaterialUnit.code（物料/单据真源）。

    金蝶常见 FNumber=001、FName=吨；本系统预设编码为「吨」。
    有名称时优先按名称对齐本地单位，避免把金蝶内部编码写入物料。
    """
    code = cell_str(unit_code)
    name = cell_str(unit_name)
    if not code and not name:
        raise ValidationError("基础单位编码不能为空")

    async def _by_code(value: str) -> Optional[MaterialUnit]:
        return await MaterialUnit.filter(
            tenant_id=tenant_id,
            code=value,
            deleted_at__isnull=True,
        ).first()

    async def _by_name(value: str) -> Optional[MaterialUnit]:
        rows = await MaterialUnit.filter(
            tenant_id=tenant_id,
            name=value,
            deleted_at__isnull=True,
        ).all()
        if not rows:
            return None
        # 同名多条时优先 code==name（系统预设「吨」），避免命中金蝶 FNumber=001
        for row in rows:
            if row.code == row.name:
                return row
        return rows[0]

    unit: Optional[MaterialUnit] = None
    if name:
        unit = await _by_name(name) or await _by_code(name)
    if unit is None and code:
        unit = await _by_code(code) or await _by_name(code)
    if not unit:
        label = name or code
        raise ValidationError(
            f"基础单位 {label} 不存在，请先在单位管理加载预设或完成单位同步"
            "（金蝶请将单位编码映射到名称，或同时映射基础单位名称）"
        )
    return unit.code


async def resolve_material_unit_code(tenant_id: int, unit_code: str) -> str:
    """兼容旧调用：仅编码解析。"""
    return await resolve_material_base_unit(tenant_id, unit_code=unit_code)


async def resolve_material_group_id(tenant_id: int, group_code: str) -> int:
    code = cell_str(group_code)
    if not code:
        raise ValidationError("物料分组编码不能为空")
    group = await MaterialGroup.filter(
        tenant_id=tenant_id,
        code=code,
        deleted_at__isnull=True,
    ).first()
    if not group:
        raise ValidationError(
            f"物料分组 {code} 不存在，请先在物料分组同步中完成同步"
        )
    return group.id


async def load_material_unit_lookup(
    tenant_id: int,
) -> Tuple[Dict[str, MaterialUnit], Dict[str, List[MaterialUnit]]]:
    """一次加载租户单位，供物料批量同步内存解析。"""
    rows = await MaterialUnit.filter(
        tenant_id=tenant_id,
        deleted_at__isnull=True,
    ).all()
    by_code = {row.code: row for row in rows if row.code}
    by_name: Dict[str, List[MaterialUnit]] = {}
    for row in rows:
        if not row.name:
            continue
        by_name.setdefault(row.name, []).append(row)
    return by_code, by_name


def resolve_material_base_unit_from_lookup(
    by_code: Dict[str, MaterialUnit],
    by_name: Dict[str, List[MaterialUnit]],
    unit_code: str = "",
    unit_name: str = "",
) -> str:
    """与 resolve_material_base_unit 相同规则，走内存映射，避免逐条查库。"""
    code = cell_str(unit_code)
    name = cell_str(unit_name)
    if not code and not name:
        raise ValidationError("基础单位编码不能为空")

    def _pick_by_name(value: str) -> Optional[MaterialUnit]:
        rows = by_name.get(value) or []
        if not rows:
            return None
        for row in rows:
            if row.code == row.name:
                return row
        return rows[0]

    unit: Optional[MaterialUnit] = None
    if name:
        unit = _pick_by_name(name) or by_code.get(name)
    if unit is None and code:
        unit = by_code.get(code) or _pick_by_name(code)
    if not unit:
        label = name or code
        raise ValidationError(
            f"基础单位 {label} 不存在，请先在单位管理加载预设或完成单位同步"
            "（金蝶请将单位编码映射到名称，或同时映射基础单位名称）"
        )
    return unit.code


async def load_material_group_id_lookup(tenant_id: int) -> Dict[str, int]:
    """一次加载租户物料分组 code→id。"""
    rows = await MaterialGroup.filter(
        tenant_id=tenant_id,
        deleted_at__isnull=True,
    ).all()
    return {row.code: row.id for row in rows if row.code}


def resolve_material_group_id_from_lookup(
    group_by_code: Dict[str, int],
    group_code: str,
) -> int:
    code = cell_str(group_code)
    if not code:
        raise ValidationError("物料分组编码不能为空")
    group_id = group_by_code.get(code)
    if group_id is None:
        raise ValidationError(
            f"物料分组 {code} 不存在，请先在物料分组同步中完成同步"
        )
    return group_id


async def ensure_material_groups_from_material_rows(
    tenant_id: int,
    current_user: Optional[User],
    *,
    group_by_code: Dict[str, int],
    group_pairs: List[tuple[str, str]],
) -> Dict[str, int]:
    """
    用物料行上的分组编码/名称补齐本地物料分组。

    金蝶物料查询自带 FMaterialGroup.FNumber/FName；分组接口若因 FieldKeys 失败拉空时，
    仍须能用物料载荷落分组，避免上万条「分组不存在」。
    """
    pending: Dict[str, str] = {}
    for code_raw, name_raw in group_pairs:
        code = cell_str(code_raw)
        name = cell_str(name_raw)
        if not code:
            continue
        if code in group_by_code:
            continue
        # 无名称时用编码占位名称，保证可落库（名称可随后在分组同步中更新）
        pending[code] = name or code

    if not pending:
        return group_by_code

    for code, name in pending.items():
        existing = await MaterialGroup.filter(
            tenant_id=tenant_id,
            code=code,
            deleted_at__isnull=True,
        ).first()
        if existing:
            if name and existing.name != name:
                existing.name = name
                apply_update_audit(existing, current_user)
                await existing.save(update_fields=["name", "updated_at", "updated_by", "updated_by_name"])
            group_by_code[code] = existing.id
            continue
        payload: Dict[str, Any] = {
            "code": code,
            "name": name,
            "is_active": True,
        }
        apply_create_audit(payload, current_user)
        group = await MaterialGroup.create(tenant_id=tenant_id, **payload)
        group_by_code[code] = group.id

    return group_by_code


async def resolve_customer_by_header(
    tenant_id: int,
    *,
    customer_id: object = None,
    customer_code: str = "",
    customer_name: str = "",
) -> tuple[int, str]:
    if customer_id is not None:
        try:
            customer_id_int = int(customer_id)
        except (TypeError, ValueError) as exc:
            raise ValidationError("customer_id 无效") from exc
        customer = await Customer.filter(
            tenant_id=tenant_id,
            id=customer_id_int,
            deleted_at__isnull=True,
        ).first()
        if not customer:
            raise ValidationError(f"客户 ID {customer_id_int} 不存在")
        return customer.id, customer.name

    code = cell_str(customer_code)
    name = cell_str(customer_name)
    if code:
        customer = None
        for lookup_code in dict.fromkeys((code, code.upper())):
            customer = await Customer.filter(
                tenant_id=tenant_id,
                code=lookup_code,
                deleted_at__isnull=True,
            ).first()
            if customer:
                break
        if not customer:
            raise ValidationError(
                f"客户编码 {code} 不存在，请先在客户管理配置并完成客户同步"
            )
        return customer.id, customer.name

    if name:
        customer = await Customer.filter(
            tenant_id=tenant_id,
            name=name,
            deleted_at__isnull=True,
        ).first()
        if not customer:
            raise ValidationError(
                f"客户名称 {name} 不存在，请先在客户管理配置并完成客户同步"
            )
        return customer.id, customer.name

    raise ValidationError("须映射 customer_id、customer_code 或 customer_name 之一")


async def resolve_supplier_by_header(
    tenant_id: int,
    *,
    supplier_id: object = None,
    supplier_code: str = "",
    supplier_name: str = "",
) -> tuple[int, str]:
    if supplier_id is not None:
        try:
            supplier_id_int = int(supplier_id)
        except (TypeError, ValueError) as exc:
            raise ValidationError("supplier_id 无效") from exc
        supplier = await Supplier.filter(
            tenant_id=tenant_id,
            id=supplier_id_int,
            deleted_at__isnull=True,
        ).first()
        if not supplier:
            raise ValidationError(f"供应商 ID {supplier_id_int} 不存在")
        return supplier.id, supplier.name

    code = cell_str(supplier_code)
    name = cell_str(supplier_name)
    if code:
        supplier = None
        for lookup_code in dict.fromkeys((code, code.upper())):
            supplier = await Supplier.filter(
                tenant_id=tenant_id,
                code=lookup_code,
                deleted_at__isnull=True,
            ).first()
            if supplier:
                break
        if not supplier:
            raise ValidationError(
                f"供应商编码 {code} 不存在，请先在供应商管理配置并完成供应商同步"
            )
        return supplier.id, supplier.name

    if name:
        supplier = await Supplier.filter(
            tenant_id=tenant_id,
            name=name,
            deleted_at__isnull=True,
        ).first()
        if not supplier:
            raise ValidationError(
                f"供应商名称 {name} 不存在，请先在供应商管理配置并完成供应商同步"
            )
        return supplier.id, supplier.name

    raise ValidationError("须映射 supplier_id、supplier_code 或 supplier_name 之一")


async def resolve_sales_order_by_code(
    tenant_id: int,
    order_code: str,
) -> tuple[int, str, str]:
    code = cell_str(order_code)
    if not code:
        raise ValidationError("sales_order_code 不能为空")
    sales_order = await SalesOrder.filter(
        tenant_id=tenant_id,
        order_code=code,
        deleted_at__isnull=True,
    ).first()
    if not sales_order:
        raise ValidationError(
            f"销售订单 {code} 不存在，请先在销售订单管理配置并完成销售订单同步"
        )
    return sales_order.id, sales_order.order_code, sales_order.customer_name or sales_order.order_code


def map_kingdee_mo_status(document_status: object, status: object, close_status: object) -> str:
    """
    金蝶生产订单（PRD_MO）状态映射为本地工单 status。

    FDocumentStatus：Z/A/B/D 视为草稿；C 为已审核后按 FStatus 区分执行态。
    FStatus：1/2 计划、3 下达、4 开工、5/6/7 完工/结案/结算。
    FCloseStatus：B 且 FStatus=1/2 视为取消（业务关闭未下达）。
    """
    doc = cell_str(document_status).upper()
    st = cell_str(status).upper()
    close = cell_str(close_status).upper()

    if not doc and not st and not close:
        raise ValidationError("生产订单状态字段不能为空")

    if close == "B" and st in ("1", "2"):
        return "cancelled"
    if doc in ("Z", "A", "B", "D"):
        return "draft"
    if doc == "C":
        # 已审核：无 FStatus 时按已下达；有值再细分
        if not st or st in ("1", "2", "3"):
            return "released"
        if st == "4":
            return "in_progress"
        if st in ("5", "6", "7"):
            return "completed"
        if close == "B":
            return "completed"
    if not doc and st in ("1", "2", "3"):
        return "released"
    if not doc and st == "4":
        return "in_progress"
    if not doc and st in ("5", "6", "7"):
        return "completed"

    raise ValidationError(
        f"无法映射金蝶生产订单状态：FDocumentStatus={document_status}, "
        f"FStatus={status}, FCloseStatus={close_status}"
    )
