"""辐条轮毂总装 — 服务层"""
from decimal import Decimal
from datetime import datetime
from typing import List, Optional, Tuple

from fastapi import HTTPException
from tortoise import transactions
from tortoise.expressions import Q

from apps.spoke_wheel.models import (
    SpokeWheelAssembly,
    SpokeWheelConcentricityCheck,
)
from apps.spoke_wheel.schemas import (
    SpokeWheelAssemblyCreate,
    SpokeWheelAssemblyUpdate,
    ConcentricityCheckCreate,
)


def _gen_code_sync(tenant_id: int, prefix: str = "SW") -> str:
    """生成总装单号占位(实际不用,保留兼容)"""
    from datetime import datetime as _dt
    today = _dt.now().strftime("%Y%m%d")
    return f"{prefix}-{today}-0001"


async def _gen_code(tenant_id: int, prefix: str = "SW") -> str:
    """生成总装单号: SW-YYYYMMDD-NNNN"""
    from datetime import datetime as _dt
    today = _dt.now().strftime("%Y%m%d")
    last = await (
        SpokeWheelAssembly.filter(tenant_id=tenant_id, code__startswith=f"{prefix}-{today}")
        .order_by("-id")
        .first()
    )
    seq = 1
    if last and last.code:
        try:
            seq = int(last.code.split("-")[-1]) + 1
        except Exception:
            seq = 1
    return f"{prefix}-{today}-{seq:04d}"


async def create_assembly(payload: SpokeWheelAssemblyCreate, tenant_id: int, user) -> SpokeWheelAssembly:
    """创建总装记录(草稿状态)"""
    code = payload.code or await _gen_code(tenant_id)
    existed = await SpokeWheelAssembly.filter(tenant_id=tenant_id, code=code).first()
    if existed:
        raise HTTPException(status_code=400, detail=f"总装单号 {code} 已存在")
    obj = await SpokeWheelAssembly.create(
        tenant_id=tenant_id,
        code=code,
        work_order_id=payload.work_order_id,
        work_order_code=payload.work_order_code,
        product_material_id=payload.product_material_id,
        product_material_code=payload.product_material_code,
        product_material_name=payload.product_material_name,
        fixture_dial_count=payload.fixture_dial_count,
        remarks=payload.remarks,
        extra=payload.extra,
        status="draft",
        created_by=user.id if user else None,
        created_by_name=(user.full_name or user.username) if user else None,
    )
    return obj


async def list_assemblies(tenant_id: int, status: Optional[str] = None, work_order_id: Optional[int] = None, page: int = 1, page_size: int = 20) -> Tuple[List[SpokeWheelAssembly], int]:
    q = SpokeWheelAssembly.filter(tenant_id=tenant_id)
    if status:
        q = q.filter(status=status)
    if work_order_id:
        q = q.filter(work_order_id=work_order_id)
    total = await q.count()
    items = await q.order_by("-id").offset((page - 1) * page_size).limit(page_size)
    return items, total


async def get_assembly(tenant_id: int, assembly_id: int) -> SpokeWheelAssembly:
    obj = await SpokeWheelAssembly.filter(tenant_id=tenant_id, id=assembly_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail=f"总装记录 {assembly_id} 不存在")
    return obj


async def update_assembly(tenant_id: int, assembly_id: int, payload: SpokeWheelAssemblyUpdate, user) -> SpokeWheelAssembly:
    obj = await get_assembly(tenant_id, assembly_id)
    data = payload.model_dump(exclude_unset=True)
    # 状态机联动时间戳
    now = datetime.now()
    if data.get("status") == "fixed" and not obj.fixed_at:
        data["fixed_at"] = now
    if data.get("status") in ("debugging", "qc_passed", "qc_failed", "completed") and not obj.debug_started_at:
        data["debug_started_at"] = now
    if data.get("status") == "completed" and not obj.completed_at:
        data["completed_at"] = now
        data["debug_completed_at"] = now
    if "hub_assembled" in data and data["hub_assembled"] and not obj.hub_assembled_at:
        data["hub_assembled_at"] = now
    if user:
        data["updated_by"] = user.id
        data["updated_by_name"] = (user.full_name or user.username) if user else None
    await obj.update_from_dict(data).save()
    return obj


async def create_concentricity_check(payload: ConcentricityCheckCreate, tenant_id: int, user) -> SpokeWheelConcentricityCheck:
    """录入同心度检测,自动算极差 + 判定合格"""
    assembly = await get_assembly(tenant_id, payload.assembly_id)
    # 极差 = max - min
    values = [payload.dial_1_value, payload.dial_2_value, payload.dial_3_value]
    max_dev = max(values) - min(values)
    is_qualified = max_dev <= payload.tolerance_mm
    obj = await SpokeWheelConcentricityCheck.create(
        tenant_id=tenant_id,
        assembly_id=assembly.id,
        assembly_code=assembly.code,
        dial_1_value=payload.dial_1_value,
        dial_2_value=payload.dial_2_value,
        dial_3_value=payload.dial_3_value,
        max_deviation_mm=max_dev,
        tolerance_mm=payload.tolerance_mm,
        is_qualified=is_qualified,
        inspector_id=payload.inspector_id or (user.id if user else None),
        inspector_name=payload.inspector_name or ((user.full_name or user.username) if user else None),
        remarks=payload.remarks,
        measured_at=payload.measured_at or datetime.now(),
    )
    # 同步更新总装记录的最终状态
    new_status = "qc_passed" if is_qualified else "qc_failed"
    await assembly.update_from_dict({
        "final_max_deviation_mm": max_dev,
        "final_qc_passed": is_qualified,
        "status": new_status,
        "inspector_id": obj.inspector_id,
        "inspector_name": obj.inspector_name,
        "debug_completed_at": datetime.now(),
    }).save()
    return obj


async def list_checks_by_assembly(tenant_id: int, assembly_id: int) -> List[SpokeWheelConcentricityCheck]:
    items = await (
        SpokeWheelConcentricityCheck.filter(tenant_id=tenant_id, assembly_id=assembly_id)
        .order_by("-id")
    )
    return items