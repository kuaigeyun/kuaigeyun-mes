"""
工单表添加部分唯一索引以支持软删除后编码重用

工单表原唯一约束 (tenant_id, code) 包含软删除记录，导致下推工单时若编码已存在（含已删除）
会报重复键错误。改为部分唯一索引 WHERE deleted_at IS NULL，与物料等表一致。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 删除旧的唯一约束
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'uid_apps_kuaizh_tenant__b950cb'
            ) THEN
                ALTER TABLE "apps_kuaizhizao_work_orders"
                DROP CONSTRAINT "uid_apps_kuaizh_tenant__b950cb";
            END IF;
        END $$;

        -- 创建部分唯一索引（仅对未删除记录生效）
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_work_orders_tenant_code"
        ON "apps_kuaizhizao_work_orders" ("tenant_id", "code")
        WHERE "deleted_at" IS NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 删除部分唯一索引
        DROP INDEX IF EXISTS "idx_apps_kuaizhizao_work_orders_tenant_code";

        -- 恢复原唯一约束
        ALTER TABLE "apps_kuaizhizao_work_orders"
        ADD CONSTRAINT "uid_apps_kuaizh_tenant__b950cb" UNIQUE ("tenant_id", "code");
    """
