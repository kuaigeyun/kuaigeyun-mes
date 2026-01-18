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
        "modules": {
            "production": True,      # 生产管理（核心模块，不可关闭）
            "warehouse": True,       # 仓储管理（核心模块，不可关闭）
            "demand": False,         # 需求管理
            "purchase": False,      # 采购管理
            "sales": False,          # 销售管理
            "quality": False,        # 质量管理
            "finance": False,        # 财务管理
        },
        "parameters": {
            "work_order": {
                "auto_generate": False,
                "priority": False,
                "split": False,
                "merge": False,
            },
            "reporting": {
                "quick_reporting": True,
                "parameter_reporting": False,
                "auto_fill": True,
                "data_correction": False,
            },
            "warehouse": {
                "batch_management": False,
                "serial_management": False,
                "multi_unit": False,
                "fifo": False,
                "lifo": False,
            },
            "quality": {
                "incoming_inspection": False,
                "process_inspection": False,
                "finished_inspection": False,
                "defect_handling": False,
            },
        },
    }
    
    # 全流程模式默认配置
    FULL_MODE_CONFIG = {
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