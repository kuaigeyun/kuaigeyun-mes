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
