"""
BOM辅助工具模块

提供调用master_data APP的BOM API的辅助函数。

Author: Luigi Lu
Date: 2025-01-01
"""

from collections import defaultdict
from datetime import datetime
from typing import List, Dict, Any, Optional
from decimal import Decimal
from loguru import logger

from tortoise.expressions import Q

from apps.master_data.models.material import BOM
from infra.exceptions.exceptions import ValidationError


def bom_item_base_quantity(bom_item: BOM) -> Decimal:
    """读取 BOM 行所属版本的基准数量（默认 1）。"""
    value = getattr(bom_item, "base_quantity", None)
    if value is None:
        return Decimal("1")
    return Decimal(str(value))


def bom_line_unit_quantity(quantity: Decimal, base_quantity: Optional[Decimal] = None) -> Decimal:
    """单位用量 = 行用量 / 基准数量。"""
    base = Decimal(str(base_quantity if base_quantity is not None else 1))
    if base <= 0:
        raise ValidationError("基准数量必须大于 0")
    return Decimal(str(quantity)) / base


def bom_line_required_quantity(
    quantity: Decimal,
    base_quantity: Optional[Decimal],
    parent_qty: float,
    waste_rate: Decimal = Decimal("0"),
) -> float:
    """子件实际需求 = (行用量/基准数量) × 父件数量 × (1 + 损耗率%)。"""
    unit = bom_line_unit_quantity(quantity, base_quantity)
    waste = Decimal(str(waste_rate or 0))
    return float(unit * Decimal(str(parent_qty)) * (Decimal("1") + waste / Decimal("100")))


def bom_line_required_quantity_decimal(
    quantity: Decimal,
    base_quantity: Optional[Decimal],
    parent_qty: Decimal,
    waste_rate: Decimal = Decimal("0"),
) -> Decimal:
    """Decimal 版子件实际需求（成本核算等场景）。"""
    unit = bom_line_unit_quantity(quantity, base_quantity)
    waste = Decimal(str(waste_rate or 0))
    return unit * Decimal(str(parent_qty)) * (Decimal("1") + waste / Decimal("100"))


def _select_alternatives(bom_items: List[BOM]) -> List[BOM]:
    """
    替代料组内互斥选择：主料优先，否则按 priority 升序选第一个。
    按 alternative_group_id 分组；None 视为独立组（仅自身）。
    """
    by_group = defaultdict(list)
    result = []
    for b in bom_items:
        gid = getattr(b, "alternative_group_id", None)
        if gid is None:
            result.append(b)
        else:
            by_group[gid].append(b)
            
    for group in by_group.values():
        mains = [x for x in group if not getattr(x, "is_alternative", False)]
        if mains:
            result.append(mains[0])
        else:
            chosen = min(group, key=lambda x: (getattr(x, "priority", 0) or 0, x.id))
            result.append(chosen)
    return result


def _select_configurable(
    bom_items: List[BOM],
    material_id: int,
    configurable_selections: Optional[Dict[str, int]] = None,
) -> List[BOM]:
    """
    配置位组内选择：按用户选择或默认选项保留。
    configurable_selections 格式: { "parentMaterialId_configurableGroupId": componentId }
    非配置位行保持；配置位行按选择或 is_default_configurable 保留。
    """
    configurable_selections = configurable_selections or {}
    result = []
    by_cfg_group = defaultdict(list)
    for b in bom_items:
        is_cfg = getattr(b, "is_configurable", False)
        cfg_gid = getattr(b, "configurable_group_id", None)
        if is_cfg and cfg_gid is not None:
            by_cfg_group[cfg_gid].append(b)
        else:
            result.append(b)
    for cfg_gid, group in by_cfg_group.items():
        key = f"{material_id}_{cfg_gid}"
        selected_component_id = configurable_selections.get(key) or configurable_selections.get(str(key))
        if selected_component_id is not None:
            try:
                target_id = int(selected_component_id)
            except (TypeError, ValueError):
                target_id = None
            chosen = next((x for x in group if x.component_id == target_id), None) if target_id is not None else None
            if chosen:
                result.append(chosen)
                continue
        default_item = next((x for x in group if getattr(x, "is_default_configurable", False)), None)
        result.append(default_item if default_item else group[0])
    return result
from apps.master_data.schemas.material_schemas import BOMResponse
from infra.exceptions.exceptions import NotFoundError


def _bom_effective_filter(as_of_date: Optional[datetime]):
    """构建 BOM 生效/失效过滤条件：effective_date <= as_of_date 且 (expiry_date is null or expiry_date >= as_of_date)"""
    if not as_of_date:
        return None
    return (Q(effective_date__isnull=True) | Q(effective_date__lte=as_of_date)) & (
        Q(expiry_date__isnull=True) | Q(expiry_date__gte=as_of_date)
    )


