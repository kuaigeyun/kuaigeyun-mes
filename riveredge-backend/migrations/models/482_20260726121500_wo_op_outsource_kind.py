"""工单工序委外落章字段：outsource_kind / lead_time / 默认供应商。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_work_order_operations"
            ADD COLUMN IF NOT EXISTS "outsource_kind" VARCHAR(20) NOT NULL DEFAULT 'none';
        COMMENT ON COLUMN "apps_kuaizhizao_work_order_operations"."outsource_kind"
            IS '委外类型：none / planned / ad_hoc';

        ALTER TABLE "apps_kuaizhizao_work_order_operations"
            ADD COLUMN IF NOT EXISTS "outsource_lead_time_days" INT;
        COMMENT ON COLUMN "apps_kuaizhizao_work_order_operations"."outsource_lead_time_days"
            IS '委外提前期（天）';

        ALTER TABLE "apps_kuaizhizao_work_order_operations"
            ADD COLUMN IF NOT EXISTS "default_outsource_supplier_id" INT;
        COMMENT ON COLUMN "apps_kuaizhizao_work_order_operations"."default_outsource_supplier_id"
            IS '默认委外供应商ID';

        ALTER TABLE "apps_kuaizhizao_work_order_operations"
            ADD COLUMN IF NOT EXISTS "default_outsource_supplier_name" VARCHAR(200);
        COMMENT ON COLUMN "apps_kuaizhizao_work_order_operations"."default_outsource_supplier_name"
            IS '默认委外供应商名称';

        CREATE INDEX IF NOT EXISTS "idx_wo_op_outsource_kind"
            ON "apps_kuaizhizao_work_order_operations" ("tenant_id", "outsource_kind");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "idx_wo_op_outsource_kind";
        ALTER TABLE "apps_kuaizhizao_work_order_operations" DROP COLUMN IF EXISTS "default_outsource_supplier_name";
        ALTER TABLE "apps_kuaizhizao_work_order_operations" DROP COLUMN IF EXISTS "default_outsource_supplier_id";
        ALTER TABLE "apps_kuaizhizao_work_order_operations" DROP COLUMN IF EXISTS "outsource_lead_time_days";
        ALTER TABLE "apps_kuaizhizao_work_order_operations" DROP COLUMN IF EXISTS "outsource_kind";
    """
