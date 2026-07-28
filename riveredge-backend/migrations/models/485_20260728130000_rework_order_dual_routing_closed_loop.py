"""返工单双路线模式与闭环字段迁移。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_rework_orders"
            ADD COLUMN IF NOT EXISTS "routing_mode" VARCHAR(20) NOT NULL DEFAULT 'DYNAMIC',
            ADD COLUMN IF NOT EXISTS "current_operation_link_id" INT,
            ADD COLUMN IF NOT EXISTS "verification_required" BOOL NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS "completed_quantity" DECIMAL(18,4),
            ADD COLUMN IF NOT EXISTS "completion_requested_at" TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS "completion_requested_by" INT,
            ADD COLUMN IF NOT EXISTS "completion_requested_by_name" VARCHAR(100),
            ADD COLUMN IF NOT EXISTS "quality_released_at" TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS "quality_released_by" INT,
            ADD COLUMN IF NOT EXISTS "quality_released_by_name" VARCHAR(100),
            ADD COLUMN IF NOT EXISTS "closed_at" TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS "closed_by" INT,
            ADD COLUMN IF NOT EXISTS "closed_by_name" VARCHAR(100),
            ADD COLUMN IF NOT EXISTS "on_hold_at" TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS "on_hold_by" INT,
            ADD COLUMN IF NOT EXISTS "on_hold_by_name" VARCHAR(100),
            ADD COLUMN IF NOT EXISTS "hold_previous_status" VARCHAR(30),
            ADD COLUMN IF NOT EXISTS "source_inspection_id" INT,
            ADD COLUMN IF NOT EXISTS "verification_inspection_id" INT;

        COMMENT ON COLUMN "apps_kuaizhizao_rework_orders"."routing_mode" IS '路线模式 DYNAMIC/PREDEFINED';
        COMMENT ON COLUMN "apps_kuaizhizao_rework_orders"."current_operation_link_id" IS '当前激活的返工工序行 ID';
        COMMENT ON COLUMN "apps_kuaizhizao_rework_orders"."verification_required" IS '关闭前是否需复检';
        COMMENT ON COLUMN "apps_kuaizhizao_rework_orders"."completed_quantity" IS '申请完修数量';

        UPDATE "apps_kuaizhizao_rework_orders"
        SET "status" = 'closed'
        WHERE "status" = 'completed' AND "deleted_at" IS NULL;

        ALTER TABLE "apps_kuaizhizao_rework_order_operations"
            ADD COLUMN IF NOT EXISTS "role" VARCHAR(20) NOT NULL DEFAULT 'start',
            ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
            ADD COLUMN IF NOT EXISTS "input_quantity" DECIMAL(18,4),
            ADD COLUMN IF NOT EXISTS "qualified_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS "unqualified_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS "started_at" TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS "decision_reason" TEXT,
            ADD COLUMN IF NOT EXISTS "decided_by" INT,
            ADD COLUMN IF NOT EXISTS "decided_by_name" VARCHAR(100),
            ADD COLUMN IF NOT EXISTS "decided_at" TIMESTAMPTZ;

        UPDATE "apps_kuaizhizao_rework_order_operations" roo
        SET "role" = 'start', "status" = 'completed', "input_quantity" = ro.quantity
        FROM "apps_kuaizhizao_rework_orders" ro
        WHERE roo."rework_order_id" = ro."id"
          AND ro."status" IN ('closed', 'in_progress', 'released', 'pending_verification', 'quality_released')
          AND roo."sequence" = 0;

        ALTER TABLE "apps_kuaizhizao_reporting_records"
            ADD COLUMN IF NOT EXISTS "rework_order_operation_id" INT;

        COMMENT ON COLUMN "apps_kuaizhizao_reporting_records"."rework_order_operation_id"
            IS '返工工序行 ID（apps_kuaizhizao_rework_order_operations.id）';

        CREATE INDEX IF NOT EXISTS "idx_rework_orders_routing_mode"
            ON "apps_kuaizhizao_rework_orders" ("tenant_id", "routing_mode");
        CREATE INDEX IF NOT EXISTS "idx_rework_order_operations_status"
            ON "apps_kuaizhizao_rework_order_operations" ("tenant_id", "rework_order_id", "status");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "apps_kuaizhizao_rework_orders"
        SET "status" = 'completed'
        WHERE "status" = 'closed' AND "deleted_at" IS NULL;

        DROP INDEX IF EXISTS "idx_rework_order_operations_status";
        DROP INDEX IF EXISTS "idx_rework_orders_routing_mode";

        ALTER TABLE "apps_kuaizhizao_reporting_records"
            DROP COLUMN IF EXISTS "rework_order_operation_id";

        ALTER TABLE "apps_kuaizhizao_rework_order_operations"
            DROP COLUMN IF EXISTS "decided_at",
            DROP COLUMN IF EXISTS "decided_by_name",
            DROP COLUMN IF EXISTS "decided_by",
            DROP COLUMN IF EXISTS "decision_reason",
            DROP COLUMN IF EXISTS "completed_at",
            DROP COLUMN IF EXISTS "started_at",
            DROP COLUMN IF EXISTS "unqualified_quantity",
            DROP COLUMN IF EXISTS "qualified_quantity",
            DROP COLUMN IF EXISTS "input_quantity",
            DROP COLUMN IF EXISTS "status",
            DROP COLUMN IF EXISTS "role";

        ALTER TABLE "apps_kuaizhizao_rework_orders"
            DROP COLUMN IF EXISTS "verification_inspection_id",
            DROP COLUMN IF EXISTS "source_inspection_id",
            DROP COLUMN IF EXISTS "on_hold_by_name",
            DROP COLUMN IF EXISTS "on_hold_by",
            DROP COLUMN IF EXISTS "on_hold_at",
            DROP COLUMN IF EXISTS "hold_previous_status",
            DROP COLUMN IF EXISTS "closed_by_name",
            DROP COLUMN IF EXISTS "closed_by",
            DROP COLUMN IF EXISTS "closed_at",
            DROP COLUMN IF EXISTS "quality_released_by_name",
            DROP COLUMN IF EXISTS "quality_released_by",
            DROP COLUMN IF EXISTS "quality_released_at",
            DROP COLUMN IF EXISTS "completion_requested_by_name",
            DROP COLUMN IF EXISTS "completion_requested_by",
            DROP COLUMN IF EXISTS "completion_requested_at",
            DROP COLUMN IF EXISTS "completed_quantity",
            DROP COLUMN IF EXISTS "verification_required",
            DROP COLUMN IF EXISTS "current_operation_link_id",
            DROP COLUMN IF EXISTS "routing_mode";
    """
