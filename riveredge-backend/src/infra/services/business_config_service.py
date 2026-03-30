"""
业务配置服务模块

提供业务配置相关的业务逻辑处理，包括运行模式切换、流程模块开关、流程参数配置等。

Author: Luigi Lu
Date: 2026-01-27
"""

from typing import Dict, Any, Optional, List
from datetime import datetime
from fastapi import HTTPException, status
from loguru import logger

from infra.models.tenant import Tenant, TenantPlan
from infra.exceptions.exceptions import ValidationError, NotFoundError, BusinessLogicError

# 注册表分类文案（前端可直接消费，减少硬编码）
PROCESS_REGISTRY_CATEGORY_META: Dict[str, Dict[str, str]] = {
    "sales": {
        "labelKey": "pages.system.configCenter.processCategory.sales",
        "descriptionKey": "pages.system.configCenter.processCategory.salesDesc",
    },
    "planning": {
        "labelKey": "pages.system.configCenter.processCategory.planning",
        "descriptionKey": "pages.system.configCenter.processCategory.planningDesc",
    },
    "procurement": {
        "labelKey": "pages.system.configCenter.processCategory.procurement",
        "descriptionKey": "pages.system.configCenter.processCategory.procurementDesc",
    },
    "purchase": {
        "labelKey": "pages.system.configCenter.processCategory.procurement",
        "descriptionKey": "pages.system.configCenter.processCategory.procurementDesc",
    },
    "quality": {
        "labelKey": "pages.system.configCenter.processCategory.procurement",
        "descriptionKey": "pages.system.configCenter.processCategory.procurementDesc",
    },
    "work_order": {
        "labelKey": "pages.system.configCenter.processCategory.work_order",
        "descriptionKey": "pages.system.configCenter.processCategory.work_orderDesc",
    },
    "reporting": {
        "labelKey": "pages.system.configCenter.processCategory.reporting",
        "descriptionKey": "pages.system.configCenter.processCategory.reportingDesc",
    },
}

PARAMETER_REGISTRY_CATEGORY_META: Dict[str, Dict[str, str]] = {
    "work_order": {
        "labelKey": "pages.system.configCenter.category.production",
        "descriptionKey": "pages.system.configCenter.category.productionDesc",
    },
    "reporting": {
        "labelKey": "pages.system.configCenter.category.production",
        "descriptionKey": "pages.system.configCenter.category.productionDesc",
    },
    "planning": {
        "labelKey": "pages.system.configCenter.category.production",
        "descriptionKey": "pages.system.configCenter.category.productionDesc",
    },
    "bom": {
        "labelKey": "pages.system.configCenter.category.production",
        "descriptionKey": "pages.system.configCenter.category.productionDesc",
    },
    "warehouse": {
        "labelKey": "pages.system.configCenter.category.supply",
        "descriptionKey": "pages.system.configCenter.category.supplyDesc",
    },
    "purchase": {
        "labelKey": "pages.system.configCenter.category.supply",
        "descriptionKey": "pages.system.configCenter.category.supplyDesc",
    },
    "procurement": {
        "labelKey": "pages.system.configCenter.category.supply",
        "descriptionKey": "pages.system.configCenter.category.supplyDesc",
    },
    "quality": {
        "labelKey": "pages.system.configCenter.category.sales_quality",
        "descriptionKey": "pages.system.configCenter.category.sales_qualityDesc",
    },
    "sales": {
        "labelKey": "pages.system.configCenter.category.sales_quality",
        "descriptionKey": "pages.system.configCenter.category.sales_qualityDesc",
    },
    "finance": {
        "labelKey": "pages.system.configCenter.category.supply",
        "descriptionKey": "pages.system.configCenter.category.supplyDesc",
    },
}

# 参数控件元数据（默认 boolean，可按 full key 覆盖为 number/string/color 并附 min/max）
REGISTRY_PARAM_CONTROL_META: Dict[str, Dict[str, Any]] = {
    "parameters.purchase.tolerance_percentage": {"type": "number", "min": 0, "max": 100},
    "parameters.purchase.price_fluctuation_limit_percent": {"type": "number", "min": 0, "max": 100},
    "parameters.work_order.material_shortage_block_level": {"type": "number", "min": 0, "max": 3},
    "parameters.finance.auto_write_off_precision_limit": {"type": "number", "min": 0, "max": 100},
    "parameters.sales.low_margin_threshold_percent": {"type": "number", "min": 0, "max": 100},
    "parameters.sales.price_deviation_approval_threshold_percent": {"type": "number", "min": 0, "max": 100},
}

# 节点配置常量（供预设构建使用）
_NODE_OFF = {"enabled": False, "auditRequired": False}
_NODE_ON = {"enabled": True, "auditRequired": False}
_NODE_AUDIT = {"enabled": True, "auditRequired": True}


def _build_preset_nodes(all_nodes: list, *pairs) -> dict:
    """(node_id, mode) 其中 mode 为 'off'|'on'|'audit'"""
    d = {n: _NODE_OFF for n in all_nodes}
    for nid, mode in pairs:
        if mode == "audit":
            d[nid] = _NODE_AUDIT
        elif mode == "on":
            d[nid] = _NODE_ON
    return d


# ============ 配置分类常量（业务配置中心三层架构） ============
# 蓝图设置：业务是否开启（modules, nodes.enabled, industry, scale）
BLUEPRINT_KEYS = {"modules", "nodes", "industry", "scale"}

# 流程设置：企业流程控制（审核、流转、自动审批）
PROCESS_KEYS = {
    "nodes.auditRequired",  # 各节点审核要求
    "parameters.sales.audit_enabled",
    "parameters.planning.require_production_plan",
    "parameters.procurement.require_purchase_requisition",
    "parameters.purchase.auto_approval",
    "parameters.reporting.auto_approve",
    "parameters.work_order.picking_issue_strategy",
    "parameters.work_order.picking_confirm_warehouse_only",
    "parameters.work_order.picking_confirm_allowed_role_codes",
    "parameters.work_order.require_confirmed_picking_before_operation_start",
    "parameters.work_order.require_confirmed_picking_before_reporting",
}

# 参数设置：具体业务值（数值、阈值、功能开关）
PARAMETER_KEYS = {
    "parameters.work_order.allow_production_without_material",
    "parameters.work_order.auto_generate",
    "parameters.work_order.priority",
    "parameters.work_order.split",
    "parameters.work_order.merge",
    "parameters.reporting.quick_reporting",
    "parameters.reporting.parameter_reporting",
    "parameters.reporting.auto_fill",
    "parameters.reporting.data_correction",
    "parameters.warehouse.batch_management",
    "parameters.warehouse.serial_management",
    "parameters.warehouse.multi_unit",
    "parameters.warehouse.fifo",
    "parameters.warehouse.lifo",
    "parameters.warehouse.location_management",
    "parameters.warehouse.auto_outbound",
    "parameters.purchase.tolerance_percentage",
    "parameters.purchase.price_fluctuation_limit_percent",
    "parameters.quality.incoming_inspection",
    "parameters.quality.require_incoming_inspection_for_receipt",
    "parameters.quality.process_inspection",
    "parameters.quality.finished_inspection",
    "parameters.quality.defect_handling",
    "parameters.bom.bom_multi_version_allowed",
    "parameters.work_order.material_shortage_block_level",
    "parameters.finance.auto_write_off_precision_limit",
    "parameters.finance.auto_generate_receivable_from_sales_invoice",
    "parameters.finance.auto_generate_payable_from_purchase_invoice",
    "parameters.sales.low_margin_threshold_percent",
    "parameters.sales.price_deviation_approval_threshold_percent",
}

