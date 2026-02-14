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
            "sales_order": {"enabled": True, "auditRequired": False},
            "sales_forecast": {"enabled": True, "auditRequired": False},
            "sales_delivery": {"enabled": True, "auditRequired": False},
            "inventory_check": {"enabled": False, "auditRequired": False},
            "production_plan": {"enabled": False, "auditRequired": False},
            "purchase_request": {"enabled": True, "auditRequired": False},
            "purchase_order": {"enabled": True, "auditRequired": False},
            "inbound_delivery": {"enabled": True, "auditRequired": False},
            "work_order": {"enabled": True, "auditRequired": False},
            "quality_inspection": {"enabled": False, "auditRequired": False},
        },
        "modules": {
            "production": True,      # 生产管理（核心模块，不可关闭）
            "warehouse": True,       # 仓储管理（核心模块，不可关闭）
            "demand": True,          # 需求管理（支持直接创建生产计划）
            "purchase": True,        # 采购管理
            "sales": True,           # 销售管理
            "quality": False,        # 质量管理（默认关闭）
            "finance": False,        # 财务管理（默认关闭）
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
            "sales_order": {"enabled": True, "auditRequired": True},
            "sales_forecast": {"enabled": True, "auditRequired": True},
            "sales_delivery": {"enabled": True, "auditRequired": True},
            "inventory_check": {"enabled": True, "auditRequired": True},
            "production_plan": {"enabled": True, "auditRequired": True},
            "purchase_request": {"enabled": True, "auditRequired": True},
            "purchase_order": {"enabled": True, "auditRequired": True},
            "inbound_delivery": {"enabled": True, "auditRequired": False},
            "work_order": {"enabled": True, "auditRequired": False},
            "quality_inspection": {"enabled": True, "auditRequired": True},
        },
        "modules": {
            "production": True,      # 生产管理（核心模块，不可关闭）
            "warehouse": True,       # 仓储管理（核心模块，不可关闭）
            "demand": True,          # 需求管理
            "purchase": True,        # 采购管理
            "sales": True,           # 销售管理
            "quality": True,         # 质量管理
            "finance": True,         # 财务管理
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