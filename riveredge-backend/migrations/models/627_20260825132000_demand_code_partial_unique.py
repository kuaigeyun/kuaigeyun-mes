"""
需求编码唯一约束改为「未删除」部分唯一索引。

历史 soft-delete 行仍占用 (tenant_id, demand_code) 全表唯一时，
销售订单下推会因 IntegrityError 失败并被 API 吞成笼统 500。
"""

from tortoise import BaseDBAsyncClient


RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_demands"
            DROP CONSTRAINT IF EXISTS "uid_apps_kuaizh_demand_c_123456";
        DROP INDEX IF EXISTS "uid_apps_kuaizh_demand_c_123456";
        CREATE UNIQUE INDEX IF NOT EXISTS "uid_apps_kuaizh_demand_code_active"
            ON "apps_kuaizhizao_demands" ("tenant_id", "demand_code")
            WHERE "deleted_at" IS NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "uid_apps_kuaizh_demand_code_active";
        ALTER TABLE "apps_kuaizhizao_demands"
            DROP CONSTRAINT IF EXISTS "uid_apps_kuaizh_demand_c_123456";
        DROP INDEX IF EXISTS "uid_apps_kuaizh_demand_c_123456";
        CREATE UNIQUE INDEX "uid_apps_kuaizh_demand_c_123456"
            ON "apps_kuaizhizao_demands" ("tenant_id", "demand_code");
    """
