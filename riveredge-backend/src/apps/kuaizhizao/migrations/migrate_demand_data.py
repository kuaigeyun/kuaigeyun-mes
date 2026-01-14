"""
历史数据迁移脚本

将旧的销售预测和销售订单数据迁移到统一需求表。

Author: Luigi Lu
Date: 2025-01-14
"""

from typing import Dict, List, Any, Optional
from datetime import datetime
from decimal import Decimal
from loguru import logger

from apps.kuaizhizao.models.demand import Demand
from apps.kuaizhizao.models.demand_item import DemandItem
from apps.kuaizhizao.models.sales_forecast import SalesForecast
from apps.kuaizhizao.models.sales_order import SalesOrder
from apps.kuaizhizao.models.sales_forecast_item import SalesForecastItem
from apps.kuaizhizao.models.sales_order_item import SalesOrderItem


class DemandDataMigration:
    """需求数据迁移类"""
    
    def __init__(self):
        self.migration_log: List[Dict[str, Any]] = []
        self.rollback_data: List[Dict[str, Any]] = []
    
    async def migrate_all(self, tenant_id: int, dry_run: bool = False) -> Dict[str, Any]:
        """
        迁移所有数据
        
        Args:
            tenant_id: 租户ID
            dry_run: 是否仅模拟运行（不实际迁移）
            
        Returns:
            Dict: 迁移结果统计
        """
        logger.info(f"开始迁移租户 {tenant_id} 的需求数据（dry_run={dry_run}）")
        
        result = {
            "tenant_id": tenant_id,
            "dry_run": dry_run,
            "sales_forecast_count": 0,
            "sales_order_count": 0,
            "migrated_demands": [],
            "errors": [],
            "start_time": datetime.now().isoformat(),
        }
        
        try:
            # 迁移销售预测数据
            forecast_result = await self.migrate_sales_forecasts(tenant_id, dry_run)
            result["sales_forecast_count"] = forecast_result["count"]
            result["migrated_demands"].extend(forecast_result["migrated"])
            result["errors"].extend(forecast_result["errors"])
            
            # 迁移销售订单数据
            order_result = await self.migrate_sales_orders(tenant_id, dry_run)
            result["sales_order_count"] = order_result["count"]
            result["migrated_demands"].extend(order_result["migrated"])
            result["errors"].extend(order_result["errors"])
            
            result["end_time"] = datetime.now().isoformat()
            result["success"] = len(result["errors"]) == 0
            
            logger.info(f"迁移完成: 销售预测 {result['sales_forecast_count']} 条, 销售订单 {result['sales_order_count']} 条")
            
        except Exception as e:
            logger.error(f"迁移过程发生异常: {e}")
            result["errors"].append({"type": "exception", "message": str(e)})
            result["success"] = False
        
        return result
