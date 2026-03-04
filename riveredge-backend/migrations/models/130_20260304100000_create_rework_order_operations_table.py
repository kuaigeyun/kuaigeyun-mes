"""
创建返工单关联工序表

用于记录返工单涉及原工单的哪几道工序需要返工。

Author: RiverEdge Team
Date: 2026-03-04
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_rework_order_operations" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "rework_order_id" INT NOT NULL,
            "work_order_operation_id" INT NOT NULL,
            "sequence" INT NOT NULL DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_rework_order_ops_tenant_id" ON "apps_kuaizhizao_rework_order_operations" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_rework_order_ops_rework_order_id" ON "apps_kuaizhizao_rework_order_operations" ("rework_order_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_rework_order_ops_work_order_op_id" ON "apps_kuaizhizao_rework_order_operations" ("work_order_operation_id");
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_kuaizh_rework_order_ops_unique" ON "apps_kuaizhizao_rework_order_operations" ("tenant_id", "rework_order_id", "work_order_operation_id");

        COMMENT ON TABLE "apps_kuaizhizao_rework_order_operations" IS '快格轻制造 - 返工单关联工序';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_rework_order_operations" CASCADE;
    """