# 已实装并在后端有明确生效点的配置项（用于前端禁用“假开关”）
IMPLEMENTED_PARAMETER_KEYS = {
    # 流程设置
    "parameters.sales.audit_enabled",
    "parameters.planning.require_production_plan",
    "parameters.procurement.require_purchase_requisition",
    "parameters.purchase.auto_approval",
    "parameters.reporting.auto_approve",
    "parameters.work_order.picking_issue_strategy",
    "parameters.work_order.picking_confirm_warehouse_only",
    "parameters.work_order.picking_confirm_allowed_role_codes",
    "parameters.work_order.require_confirmed_picking_before_operation_start",
    "parameters.work_order.require_confirmed_picking_before_reporting",
    # 参数设置
    "parameters.work_order.allow_production_without_material",
    "parameters.work_order.auto_generate",
    "parameters.work_order.priority",
    "parameters.work_order.split",
    "parameters.work_order.merge",
    "parameters.reporting.quick_reporting",
    "parameters.reporting.parameter_reporting",
    "parameters.reporting.data_correction",
    "parameters.warehouse.batch_management",
    "parameters.warehouse.serial_management",
    "parameters.warehouse.lifo",
    "parameters.warehouse.location_management",
    "parameters.warehouse.auto_outbound",
    "parameters.purchase.tolerance_percentage",
    "parameters.purchase.price_fluctuation_limit_percent",
    "parameters.quality.incoming_inspection",
    "parameters.quality.require_incoming_inspection_for_receipt",
    "parameters.quality.process_inspection",
    "parameters.quality.finished_inspection",
    "parameters.quality.defect_handling",
    "parameters.bom.bom_multi_version_allowed",
    "parameters.work_order.material_shortage_block_level",
    "parameters.finance.auto_write_off_precision_limit",
    "parameters.finance.auto_generate_receivable_from_sales_invoice",
    "parameters.finance.auto_generate_payable_from_purchase_invoice",
    "parameters.sales.low_margin_threshold_percent",
    "parameters.sales.price_deviation_approval_threshold_percent",
}

DEFAULT_WAREHOUSE_ROLE_CODES = {
    "WAREHOUSE",
    "WAREHOUSE_MANAGER",
    "WAREHOUSE_ADMIN",
    "INVENTORY",
    "INVENTORY_MANAGER",
}

DEFAULT_PRODUCTION_PICKING_CONFIRM_ROLE_CODES = {
    "PRODUCTION",
    "PRODUCTION_MANAGER",
    "PRODUCTION_WORKER",
    "WORKSHOP",
    "WORKSHOP_MANAGER",
    "DEPT_MANAGER",
}

# 全部业务节点（与蓝图 / 前端 BACKEND_NODE_IDS 一致；新增节点须同步此处，否则「全模块全开」预设不会写入）
ALL_NODES = [
    "quotation", "sample_trial", "sales_forecast", "sales_order", "sales_delivery", "shipment_notice", "delivery_notice",
    "sales_return", "customer_follow_up",
    "demand", "demand_computation", "production_control_tower",
    "purchase_request", "purchase_order", "receipt_notice", "inbound_delivery", "logistics_tracking", "purchase_return",
    "production_plan", "work_order", "rework_order", "outsource_order",
    "quality_inspection", "inspection_center", "inventory_check",
    "equipment_fault", "maintenance_plan", "maintenance_reminder", "equipment_status", "spare_parts",
    "mold_usage", "mold_calibration", "mold_maintenance_reminder",
    "tool_usage", "tool_maintenance", "tool_calibration", "tool_maintenance_reminder",
    "inbound", "outbound", "other_inbound", "other_outbound", "stocktaking", "inventory_transfer",
    "assembly_order", "disassembly_order", "material_borrow", "material_return", "barcode_mapping",
    "batch_inventory_query", "material_call",
    "receivable", "payable", "invoice", "cost_calculation",
]

KEY_AUDIT_NODES = [
    "sales_forecast",
    "sales_order",
    "purchase_request",
    "purchase_order",
    "production_plan",
    "quality_inspection",
    "inspection_center",
    "inventory_check",
    "receivable",
    "payable",
    "invoice",
]


def _build_registry_schema(full_keys: set) -> Dict[str, List[str]]:
    """将 parameters.<category>.<key> 集合构建为 {category: [key]}"""
    result: Dict[str, List[str]] = {}
    for full_key in full_keys:
        if not full_key.startswith("parameters."):
            continue
        parts = full_key.replace("parameters.", "").split(".", 1)
        if len(parts) == 2:
            category, key = parts
            if category not in result:
                result[category] = []
            if key not in result[category]:
                result[category].append(key)
    return result


def _build_process_registry_schema() -> Dict[str, List[str]]:
    """流程设置注册表（仅流程类 key）"""
    return _build_registry_schema(PROCESS_KEYS)


def _build_parameter_registry_schema() -> Dict[str, List[str]]:
    """参数设置注册表（仅参数类 key）"""
    return _build_registry_schema(PARAMETER_KEYS)


def _build_registry_category_meta_schema(
    registry_schema: Dict[str, List[str]],
    category_meta: Dict[str, Dict[str, str]],
) -> Dict[str, Dict[str, str]]:
    """返回注册表分类文案元数据（仅返回当前 registry 中存在的分类）"""
    result: Dict[str, Dict[str, str]] = {}
    for category in registry_schema.keys():
        if category in category_meta:
            result[category] = dict(category_meta[category])
    return result


def _build_process_registry_meta_schema() -> Dict[str, Dict[str, str]]:
    return _build_registry_category_meta_schema(
        _build_process_registry_schema(),
        PROCESS_REGISTRY_CATEGORY_META,
    )


def _build_parameter_registry_meta_schema() -> Dict[str, Dict[str, str]]:
    return _build_registry_category_meta_schema(
        _build_parameter_registry_schema(),
        PARAMETER_REGISTRY_CATEGORY_META,
    )


def _build_registry_param_meta_schema(
    registry_schema: Dict[str, List[str]],
) -> Dict[str, Dict[str, Dict[str, str]]]:
    """
    参数项文案元数据（按 category/key）：
    {category: {key: {labelKey, descriptionKey}}}
    """
    result: Dict[str, Dict[str, Dict[str, str]]] = {}
    for category, keys in registry_schema.items():
        result[category] = {}
        for key in keys:
            base = f"{category}_{key}"
            result[category][key] = {
                "labelKey": f"pages.system.configCenter.param.{base}",
                "descriptionKey": f"pages.system.configCenter.param.{base}_desc",
            }
    return result


def _build_process_registry_param_meta_schema() -> Dict[str, Dict[str, Dict[str, str]]]:
    return _build_registry_param_meta_schema(_build_process_registry_schema())


def _build_parameter_registry_param_meta_schema() -> Dict[str, Dict[str, Dict[str, str]]]:
    return _build_registry_param_meta_schema(_build_parameter_registry_schema())


def _build_registry_control_meta_schema(
    registry_schema: Dict[str, List[str]],
) -> Dict[str, Dict[str, Dict[str, Any]]]:
    """
    参数控件元数据（按 category/key）：
    {category: {key: {type, min?, max?}}}
    """
    result: Dict[str, Dict[str, Dict[str, Any]]] = {}
    for category, keys in registry_schema.items():
        result[category] = {}
        for key in keys:
            full_key = f"parameters.{category}.{key}"
            override = REGISTRY_PARAM_CONTROL_META.get(full_key, {})
            item: Dict[str, Any] = {
                "type": override.get("type", "boolean"),
            }
            if "min" in override:
                item["min"] = override["min"]
            if "max" in override:
                item["max"] = override["max"]
            result[category][key] = item
    return result


def _build_process_registry_control_meta_schema() -> Dict[str, Dict[str, Dict[str, Any]]]:
    return _build_registry_control_meta_schema(_build_process_registry_schema())


def _build_parameter_registry_control_meta_schema() -> Dict[str, Dict[str, Dict[str, Any]]]:
    return _build_registry_control_meta_schema(_build_parameter_registry_schema())


