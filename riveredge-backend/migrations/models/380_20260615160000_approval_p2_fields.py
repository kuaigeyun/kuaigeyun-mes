"""审批任务 P2 扩展字段 + 流程版本 + 实例版本钉扎"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "core_approval_tasks"
        ADD COLUMN IF NOT EXISTS "delegated_from_user_id" INT,
        ADD COLUMN IF NOT EXISTS "sign_type" VARCHAR(20),
        ADD COLUMN IF NOT EXISTS "due_at" TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "parent_task_id" INT;

        ALTER TABLE "core_approval_processes"
        ADD COLUMN IF NOT EXISTS "version" INT NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS "published_version" INT NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS "draft_nodes" JSONB;

        ALTER TABLE "core_approval_instances"
        ADD COLUMN IF NOT EXISTS "process_version" INT;

        ALTER TABLE "core_approval_histories"
        ALTER COLUMN "action" TYPE VARCHAR(40);
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "core_approval_tasks"
        DROP COLUMN IF EXISTS "delegated_from_user_id",
        DROP COLUMN IF EXISTS "sign_type",
        DROP COLUMN IF EXISTS "due_at",
        DROP COLUMN IF EXISTS "parent_task_id";

        ALTER TABLE "core_approval_processes"
        DROP COLUMN IF EXISTS "version",
        DROP COLUMN IF EXISTS "published_version",
        DROP COLUMN IF EXISTS "draft_nodes";

        ALTER TABLE "core_approval_instances"
        DROP COLUMN IF EXISTS "process_version";

        ALTER TABLE "core_approval_histories"
        ALTER COLUMN "action" TYPE VARCHAR(20);
    """
