"""保养执行记录增加来源字段：source_type / source_uuid（故障转保养）。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_maintenance_executions"
            ADD COLUMN IF NOT EXISTS "source_type" VARCHAR(50);
        COMMENT ON COLUMN "apps_kuaizhizao_maintenance_executions"."source_type"
            IS '来源类型（equipment_fault 等）';

        ALTER TABLE "apps_kuaizhizao_maintenance_executions"
            ADD COLUMN IF NOT EXISTS "source_uuid" VARCHAR(36);
        COMMENT ON COLUMN "apps_kuaizhizao_maintenance_executions"."source_uuid"
            IS '来源单据 UUID';

        CREATE INDEX IF NOT EXISTS "idx_maint_exec_source"
            ON "apps_kuaizhizao_maintenance_executions" ("tenant_id", "source_type", "source_uuid");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "idx_maint_exec_source";
        ALTER TABLE "apps_kuaizhizao_maintenance_executions" DROP COLUMN IF EXISTS "source_uuid";
        ALTER TABLE "apps_kuaizhizao_maintenance_executions" DROP COLUMN IF EXISTS "source_type";
    """