def _build_parameter_keys_schema() -> Dict[str, List[str]]:
    """
    兼容字段：保留历史 parameterKeys（流程+参数并集）。
    建议新调用方改用 processRegistry / parameterRegistry。
    """
    result = _build_parameter_registry_schema()
    for category, keys in _build_process_registry_schema().items():
        if category not in result:
            result[category] = []
        for key in keys:
            if key not in result[category]:
                result[category].append(key)
    return result


def _build_parameter_implementation_schema() -> Dict[str, Dict[str, bool]]:
    """返回参数实装状态：{category: {key: implemented_bool}}"""
    result: Dict[str, Dict[str, bool]] = {}
    for full_key in PARAMETER_KEYS | PROCESS_KEYS:
        if not full_key.startswith("parameters."):
            continue
        parts = full_key.replace("parameters.", "").split(".", 1)
        if len(parts) != 2:
            continue
        category, key = parts
        if category not in result:
            result[category] = {}
        result[category][key] = full_key in IMPLEMENTED_PARAMETER_KEYS
    return result


class BusinessConfigService:
    """
    业务配置服务类
    
    提供业务配置相关的业务逻辑处理。
    """
    
    # 运行模式定义
    RUNNING_MODE_SIMPLE = "simple"  # 极简模式
    RUNNING_MODE_FULL = "full"      # 全流程模式
    
    # 极简模式默认配置
    SIMPLE_MODE_CONFIG = {
        "industry": "general",
        "scale": "small",
        "nodes": {
            "quotation": {"enabled": False, "auditRequired": False},
            "sample_trial": {"enabled": False, "auditRequired": False},
            "sales_forecast": {"enabled": True, "auditRequired": False},
            "sales_order": {"enabled": True, "auditRequired": False},
            "sales_delivery": {"enabled": True, "auditRequired": False},
            "shipment_notice": {"enabled": True, "auditRequired": False},
            "delivery_notice": {"enabled": False, "auditRequired": False},
            "sales_return": {"enabled": False, "auditRequired": False},
            "customer_follow_up": {"enabled": False, "auditRequired": False},
            "demand": {"enabled": True, "auditRequired": False},
            "demand_computation": {"enabled": True, "auditRequired": False},
            "production_control_tower": {"enabled": False, "auditRequired": False},
            "purchase_request": {"enabled": True, "auditRequired": False},
            "purchase_order": {"enabled": True, "auditRequired": False},
            "receipt_notice": {"enabled": True, "auditRequired": False},
            "inbound_delivery": {"enabled": True, "auditRequired": False},
            "logistics_tracking": {"enabled": False, "auditRequired": False},
            "purchase_return": {"enabled": False, "auditRequired": False},
            "production_plan": {"enabled": False, "auditRequired": False},
            "work_order": {"enabled": True, "auditRequired": False},
            "rework_order": {"enabled": False, "auditRequired": False},
            "outsource_order": {"enabled": False, "auditRequired": False},
            "quality_inspection": {"enabled": False, "auditRequired": False},
            "inspection_center": {"enabled": False, "auditRequired": False},
            "inventory_check": {"enabled": False, "auditRequired": False},
            "equipment_fault": {"enabled": False, "auditRequired": False},
            "maintenance_plan": {"enabled": False, "auditRequired": False},
            "maintenance_reminder": {"enabled": False, "auditRequired": False},
            "equipment_status": {"enabled": False, "auditRequired": False},
            "spare_parts": {"enabled": False, "auditRequired": False},
            "mold_usage": {"enabled": False, "auditRequired": False},
            "mold_calibration": {"enabled": False, "auditRequired": False},
            "mold_maintenance_reminder": {"enabled": False, "auditRequired": False},
            "tool_usage": {"enabled": False, "auditRequired": False},
            "tool_maintenance": {"enabled": False, "auditRequired": False},
            "tool_calibration": {"enabled": False, "auditRequired": False},
            "tool_maintenance_reminder": {"enabled": False, "auditRequired": False},
            "inbound": {"enabled": True, "auditRequired": False},
            "outbound": {"enabled": True, "auditRequired": False},
            "other_inbound": {"enabled": False, "auditRequired": False},
            "other_outbound": {"enabled": False, "auditRequired": False},
            "stocktaking": {"enabled": False, "auditRequired": False},
            "inventory_transfer": {"enabled": False, "auditRequired": False},
            "assembly_order": {"enabled": False, "auditRequired": False},
            "disassembly_order": {"enabled": False, "auditRequired": False},
            "material_borrow": {"enabled": False, "auditRequired": False},
            "material_return": {"enabled": False, "auditRequired": False},
            "barcode_mapping": {"enabled": False, "auditRequired": False},
            "batch_inventory_query": {"enabled": False, "auditRequired": False},
            "material_call": {"enabled": False, "auditRequired": False},
            "receivable": {"enabled": False, "auditRequired": False},
            "payable": {"enabled": False, "auditRequired": False},
            "invoice": {"enabled": False, "auditRequired": False},
            "cost_calculation": {"enabled": False, "auditRequired": False},
        },
        "modules": {
            "production": True,
            "warehouse": True,
            "demand": True,
            "purchase": True,
            "sales": True,
            "quality": False,
            "finance": False,
            "equipment": False,
        },
        "parameters": {
            "work_order": {
                "auto_generate": True,   # 允许自动生成
                "priority": False,       # 简化优先级管理
                "split": False,          # 关闭拆单
                "merge": False,          # 关闭合单
                "allow_production_without_material": False,  # 允许不带料生产（只管制造过程，不检查缺料）
                "material_shortage_block_level": 1,  # 缺料拦截级别：0=不拦截，1=下达，2=下达+开工，3=下达+开工+报工
                "picking_issue_strategy": "after_release",
                "picking_confirm_warehouse_only": True,
                "picking_confirm_allowed_role_codes": [],
                "require_confirmed_picking_before_operation_start": False,
                "require_confirmed_picking_before_reporting": False,
            },
            "reporting": {
                "quick_reporting": True,     # 开启快捷报工
                "parameter_reporting": False, # 关闭参数报工
                "auto_fill": True,           # 开启自动填充
                "data_correction": False,    # 关闭数据修正
                "auto_approve": False,       # 开启后，提交的报工记录将自动通过审核
            },
            "warehouse": {
                "batch_management": False,   # 关闭批次管理
                "location_management": False,# 关闭库位管理
                "fifo": False,               # 关闭先进先出强制
                "auto_outbound": True,       # 开启自动出库
            },
            "purchase": {
                "auto_approval": True,       # 开启采购自动审批
                "tolerance_percentage": 0,   # 采购超收容差（%）
                "price_fluctuation_limit_percent": 0,  # 采购价格偏差阈值（%），0 表示不启用
                "price_control": False,      # 关闭价格控制
                "supplier_evaluation": False,# 关闭供应商评估
            },
            "bom": {
                "bom_multi_version_allowed": True,  # BOM 是否允许多版本共存，需求计算时可选择版本
            },
            "planning": {
                "require_production_plan": False,  # 极简模式下计划节点关闭，仅可直连工单
            },
            "sales": {
                "low_margin_threshold_percent": 0,  # 低毛利阈值（%），0 表示不启用拦截
                "price_deviation_approval_threshold_percent": 0,  # 销售价格偏差触发审批阈值（%），0 表示不启用
            },
            "finance": {
                "auto_write_off_precision_limit": 0,  # 核销尾差自动冲平限额（本位币）
                "auto_generate_receivable_from_sales_invoice": False,  # 销售开票自动生成应收
                "auto_generate_payable_from_purchase_invoice": False,  # 采购开票自动生成应付
            },
        }
    }
    
    MAX_RECURSION_DEPTH = 3  # 防止无限递归

    async def check_node_enabled(self, tenant_id: int, node_key: str) -> bool:
        """
        检查业务节点是否启用
        """
        config = await self.get_business_config(tenant_id)
        nodes = config.get("nodes", {})
        node_config = nodes.get(node_key)
        
        # 如果节点配置不存在，默认启用（向后兼容）
        if not node_config:
            return True
            
        return node_config.get("enabled", True)

    async def get_bom_multi_version_allowed(self, tenant_id: int) -> bool:
        """
        获取 BOM 是否允许多版本共存配置
        
        当为 true 时，需求计算可选择 BOM 版本；为 false 时，统一使用默认版本。
        """
        config = await self.get_business_config(tenant_id)
        bom_params = config.get("parameters", {}).get("bom", {})
        return bom_params.get("bom_multi_version_allowed", True)

    async def allow_production_without_material(self, tenant_id: int) -> bool:
        """
        获取是否允许不带料生产配置
        
        当为 true 时，工单下达不检查缺料，只管制造过程；为 false 时，缺料则禁止下达。
        """
        return (await self.get_material_shortage_block_level(tenant_id)) <= 0

    async def get_material_shortage_block_level(self, tenant_id: int) -> int:
        """
        获取缺料拦截级别（0~3）：
        0=不拦截，1=下达拦截，2=下达+开工拦截，3=下达+开工+报工拦截。
        """
        config = await self.get_business_config(tenant_id)
        wo_params = config.get("parameters", {}).get("work_order", {})
        raw_level = wo_params.get("material_shortage_block_level", None)
        if raw_level is None:
            allow_without_material = bool(wo_params.get("allow_production_without_material", False))
            return 0 if allow_without_material else 1

        try:
            level = int(raw_level)
        except Exception:
            level = 1
        return max(0, min(3, level))

    async def get_purchase_tolerance_percentage(self, tenant_id: int) -> float:
        """获取采购超收容差百分比（0~100）。"""
        config = await self.get_business_config(tenant_id)
        purchase_params = config.get("parameters", {}).get("purchase", {})
        raw_pct = purchase_params.get("tolerance_percentage", 0)
        try:
            pct = float(raw_pct)
        except Exception:
            pct = 0.0
        return max(0.0, min(100.0, pct))

    async def get_purchase_price_fluctuation_limit_percent(self, tenant_id: int) -> float:
        """获取采购价格偏差阈值（0~100，0=关闭）。"""
        config = await self.get_business_config(tenant_id)
        purchase_params = config.get("parameters", {}).get("purchase", {})
        raw_pct = purchase_params.get("price_fluctuation_limit_percent", 0)
        try:
            pct = float(raw_pct)
        except Exception:
            pct = 0.0
        return max(0.0, min(100.0, pct))

    async def get_sales_low_margin_threshold_percent(self, tenant_id: int) -> float:
        """获取销售低毛利阈值百分比（0~100，0=关闭）。"""
        config = await self.get_business_config(tenant_id)
        sales_params = config.get("parameters", {}).get("sales", {})
        raw_pct = sales_params.get("low_margin_threshold_percent", 0)
        try:
            pct = float(raw_pct)
        except Exception:
            pct = 0.0
        return max(0.0, min(100.0, pct))

    async def get_sales_price_deviation_approval_threshold_percent(self, tenant_id: int) -> float:
        """获取销售价格偏差触发审批阈值（0~100，0=关闭）。"""
        config = await self.get_business_config(tenant_id)
        sales_params = config.get("parameters", {}).get("sales", {})
        raw_pct = sales_params.get("price_deviation_approval_threshold_percent", 0)
        try:
            pct = float(raw_pct)
        except Exception:
            pct = 0.0
        return max(0.0, min(100.0, pct))

    async def get_finance_auto_write_off_precision_limit(self, tenant_id: int) -> float:
        """获取财务尾差自动冲平限额（>=0）。"""
        config = await self.get_business_config(tenant_id)
        finance_params = config.get("parameters", {}).get("finance", {})
        raw_limit = finance_params.get("auto_write_off_precision_limit", 0)
        try:
            limit = float(raw_limit)
        except Exception:
            limit = 0.0
        return max(0.0, min(100.0, limit))

    async def get_finance_auto_generate_receivable_from_sales_invoice(self, tenant_id: int) -> bool:
        """是否启用销售开票自动生成应收。"""
        config = await self.get_business_config(tenant_id)
        finance_params = config.get("parameters", {}).get("finance", {})
        return bool(finance_params.get("auto_generate_receivable_from_sales_invoice", False))

    async def get_finance_auto_generate_payable_from_purchase_invoice(self, tenant_id: int) -> bool:
        """是否启用采购开票自动生成应付。"""
        config = await self.get_business_config(tenant_id)
        finance_params = config.get("parameters", {}).get("finance", {})
        return bool(finance_params.get("auto_generate_payable_from_purchase_invoice", False))

    async def check_audit_required(self, tenant_id: int, node_key: str) -> bool:
        """
        检查业务节点是否需要审核
        """
        config = await self.get_business_config(tenant_id)
        nodes = config.get("nodes", {})
        node_config = nodes.get(node_key)
        # 销售订单：任一为「无需审核」则无需审核。1) parameters.sales.audit_enabled=False 表示关闭审核；2) 蓝图 nodes.sales_order.auditRequired=False 表示自动审核
        if node_key == "sales_order":
            sales_params = config.get("parameters", {}).get("sales", {})
            if sales_params.get("audit_enabled", True) is False:
                return False
            if node_config is not None:
                return bool(node_config.get("auditRequired", False))
            return False

        # 采购订单：1) parameters.purchase.auto_approval=True 表示提交后自动通过；2) 蓝图 nodes.purchase_order.auditRequired
        if node_key == "purchase_order":
            purchase_params = config.get("parameters", {}).get("purchase", {})
            if purchase_params.get("auto_approval", False) is True:
                return False
            if node_config is not None:
                return bool(node_config.get("auditRequired", False))
            return False

        # 如果节点配置不存在，默认需要审核（向后兼容，或者根据模式决定，这里简便起见默认True或根据simple模式? 
        # 为了安全起见，如果不配置，默认False可能更符合"极简"体验，但默认True符合"严谨"体验。
        # 参考 get_business_config 中的默认值补全逻辑，如果拿到 config，应该已经补全了默认值。
        
        if not node_config:
            # Fallback based on running mode logic if needed, but get_business_config should handle defaults.
            # If still missing, assume specific defaults logic or False
            return False
            
        return node_config.get("auditRequired", False)

    async def can_direct_generate_work_order_from_computation(self, tenant_id: int) -> bool:
        """
        检查需求计算是否可直接生成工单（不经过生产计划）。
        - production_plan.enabled=false 时：计划层关闭，仅可直连，返回 True
        - production_plan.enabled=true 且 require_production_plan=false 时：可直连可经计划，返回 True
        - production_plan.enabled=true 且 require_production_plan=true 时：必须经计划，返回 False
        """
        plan_enabled = await self.check_node_enabled(tenant_id, "production_plan")
        if not plan_enabled:
            return True  # 计划关闭，必须直连
        config = await self.get_business_config(tenant_id)
        require_plan = config.get("parameters", {}).get("planning", {}).get("require_production_plan", False)
        return not require_plan

    async def get_planning_config(self, tenant_id: int) -> Dict[str, Any]:
        """
        获取计划管理相关配置，供前端展示当前模式。
        """
        plan_enabled = await self.check_node_enabled(tenant_id, "production_plan")
        audit_required = await self.check_audit_required(tenant_id, "production_plan")
        can_direct_wo = await self.can_direct_generate_work_order_from_computation(tenant_id)
        return {
            "production_plan_enabled": plan_enabled,
            "production_plan_audit_required": audit_required,
            "can_direct_generate_work_order": can_direct_wo,
            "planning_mode": "direct" if not plan_enabled or can_direct_wo else "via_plan",
        }

    async def get_work_order_picking_policy(self, tenant_id: int) -> Dict[str, Any]:
        """
        获取工单领料策略（角色 + 开工/报工门禁）
        """
        config = await self.get_business_config(tenant_id)
        wo_params = config.get("parameters", {}).get("work_order", {})

        issue_strategy = str(wo_params.get("picking_issue_strategy", "after_release") or "after_release")
        warehouse_only = bool(wo_params.get("picking_confirm_warehouse_only", True))
        require_before_start = bool(wo_params.get("require_confirmed_picking_before_operation_start", False))
        require_before_reporting = bool(wo_params.get("require_confirmed_picking_before_reporting", False))

        configured_codes = wo_params.get("picking_confirm_allowed_role_codes", [])
        if not isinstance(configured_codes, list):
            configured_codes = []
        normalized_extra_codes = sorted({
            str(code).strip().upper()
            for code in configured_codes
            if str(code).strip()
        })

        allowed_codes = set(DEFAULT_WAREHOUSE_ROLE_CODES)
        if warehouse_only:
            allowed_codes = set(DEFAULT_WAREHOUSE_ROLE_CODES)
        else:
            allowed_codes.update(normalized_extra_codes or DEFAULT_PRODUCTION_PICKING_CONFIRM_ROLE_CODES)

        return {
            "picking_issue_strategy": issue_strategy,
            "picking_confirm_warehouse_only": warehouse_only,
            "picking_confirm_allowed_role_codes": normalized_extra_codes,
            "require_confirmed_picking_before_operation_start": require_before_start,
            "require_confirmed_picking_before_reporting": require_before_reporting,
            "default_warehouse_role_codes": sorted(DEFAULT_WAREHOUSE_ROLE_CODES),
            "effective_allowed_role_codes": sorted(allowed_codes),
        }

    
    # 全流程模式默认配置
    FULL_MODE_CONFIG = {
        "industry": "general",
        "scale": "medium",
        "nodes": {
            "quotation": {"enabled": True, "auditRequired": False},
            "sample_trial": {"enabled": True, "auditRequired": False},
            "sales_forecast": {"enabled": True, "auditRequired": True},
            "sales_order": {"enabled": True, "auditRequired": True},
            "sales_delivery": {"enabled": True, "auditRequired": True},
            "shipment_notice": {"enabled": True, "auditRequired": False},
            "delivery_notice": {"enabled": True, "auditRequired": False},
            "sales_return": {"enabled": True, "auditRequired": False},
            "customer_follow_up": {"enabled": True, "auditRequired": False},
            "demand": {"enabled": True, "auditRequired": False},
            "demand_computation": {"enabled": True, "auditRequired": False},
            "production_control_tower": {"enabled": True, "auditRequired": False},
            "purchase_request": {"enabled": True, "auditRequired": True},
            "purchase_order": {"enabled": True, "auditRequired": True},
            "receipt_notice": {"enabled": True, "auditRequired": False},
            "inbound_delivery": {"enabled": True, "auditRequired": False},
            "logistics_tracking": {"enabled": True, "auditRequired": False},
            "purchase_return": {"enabled": True, "auditRequired": False},
            "production_plan": {"enabled": True, "auditRequired": True},
            "work_order": {"enabled": True, "auditRequired": False},
            "rework_order": {"enabled": True, "auditRequired": False},
            "outsource_order": {"enabled": True, "auditRequired": False},
            "quality_inspection": {"enabled": True, "auditRequired": True},
            "inspection_center": {"enabled": True, "auditRequired": True},
            "inventory_check": {"enabled": True, "auditRequired": True},
            "equipment_fault": {"enabled": True, "auditRequired": False},
            "maintenance_plan": {"enabled": True, "auditRequired": False},
            "maintenance_reminder": {"enabled": True, "auditRequired": False},
            "equipment_status": {"enabled": True, "auditRequired": False},
            "spare_parts": {"enabled": True, "auditRequired": False},
            "mold_usage": {"enabled": True, "auditRequired": False},
            "mold_calibration": {"enabled": True, "auditRequired": False},
            "mold_maintenance_reminder": {"enabled": True, "auditRequired": False},
            "tool_usage": {"enabled": True, "auditRequired": False},
            "tool_maintenance": {"enabled": True, "auditRequired": False},
            "tool_calibration": {"enabled": True, "auditRequired": False},
            "tool_maintenance_reminder": {"enabled": True, "auditRequired": False},
            "inbound": {"enabled": True, "auditRequired": False},
            "outbound": {"enabled": True, "auditRequired": False},
            "other_inbound": {"enabled": True, "auditRequired": False},
            "other_outbound": {"enabled": True, "auditRequired": False},
            "stocktaking": {"enabled": True, "auditRequired": False},
            "inventory_transfer": {"enabled": True, "auditRequired": False},
            "assembly_order": {"enabled": True, "auditRequired": False},
            "disassembly_order": {"enabled": True, "auditRequired": False},
            "material_borrow": {"enabled": True, "auditRequired": False},
            "material_return": {"enabled": True, "auditRequired": False},
            "barcode_mapping": {"enabled": True, "auditRequired": False},
            "batch_inventory_query": {"enabled": True, "auditRequired": False},
            "material_call": {"enabled": True, "auditRequired": False},
            "receivable": {"enabled": True, "auditRequired": False},
            "payable": {"enabled": True, "auditRequired": False},
            "invoice": {"enabled": True, "auditRequired": False},
            "cost_calculation": {"enabled": True, "auditRequired": False},
        },
        "modules": {
            "production": True,
            "warehouse": True,
            "demand": True,
            "purchase": True,
            "sales": True,
            "quality": True,
            "finance": True,
            "equipment": True,
        },
        "parameters": {
            "work_order": {
                "auto_generate": True,
                "priority": True,
                "split": True,
                "merge": True,
                "allow_production_without_material": False,  # 允许不带料生产（只管制造过程，不检查缺料）
                "material_shortage_block_level": 1,  # 缺料拦截级别：0=不拦截，1=下达，2=下达+开工，3=下达+开工+报工
                "picking_issue_strategy": "after_release",
                "picking_confirm_warehouse_only": True,
                "picking_confirm_allowed_role_codes": [],
                "require_confirmed_picking_before_operation_start": False,
                "require_confirmed_picking_before_reporting": False,
            },
            "reporting": {
                "quick_reporting": True,
                "parameter_reporting": True,
                "auto_fill": True,
                "data_correction": True,
                "auto_approve": False,       # 开启后，提交的报工记录将自动通过审核
            },
            "warehouse": {
                "batch_management": True,
                "serial_management": True,
                "multi_unit": True,
                "fifo": True,
                "lifo": False,
            },
            "quality": {
                "incoming_inspection": True,
                "require_incoming_inspection_for_receipt": False,
                "process_inspection": True,
                "finished_inspection": True,
                "defect_handling": True,
            },
            "sales": {
                "audit_enabled": True,
                "low_margin_threshold_percent": 0,  # 低毛利阈值（%），0 表示不启用拦截
                "price_deviation_approval_threshold_percent": 0,  # 销售价格偏差触发审批阈值（%），0 表示不启用
            },
            "purchase": {
                "auto_approval": False,  # 全流程默认走人工审核；与 nodes.purchase_order.auditRequired 配合
                "tolerance_percentage": 0,  # 采购超收容差（%）
                "price_fluctuation_limit_percent": 0,  # 采购价格偏差阈值（%），0 表示不启用
                "price_control": False,
                "supplier_evaluation": False,
            },
            "procurement": {
                "require_purchase_requisition": False,
            },
            "planning": {
                "require_production_plan": False,
            },
            "bom": {
                "bom_multi_version_allowed": True,  # BOM 是否允许多版本共存，需求计算时可选择版本
            },
            "finance": {
                "auto_write_off_precision_limit": 0,  # 核销尾差自动冲平限额（本位币）
                "auto_generate_receivable_from_sales_invoice": False,  # 销售开票自动生成应收
                "auto_generate_payable_from_purchase_invoice": False,  # 采购开票自动生成应付
            },
        },
    }
    
    # 最小必要内置模式（按最佳实践保留）
    COMPLEXITY_PRESETS = {
        "M1": {
            "code": "M1",
            "name": "快速上线（生产+仓储）",
            "description": "适合 0-2 周快速试运行，先跑工单与收发存",
            "nodes": _build_preset_nodes(
                ALL_NODES,
                ("work_order", "on"),
                ("inbound", "on"),
                ("outbound", "on"),
            ),
            "modules": {
                "production": True, "warehouse": True, "demand": False,
                "purchase": False, "sales": False, "quality": False, "finance": False, "equipment": False,
            },
            "parameters": {
                "planning": {"require_production_plan": False},
                "procurement": {"require_purchase_requisition": False},
                "work_order": {"allow_production_without_material": True},
                "sales": {"audit_enabled": False},
                "purchase": {"auto_approval": True},
                "reporting": {"auto_approve": True},
            },
        },
        "M2": {
            "code": "M2",
            "name": "标准运营（产供销协同）",
            "description": "适合 1-3 个月，中小制造企业常用主流程",
            "nodes": _build_preset_nodes(
                ALL_NODES,
                ("quotation", "on"), ("sample_trial", "on"), ("sales_forecast", "on"), ("sales_order", "on"), ("sales_delivery", "on"), ("shipment_notice", "on"), ("delivery_notice", "on"),
                ("demand", "on"), ("demand_computation", "on"),
                ("purchase_request", "on"), ("purchase_order", "on"), ("receipt_notice", "on"), ("inbound_delivery", "on"),
                ("production_plan", "on"), ("work_order", "on"), ("rework_order", "on"), ("outsource_order", "on"),
                ("quality_inspection", "on"), ("inventory_check", "on"),
                ("inbound", "on"), ("outbound", "on"), ("other_inbound", "on"), ("other_outbound", "on"), ("stocktaking", "on"), ("inventory_transfer", "on"), ("assembly_order", "on"), ("disassembly_order", "on"), ("material_borrow", "on"), ("material_return", "on"), ("barcode_mapping", "on"),
            ),
            "modules": {
                "production": True, "warehouse": True, "demand": True,
                "purchase": True, "sales": True, "quality": True, "finance": False, "equipment": False,
            },
            "parameters": {
                "planning": {"require_production_plan": False},
                "procurement": {"require_purchase_requisition": False},
                "work_order": {"allow_production_without_material": False},
                "sales": {"audit_enabled": False},
                "purchase": {"auto_approval": True},
                "reporting": {"auto_approve": True},
            },
        },
        "M3": {
            "code": "M3",
            "name": "全模块全开（无审核）",
            "description": "全节点启用，适合追求效率与快速流转的团队",
            "nodes": _build_preset_nodes(ALL_NODES, *[(n, "on") for n in ALL_NODES]),
            "modules": {
                "production": True, "warehouse": True, "demand": True,
                "purchase": True, "sales": True, "quality": True, "finance": True, "equipment": True,
            },
            "parameters": {
                "planning": {"require_production_plan": False},
                "procurement": {"require_purchase_requisition": False},
                "work_order": {"allow_production_without_material": False},
                "sales": {"audit_enabled": False},
                "purchase": {"auto_approval": True},
                "reporting": {"auto_approve": True},
            },
        },
        "M4": {
            "code": "M4",
            "name": "全模块全开（关键节点审核）",
            "description": "全节点启用，关键业务节点强制审核，兼顾效率与风控",
            "nodes": _build_preset_nodes(
                ALL_NODES,
                *[(n, "audit" if n in KEY_AUDIT_NODES else "on") for n in ALL_NODES]
            ),
            "modules": {
                "production": True, "warehouse": True, "demand": True,
                "purchase": True, "sales": True, "quality": True, "finance": True, "equipment": True,
            },
            "parameters": {
                "planning": {"require_production_plan": False},
                "procurement": {"require_purchase_requisition": True},
                "work_order": {"allow_production_without_material": False},
                "sales": {"audit_enabled": True},
                "purchase": {"auto_approval": False},
                "reporting": {"auto_approve": False},
            },
        },
    }

    # 默认业务复杂度（新租户或未配置时使用）
    DEFAULT_COMPLEXITY_LEVEL = "M2"

    # 核心模块列表（不可关闭）
    CORE_MODULES = ["production", "warehouse"]
    
    # PRO版功能列表（需要专业套餐或企业套餐）
    PRO_FEATURES = {
        "modules": [
            "advanced_scheduling",      # 高级排产
            "outsourcing",              # 工序委外管理
            "purchase_inquiry",         # 采购询价
            "purchase_contract",        # 采购合同
            "quality_analysis",         # 质量统计分析
            "customer_material",        # 客户来料登记
            "warehouse_optimization",   # 仓储优化建议
            "supply_chain",             # 企业上下游协同
        ],
        "parameters": {
            "work_order": [
                "advanced_scheduling",  # 高级排产
            ],
            "warehouse": [
                "warehouse_optimization",  # 仓储优化建议
            ],
            "quality": [
                "quality_analysis",     # 质量统计分析
            ],
        },
    }
    
    # PRO版套餐列表
    PRO_PLANS = ["professional", "enterprise"]
    
    async def get_business_config(self, tenant_id: int) -> Dict[str, Any]:
        """
        获取业务配置
        
        Args:
            tenant_id: 组织ID
            
        Returns:
            Dict[str, Any]: 业务配置
        """
        tenant = await Tenant.get_or_none(id=tenant_id)
        if not tenant:
            raise NotFoundError(f"组织不存在: {tenant_id}")
        
        settings = tenant.settings or {}
        business_config = settings.get("business_config", {})
        
        # 如果没有配置，返回默认配置（极简模式）
        if not business_config:
            business_config = {
                "running_mode": self.RUNNING_MODE_SIMPLE,
                **self.SIMPLE_MODE_CONFIG,
            }
        else:
            # 确保必需字段存在（处理旧数据或不完整数据）
            if "running_mode" not in business_config:
                business_config["running_mode"] = self.RUNNING_MODE_SIMPLE
            
            # Ensure industry and scale (defaults)
            if "industry" not in business_config:
                business_config["industry"] = "general"
            if "scale" not in business_config:
                business_config["scale"] = "medium"
                
            # 确保 default modules 和 parameters 存在
            # 使用 setdefault 确保一级 key 存在
            business_config.setdefault("modules", {})
            business_config.setdefault("nodes", {})
            business_config.setdefault("parameters", {})
            
            # 递归合并缺少的配置项（例如 sales.audit_enabled）
            # 根据当前模式（默认为 simple）获取对应的默认配置作为参考
            current_mode = business_config.get("running_mode", self.RUNNING_MODE_SIMPLE)
            default_config = self.SIMPLE_MODE_CONFIG if current_mode == self.RUNNING_MODE_SIMPLE else self.FULL_MODE_CONFIG
            
            # 补全缺失的 modules
            for mod, enabled in default_config["modules"].items():
                if mod not in business_config["modules"]:
                    business_config["modules"][mod] = enabled
            
            # Populate nodes if empty (using default nodes from config)
            if not business_config["nodes"]:
                 business_config["nodes"] = default_config["nodes"]
            else:
                 # Check for missing nodes keys? Assuming overwrite or merge?
                 # For now, merge missing keys
                 for key, val in default_config["nodes"].items():
                     if key not in business_config["nodes"]:
                         business_config["nodes"][key] = val
            
            # 补全缺失的 parameters
            for cat, params in default_config["parameters"].items():
                if cat not in business_config["parameters"]:
                    business_config["parameters"][cat] = params
                else:
                    # 如果分类存在，检查分类下的具体参数
                    for key, val in params.items():
                        if key not in business_config["parameters"][cat]:
                            business_config["parameters"][cat][key] = val
        
        return business_config
    
    async def switch_running_mode(
        self,
        tenant_id: int,
        mode: str,
        apply_defaults: bool = True
    ) -> Dict[str, Any]:
        """
        切换运行模式
        
        Args:
            tenant_id: 组织ID
            mode: 运行模式（simple/full）
            apply_defaults: 是否应用默认配置
            
        Returns:
            Dict[str, Any]: 切换结果
        """
        if mode not in [self.RUNNING_MODE_SIMPLE, self.RUNNING_MODE_FULL]:
            raise ValidationError(f"无效的运行模式: {mode}")
        
        tenant = await Tenant.get_or_none(id=tenant_id)
        if not tenant:
            raise NotFoundError(f"组织不存在: {tenant_id}")
        
        settings = tenant.settings or {}
        business_config = settings.get("business_config", {})
        
        # 更新运行模式
        business_config["running_mode"] = mode
        business_config["mode_switched_at"] = datetime.now().isoformat()
        
        # 如果应用默认配置，则应用对应模式的默认配置
        if apply_defaults:
            if mode == self.RUNNING_MODE_SIMPLE:
                default_config = self.SIMPLE_MODE_CONFIG
            else:
                default_config = self.FULL_MODE_CONFIG
            
            # 合并默认配置（保留用户自定义的配置）
            business_config.setdefault("modules", {}).update(default_config["modules"])
            business_config.setdefault("parameters", {}).update(default_config["parameters"])
        
        # 保存配置
        settings["business_config"] = business_config
        await Tenant.filter(id=tenant_id).update(settings=settings)
        
        logger.info(f"组织 {tenant_id} 切换运行模式为: {mode}")
        
        return {
            "success": True,
            "message": f"运行模式已切换为: {mode}",
            "running_mode": mode,
            "config": business_config,
        }

    async def apply_complexity_preset(
        self,
        tenant_id: int,
        level: str,
    ) -> Dict[str, Any]:
        """
        应用业务复杂度预设（最小必要内置模式）

        Args:
            tenant_id: 组织ID
            level: 预设编码（M1/M2/M3/M4）

        Returns:
            Dict[str, Any]: 应用结果
        """
        if level not in self.COMPLEXITY_PRESETS:
            valid_levels = "/".join(self.COMPLEXITY_PRESETS.keys())
            raise ValidationError(f"无效的复杂度等级: {level}，支持 {valid_levels}")

        preset = self.COMPLEXITY_PRESETS[level]
        tenant = await Tenant.get_or_none(id=tenant_id)
        if not tenant:
            raise NotFoundError(f"组织不存在: {tenant_id}")

        settings = tenant.settings or {}
        business_config = settings.get("business_config", {})
        business_config.setdefault("nodes", {})
        business_config.setdefault("modules", {})
        business_config.setdefault("parameters", {})

        # 应用 nodes（完全覆盖）
        business_config["nodes"] = dict(preset["nodes"])
        # 应用 modules
        business_config["modules"].update(preset["modules"])
        # 合并 parameters（只覆盖预设中指定的分类）
        for cat, params in preset["parameters"].items():
            if cat not in business_config["parameters"]:
                business_config["parameters"][cat] = {}
            business_config["parameters"][cat].update(params)

        business_config["complexity_level"] = level
        business_config["complexity_name"] = preset["name"]
        business_config["complexity_applied_at"] = datetime.now().isoformat()

        settings["business_config"] = business_config
        await Tenant.filter(id=tenant_id).update(settings=settings)

        logger.info(f"组织 {tenant_id} 已应用业务复杂度预设: {level} {preset['name']}")

        return {
            "success": True,
            "message": f"已应用预设：{preset['name']}",
            "complexity_level": level,
            "complexity_name": preset["name"],
            "config": business_config,
        }

    async def get_complexity_presets(self) -> Dict[str, Any]:
        """
        获取内置业务模式预设列表（供前端选择器使用）
        """
        order = ["M1", "M2", "M3", "M4"]
        return {
            "presets": [
                {"code": self.COMPLEXITY_PRESETS[k]["code"], "name": self.COMPLEXITY_PRESETS[k]["name"], "description": self.COMPLEXITY_PRESETS[k]["description"]}
                for k in order if k in self.COMPLEXITY_PRESETS
            ],
            "default_level": self.DEFAULT_COMPLEXITY_LEVEL,
        }

    async def update_module_switch(
        self,
        tenant_id: int,
        module_code: str,
        enabled: bool
    ) -> Dict[str, Any]:
        """
        更新模块开关
        
        Args:
            tenant_id: 组织ID
            module_code: 模块代码
            enabled: 是否启用
            
        Returns:
            Dict[str, Any]: 更新结果
        """
        # 检查是否为核心模块
        if module_code in self.CORE_MODULES and not enabled:
            raise BusinessLogicError(f"核心模块 {module_code} 不可关闭")
        
        tenant = await Tenant.get_or_none(id=tenant_id)
        if not tenant:
            raise NotFoundError(f"组织不存在: {tenant_id}")
        
        settings = tenant.settings or {}
        business_config = settings.get("business_config", {})
        
        # 确保modules字段存在
        if "modules" not in business_config:
            business_config["modules"] = {}
        
        # 更新模块开关
        business_config["modules"][module_code] = enabled
        
        # 保存配置
        settings["business_config"] = business_config
        await Tenant.filter(id=tenant_id).update(settings=settings)
        
        logger.info(f"组织 {tenant_id} 更新模块 {module_code} 开关为: {enabled}")
        
        return {
            "success": True,
            "message": f"模块 {module_code} 已{'启用' if enabled else '关闭'}",
            "module_code": module_code,
            "enabled": enabled,
        }
    
    async def update_process_parameter(
        self,
        tenant_id: int,
        category: str,
        parameter_key: str,
        value: Any
    ) -> Dict[str, Any]:
        """
        更新流程参数
        
        Args:
            tenant_id: 组织ID
            category: 参数分类（work_order/reporting/warehouse/quality等）
            parameter_key: 参数键
            value: 参数值
            
        Returns:
            Dict[str, Any]: 更新结果
        """
        tenant = await Tenant.get_or_none(id=tenant_id)
        if not tenant:
            raise NotFoundError(f"组织不存在: {tenant_id}")
        
        settings = tenant.settings or {}
        business_config = settings.get("business_config", {})
        
        # 确保parameters字段存在
        if "parameters" not in business_config:
            business_config["parameters"] = {}
        
        # 确保分类存在
        if category not in business_config["parameters"]:
            business_config["parameters"][category] = {}
        
        # 更新参数
        business_config["parameters"][category][parameter_key] = value
        
        # 保存配置
        settings["business_config"] = business_config
        await Tenant.filter(id=tenant_id).update(settings=settings)
        
        logger.info(f"组织 {tenant_id} 更新流程参数 {category}.{parameter_key} = {value}")
        
        return {
            "success": True,
            "message": f"流程参数 {category}.{parameter_key} 已更新",
            "category": category,
            "parameter_key": parameter_key,
            "value": value,
        }
    
    async def batch_update_process_parameters(
        self,
        tenant_id: int,
        parameters: Dict[str, Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        批量更新流程参数
        
        Args:
            tenant_id: 组织ID
            parameters: 参数配置字典，格式：{"category": {"key": value}}
            
        Returns:
            Dict[str, Any]: 更新结果
        """
        tenant = await Tenant.get_or_none(id=tenant_id)
        if not tenant:
            raise NotFoundError(f"组织不存在: {tenant_id}")
        
        settings = tenant.settings or {}
        business_config = settings.get("business_config", {})
        
        # 确保parameters字段存在
        if "parameters" not in business_config:
            business_config["parameters"] = {}
        
        # 批量更新参数
        for category, params in parameters.items():
            if category not in business_config["parameters"]:
                business_config["parameters"][category] = {}
            business_config["parameters"][category].update(params)
        
        # 保存配置
        settings["business_config"] = business_config
        await Tenant.filter(id=tenant_id).update(settings=settings)
        
        logger.info(f"组织 {tenant_id} 批量更新流程参数")
        
        return {
            "success": True,
            "message": "流程参数已批量更新",
            "updated_count": sum(len(params) for params in parameters.values()),
        }

    async def update_nodes_config(
        self,
        tenant_id: int,
        nodes: Dict[str, Dict[str, Any]],
        industry: Optional[str] = None,
        scale: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        更新节点配置
        """
        tenant = await Tenant.get_or_none(id=tenant_id)
        if not tenant:
            raise NotFoundError(f"组织不存在: {tenant_id}")
        
        settings = tenant.settings or {}
        business_config = settings.get("business_config", {})
        
        # Ensure nodes exists
        if "nodes" not in business_config:
            business_config["nodes"] = {}

        # Update nodes
        business_config["nodes"].update(nodes)
        
        # Update industry/scale if provided
        if industry:
            business_config["industry"] = industry
        if scale:
            business_config["scale"] = scale

        # 保存业务蓝图配置时标记蓝图已确认（供上线助手阶段1检查）
        settings["blueprint_confirmed"] = True
            
        settings["business_config"] = business_config
        await Tenant.filter(id=tenant_id).update(settings=settings)
        
        logger.info(f"组织 {tenant_id} 更新节点配置")
        
        return {
            "success": True,
            "message": "节点配置已更新",
            "nodes": business_config["nodes"],
            "industry": business_config.get("industry"),
            "scale": business_config.get("scale")
        }
    
    async def check_pro_feature_access(
        self,
        tenant_id: int,
        feature_type: str,
        feature_code: str
    ) -> Dict[str, Any]:
        """
        检查PRO版功能访问权限
        
        Args:
            tenant_id: 组织ID
            feature_type: 功能类型（modules/parameters）
            feature_code: 功能代码
            
        Returns:
            Dict[str, Any]: 检查结果，包含是否有权限、当前套餐、升级提示等
        """
        tenant = await Tenant.get_or_none(id=tenant_id)
        if not tenant:
            raise NotFoundError(f"组织不存在: {tenant_id}")
        
        # 检查是否为PRO版功能
        is_pro_feature = False
        if feature_type == "modules":
            is_pro_feature = feature_code in self.PRO_FEATURES["modules"]
        elif feature_type == "parameters":
            for category, features in self.PRO_FEATURES["parameters"].items():
                if feature_code in features:
                    is_pro_feature = True
                    break
        
        if not is_pro_feature:
            return {
                "has_access": True,
                "is_pro_feature": False,
                "current_plan": tenant.plan.value,
            }
        
        # 检查当前套餐是否为PRO版套餐
        has_access = tenant.plan.value in self.PRO_PLANS
        
        return {
            "has_access": has_access,
            "is_pro_feature": True,
            "current_plan": tenant.plan.value,
            "upgrade_message": "此功能需要专业套餐或企业套餐，请升级后使用" if not has_access else None,
        }
    
    async def get_pro_features_list(self, tenant_id: int) -> Dict[str, Any]:
        """
        获取PRO版功能列表
        
        Args:
            tenant_id: 组织ID
            
        Returns:
            Dict[str, Any]: PRO版功能列表，包含模块和参数
        """
        tenant = await Tenant.get_or_none(id=tenant_id)
        if not tenant:
            raise NotFoundError(f"组织不存在: {tenant_id}")
        
        has_pro_access = tenant.plan.value in self.PRO_PLANS
        
        return {
            "has_pro_access": has_pro_access,
            "current_plan": tenant.plan.value,
            "pro_modules": self.PRO_FEATURES["modules"],
            "pro_parameters": self.PRO_FEATURES["parameters"],
        }

    async def get_config_templates(self, tenant_id: int) -> List[Dict[str, Any]]:
        """
        获取配置模板列表
        
        Args:
            tenant_id: 组织ID
            
        Returns:
            List[Dict[str, Any]]: 配置模板列表
        """
        tenant = await Tenant.get_or_none(id=tenant_id)
        if not tenant:
            raise NotFoundError(f"组织不存在: {tenant_id}")
        
        settings = tenant.settings or {}
        return settings.get("config_templates", [])

    async def save_config_template(
        self,
        tenant_id: int,
        template_name: str,
        template_description: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        保存配置模板
        
        Args:
            tenant_id: 组织ID
            template_name: 模板名称
            template_description: 模板描述
            
        Returns:
            Dict[str, Any]: 保存结果
        """
        tenant = await Tenant.get_or_none(id=tenant_id)
        if not tenant:
            raise NotFoundError(f"组织不存在: {tenant_id}")
        
        settings = tenant.settings or {}
        templates = settings.get("config_templates", [])
        
        # 获取当前配置
        current_config = await self.get_business_config(tenant_id)
        
        # 生成新模板
        new_template = {
            "id": int(datetime.now().timestamp() * 1000),  # 使用毫秒级时间戳作为ID
            "name": template_name,
            "description": template_description,
            "config": current_config,
            "created_at": datetime.now().isoformat()
        }
        
        templates.append(new_template)
        settings["config_templates"] = templates
        
        await Tenant.filter(id=tenant_id).update(settings=settings)
        
        return {
            "success": True,
            "message": "配置模板已保存",
            "template": new_template
        }

    async def apply_config_template(
        self,
        tenant_id: int,
        template_id: int
    ) -> Dict[str, Any]:
        """
        应用配置模板
        
        Args:
            tenant_id: 组织ID
            template_id: 模板ID
            
        Returns:
            Dict[str, Any]: 应用结果
        """
        tenant = await Tenant.get_or_none(id=tenant_id)
        if not tenant:
            raise NotFoundError(f"组织不存在: {tenant_id}")
        
        settings = tenant.settings or {}
        templates = settings.get("config_templates", [])
        
        # 查找模板
        template = next((t for t in templates if t["id"] == template_id), None)
        if not template:
            raise NotFoundError(f"配置模板不存在: {template_id}")
        
        # 应用模板配置
        business_config = template["config"]
        # 更新模式切换时间
        business_config["mode_switched_at"] = datetime.now().isoformat()
        
        settings["business_config"] = business_config
        await Tenant.filter(id=tenant_id).update(settings=settings)
        
        return {
            "success": True,
            "message": f"已应用配置模板: {template['name']}",
            "template": template
        }

    async def delete_config_template(
        self,
        tenant_id: int,
        template_id: int
    ) -> Dict[str, Any]:
        """
        删除配置模板
        
        Args:
            tenant_id: 组织ID
            template_id: 模板ID
            
        Returns:
            Dict[str, Any]: 删除结果
        """
        tenant = await Tenant.get_or_none(id=tenant_id)
        if not tenant:
            raise NotFoundError(f"组织不存在: {tenant_id}")
        
        settings = tenant.settings or {}
        templates = settings.get("config_templates", [])
        
        # 过滤掉要删除的模板
        new_templates = [t for t in templates if t["id"] != template_id]
        
        if len(new_templates) == len(templates):
             raise NotFoundError(f"配置模板不存在: {template_id}")
             
        settings["config_templates"] = new_templates
        await Tenant.filter(id=tenant_id).update(settings=settings)
        
        return {
            "success": True,
            "message": "配置模板已删除"
        }