"""
数据库迁移：DemandComputation 和 DemandComputationItem 多需求支持

- DemandComputation 新增 demand_ids (JSONB)，存储参与计算的需求 ID 列表
- DemandComputationItem 新增 demand_item_ids (JSONB)，存储该计算行由哪些 DemandItem 汇总而来

设计文档：多需求合并与追溯设计.md

Author: RiverEdge Team
Date: 2025-02-02
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    执行迁移：添加 demand_ids 和 demand_item_ids 列
    """
    return """
        ALTER TABLE "apps_kuaizhizao_demand_computations"
        ADD COLUMN IF NOT EXISTS "demand_ids" JSONB;

        COMMENT ON COLUMN "apps_kuaizhizao_demand_computations"."demand_ids" IS '参与计算的需求ID列表，多需求合并时使用';

        ALTER TABLE "apps_kuaizhizao_demand_computation_items"
        ADD COLUMN IF NOT EXISTS "demand_item_ids" JSONB;

        COMMENT ON COLUMN "apps_kuaizhizao_demand_computation_items"."demand_item_ids" IS '该计算行由哪些 DemandItem 汇总而来，用于追溯';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """回滚迁移"""
    return """
        ALTER TABLE "apps_kuaizhizao_demand_computations"
        DROP COLUMN IF EXISTS "demand_ids";

        ALTER TABLE "apps_kuaizhizao_demand_computation_items"
        DROP COLUMN IF EXISTS "demand_item_ids";
    """
