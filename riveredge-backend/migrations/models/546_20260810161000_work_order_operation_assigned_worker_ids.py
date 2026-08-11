"""
工单工序派工支持多人：assigned_worker_ids JSON 数组。

存量单人员派工回填为 [assigned_worker_id]；展示名仍用 assigned_worker_name（逗号分隔多人）。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_work_order_operations"
        ADD COLUMN IF NOT EXISTS "assigned_worker_ids" JSONB NOT NULL DEFAULT '[]';

        ALTER TABLE "apps_kuaizhizao_work_order_operations"
        ALTER COLUMN "assigned_worker_name" TYPE VARCHAR(500);

        UPDATE "apps_kuaizhizao_work_order_operations"
        SET "assigned_worker_ids" = jsonb_build_array("assigned_worker_id")
        WHERE "assigned_worker_id" IS NOT NULL
          AND (
            "assigned_worker_ids" IS NULL
            OR "assigned_worker_ids" = '[]'::jsonb
          );
    """
