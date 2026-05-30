"""工单 parent_work_order_id：拆分工单挂原工单；并尝试按编码规则回填历史数据"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_work_orders"
            ADD COLUMN IF NOT EXISTS "parent_work_order_id" INT NULL;

        COMMENT ON COLUMN "apps_kuaizhizao_work_orders"."parent_work_order_id"
            IS '原工单 ID（拆分工单指向被拆分的工单）';

        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_work_orders_parent_work_order_id"
            ON "apps_kuaizhizao_work_orders" ("parent_work_order_id");

        UPDATE "apps_kuaizhizao_work_orders" AS child
        SET "parent_work_order_id" = parent.id
        FROM "apps_kuaizhizao_work_orders" AS parent
        WHERE child."parent_work_order_id" IS NULL
          AND child."deleted_at" IS NULL
          AND parent."deleted_at" IS NULL
          AND child."tenant_id" = parent."tenant_id"
          AND child.code ~ '.+-[0-9]{3}$'
          AND parent.code = regexp_replace(child.code, '-[0-9]{3}$', '');
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "idx_apps_kuaizhizao_work_orders_parent_work_order_id";
        ALTER TABLE "apps_kuaizhizao_work_orders"
            DROP COLUMN IF EXISTS "parent_work_order_id";
    """
