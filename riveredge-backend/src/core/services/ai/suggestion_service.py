"""
AI智能建议服务模块

提供AI智能建议的业务逻辑处理，支持多组织隔离。

Author: Luigi Lu
Date: 2026-01-05
"""

from typing import List, Dict, Any, Optional
from datetime import datetime

from core.services.ai.suggestion_engine import (
    SuggestionEngine,
    Suggestion,
    get_suggestion_engine,
)
from core.services.ai.suggestion_rules import (
    # 系统初始化建议规则
    InitOrganizationInfoRule,
    InitDefaultSettingsRule,
    # 工单管理建议规则
    WorkOrderMaterialShortageRule,
    WorkOrderDelayRule,
    # 报工建议规则
    ReportingQualityIssueRule,
    # 库存管理建议规则
    InventoryLowStockRule,
    # 生产看板建议规则
    ProductionEfficiencyRule,
)
from loguru import logger


class SuggestionService:
    """
    AI智能建议服务类
    
    处理AI智能建议相关的所有业务逻辑。
    """
    
    def __init__(self):
        """初始化建议服务"""
        self.engine = get_suggestion_engine()
        self._register_rules()
    
    def _register_rules(self):
        """注册所有建议规则"""
        # 系统初始化建议规则
        self.engine.register_rules("init", [
            InitOrganizationInfoRule(),
            InitDefaultSettingsRule(),
        ])
        
        # 工单管理建议规则
        self.engine.register_rules("work_order", [
            WorkOrderMaterialShortageRule(),
            WorkOrderDelayRule(),
        ])
        
        # 报工建议规则
        self.engine.register_rules("reporting", [
            ReportingQualityIssueRule(),
        ])
        
        # 库存管理建议规则
        self.engine.register_rules("inventory", [
            InventoryLowStockRule(),
        ])
        
        # 生产看板建议规则
        self.engine.register_rules("production", [
            ProductionEfficiencyRule(),
        ])
        
        logger.info("AI智能建议规则注册完成")
    
    async def get_suggestions(
        self,
        tenant_id: int,
        scene: str,
        context: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        获取建议列表
        
        Args:
            tenant_id: 组织ID
            scene: 业务场景（init、work_order、reporting、inventory、production等）
            context: 上下文信息（可选，包含业务场景相关的数据）
            
        Returns:
            List[Dict[str, Any]]: 建议列表（已转换为字典格式）
        """
        try:
            # 获取建议
            suggestions = await self.engine.get_suggestions(
                tenant_id=tenant_id,
                scene=scene,
                context=context or {}
            )
            
            # 转换为字典格式
            return [s.to_dict() for s in suggestions]
        except Exception as e:
            logger.error(f"获取建议失败: {scene}, 错误: {e}")
            return []
    
    async def get_suggestions_for_work_order(
        self,
        tenant_id: int,
        work_order_id: int
    ) -> List[Dict[str, Any]]:
        """
        获取工单相关建议
        
        Args:
            tenant_id: 组织ID
            work_order_id: 工单ID
            
        Returns:
            List[Dict[str, Any]]: 建议列表
        """
        try:
            # 获取工单信息
            from apps.kuaizhizao.models.work_order import WorkOrder
            work_order = await WorkOrder.filter(
                tenant_id=tenant_id,
                id=work_order_id,
                deleted_at__isnull=True
            ).first()
            
            if not work_order:
                return []
            
            # 获取缺料异常
            material_shortages = []
            try:
                from apps.kuaizhizao.models.material_shortage_exception import MaterialShortageException
                shortages = await MaterialShortageException.filter(
                    tenant_id=tenant_id,
                    work_order_id=work_order_id,
                    status="open",
                    deleted_at__isnull=True
                ).all()
                
                for shortage in shortages:
                    material_shortages.append({
                        "work_order_id": work_order_id,
                        "work_order_code": work_order.code,
                        "material_id": shortage.material_id,
                        "material_name": shortage.material_name or "",
                        "shortage_quantity": float(shortage.shortage_quantity) if shortage.shortage_quantity else 0,
                    })
            except Exception as e:
                logger.warning(f"获取缺料异常失败: {e}")
            
            # 检查工单是否延期
            delayed_work_orders = []
            if work_order.planned_end_date and work_order.status in ["released", "in_progress"]:
                from datetime import date
                if date.today() > work_order.planned_end_date:
                    delay_days = (date.today() - work_order.planned_end_date).days
                    delayed_work_orders.append({
                        "work_order_id": work_order_id,
                        "work_order_code": work_order.code,
                        "delay_days": delay_days,
                    })
            
            context = {
                "work_order_id": work_order_id,
                "material_shortages": material_shortages,
                "delayed_work_orders": delayed_work_orders,
            }
            
            return await self.get_suggestions(tenant_id, "work_order", context)
        except Exception as e:
            logger.error(f"获取工单建议失败: {work_order_id}, 错误: {e}")
            return []
    
    async def get_suggestions_for_reporting(
        self,
        tenant_id: int,
        reporting_id: int
    ) -> List[Dict[str, Any]]:
        """
        获取报工相关建议
        
        Args:
            tenant_id: 组织ID
            reporting_id: 报工记录ID
            
        Returns:
            List[Dict[str, Any]]: 建议列表
        """
        # TODO: 获取报工相关信息（质量问题等）
        context = {
            "reporting_id": reporting_id,
            "quality_issues": [],  # TODO: 从数据库获取
        }
        
        return await self.get_suggestions(tenant_id, "reporting", context)
    
    async def get_suggestions_for_inventory(
        self,
        tenant_id: int
    ) -> List[Dict[str, Any]]:
        """
        获取库存相关建议
        
        Args:
            tenant_id: 组织ID
            
        Returns:
            List[Dict[str, Any]]: 建议列表
        """
        try:
            # 获取库存预警
            low_stock_items = []
            try:
                from apps.kuaizhizao.models.inventory_alert import InventoryAlert
                alerts = await InventoryAlert.filter(
                    tenant_id=tenant_id,
                    status="open",
                    alert_type="low_stock",
                    deleted_at__isnull=True
                ).limit(20).all()
                
                for alert in alerts:
                    low_stock_items.append({
                        "material_id": alert.material_id,
                        "material_name": alert.material_name or "",
                        "current_quantity": float(alert.current_quantity) if alert.current_quantity else 0,
                        "safety_stock": float(alert.safety_stock) if alert.safety_stock else 0,
                    })
            except Exception as e:
                logger.warning(f"获取库存预警失败: {e}")
            
            context = {
                "low_stock_items": low_stock_items,
            }
            
            return await self.get_suggestions(tenant_id, "inventory", context)
        except Exception as e:
            logger.error(f"获取库存建议失败: {tenant_id}, 错误: {e}")
            return []
    
    async def get_suggestions_for_production(
        self,
        tenant_id: int
    ) -> List[Dict[str, Any]]:
        """
        获取生产看板相关建议
        
        Args:
            tenant_id: 组织ID
            
        Returns:
            List[Dict[str, Any]]: 建议列表
        """
        # TODO: 获取生产效率信息
        context = {
            "efficiency": {
                "current": 0,  # TODO: 从数据库计算
                "target": 0,  # TODO: 从配置获取
            },
        }
        
        return await self.get_suggestions(tenant_id, "production", context)

