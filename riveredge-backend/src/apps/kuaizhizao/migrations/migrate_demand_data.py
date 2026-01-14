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
    
    async def _migrate_forecast_items(
        self, 
        tenant_id: int, 
        forecast_id: int, 
        demand_id: int
    ) -> None:
        """
        迁移销售预测明细到需求明细
        
        Args:
            tenant_id: 租户ID
            forecast_id: 销售预测ID
            demand_id: 需求ID
        """
        items = await SalesForecastItem.filter(
            tenant_id=tenant_id,
            forecast_id=forecast_id
        ).all()
        
        for item in items:
            # 计算预测月份（从forecast_date提取）
            forecast_month = None
            if item.forecast_date:
                forecast_month = item.forecast_date.strftime("%Y-%m")
            
            await DemandItem.create(
                tenant_id=tenant_id,
                demand_id=demand_id,
                material_id=item.material_id,
                material_code=item.material_code,
                material_name=item.material_name,
                material_spec=item.material_spec,
                material_unit=item.material_unit,
                required_quantity=item.forecast_quantity,
                forecast_date=item.forecast_date,
                forecast_month=forecast_month,
                historical_sales=item.historical_sales,
                historical_period=item.historical_period,
                confidence_level=item.confidence_level,
                forecast_method=item.forecast_method,
                notes=item.notes,
            )
    
    async def _migrate_order_items(
        self, 
        tenant_id: int, 
        order_id: int, 
        demand_id: int
    ) -> None:
        """
        迁移销售订单明细到需求明细
        
        Args:
            tenant_id: 租户ID
            order_id: 销售订单ID
            demand_id: 需求ID
        """
        items = await SalesOrderItem.filter(
            tenant_id=tenant_id,
            sales_order_id=order_id
        ).all()
        
        for item in items:
            await DemandItem.create(
                tenant_id=tenant_id,
                demand_id=demand_id,
                material_id=item.material_id,
                material_code=item.material_code,
                material_name=item.material_name,
                material_spec=item.material_spec,
                material_unit=item.material_unit,
                required_quantity=item.order_quantity,
                delivery_date=item.delivery_date,
                delivered_quantity=item.delivered_quantity,
                remaining_quantity=item.remaining_quantity,
                unit_price=item.unit_price,
                item_amount=item.total_amount,
                delivery_status=item.delivery_status,
                work_order_id=item.work_order_id,
                work_order_code=item.work_order_code,
                notes=item.notes,
            )
    
    async def _update_demand_totals(self, demand_id: int) -> None:
        """
        更新需求的总数量和总金额
        
        Args:
            demand_id: 需求ID
        """
        items = await DemandItem.filter(demand_id=demand_id).all()
        
        total_quantity = Decimal("0")
        total_amount = Decimal("0")
        
        for item in items:
            total_quantity += item.required_quantity or Decimal("0")
            if item.item_amount:
                total_amount += item.item_amount
        
        await Demand.filter(id=demand_id).update(
            total_quantity=total_quantity,
            total_amount=total_amount
        )
    
    async def migrate_sales_orders(
        self, 
        tenant_id: int, 
        dry_run: bool = False
    ) -> Dict[str, Any]:
        """
        迁移销售订单数据到统一需求表
        
        Args:
            tenant_id: 租户ID
            dry_run: 是否仅模拟运行
            
        Returns:
            Dict: 迁移结果
        """
        logger.info(f"开始迁移租户 {tenant_id} 的销售订单数据")
        
        result = {
            "count": 0,
            "migrated": [],
            "errors": []
        }
        
        try:
            # 查询所有未删除的销售订单
            orders = await SalesOrder.filter(
                tenant_id=tenant_id,
                deleted_at__isnull=True
            ).all()
            
            logger.info(f"找到 {len(orders)} 条销售订单数据")
            
            for order in orders:
                try:
                    # 检查是否已经迁移过
                    existing = await Demand.filter(
                        tenant_id=tenant_id,
                        source_id=order.id,
                        source_type="sales_order"
                    ).first()
                    
                    if existing:
                        logger.warning(f"销售订单 {order.order_code} 已迁移，跳过")
                        continue
                    
                    if not dry_run:
                        # 创建统一需求
                        demand = await Demand.create(
                            tenant_id=tenant_id,
                            demand_code=order.order_code,
                            demand_type="sales_order",
                            demand_name=order.order_code,  # 销售订单可能没有名称，使用编码
                            business_mode="MTO",
                            start_date=order.order_date,
                            end_date=None,
                            order_date=order.order_date,
                            delivery_date=order.delivery_date,
                            customer_id=order.customer_id,
                            customer_name=order.customer_name,
                            customer_contact=order.customer_contact,
                            customer_phone=order.customer_phone,
                            total_quantity=order.total_quantity,
                            total_amount=order.total_amount,
                            status=order.status,
                            reviewer_id=order.reviewer_id,
                            reviewer_name=order.reviewer_name,
                            review_time=order.review_time,
                            review_status=order.review_status,
                            review_remarks=order.review_remarks,
                            salesman_id=order.salesman_id,
                            salesman_name=order.salesman_name,
                            shipping_address=order.shipping_address,
                            shipping_method=order.shipping_method,
                            payment_terms=order.payment_terms,
                            notes=order.notes,
                            is_active=order.is_active,
                            created_by=order.created_by,
                            updated_by=order.updated_by,
                            source_id=order.id,
                            source_type="sales_order",
                            source_code=order.order_code,
                            created_at=order.created_at,
                            updated_at=order.updated_at,
                        )
                        
                        # 迁移销售订单明细
                        await self._migrate_order_items(tenant_id, order.id, demand.id)
                        
                        # 计算总数量和总金额
                        await self._update_demand_totals(demand.id)
                        
                        result["migrated"].append({
                            "source_id": order.id,
                            "source_code": order.order_code,
                            "demand_id": demand.id,
                            "demand_code": demand.demand_code
                        })
                        logger.info(f"成功迁移销售订单 {order.order_code} -> 需求 {demand.demand_code}")
                    else:
                        result["migrated"].append({
                            "source_id": order.id,
                            "source_code": order.order_code,
                            "demand_id": None,
                            "demand_code": order.order_code
                        })
                        logger.info(f"[模拟] 将迁移销售订单 {order.order_code}")
                    
                    result["count"] += 1
                    
                except Exception as e:
                    error_msg = f"迁移销售订单 {order.order_code} 失败: {str(e)}"
                    logger.error(error_msg)
                    result["errors"].append({
                        "source_type": "sales_order",
                        "source_id": order.id,
                        "source_code": order.order_code,
                        "error": error_msg
                    })
            
        except Exception as e:
            logger.error(f"迁移销售订单数据异常: {e}")
            result["errors"].append({
                "source_type": "sales_order",
                "error": f"批量迁移异常: {str(e)}"
            })
        
        return result
    
    async def validate_migration(
        self, 
        tenant_id: int
    ) -> Dict[str, Any]:
        """
        验证迁移数据的完整性
        
        Args:
            tenant_id: 租户ID
            
        Returns:
            Dict: 验证结果
        """
        logger.info(f"开始验证租户 {tenant_id} 的迁移数据")
        
        result = {
            "valid": True,
            "errors": [],
            "warnings": []
        }
        
        try:
            # 验证销售预测数据
            forecasts = await SalesForecast.filter(
                tenant_id=tenant_id,
                deleted_at__isnull=True
            ).all()
            
            for forecast in forecasts:
                demand = await Demand.filter(
                    tenant_id=tenant_id,
                    source_id=forecast.id,
                    source_type="sales_forecast"
                ).first()
                
                if not demand:
                    result["warnings"].append({
                        "type": "missing",
                        "source_type": "sales_forecast",
                        "source_id": forecast.id,
                        "source_code": forecast.forecast_code,
                        "message": "销售预测未迁移"
                    })
                    continue
                
                # 验证明细数量
                forecast_items = await SalesForecastItem.filter(
                    tenant_id=tenant_id,
                    forecast_id=forecast.id
                ).count()
                
                demand_items = await DemandItem.filter(
                    tenant_id=tenant_id,
                    demand_id=demand.id
                ).count()
                
                if forecast_items != demand_items:
                    result["errors"].append({
                        "type": "item_count_mismatch",
                        "source_type": "sales_forecast",
                        "source_id": forecast.id,
                        "source_code": forecast.forecast_code,
                        "demand_id": demand.id,
                        "expected": forecast_items,
                        "actual": demand_items
                    })
                    result["valid"] = False
            
            # 验证销售订单数据
            orders = await SalesOrder.filter(
                tenant_id=tenant_id,
                deleted_at__isnull=True
            ).all()
            
            for order in orders:
                demand = await Demand.filter(
                    tenant_id=tenant_id,
                    source_id=order.id,
                    source_type="sales_order"
                ).first()
                
                if not demand:
                    result["warnings"].append({
                        "type": "missing",
                        "source_type": "sales_order",
                        "source_id": order.id,
                        "source_code": order.order_code,
                        "message": "销售订单未迁移"
                    })
                    continue
                
                # 验证明细数量
                order_items = await SalesOrderItem.filter(
                    tenant_id=tenant_id,
                    sales_order_id=order.id
                ).count()
                
                demand_items = await DemandItem.filter(
                    tenant_id=tenant_id,
                    demand_id=demand.id
                ).count()
                
                if order_items != demand_items:
                    result["errors"].append({
                        "type": "item_count_mismatch",
                        "source_type": "sales_order",
                        "source_id": order.id,
                        "source_code": order.order_code,
                        "demand_id": demand.id,
                        "expected": order_items,
                        "actual": demand_items
                    })
                    result["valid"] = False
            
        except Exception as e:
            logger.error(f"验证迁移数据异常: {e}")
            result["errors"].append({
                "type": "exception",
                "message": str(e)
            })
            result["valid"] = False
        
        return result
    
    async def rollback_migration(
        self, 
        tenant_id: int,
        source_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        回滚迁移数据
        
        Args:
            tenant_id: 租户ID
            source_type: 源类型（sales_forecast 或 sales_order），None表示回滚所有
            
        Returns:
            Dict: 回滚结果
        """
        logger.warning(f"开始回滚租户 {tenant_id} 的迁移数据（source_type={source_type}）")
        
        result = {
            "count": 0,
            "deleted": [],
            "errors": []
        }
        
        try:
            # 构建查询条件
            filters = {
                "tenant_id": tenant_id
            }
            if source_type:
                filters["source_type"] = source_type
            
            # 查询已迁移的需求
            demands = await Demand.filter(**filters).all()
            
            logger.info(f"找到 {len(demands)} 条已迁移的需求数据")
            
            for demand in demands:
                try:
                    # 删除需求明细
                    await DemandItem.filter(demand_id=demand.id).delete()
                    
                    # 删除需求
                    await demand.delete()
                    
                    result["deleted"].append({
                        "demand_id": demand.id,
                        "demand_code": demand.demand_code,
                        "source_type": demand.source_type,
                        "source_id": demand.source_id,
                        "source_code": demand.source_code
                    })
                    result["count"] += 1
                    logger.info(f"已回滚需求 {demand.demand_code}")
                    
                except Exception as e:
                    error_msg = f"回滚需求 {demand.demand_code} 失败: {str(e)}"
                    logger.error(error_msg)
                    result["errors"].append({
                        "demand_id": demand.id,
                        "demand_code": demand.demand_code,
                        "error": error_msg
                    })
            
        except Exception as e:
            logger.error(f"回滚迁移数据异常: {e}")
            result["errors"].append({
                "type": "exception",
                "message": str(e)
            })
        
        return result
