"""
物料来源控制辅助工具模块

提供物料来源识别、验证、处理等辅助函数，支持物料来源控制功能。

根据《☆ 用户使用全场景推演.md》的设计，实现物料来源控制功能。

物料来源类型：
- Make（自制件）：企业自己生产制造
- Buy（采购件）：外部采购获得
- Phantom（虚拟件）：不实际存在，仅用于BOM展开
- Outsource（委外件）：委托外部加工
- Service（服务）：服务类物料

可配置能力由 variant_managed / BOM 配置位表达，不再使用 Configure 来源类型。

Author: Auto (AI Assistant)
Date: 2026-01-16
"""

from datetime import datetime
from typing import Dict, Any, Optional, List, Tuple
from decimal import Decimal
from loguru import logger

from apps.master_data.models.material import Material, BOM
from apps.master_data.constants.material_source_type import (
    CANONICAL_SOURCE_TYPES,
    normalize_material_source_type,
    require_canonical_material_source_type,
)
from apps.kuaizhizao.utils.bom_helper import (
    _select_alternatives,
    _select_configurable,
    _bom_effective_filter,
    bom_line_required_quantity,
    bom_item_base_quantity,
    bom_component_lines_filter,
)


def _bom_component_qty(bom_item: BOM, required_quantity: float) -> float:
    return bom_line_required_quantity(
        bom_item.quantity,
        bom_item_base_quantity(bom_item),
        required_quantity,
        bom_item.waste_rate or Decimal("0"),
    )


def _bom_leaf_requirement(
    bom_item: BOM,
    component: Material,
    component_qty: float,
    level: int,
    **extra: Any,
) -> Dict[str, Any]:
    """BOM 展开叶节点需求（携带发料方式）。"""
    return {
        "material_id": component.id,
        "material_code": component.main_code or component.code,
        "material_name": component.name,
        "source_type": require_canonical_material_source_type(
            component.source_type,
            material_id=component.id,
            material_code=component.main_code or component.code,
            material_name=component.name,
        ),
        "required_quantity": component_qty,
        "unit": bom_item.unit or component.base_unit,
        "level": level,
        "issue_method": getattr(bom_item, "issue_method", None) or "pick",
        **extra,
    }


async def _get_bom_for_material(
    tenant_id: int,
    material_id: int,
    only_approved: bool,
    bom_version: Optional[str],
    use_default_bom: bool,
    material_bom_versions: Optional[Dict[int, str]],
    as_of_date: Optional[datetime] = None,
) -> Optional[BOM]:
    """根据版本参数获取物料的 BOM（支持指定版本或默认版本）"""
    versions = material_bom_versions or {}
    version = versions.get(material_id) or versions.get(str(material_id))  # 兼容 JSON 字符串 key
    if not version:
        version = bom_version
    # 当使用 material_bom_versions 模式时，未指定版本的物料（如下层 BOM）使用默认版本，确保能正确展开
    use_default = (use_default_bom and not version) or (
        bool(material_bom_versions) and not version
    )

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
        return await query.first()
    if use_default:
        bom = await query.filter(is_default=True).first()
        if bom:
            return bom
        # 无默认版本时回退到最新版本
        fallback = BOM.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            deleted_at__isnull=True
        )
        if eff_filter:
            fallback = fallback.filter(eff_filter)
        if only_approved:
            fallback = fallback.filter(approval_status="approved")
        return await fallback.order_by("-created_at").first()
    return await query.order_by("-version", "-created_at").first()
from infra.exceptions.exceptions import ValidationError, NotFoundError


