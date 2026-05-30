"""返工单起始工序 + 报工记录关联返工单"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_rework_orders"
            ADD COLUMN IF NOT EXISTS "start_work_order_operation_id" INT NULL;

        COMMENT ON COLUMN "apps_kuaizhizao_rework_orders"."start_work_order_operation_id"
            IS '返工起始工序（原工单工序 ID；整单返工为原工单首道工序）';

        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_rework_orders_start_wo_op_id"
            ON "apps_kuaizhizao_rework_orders" ("start_work_order_operation_id");

        UPDATE "apps_kuaizhizao_rework_orders" AS ro
        SET "start_work_order_operation_id" = sub.work_order_operation_id
        FROM (
            SELECT DISTINCT ON (rework_order_id)
                rework_order_id,
                work_order_operation_id
            FROM "apps_kuaizhizao_rework_order_operations"
            ORDER BY rework_order_id, sequence ASC, work_order_operation_id ASC
        ) AS sub
        WHERE ro.id = sub.rework_order_id
          AND ro."start_work_order_operation_id" IS NULL;

        UPDATE "apps_kuaizhizao_rework_orders" AS ro
        SET "start_work_order_operation_id" = wo_op.id
        FROM "apps_kuaizhizao_work_order_operations" AS wo_op
        WHERE ro."start_work_order_operation_id" IS NULL
          AND ro."original_work_order_id" = wo_op."work_order_id"
          AND ro."tenant_id" = wo_op."tenant_id"
          AND wo_op."deleted_at" IS NULL
          AND wo_op.id = (
              SELECT op2.id
              FROM "apps_kuaizhizao_work_order_operations" AS op2
              WHERE op2."work_order_id" = ro."original_work_order_id"
                AND op2."tenant_id" = ro."tenant_id"
                AND op2."deleted_at" IS NULL
              ORDER BY op2.sequence ASC, op2.id ASC
              LIMIT 1
          );

        ALTER TABLE "apps_kuaizhizao_reporting_records"
            ADD COLUMN IF NOT EXISTS "rework_order_id" INT NULL;

        COMMENT ON COLUMN "apps_kuaizhizao_reporting_records"."rework_order_id"
            IS '返工单 ID（返工报工时有值，不影响原工单工序累计）';

        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_reporting_records_rework_order_id"
            ON "apps_kuaizhizao_reporting_records" ("rework_order_id");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "idx_apps_kuaizhizao_reporting_records_rework_order_id";
        ALTER TABLE "apps_kuaizhizao_reporting_records"
            DROP COLUMN IF EXISTS "rework_order_id";

        DROP INDEX IF EXISTS "idx_apps_kuaizh_rework_orders_start_wo_op_id";
        ALTER TABLE "apps_kuaizhizao_rework_orders"
            DROP COLUMN IF EXISTS "start_work_order_operation_id";
    """
