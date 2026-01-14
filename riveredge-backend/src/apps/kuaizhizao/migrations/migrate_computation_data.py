"""
历史数据迁移脚本

将旧的MRP和LRP运算结果数据迁移到统一需求计算结果表。

Author: Luigi Lu
Date: 2025-01-14
"""

from typing import Dict, List, Any, Optional
from datetime import datetime
from decimal import Decimal
from loguru import logger

from apps.kuaizhizao.models.demand_computation import DemandComputation
from apps.kuaizhizao.models.demand_computation_item import DemandComputationItem
from apps.kuaizhizao.models.demand import Demand


class ComputationDataMigration:
    """需求计算数据迁移类"""
    
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
        logger.info(f"开始迁移租户 {tenant_id} 的需求计算数据（dry_run={dry_run}）")
        
        result = {
            "tenant_id": tenant_id,
            "dry_run": dry_run,
            "mrp_count": 0,
            "lrp_count": 0,
            "migrated_computations": [],
            "errors": [],
            "start_time": datetime.now().isoformat(),
            "end_time": None,
        }
        
        try:
            # 迁移MRP数据
            mrp_result = await self.migrate_mrp_results(tenant_id, dry_run)
            result["mrp_count"] = mrp_result["migrated_count"]
            result["migrated_computations"].extend(mrp_result["migrated_computations"])
            result["errors"].extend(mrp_result["errors"])
            
            # 迁移LRP数据
            lrp_result = await self.migrate_lrp_results(tenant_id, dry_run)
            result["lrp_count"] = lrp_result["migrated_count"]
            result["migrated_computations"].extend(lrp_result["migrated_computations"])
            result["errors"].extend(lrp_result["errors"])
            
        except Exception as e:
            logger.error(f"迁移过程中发生错误: {e}")
            result["errors"].append({"type": "migration_error", "message": str(e)})
        
        result["end_time"] = datetime.now().isoformat()
        logger.info(f"迁移完成: MRP {result['mrp_count']} 条, LRP {result['lrp_count']} 条")
        
        return result
    
    async def migrate_mrp_results(self, tenant_id: int, dry_run: bool = False) -> Dict[str, Any]:
        """
        迁移MRP运算结果数据
        
        Args:
            tenant_id: 租户ID
            dry_run: 是否仅模拟运行
            
        Returns:
            Dict: 迁移结果
        """
        logger.info(f"开始迁移MRP数据（tenant_id={tenant_id}, dry_run={dry_run}）")
        
        result = {
            "migrated_count": 0,
            "migrated_computations": [],
            "errors": [],
        }
        
        try:
            # 注意：这里需要从旧的MRP结果表读取数据
            # 由于旧模型可能已经废弃，我们需要直接查询数据库表
            from tortoise import Tortoise
            from tortoise.connection import connections
            
            # 获取数据库连接
            conn = connections.get("default")
            
            # 查询旧的MRP结果数据（按forecast_id分组）
            query = """
                SELECT 
                    forecast_id,
                    COUNT(*) as item_count,
                    MIN(computation_time) as min_time,
                    MAX(computation_time) as max_time
                FROM apps_kuaizhizao_mrp_results
                WHERE tenant_id = $1 AND deleted_at IS NULL
                GROUP BY forecast_id
            """
            
            rows = await conn.execute_query(query, [tenant_id])
            
            for row in rows:
                forecast_id = row[0]
                
                try:
                    # 查找对应的需求（通过forecast_id）
                    demand = await Demand.get_or_none(
                        tenant_id=tenant_id,
                        demand_type="sales_forecast",
                        # 注意：需要根据实际需求表结构关联forecast_id
                        # 这里假设需求表有source_id字段存储原始forecast_id
                    )
                    
                    if not demand:
                        logger.warning(f"未找到对应的需求（forecast_id={forecast_id}），跳过")
                        continue
                    
                    # 检查是否已经迁移过
                    existing = await DemandComputation.get_or_none(
                        tenant_id=tenant_id,
                        demand_id=demand.id,
                        computation_type="MRP"
                    )
                    
                    if existing:
                        logger.info(f"需求 {demand.id} 的MRP计算已存在，跳过")
                        continue
                    
                    if not dry_run:
                        # 创建统一需求计算
                        computation = await self._create_computation_from_mrp(
                            tenant_id=tenant_id,
                            demand=demand,
                            forecast_id=forecast_id
                        )
                        result["migrated_computations"].append({
                            "computation_id": computation.id,
                            "computation_code": computation.computation_code,
                            "demand_id": demand.id,
                            "type": "MRP"
                        })
                    
                    result["migrated_count"] += 1
                    
                except Exception as e:
                    logger.error(f"迁移MRP数据失败（forecast_id={forecast_id}）: {e}")
                    result["errors"].append({
                        "type": "mrp_migration_error",
                        "forecast_id": forecast_id,
                        "message": str(e)
                    })
            
        except Exception as e:
            logger.error(f"迁移MRP数据过程中发生错误: {e}")
            result["errors"].append({
                "type": "mrp_migration_error",
                "message": str(e)
            })
        
        logger.info(f"MRP数据迁移完成: {result['migrated_count']} 条")
        return result
    
    async def _create_computation_from_mrp(
        self,
        tenant_id: int,
        demand: Demand,
        forecast_id: int
    ) -> DemandComputation:
        """
        从MRP结果创建统一需求计算
        
        Args:
            tenant_id: 租户ID
            demand: 需求对象
            forecast_id: 销售预测ID
            
        Returns:
            DemandComputation: 创建的计算对象
        """
        from core.services.business.code_generation_service import CodeGenerationService
        
        # 生成计算编码
        try:
            computation_code = await CodeGenerationService.generate_code(
                tenant_id=tenant_id,
                rule_code="DEMAND_COMPUTATION",
                context={"computation_type": "MRP"}
            )
        except Exception:
            now = datetime.now()
            computation_code = f"MRP-{now.strftime('%Y%m%d')}-MIGRATED"
        
        # 创建计算对象
        computation = await DemandComputation.create(
            tenant_id=tenant_id,
            computation_code=computation_code,
            demand_id=demand.id,
            demand_code=demand.demand_code,
            demand_type=demand.demand_type,
            business_mode=demand.business_mode,
            computation_type="MRP",
            computation_params={
                "source": "migration",
                "original_forecast_id": forecast_id,
            },
            computation_status="完成",
            notes="从历史MRP数据迁移",
            created_by=None,
        )
        
        # 迁移计算结果明细
        await self._migrate_mrp_items(tenant_id, computation, forecast_id)
        
        return computation
    
    async def _migrate_mrp_items(
        self,
        tenant_id: int,
        computation: DemandComputation,
        forecast_id: int
    ) -> None:
        """
        迁移MRP计算结果明细
        
        Args:
            tenant_id: 租户ID
            computation: 计算对象
            forecast_id: 销售预测ID
        """
        from tortoise.connection import connections
        
        conn = connections.get("default")
        
        # 查询MRP结果明细
        query = """
            SELECT 
                material_id,
                planning_horizon,
                time_bucket,
                current_inventory,
                safety_stock,
                reorder_point,
                total_gross_requirement,
                total_net_requirement,
                total_planned_receipt,
                total_planned_release,
                suggested_work_orders,
                suggested_purchase_orders,
                demand_schedule,
                inventory_schedule,
                planned_order_schedule,
                notes
            FROM apps_kuaizhizao_mrp_results
            WHERE tenant_id = $1 AND forecast_id = $2 AND deleted_at IS NULL
        """
        
        rows = await conn.execute_query(query, [tenant_id, forecast_id])
        
        # 获取物料信息（需要从物料表查询）
        from apps.master_data.models.material import Material
        
        for row in rows:
            material_id = row[0]
            material = await Material.get_or_none(tenant_id=tenant_id, id=material_id)
            
            if not material:
                logger.warning(f"物料不存在（material_id={material_id}），跳过")
                continue
            
            # 创建计算结果明细
            await DemandComputationItem.create(
                tenant_id=tenant_id,
                computation_id=computation.id,
                material_id=material_id,
                material_code=material.code,
                material_name=material.name,
                material_spec=material.spec,
                material_unit=material.unit,
                required_quantity=Decimal(str(row[6])),  # total_gross_requirement
                available_inventory=Decimal(str(row[3])),  # current_inventory
                net_requirement=Decimal(str(row[7])),  # total_net_requirement
                gross_requirement=Decimal(str(row[6])),  # total_gross_requirement
                safety_stock=Decimal(str(row[4])),  # safety_stock
                reorder_point=Decimal(str(row[5])),  # reorder_point
                planned_receipt=Decimal(str(row[8])),  # total_planned_receipt
                planned_release=Decimal(str(row[9])),  # total_planned_release
                suggested_work_order_quantity=Decimal(str(row[10])) if row[10] else None,  # suggested_work_orders
                suggested_purchase_order_quantity=Decimal(str(row[11])) if row[11] else None,  # suggested_purchase_orders
                detail_results={
                    "demand_schedule": row[12] if row[12] else {},
                    "inventory_schedule": row[13] if row[13] else {},
                    "planned_order_schedule": row[14] if row[14] else {},
                },
                notes=row[15] if row[15] else None,
            )
