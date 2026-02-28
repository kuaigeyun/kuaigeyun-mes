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
    "parameters.quality.incoming_inspection",
    "parameters.quality.require_incoming_inspection_for_receipt",
    "parameters.quality.process_inspection",
    "parameters.quality.finished_inspection",
    "parameters.quality.defect_handling",
    "parameters.bom.bom_multi_version_allowed",
}

# 全部 45 业务节点（与菜单结构对齐：设备运营/模具运营/工装运营 细粒度）
ALL_NODES = [
    "quotation", "sample_trial", "sales_forecast", "sales_order", "sales_delivery", "shipment_notice", "delivery_notice",
    "demand", "demand_computation",
    "purchase_request", "purchase_order", "receipt_notice", "inbound_delivery",
    "production_plan", "work_order", "rework_order", "outsource_order",
    "quality_inspection", "inventory_check",
    "equipment_fault", "maintenance_plan", "maintenance_reminder", "equipment_status",
    "mold_usage", "mold_calibration", "mold_maintenance_reminder",
    "tool_usage", "tool_maintenance", "tool_calibration", "tool_maintenance_reminder",
    "inbound", "outbound", "other_inbound", "other_outbound", "stocktaking", "inventory_transfer", "assembly_order", "disassembly_order", "material_borrow", "material_return", "barcode_mapping",
    "receivable", "payable", "invoice", "cost_calculation",
]


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
            "demand": {"enabled": True, "auditRequired": False},
            "demand_computation": {"enabled": True, "auditRequired": False},
            "purchase_request": {"enabled": True, "auditRequired": False},
            "purchase_order": {"enabled": True, "auditRequired": False},
            "receipt_notice": {"enabled": True, "auditRequired": False},
            "inbound_delivery": {"enabled": True, "auditRequired": False},
            "production_plan": {"enabled": False, "auditRequired": False},
            "work_order": {"enabled": True, "auditRequired": False},
            "rework_order": {"enabled": False, "auditRequired": False},
            "outsource_order": {"enabled": False, "auditRequired": False},
            "quality_inspection": {"enabled": False, "auditRequired": False},
            "inventory_check": {"enabled": False, "auditRequired": False},
            "equipment_fault": {"enabled": False, "auditRequired": False},
            "maintenance_plan": {"enabled": False, "auditRequired": False},
            "maintenance_reminder": {"enabled": False, "auditRequired": False},
            "equipment_status": {"enabled": False, "auditRequired": False},
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
                "price_control": False,      # 关闭价格控制
                "supplier_evaluation": False,# 关闭供应商评估
            },
            "bom": {
                "bom_multi_version_allowed": True,  # BOM 是否允许多版本共存，需求计算时可选择版本
            },
            "planning": {
                "require_production_plan": False,  # 极简模式下计划节点关闭，仅可直连工单
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
        config = await self.get_business_config(tenant_id)
        wo_params = config.get("parameters", {}).get("work_order", {})
        return wo_params.get("allow_production_without_material", False)

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
            "demand": {"enabled": True, "auditRequired": False},
            "demand_computation": {"enabled": True, "auditRequired": False},
            "purchase_request": {"enabled": True, "auditRequired": True},
            "purchase_order": {"enabled": True, "auditRequired": True},
            "receipt_notice": {"enabled": True, "auditRequired": False},
            "inbound_delivery": {"enabled": True, "auditRequired": False},
            "production_plan": {"enabled": True, "auditRequired": True},
            "work_order": {"enabled": True, "auditRequired": False},
            "rework_order": {"enabled": True, "auditRequired": False},
            "outsource_order": {"enabled": True, "auditRequired": False},
            "quality_inspection": {"enabled": True, "auditRequired": True},
            "inventory_check": {"enabled": True, "auditRequired": True},
            "equipment_fault": {"enabled": True, "auditRequired": False},
            "maintenance_plan": {"enabled": True, "auditRequired": False},
            "maintenance_reminder": {"enabled": True, "auditRequired": False},
            "equipment_status": {"enabled": True, "auditRequired": False},
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
        },
    }
    
    # 八级业务复杂度预设（L0-L7，统一新逻辑）
    COMPLEXITY_PRESETS = {
        "L0": {
            "code": "L0",
            "name": "试运行模式",
            "description": "仅工单+报工，快速验证",
            "nodes": _build_preset_nodes(ALL_NODES, ("work_order", "on")),
            "modules": {
                "production": True, "warehouse": True, "demand": False,
                "purchase": False, "sales": False, "quality": False, "finance": False, "equipment": False,
            },
            "parameters": {"planning": {"require_production_plan": False}, "work_order": {"allow_production_without_material": True}},
        },
        "L1": {
            "code": "L1",
            "name": "来料加工模式",
            "description": "代工/OEM，只接生产任务，材料由委托方提供",
            "nodes": _build_preset_nodes(ALL_NODES, ("work_order", "on")),
            "modules": {
                "production": True, "warehouse": True, "demand": True,
                "purchase": False, "sales": False, "quality": False, "finance": False, "equipment": False,
            },
            "parameters": {"planning": {"require_production_plan": False}, "procurement": {"require_purchase_requisition": False}, "work_order": {"allow_production_without_material": True}},
        },
        "L2": {
            "code": "L2",
            "name": "订单生产模式",
            "description": "有销售但原料外采或委外，不做采购闭环",
            "nodes": _build_preset_nodes(ALL_NODES, ("sales_forecast", "on"), ("sales_order", "on"), ("sales_delivery", "on"), ("work_order", "on")),
            "modules": {
                "production": True, "warehouse": True, "demand": True,
                "purchase": False, "sales": True, "quality": False, "finance": False, "equipment": False,
            },
            "parameters": {"planning": {"require_production_plan": False}, "procurement": {"require_purchase_requisition": False}, "work_order": {"allow_production_without_material": True}},
        },
        "L3": {
            "code": "L3",
            "name": "生产物料模式",
            "description": "自采原料、自管库存的生产车间",
            "nodes": _build_preset_nodes(ALL_NODES,
                ("inventory_check", "on"), ("production_plan", "on"), ("purchase_request", "on"),
                ("purchase_order", "on"), ("inbound_delivery", "on"), ("receipt_notice", "on"),
                ("work_order", "on"), ("quality_inspection", "on"),
                ("inbound", "on"), ("outbound", "on"),
            ),
            "modules": {
                "production": True, "warehouse": True, "demand": True,
                "purchase": True, "sales": False, "quality": True, "finance": False, "equipment": False,
            },
            "parameters": {"planning": {"require_production_plan": False}, "procurement": {"require_purchase_requisition": False}, "work_order": {"allow_production_without_material": False}},
        },
        "L4": {
            "code": "L4",
            "name": "进销存生产模式",
            "description": "中小厂完整业务，追求效率，不强调内控",
            "nodes": _build_preset_nodes(ALL_NODES,
                ("quotation", "on"), ("sample_trial", "on"), ("sales_forecast", "on"), ("sales_order", "on"), ("sales_delivery", "on"), ("shipment_notice", "on"), ("delivery_notice", "on"),
                ("demand", "on"), ("demand_computation", "on"),
                ("purchase_request", "on"), ("purchase_order", "on"), ("receipt_notice", "on"), ("inbound_delivery", "on"),
                ("production_plan", "on"), ("work_order", "on"), ("rework_order", "on"), ("outsource_order", "on"),
                ("quality_inspection", "on"), ("inventory_check", "on"),
                ("inbound", "on"), ("outbound", "on"), ("other_inbound", "on"), ("other_outbound", "on"), ("stocktaking", "on"), ("inventory_transfer", "on"), ("assembly_order", "on"), ("disassembly_order", "on"), ("material_borrow", "on"), ("material_return", "on"),
            ),
            "modules": {
                "production": True, "warehouse": True, "demand": True,
                "purchase": True, "sales": True, "quality": True, "finance": False, "equipment": False,
            },
            "parameters": {"planning": {"require_production_plan": False}, "procurement": {"require_purchase_requisition": False}, "work_order": {"allow_production_without_material": False}},
        },
        "L5": {
            "code": "L5",
            "name": "全流程内控模式",
            "description": "规范企业，需内控与追溯",
            "nodes": _build_preset_nodes(ALL_NODES,
                ("quotation", "on"), ("sample_trial", "on"), ("sales_forecast", "audit"), ("sales_order", "audit"), ("sales_delivery", "on"), ("shipment_notice", "on"), ("delivery_notice", "on"),
                ("demand", "on"), ("demand_computation", "on"),
                ("purchase_request", "audit"), ("purchase_order", "audit"), ("receipt_notice", "on"), ("inbound_delivery", "on"),
                ("production_plan", "audit"), ("work_order", "on"), ("rework_order", "on"), ("outsource_order", "on"),
                ("quality_inspection", "audit"), ("inventory_check", "audit"),
                ("inbound", "on"), ("outbound", "on"), ("other_inbound", "on"), ("other_outbound", "on"), ("stocktaking", "on"), ("inventory_transfer", "on"), ("assembly_order", "on"), ("disassembly_order", "on"), ("material_borrow", "on"), ("material_return", "on"),
                ("receivable", "on"), ("payable", "on"), ("invoice", "on"), ("cost_calculation", "on"),
            ),
            "modules": {
                "production": True, "warehouse": True, "demand": True,
                "purchase": True, "sales": True, "quality": True, "finance": True, "equipment": False,
            },
            "parameters": {"planning": {"require_production_plan": False}, "procurement": {"require_purchase_requisition": False}, "work_order": {"allow_production_without_material": False}},
        },
        "L6": {
            "code": "L6",
            "name": "全模块+设备",
            "description": "L5 基础上启用设备管理",
            "nodes": _build_preset_nodes(ALL_NODES,
                ("quotation", "on"), ("sample_trial", "on"), ("sales_forecast", "audit"), ("sales_order", "audit"), ("sales_delivery", "on"), ("shipment_notice", "on"), ("delivery_notice", "on"),
                ("demand", "on"), ("demand_computation", "on"),
                ("purchase_request", "audit"), ("purchase_order", "audit"), ("receipt_notice", "on"), ("inbound_delivery", "on"),
                ("production_plan", "audit"), ("work_order", "on"), ("rework_order", "on"), ("outsource_order", "on"),
                ("quality_inspection", "audit"), ("inventory_check", "audit"),
                ("equipment_fault", "on"), ("maintenance_plan", "on"), ("maintenance_reminder", "on"), ("equipment_status", "on"),
                ("mold_usage", "on"), ("mold_calibration", "on"), ("mold_maintenance_reminder", "on"),
                ("tool_usage", "on"), ("tool_maintenance", "on"), ("tool_calibration", "on"), ("tool_maintenance_reminder", "on"),
                ("inbound", "on"), ("outbound", "on"), ("other_inbound", "on"), ("other_outbound", "on"), ("stocktaking", "on"), ("inventory_transfer", "on"), ("assembly_order", "on"), ("disassembly_order", "on"), ("material_borrow", "on"), ("material_return", "on"), ("barcode_mapping", "on"),
                ("receivable", "on"), ("payable", "on"), ("invoice", "on"), ("cost_calculation", "on"),
            ),
            "modules": {
                "production": True, "warehouse": True, "demand": True,
                "purchase": True, "sales": True, "quality": True, "finance": True, "equipment": True,
            },
            "parameters": {"planning": {"require_production_plan": False}, "procurement": {"require_purchase_requisition": False}, "work_order": {"allow_production_without_material": False}},
        },
        "L7": {
            "code": "L7",
            "name": "全模块+设备+仓储细粒度",
            "description": "L6 基础上启用全部仓储与财务节点",
            "nodes": _build_preset_nodes(ALL_NODES,
                ("quotation", "on"), ("sample_trial", "on"), ("sales_forecast", "audit"), ("sales_order", "audit"), ("sales_delivery", "on"), ("shipment_notice", "on"), ("delivery_notice", "on"),
                ("demand", "on"), ("demand_computation", "on"),
                ("purchase_request", "audit"), ("purchase_order", "audit"), ("receipt_notice", "on"), ("inbound_delivery", "on"),
                ("production_plan", "audit"), ("work_order", "on"), ("rework_order", "on"), ("outsource_order", "on"),
                ("quality_inspection", "audit"), ("inventory_check", "audit"),
                ("equipment_fault", "on"), ("maintenance_plan", "on"), ("maintenance_reminder", "on"), ("equipment_status", "on"),
                ("mold_usage", "on"), ("mold_calibration", "on"), ("mold_maintenance_reminder", "on"),
                ("tool_usage", "on"), ("tool_maintenance", "on"), ("tool_calibration", "on"), ("tool_maintenance_reminder", "on"),
                ("inbound", "on"), ("outbound", "on"), ("other_inbound", "on"), ("other_outbound", "on"), ("stocktaking", "on"), ("inventory_transfer", "on"), ("assembly_order", "on"), ("disassembly_order", "on"), ("material_borrow", "on"), ("material_return", "on"), ("barcode_mapping", "on"),
                ("receivable", "on"), ("payable", "on"), ("invoice", "on"), ("cost_calculation", "on"),
            ),
            "modules": {
                "production": True, "warehouse": True, "demand": True,
                "purchase": True, "sales": True, "quality": True, "finance": True, "equipment": True,
            },
            "parameters": {"planning": {"require_production_plan": False}, "procurement": {"require_purchase_requisition": False}, "work_order": {"allow_production_without_material": False}},
        },
    }

    # 默认业务复杂度（新租户或未配置时使用）
    DEFAULT_COMPLEXITY_LEVEL = "L4"

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
        应用业务复杂度预设（L1-L5）

        Args:
            tenant_id: 组织ID
            level: 复杂度等级（L1/L2/L3/L4/L5）

        Returns:
            Dict[str, Any]: 应用结果
        """
        if level not in self.COMPLEXITY_PRESETS:
            raise ValidationError(f"无效的复杂度等级: {level}，支持 L0-L7")

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
        获取八级业务复杂度预设列表 L0-L7（供前端选择器使用）
        """
        order = ["L0", "L1", "L2", "L3", "L4", "L5", "L6", "L7"]
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