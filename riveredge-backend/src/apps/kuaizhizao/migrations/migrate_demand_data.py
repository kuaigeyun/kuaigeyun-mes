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
    
    async def migrate_sales_forecasts(
        self, 
        tenant_id: int, 
        dry_run: bool = False
    ) -> Dict[str, Any]:
        """
        迁移销售预测数据到统一需求表
        
        Args:
            tenant_id: 租户ID
            dry_run: 是否仅模拟运行
            
        Returns:
            Dict: 迁移结果
        """
        logger.info(f"开始迁移租户 {tenant_id} 的销售预测数据")
        
        result = {
            "count": 0,
            "migrated": [],
            "errors": []
        }
        
        try:
            # 查询所有未删除的销售预测
            forecasts = await SalesForecast.filter(
                tenant_id=tenant_id,
                deleted_at__isnull=True
            ).all()
            
            logger.info(f"找到 {len(forecasts)} 条销售预测数据")
            
            for forecast in forecasts:
                try:
                    # 检查是否已经迁移过（通过source_id和source_type判断）
                    existing = await Demand.filter(
                        tenant_id=tenant_id,
                        source_id=forecast.id,
                        source_type="sales_forecast"
                    ).first()
                    
                    if existing:
                        logger.warning(f"销售预测 {forecast.forecast_code} 已迁移，跳过")
                        continue
                    
                    if not dry_run:
                        # 创建统一需求
                        demand = await Demand.create(
                            tenant_id=tenant_id,
                            demand_code=forecast.forecast_code,
                            demand_type="sales_forecast",
                            demand_name=forecast.forecast_name,
                            business_mode="MTS",
                            start_date=forecast.start_date,
                            end_date=forecast.end_date,
                            forecast_period=forecast.forecast_period,
                            status=forecast.status,
                            reviewer_id=forecast.reviewer_id,
                            reviewer_name=forecast.reviewer_name,
                            review_time=forecast.review_time,
                            review_status=forecast.review_status,
                            review_remarks=forecast.review_remarks,
                            notes=forecast.notes,
                            is_active=forecast.is_active,
                            created_by=forecast.created_by,
                            updated_by=forecast.updated_by,
                            source_id=forecast.id,
                            source_type="sales_forecast",
                            source_code=forecast.forecast_code,
                            created_at=forecast.created_at,
                            updated_at=forecast.updated_at,
                        )
                        
                        # 迁移销售预测明细
                        await self._migrate_forecast_items(tenant_id, forecast.id, demand.id)
                        
                        # 计算总数量和总金额
                        await self._update_demand_totals(demand.id)
                        
                        result["migrated"].append({
                            "source_id": forecast.id,
                            "source_code": forecast.forecast_code,
                            "demand_id": demand.id,
                            "demand_code": demand.demand_code
                        })
                        logger.info(f"成功迁移销售预测 {forecast.forecast_code} -> 需求 {demand.demand_code}")
                    else:
                        result["migrated"].append({
                            "source_id": forecast.id,
                            "source_code": forecast.forecast_code,
                            "demand_id": None,
                            "demand_code": forecast.forecast_code
                        })
                        logger.info(f"[模拟] 将迁移销售预测 {forecast.forecast_code}")
                    
                    result["count"] += 1
                    
                except Exception as e:
                    error_msg = f"迁移销售预测 {forecast.forecast_code} 失败: {str(e)}"
                    logger.error(error_msg)
                    result["errors"].append({
                        "source_type": "sales_forecast",
                        "source_id": forecast.id,
                        "source_code": forecast.forecast_code,
                        "error": error_msg
                    })
            
        except Exception as e:
            logger.error(f"迁移销售预测数据异常: {e}")
            result["errors"].append({
                "source_type": "sales_forecast",
                "error": f"批量迁移异常: {str(e)}"
            })
        
        return result