def _resolve_configure_variant(
    variant_attributes: Optional[Dict[str, Any]],
    bom_variants: Optional[Dict[str, Any]],
    default_variant: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    根据属性匹配 bom_variants，返回对应的 BOM 版本配置。
    bom_variants 格式: { "color=red,size=M": { "version": "1.0" }, ... }
    variant_attributes 格式: { "color": "red", "size": "M" }
    未匹配时回退到 default_variant 对应的 key。
    """
    if not bom_variants or not isinstance(bom_variants, dict):
        return None
    attrs = variant_attributes or {}
    if isinstance(attrs, str):
        try:
            import json
            attrs = json.loads(attrs) if attrs.strip() else {}
        except Exception:
            attrs = {}
    if not isinstance(attrs, dict):
        attrs = {}
    # 构建属性 key：按属性名排序，格式 "attr1=val1,attr2=val2"
    key_parts = sorted(f"{k}={v}" for k, v in attrs.items() if v is not None and str(v).strip())
    variant_key = ",".join(key_parts) if key_parts else None
    if variant_key and variant_key in bom_variants:
        return bom_variants[variant_key]
    if default_variant and default_variant in bom_variants:
        return bom_variants[default_variant]
    if not variant_key and bom_variants:
        first_key = next(iter(bom_variants), None)
        if first_key:
            return bom_variants[first_key]
    return None


# 物料来源类型常量
SOURCE_TYPE_MAKE = "Make"  # 自制件
SOURCE_TYPE_BUY = "Buy"  # 采购件
SOURCE_TYPE_PHANTOM = "Phantom"  # 虚拟件
SOURCE_TYPE_OUTSOURCE = "Outsource"  # 委外件
SOURCE_TYPE_CONFIGURE = "Configure"  # 已废弃，仅兼容历史 BOM 展开逻辑
SOURCE_TYPE_SERVICE = "Service"  # 服务

# MRP 多阶展开：仅自制/委外/历史配置件需递归子 BOM；采购件/服务按整件采购，不再拆子件（避免与同级 BOM 行重复累计）
_MRP_RECURSE_SOURCE_TYPES = frozenset(
    {SOURCE_TYPE_MAKE, SOURCE_TYPE_OUTSOURCE, SOURCE_TYPE_CONFIGURE}
)


def _should_recurse_child_bom_in_mrp(source_type: Optional[str]) -> bool:
    return (source_type or "") in _MRP_RECURSE_SOURCE_TYPES


VALID_SOURCE_TYPES = list(CANONICAL_SOURCE_TYPES)

# 自制件制造模式（存于 source_config.manufacturing_mode）
MANUFACTURING_MODE_FABRICATION = "fabrication"  # 工艺型：材料+工艺→零件
MANUFACTURING_MODE_ASSEMBLY = "assembly"  # 组合型：原材料组装→成品/半成品
VALID_MANUFACTURING_MODES = [MANUFACTURING_MODE_FABRICATION, MANUFACTURING_MODE_ASSEMBLY]


async def get_material_source_type(
    tenant_id: int,
    material_id: int
) -> Optional[str]:
    """
    获取物料的来源类型
    
    Args:
        tenant_id: 租户ID
        material_id: 物料ID
        
    Returns:
        str: 物料来源类型（Make/Buy/Phantom/Outsource/Configure）或None
    """
    material = await Material.get_or_none(tenant_id=tenant_id, id=material_id)
    if not material:
        return None
    
    return material.source_type


async def validate_material_source_config(
    tenant_id: int,
    material_id: int,
    source_type: str
) -> Tuple[bool, List[str]]:
    """
    验证物料来源配置的完整性
    
    Args:
        tenant_id: 租户ID
        material_id: 物料ID
        source_type: 物料来源类型
        
    Returns:
        Tuple[bool, List[str]]: (是否通过验证, 错误信息列表)
    """
    errors = []
    material = await Material.get_or_none(tenant_id=tenant_id, id=material_id)
    if not material:
        errors.append(f"物料不存在: {material_id}")
        return False, errors
    
    source_config = material.source_config or {}
    
    if source_type == SOURCE_TYPE_MAKE:
        # 自制件根据制造模式区分校验：工艺型工艺路线必填、BOM可选；组合型BOM必填、工艺路线可选
        from apps.master_data.models.material import BOM
        manufacturing_mode = source_config.get("manufacturing_mode")
        bom_count = await BOM.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            approval_status="approved",
            deleted_at__isnull=True
        ).count()
        has_process_route = bool(material.process_route_id)

        if manufacturing_mode == MANUFACTURING_MODE_FABRICATION:
            # 工艺型：工艺路线必填，BOM 可选（不强制）
            if not has_process_route:
                errors.append(f"工艺型自制件必须有工艺路线配置，物料: {material.main_code} ({material.name})")
        elif manufacturing_mode == MANUFACTURING_MODE_ASSEMBLY:
            # 组合型：BOM 必填，工艺路线可选
            if bom_count == 0:
                errors.append(f"组合型自制件必须有BOM配置，物料: {material.main_code} ({material.name})")
            if not has_process_route:
                errors.append(f"组合型自制件建议配置工艺路线（装配工序），物料: {material.main_code} ({material.name})")
        else:
            # 未设置制造模式：允许“仅工艺路线”的自制件参与计算并生成建议工单。
            # 过去这里会因缺 BOM 直接报错并阻断建议工单，导致机加工类半成品误拦截。
            if not has_process_route:
                errors.append(f"自制件建议配置工艺路线，物料: {material.main_code} ({material.name})")
            
    elif source_type == SOURCE_TYPE_BUY:
        # 采购件未配置默认供应商时仅作建议，不判定为验证失败（可通过「下推到采购申请」处理）
        pass
            
    elif source_type == SOURCE_TYPE_PHANTOM:
        # 虚拟件必须有完整的BOM结构（下层物料必须可展开）
        from apps.master_data.models.material import BOM
        bom_count = await BOM.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            approval_status="approved",
            deleted_at__isnull=True
        ).count()
        
        if bom_count == 0:
            errors.append(f"虚拟件必须有完整的BOM结构，物料: {material.main_code} ({material.name})")
            
        # 检查下层物料是否可展开
        bom_items = await BOM.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            approval_status="approved",
            deleted_at__isnull=True
        ).prefetch_related("component").all()
        
        if bom_items:
            for bom_item in bom_items:
                component = await bom_item.component
                if component:
                    # 递归检查下层物料
                    child_bom_count = await BOM.filter(
                        tenant_id=tenant_id,
                        material_id=component.id,
                        approval_status="approved",
                        deleted_at__isnull=True
                    ).count()
                    
                    if child_bom_count == 0 and component.source_type == SOURCE_TYPE_PHANTOM:
                        errors.append(f"虚拟件的下层物料必须是虚拟件或可展开的物料，子物料: {component.main_code} ({component.name})")
                        
    elif source_type == SOURCE_TYPE_OUTSOURCE:
        # 委外件必须有委外供应商和委外工序
        outsource_supplier_id = source_config.get("outsource_supplier_id")
        outsource_operation = source_config.get("outsource_operation")
        
        if not outsource_supplier_id:
            errors.append(f"委外件必须有委外供应商配置，物料: {material.main_code} ({material.name})")
            
        if not outsource_operation:
            errors.append(f"委外件必须有委外工序配置，物料: {material.main_code} ({material.name})")
            
    elif source_type == SOURCE_TYPE_CONFIGURE:
        # 配置件必须有属性和BOM配置
        variant_attributes = material.variant_attributes
        bom_variants = source_config.get("bom_variants")
        
        if not variant_attributes:
            errors.append(f"配置件必须有属性配置，物料: {material.main_code} ({material.name})")
            
        if not bom_variants:
            errors.append(f"配置件必须有BOM属性配置，物料: {material.main_code} ({material.name})")

    elif source_type == SOURCE_TYPE_SERVICE:
        # 服务类物料无需额外配置
        pass

    return len(errors) == 0, errors


async def _child_has_any_approved_bom_row(
    tenant_id: int,
    material_id: int,
    only_approved: bool,
    as_of_date: Optional[datetime],
) -> bool:
    """是否存在任意一条生效/已审核的 BOM 明细行（与历史 MRP 展开前的 exists 判断一致）。"""
    q = BOM.filter(tenant_id=tenant_id, material_id=material_id, deleted_at__isnull=True)
    eff = _bom_effective_filter(as_of_date)
    if eff:
        q = q.filter(eff)
    if only_approved:
        q = q.filter(approval_status="approved")
    return await q.exists()


async def expand_bom_with_source_control(
    tenant_id: int,
    material_id: int,
    required_quantity: float,
    only_approved: bool = True,
    level: int = 0,
    max_level: int = 10,
    bom_version: Optional[str] = None,
    use_default_bom: bool = False,
    material_bom_versions: Optional[Dict[int, str]] = None,
    variant_attributes: Optional[Dict[str, Any]] = None,
    configurable_selections: Optional[Dict[str, int]] = None,
    as_of_date: Optional[datetime] = None,
    flatten_intermediate_subassemblies: bool = False,
) -> List[Dict[str, Any]]:
    """
    展开BOM（物料来源控制）

    - **flatten_intermediate_subassemblies=False**（MRP/缺料等）：虚拟件穿透；自制/委外子件先记一行再递归子 BOM；**采购件/服务仅记一行不拆子 BOM**（避免整件采购与子件同行重复累计）。
    - **flatten_intermediate_subassemblies=True**（工单齐套/叫料）：虚拟件下仅虚拟件/配置件继续穿透，其余子件单行不拆子 BOM；非虚拟父件下同理。

    Args:
        tenant_id: 租户ID
        material_id: 物料ID
        required_quantity: 需求数量
        only_approved: 是否只使用已审核的BOM
        level: 当前层级
        max_level: 最大层级（防止无限递归）
        bom_version: 全局 BOM 版本（可选），用于顶层物料
        use_default_bom: 是否使用默认版本（is_default=True），当 bom_version 未指定时生效
        material_bom_versions: 按物料ID指定版本（可选），格式 {material_id: version}
        variant_attributes: 配置件属性（可选），格式 {attr: value}，用于匹配 bom_variants
        configurable_selections: 配置位选择（可选），格式 {"parentMaterialId_configurableGroupId": componentId}
        as_of_date: 基准日期（可选），仅使用该日期生效的 BOM（effective_date<=as_of_date 且 expiry_date>=as_of_date 或 null）
        flatten_intermediate_subassemblies: True=齐套；False=MRP

    Returns:
        List[Dict]: 展开后的物料需求列表
    """
    if level >= max_level:
        logger.warning(f"BOM展开达到最大层级 {max_level}，物料ID: {material_id}")
        return []
    
    # 获取物料的来源类型
    material = await Material.get_or_none(tenant_id=tenant_id, id=material_id)
    if not material:
        return []
    
    source_type = material.source_type

    # 配置件：根据属性解析 BOM 版本
    effective_material_bom_versions = dict(material_bom_versions) if material_bom_versions else {}
    if source_type == SOURCE_TYPE_CONFIGURE:
        source_config = material.source_config or {}
        bom_variants = source_config.get("bom_variants")
        default_variant = source_config.get("default_variant")
        resolved = _resolve_configure_variant(variant_attributes, bom_variants, default_variant)
        if resolved and resolved.get("version"):
            effective_material_bom_versions[material_id] = resolved["version"]

    # 如果是虚拟件，自动跳过，直接展开下层物料
    if source_type == SOURCE_TYPE_PHANTOM:
        logger.debug(f"跳过虚拟件，直接展开下层物料，物料ID: {material_id}, 物料编码: {material.main_code}")
        
        # 获取虚拟件的BOM（支持版本参数）
        target_bom = await _get_bom_for_material(
            tenant_id, material_id, only_approved,
            bom_version, use_default_bom, effective_material_bom_versions,
            as_of_date=as_of_date,
        )
        if not target_bom:
            logger.warning(f"虚拟件没有BOM，物料ID: {material_id}")
            return []
        
        # 获取该 BOM 下的所有明细：优先用 bom_code+version；bom_code 为空时用 material_id+version
        bom_items_query = BOM.filter(**bom_component_lines_filter(target_bom, material_id))
        eff_filter = _bom_effective_filter(as_of_date)
        if eff_filter:
            bom_items_query = bom_items_query.filter(eff_filter)
        if only_approved:
            bom_items_query = bom_items_query.filter(approval_status="approved")
        bom_items = await bom_items_query.prefetch_related("component").order_by("priority", "id").all()
        bom_items = _select_alternatives(bom_items)
        bom_items = _select_configurable(bom_items, material_id, configurable_selections)

        requirements = []
        _kw = dict(
            only_approved=only_approved,
            level=level + 1,
            max_level=max_level,
            bom_version=bom_version,
            use_default_bom=use_default_bom,
            material_bom_versions=effective_material_bom_versions,
            variant_attributes=variant_attributes,
            configurable_selections=configurable_selections,
            as_of_date=as_of_date,
        )

        if flatten_intermediate_subassemblies:
            # 齐套：仅虚拟件/配置件穿透，其余子件单行
            for bom_item in bom_items:
                component = await bom_item.component
                if not component:
                    continue
                component_qty = _bom_component_qty(bom_item, required_quantity)
                ct = component.source_type
                _expand_kw = dict(
                    tenant_id=tenant_id,
                    material_id=component.id,
                    required_quantity=component_qty,
                    flatten_intermediate_subassemblies=True,
                    **_kw,
                )
                if ct == SOURCE_TYPE_PHANTOM:
                    child_requirements = await expand_bom_with_source_control(**_expand_kw)
                    if child_requirements:
                        requirements.extend(child_requirements)
                    else:
                        requirements.append(_bom_leaf_requirement(
                            bom_item, component, component_qty, level + 1,
                            from_phantom=True, phantom_material_id=material_id,
                        ))
                elif ct == SOURCE_TYPE_CONFIGURE:
                    child_requirements = await expand_bom_with_source_control(**_expand_kw)
                    if child_requirements:
                        requirements.extend(child_requirements)
                    else:
                        requirements.append(_bom_leaf_requirement(
                            bom_item, component, component_qty, level + 1,
                            from_phantom=True, phantom_material_id=material_id,
                        ))
                else:
                    requirements.append(_bom_leaf_requirement(
                        bom_item, component, component_qty, level + 1,
                        from_phantom=True, phantom_material_id=material_id,
                    ))
        else:
            # MRP：虚拟件下子件为虚拟/配置件则穿透；其余先记一行再递归下层（与非虚拟父件一致）
            for bom_item in bom_items:
                component = await bom_item.component
                if not component:
                    continue
                component_qty = _bom_component_qty(bom_item, required_quantity)
                ct = component.source_type
                _expand_kw = dict(
                    tenant_id=tenant_id,
                    material_id=component.id,
                    required_quantity=component_qty,
                    flatten_intermediate_subassemblies=False,
                    **_kw,
                )
                if ct == SOURCE_TYPE_PHANTOM:
                    child_requirements = await expand_bom_with_source_control(**_expand_kw)
                    requirements.extend(child_requirements)
                elif ct == SOURCE_TYPE_CONFIGURE:
                    child_requirements = await expand_bom_with_source_control(**_expand_kw)
                    if child_requirements:
                        requirements.extend(child_requirements)
                    else:
                        requirements.append(_bom_leaf_requirement(
                            bom_item, component, component_qty, level + 1,
                            from_phantom=True, phantom_material_id=material_id,
                            parent_material_id=material_id,
                        ))
                else:
                    requirements.append(_bom_leaf_requirement(
                        bom_item, component, component_qty, level + 1,
                        from_phantom=True, phantom_material_id=material_id,
                        parent_material_id=material_id,
                    ))
                    if _should_recurse_child_bom_in_mrp(ct) and await _child_has_any_approved_bom_row(
                        tenant_id, component.id, only_approved, as_of_date
                    ):
                        child_requirements = await expand_bom_with_source_control(**_expand_kw)
                        requirements.extend(child_requirements)

        return requirements
    
    # 非虚拟件，正常展开BOM
    target_bom = await _get_bom_for_material(
        tenant_id, material_id, only_approved,
        bom_version, use_default_bom, effective_material_bom_versions,
        as_of_date=as_of_date,
    )
    if not target_bom:
        return []
    
    # 获取该 BOM 下的所有明细：优先用 bom_code+version；bom_code 为空时用 material_id+version
    bom_items_query = BOM.filter(**bom_component_lines_filter(target_bom, material_id))
    eff_filter = _bom_effective_filter(as_of_date)
    if eff_filter:
        bom_items_query = bom_items_query.filter(eff_filter)
    if only_approved:
        bom_items_query = bom_items_query.filter(approval_status="approved")
    bom_items = await bom_items_query.prefetch_related("component").order_by("priority", "id").all()
    bom_items = _select_alternatives(bom_items)
    bom_items = _select_configurable(bom_items, material_id, configurable_selections)

    requirements = []
    _kw = dict(
        only_approved=only_approved,
        level=level + 1,
        max_level=max_level,
        bom_version=bom_version,
        use_default_bom=use_default_bom,
        material_bom_versions=effective_material_bom_versions,
        variant_attributes=variant_attributes,
        configurable_selections=configurable_selections,
        as_of_date=as_of_date,
    )

    if flatten_intermediate_subassemblies:
        for bom_item in bom_items:
            component = await bom_item.component
            if not component:
                continue
            component_qty = _bom_component_qty(bom_item, required_quantity)
            component_source_type = component.source_type
            if component_source_type == SOURCE_TYPE_PHANTOM:
                child_requirements = await expand_bom_with_source_control(
                    tenant_id=tenant_id,
                    material_id=component.id,
                    required_quantity=component_qty,
                    flatten_intermediate_subassemblies=True,
                    **_kw,
                )
                requirements.extend(child_requirements)
            elif component_source_type == SOURCE_TYPE_CONFIGURE:
                child_requirements = await expand_bom_with_source_control(
                    tenant_id=tenant_id,
                    material_id=component.id,
                    required_quantity=component_qty,
                    flatten_intermediate_subassemblies=True,
                    **_kw,
                )
                if child_requirements:
                    requirements.extend(child_requirements)
                else:
                    requirements.append(_bom_leaf_requirement(
                        bom_item, component, component_qty, level + 1, from_phantom=False,
                    ))
            else:
                requirements.append(_bom_leaf_requirement(
                    bom_item, component, component_qty, level + 1, from_phantom=False,
                ))
    else:
        # MRP（历史）：子件为虚拟件则整段展开；否则先记一行再按是否存在 BOM 行递归展开
        for bom_item in bom_items:
            component = await bom_item.component
            if not component:
                continue
            component_qty = _bom_component_qty(bom_item, required_quantity)
            component_source_type = component.source_type
            if component_source_type == SOURCE_TYPE_PHANTOM:
                child_requirements = await expand_bom_with_source_control(
                    tenant_id=tenant_id,
                    material_id=component.id,
                    required_quantity=component_qty,
                    flatten_intermediate_subassemblies=False,
                    **_kw,
                )
                requirements.extend(child_requirements)
            else:
                requirements.append(_bom_leaf_requirement(
                    bom_item, component, component_qty, level + 1, from_phantom=False,
                    parent_material_id=material_id,
                ))
                if _should_recurse_child_bom_in_mrp(component_source_type) and await _child_has_any_approved_bom_row(
                    tenant_id, component.id, only_approved, as_of_date
                ):
                    child_requirements = await expand_bom_with_source_control(
                        tenant_id=tenant_id,
                        material_id=component.id,
                        required_quantity=component_qty,
                        flatten_intermediate_subassemblies=False,
                        **_kw,
                    )
                    requirements.extend(child_requirements)

    return requirements


async def explode_bom_one_level_for_mrp(
    tenant_id: int,
    material_id: int,
    planned_quantity: float,
    *,
    only_approved: bool = True,
    bom_version: Optional[str] = None,
    use_default_bom: bool = False,
    material_bom_versions: Optional[Dict[int, str]] = None,
    variant_attributes: Optional[Dict[str, Any]] = None,
    configurable_selections: Optional[Dict[str, int]] = None,
    as_of_date: Optional[datetime] = None,
    max_phantom_depth: int = 10,
) -> List[Dict[str, Any]]:
    """
    LLC/时间分桶 MRP：按父件「计划订单量」只展开一层实件。

    - 虚拟件：穿透展平到下一层实件（不单独产出虚拟件行）
    - 自制/委外/采购/服务：只产出子件需求行，不再递归（由上层 LLC 循环处理）
    """
    if planned_quantity <= 0:
        return []

    material = await Material.get_or_none(tenant_id=tenant_id, id=material_id)
    if not material:
        return []

    source_type = material.source_type
    effective_material_bom_versions = dict(material_bom_versions) if material_bom_versions else {}
    if source_type == SOURCE_TYPE_CONFIGURE:
        source_config = material.source_config or {}
        resolved = _resolve_configure_variant(
            variant_attributes,
            source_config.get("bom_variants"),
            source_config.get("default_variant"),
        )
        if resolved and resolved.get("version"):
            effective_material_bom_versions[material_id] = resolved["version"]

    target_bom = await _get_bom_for_material(
        tenant_id,
        material_id,
        only_approved,
        bom_version,
        use_default_bom,
        effective_material_bom_versions,
        as_of_date=as_of_date,
    )
    if not target_bom:
        return []

    bom_items_query = BOM.filter(**bom_component_lines_filter(target_bom, material_id))
    eff_filter = _bom_effective_filter(as_of_date)
    if eff_filter:
        bom_items_query = bom_items_query.filter(eff_filter)
    if only_approved:
        bom_items_query = bom_items_query.filter(approval_status="approved")
    bom_items = await bom_items_query.prefetch_related("component").order_by("priority", "id").all()
    bom_items = _select_alternatives(bom_items)
    bom_items = _select_configurable(bom_items, material_id, configurable_selections)

    requirements: List[Dict[str, Any]] = []

    async def _emit_or_penetrate(
        bom_item: BOM,
        component: Material,
        component_qty: float,
        *,
        parent_id: int,
        phantom_depth: int,
    ) -> None:
        ct = component.source_type
        if ct == SOURCE_TYPE_PHANTOM:
            if phantom_depth >= max_phantom_depth:
                logger.warning(
                    f"虚拟件穿透达到上限 material_id={component.id} parent={parent_id}"
                )
                return
            nested = await explode_bom_one_level_for_mrp(
                tenant_id=tenant_id,
                material_id=component.id,
                planned_quantity=component_qty,
                only_approved=only_approved,
                bom_version=bom_version,
                use_default_bom=use_default_bom,
                material_bom_versions=effective_material_bom_versions,
                variant_attributes=variant_attributes,
                configurable_selections=configurable_selections,
                as_of_date=as_of_date,
                max_phantom_depth=max_phantom_depth,
            )
            for row in nested:
                row["phantom_material_id"] = component.id
                row.setdefault("parent_material_id", parent_id)
                requirements.append(row)
            return
        if ct == SOURCE_TYPE_CONFIGURE:
            nested = await explode_bom_one_level_for_mrp(
                tenant_id=tenant_id,
                material_id=component.id,
                planned_quantity=component_qty,
                only_approved=only_approved,
                bom_version=bom_version,
                use_default_bom=use_default_bom,
                material_bom_versions=effective_material_bom_versions,
                variant_attributes=variant_attributes,
                configurable_selections=configurable_selections,
                as_of_date=as_of_date,
                max_phantom_depth=max_phantom_depth,
            )
            if nested:
                for row in nested:
                    row.setdefault("parent_material_id", parent_id)
                    requirements.append(row)
                return
        requirements.append(
            _bom_leaf_requirement(
                bom_item,
                component,
                component_qty,
                1,
                parent_material_id=parent_id,
            )
        )

    for bom_item in bom_items:
        component = await bom_item.component
        if not component:
            continue
        component_qty = _bom_component_qty(bom_item, planned_quantity)
        if component_qty <= 0:
            continue
        await _emit_or_penetrate(
            bom_item,
            component,
            component_qty,
            parent_id=material_id,
            phantom_depth=0,
        )

    return requirements


def normalize_source_config_payload(
    raw: Optional[Dict[str, Any]],
    *,
    _depth: int = 0,
) -> Dict[str, Any]:
    """
    展平 material.source_config 或快照中多余的 {\"source_config\": {...}} 嵌套。
    部分历史/配置件物料主数据仅在最内层保存 default_supplier_id 等字段。
    """
    if not raw or not isinstance(raw, dict) or _depth > 3:
        return {}
    if any(
        key in raw
        for key in (
            "default_supplier_id",
            "outsource_supplier_id",
            "purchase_lead_time",
            "production_lead_time",
            "outsource_lead_time",
            "source_types",
            "manufacturing_mode",
        )
    ):
        return raw
    nested = raw.get("source_config")
    if isinstance(nested, dict):
        return normalize_source_config_payload(nested, _depth=_depth + 1)
    return raw


def resolve_computation_item_source_config(
    material_source_config: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    从 DemandComputationItem.material_source_config 解析可用的扁平来源配置。
    合并 get_material_source_config 顶层字段与内层 source_config。
    """
    if not material_source_config or not isinstance(material_source_config, dict):
        return {}
    cfg = material_source_config
    inner_raw = cfg.get("source_config")
    inner = normalize_source_config_payload(inner_raw if isinstance(inner_raw, dict) else None)
    merged = dict(inner)
    for key in (
        "default_supplier_id",
        "default_supplier_name",
        "outsource_supplier_id",
        "outsource_supplier_name",
        "purchase_lead_time",
        "production_lead_time",
        "outsource_lead_time",
        "purchase_price",
        "outsource_price",
        "production_waste_rate",
    ):
        if cfg.get(key) is not None:
            merged[key] = cfg[key]
    return merged


async def get_material_source_config(
    tenant_id: int,
    material_id: int
) -> Optional[Dict[str, Any]]:
    """
    获取物料的来源配置
    
    Args:
        tenant_id: 租户ID
        material_id: 物料ID
        
    Returns:
        Dict: 物料来源配置信息
    """
    material = await Material.get_or_none(tenant_id=tenant_id, id=material_id)
    if not material:
        return None
    
    source_type = material.source_type
    source_config = normalize_source_config_payload(material.source_config or {})
    
    config = {
        "source_type": source_type,
        "source_config": source_config,
    }
    
    if source_type == SOURCE_TYPE_MAKE:
        # 自制件配置（含制造模式：fabrication 工艺型 / assembly 组合型）
        config.update({
            "manufacturing_mode": source_config.get("manufacturing_mode"),
            "process_route_id": material.process_route_id,
            "production_lead_time": source_config.get("production_lead_time"),
            "min_production_batch": source_config.get("min_production_batch"),
            "production_waste_rate": source_config.get("production_waste_rate"),
        })
    elif source_type == SOURCE_TYPE_BUY:
        # 采购件配置
        config.update({
            "default_supplier_id": source_config.get("default_supplier_id"),
            "default_supplier_name": source_config.get("default_supplier_name"),
            "purchase_lead_time": source_config.get("purchase_lead_time"),
            "min_purchase_batch": source_config.get("min_purchase_batch"),
            "purchase_price": source_config.get("purchase_price"),
        })
    elif source_type == SOURCE_TYPE_OUTSOURCE:
        # 委外件配置
        config.update({
            "outsource_supplier_id": source_config.get("outsource_supplier_id"),
            "outsource_supplier_name": source_config.get("outsource_supplier_name"),
            "outsource_operation": source_config.get("outsource_operation"),
            "outsource_lead_time": source_config.get("outsource_lead_time"),
            "outsource_price": source_config.get("outsource_price"),
            "material_provided_by": source_config.get("material_provided_by", "enterprise"),  # enterprise/supplier
        })
    elif source_type == SOURCE_TYPE_CONFIGURE:
        # 配置件配置
        config.update({
            "variant_attributes": material.variant_attributes,
            "bom_variants": source_config.get("bom_variants"),
            "default_variant": source_config.get("default_variant"),
        })
    
    return config