async def get_bom_by_material_id(
    tenant_id: int,
    material_id: int,
    only_approved: bool = True,
    version: Optional[str] = None,
    use_default: bool = False,
    as_of_date: Optional[datetime] = None,
) -> Optional[BOM]:
    """
    根据物料ID获取BOM（从master_data）

    Args:
        tenant_id: 租户ID
        material_id: 物料ID
        only_approved: 是否只返回已审核的BOM（默认：True）
        version: 指定版本号（可选），若提供则按版本查询
        use_default: 是否使用默认版本（is_default=True），当 version 未指定时生效
        as_of_date: 基准日期（可选），仅返回该日期生效的 BOM（effective_date<=as_of_date 且 expiry_date>=as_of_date 或 null）

    Returns:
        BOM对象或None
    """
    query = BOM.filter(
        tenant_id=tenant_id,
        material_id=material_id,
        deleted_at__isnull=True
    )
    eff_filter = _bom_effective_filter(as_of_date)
    if eff_filter:
        query = query.filter(eff_filter)
    
    if only_approved:
        query = query.filter(approval_status="approved")
    
    if version:
        query = query.filter(version=version)
        bom = await query.first()
        # 指定版本查不到时回退到默认版本，避免因版本格式/审核状态差异导致无法展开下层 BOM
        if not bom and use_default is False:
            fallback = BOM.filter(
                tenant_id=tenant_id,
                material_id=material_id,
                deleted_at__isnull=True,
            )
            if eff_filter:
                fallback = fallback.filter(eff_filter)
            if only_approved:
                fallback = fallback.filter(approval_status="approved")
            bom = await fallback.filter(is_default=True).first()
            if not bom:
                bom = await fallback.order_by("-created_at").first()
    elif use_default:
        query = query.filter(is_default=True)
        bom = await query.first()
        if not bom:
            # 无默认版本时回退到最新版本
            query = BOM.filter(
                tenant_id=tenant_id,
                material_id=material_id,
                deleted_at__isnull=True
            )
            if eff_filter:
                query = query.filter(eff_filter)
            if only_approved:
                query = query.filter(approval_status="approved")
            bom = await query.order_by("-created_at").first()
    else:
        # 获取最新版本的BOM
        bom = await query.order_by("-version", "-created_at").first()
    
    return bom


async def get_bom_items_by_material_id(
    tenant_id: int,
    material_id: int,
    only_approved: bool = True,
    version: Optional[str] = None,
    use_default: bool = False,
    apply_alternative_selection: bool = True,
    as_of_date: Optional[datetime] = None,
) -> List[BOM]:
    """
    根据物料ID获取BOM明细列表（从master_data）

    Args:
        tenant_id: 租户ID
        material_id: 物料ID
        only_approved: 是否只返回已审核的BOM（默认：True）
        version: 指定版本号（可选）
        use_default: 是否使用默认版本（is_default=True），当 version 未指定时生效
        apply_alternative_selection: 是否应用替代料选择（默认：True），同组互斥选一
        as_of_date: 基准日期（可选），仅返回该日期生效的 BOM 明细

    Returns:
        BOM明细列表
    """
    bom = await get_bom_by_material_id(
        tenant_id=tenant_id,
        material_id=material_id,
        only_approved=only_approved,
        version=version,
        use_default=use_default,
        as_of_date=as_of_date,
    )
    if not bom:
        return []
    
    # 获取该 BOM 下的所有明细：优先用 bom_code 关联；bom_code 为空时用 material_id+version 关联（兼容历史数据）
    if bom.bom_code:
        items_query = BOM.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            bom_code=bom.bom_code,
            deleted_at__isnull=True
        )
    else:
        items_query = BOM.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            version=bom.version,
            deleted_at__isnull=True
        )
    eff_filter = _bom_effective_filter(as_of_date)
    if eff_filter:
        items_query = items_query.filter(eff_filter)
    if only_approved:
        items_query = items_query.filter(approval_status="approved")
    items = await items_query.prefetch_related("component").order_by("priority", "id").all()
    if apply_alternative_selection:
        items = _select_alternatives(items)
    return items


