"""
库存流水报表常用过滤：tenant_id + created_at。
收发存明细/汇总按期间扫流水时缺少该复合索引会全表扫描。
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE INDEX IF NOT EXISTS "idx_mat_stock_mov_tenant_created"
        ON "apps_kuaizhizao_material_stock_movements" ("tenant_id", "created_at");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "idx_mat_stock_mov_tenant_created";
    """
