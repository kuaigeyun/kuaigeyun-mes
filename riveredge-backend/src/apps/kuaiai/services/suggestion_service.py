"""
KU-AI 智能建议服务模块

提供智能建议的业务逻辑处理，支持多组织隔离。
依赖 kuaizhizao 时使用懒加载，kuaiai 可独立运行。
"""

from typing import List, Dict, Any, Optional

from apps.kuaiai.services.suggestion_engine import get_suggestion_engine
from apps.kuaiai.services.suggestion_rules import (
    InitOrganizationInfoRule,
    InitDefaultSettingsRule,
    WorkOrderMaterialShortageRule,
    WorkOrderDelayRule,
    ReportingQualityIssueRule,
    InventoryLowStockRule,
    ProductionEfficiencyRule,
)
from loguru import logger


class SuggestionService:
    """KU-AI 智能建议服务"""

    def __init__(self):
        self.engine = get_suggestion_engine()
        self._register_rules()

    def _register_rules(self):
        self.engine.register_rules("init", [
            InitOrganizationInfoRule(),
            InitDefaultSettingsRule(),
        ])
        self.engine.register_rules("work_order", [
            WorkOrderMaterialShortageRule(),
            WorkOrderDelayRule(),
        ])
        self.engine.register_rules("reporting", [
            ReportingQualityIssueRule(),
        ])
        self.engine.register_rules("inventory", [
            InventoryLowStockRule(),
        ])
        self.engine.register_rules("production", [
            ProductionEfficiencyRule(),
        ])
        logger.info("KU-AI 智能建议规则注册完成")

    async def get_suggestions(
        self,
        tenant_id: int,
        scene: str,
        context: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        try:
            suggestions = await self.engine.get_suggestions(
                tenant_id=tenant_id,
                scene=scene,
                context=context or {}
            )
            return [s.to_dict() for s in suggestions]
        except Exception as e:
            logger.error(f"获取建议失败: {scene}, 错误: {e}")
            return []

    async def get_suggestions_for_work_order(
        self,
        tenant_id: int,
        work_order_id: int
    ) -> List[Dict[str, Any]]:
        try:
            try:
                from apps.kuaizhizao.models.work_order import WorkOrder
                from apps.kuaizhizao.models.material_shortage_exception import MaterialShortageException
            except ImportError:
                logger.debug("kuaizhizao 未安装，跳过工单建议")
                return []

            work_order = await WorkOrder.filter(
                tenant_id=tenant_id,
                id=work_order_id,
                deleted_at__isnull=True
            ).first()
            if not work_order:
                return []

            material_shortages = []
            try:
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
        context = {
            "reporting_id": reporting_id,
            "quality_issues": [],
        }
        return await self.get_suggestions(tenant_id, "reporting", context)

    async def get_suggestions_for_inventory(
        self,
        tenant_id: int
    ) -> List[Dict[str, Any]]:
        try:
            try:
                from apps.kuaizhizao.models.inventory_alert import InventoryAlert
            except ImportError:
                return await self.get_suggestions(tenant_id, "inventory", {"low_stock_items": []})

            low_stock_items = []
            try:
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

            context = {"low_stock_items": low_stock_items}
            return await self.get_suggestions(tenant_id, "inventory", context)
        except Exception as e:
            logger.error(f"获取库存建议失败: {tenant_id}, 错误: {e}")
            return []

    async def get_suggestions_for_production(
        self,
        tenant_id: int
    ) -> List[Dict[str, Any]]:
        context = {
            "efficiency": {"current": 0, "target": 0},
        }
        return await self.get_suggestions(tenant_id, "production", context)