async def calculate_material_requirements_from_bom(
    tenant_id: int,
    material_id: int,
    required_quantity: float,
    only_approved: bool = True,
    as_of_date: Optional[datetime] = None,
    variant_attributes: Optional[Dict[str, Any]] = None,
    configurable_selections: Optional[Dict[str, int]] = None,
    for_kitting_analysis: bool = False,
) -> List[Any]:
    """
    根据BOM计算物料需求（从master_data）

    Args:
        tenant_id: 租户ID
        material_id: 物料ID（成品物料ID）
        required_quantity: 需求数量
        only_approved: 是否只使用已审核的BOM（默认：True）
        as_of_date: 基准日期（可选），仅使用该日期生效的 BOM
        variant_attributes: 配置件属性（可选），当产品为 Configure 时用于 BOM 匹配
        configurable_selections: 配置位选择（可选），格式 {"parentMaterialId_configurableGroupId": componentId}
        for_kitting_analysis: True 时自制/委外子件不拆子 BOM（工单齐套）；False 时多阶展开（缺料/MRP 等）

    Returns:
        物料需求列表，返回MaterialRequirement对象列表（兼容原BOMService的返回格式）
    """
    from apps.kuaizhizao.schemas.bom import MaterialRequirement
    from apps.kuaizhizao.utils.material_source_helper import expand_bom_with_source_control
    from apps.kuaizhizao.utils.issue_method_resolver import resolve_issue_method

    # 始终优先按来源控制展开 BOM：穿透虚拟件（Phantom）、处理配置件/配置位与子件递归。
    # 此前仅在传入 variant/config 时才展开，导致齐套/叫料等界面把虚拟件当作单行实体、库存为 0。
    expanded = await expand_bom_with_source_control(
        tenant_id=tenant_id,
        material_id=material_id,
        required_quantity=required_quantity,
        only_approved=only_approved,
        variant_attributes=variant_attributes,
        configurable_selections=configurable_selections,
        as_of_date=as_of_date,
        flatten_intermediate_subassemblies=for_kitting_analysis,
    )

    if expanded:
        # 按 component_id 聚合（同一物料可能从多路径展开）
        by_component: Dict[int, Dict[str, Any]] = {}
        for item in expanded:
            mid = item.get("material_id")
            if not mid:
                continue
            if mid not in by_component:
                by_component[mid] = {
                    "material_id": mid,
                    "material_code": item.get("material_code", ""),
                    "material_name": item.get("material_name", ""),
                    "source_type": item.get("source_type", "Buy"),
                    "issue_method": item.get("issue_method"),
                    "required_quantity": 0.0,
                    "unit": item.get("unit", ""),
                }
            by_component[mid]["required_quantity"] += float(item.get("required_quantity", 0))

        requirements = []
        for req in by_component.values():
            im = resolve_issue_method(req.get("issue_method"), req.get("source_type"))
            requirements.append(MaterialRequirement(
                component_id=req["material_id"],
                component_code=req["material_code"],
                component_name=req["material_name"],
                component_type=req["source_type"],
                gross_requirement=req["required_quantity"],
                net_requirement=req["required_quantity"],
                available_inventory=0.0,
                planned_receipt=0.0,
                unit=req["unit"] or "",
                lead_time=0,
                issue_method=im,
            ))
        return requirements

    strict_configure = (
        (variant_attributes and isinstance(variant_attributes, dict) and len(variant_attributes) > 0)
        or (configurable_selections and isinstance(configurable_selections, dict) and len(configurable_selections) > 0)
    )
    if strict_configure:
        raise NotFoundError(f"物料 {material_id} 的BOM不存在或未审核（配置件需匹配属性）")

    bom_items = await get_bom_items_by_material_id(
        tenant_id=tenant_id,
        material_id=material_id,
        only_approved=only_approved,
        apply_alternative_selection=True,
        as_of_date=as_of_date,
    )
    
    if not bom_items:
        raise NotFoundError(f"物料 {material_id} 的BOM不存在或未审核")
    
    requirements = []
    for item in bom_items:
        # 计算需求数量
        component = await item.component
        if not component:
            continue
        
        required_qty = bom_line_required_quantity(
            item.quantity,
            bom_item_base_quantity(item),
            required_quantity,
            item.waste_rate or Decimal("0"),
        )
        gross_requirement = required_qty
        
        # 创建MaterialRequirement对象（兼容原格式）
        requirement = MaterialRequirement(
            component_id=item.component_id,
            component_code=component.code,
            component_name=component.name,
            component_type=(component.source_type or "Buy") if hasattr(component, "source_type") else "Buy",
            gross_requirement=gross_requirement,
            net_requirement=gross_requirement,  # 暂时不考虑库存和计划入库
            available_inventory=0.0,  # TODO: 从库存系统获取
            planned_receipt=0.0,  # TODO: 从计划系统获取
            unit=item.unit,
            lead_time=0,  # TODO: 从物料主数据获取
            issue_method=resolve_issue_method(
                getattr(item, "issue_method", None),
                getattr(component, "source_type", None),
            ),
        )
        
        requirements.append(requirement)
    
    return requirements

