"""移除排程场景表（自动排程沙盘已下线）。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_scheduling_scenarios";
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_scheduling_scenarios" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "name" VARCHAR(120) NOT NULL,
            "description" TEXT,
            "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
            "objective" VARCHAR(40) NOT NULL DEFAULT 'min_makespan',
            "work_order_ids" JSONB NOT NULL,
            "constraints" JSONB NOT NULL,
            "result_snapshot" JSONB NOT NULL,
            "metrics" JSONB NOT NULL,
            "published_at" TIMESTAMPTZ,
            "published_by" INT,
            "created_by" INT,
            "updated_by" INT,
            "deleted_at" TIMESTAMPTZ
        );
    """
