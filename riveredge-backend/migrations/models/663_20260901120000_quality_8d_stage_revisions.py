"""
8D 阶段修订历史表 + 阶段解锁状态
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_quality_8d_reports"
            ADD COLUMN IF NOT EXISTS "stage_unlocks" JSONB NULL;
        COMMENT ON COLUMN "apps_kuaizhizao_quality_8d_reports"."stage_unlocks"
            IS '已申请修改并解锁的阶段';

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_quality_8d_stage_revisions" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "report_id" INT NOT NULL,
            "stage_key" VARCHAR(30) NOT NULL,
            "revision_no" INT NOT NULL,
            "action" VARCHAR(30) NOT NULL,
            "content" TEXT,
            "change_reason" TEXT,
            "changed_by" INT,
            "changed_by_name" VARCHAR(100),
            "changed_at" TIMESTAMPTZ NOT NULL
        );
        CREATE INDEX IF NOT EXISTS "idx_quality_8d_stage_revisions_tenant_id"
            ON "apps_kuaizhizao_quality_8d_stage_revisions" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_quality_8d_stage_revisions_report_id"
            ON "apps_kuaizhizao_quality_8d_stage_revisions" ("report_id");
        CREATE INDEX IF NOT EXISTS "idx_quality_8d_stage_revisions_stage_key"
            ON "apps_kuaizhizao_quality_8d_stage_revisions" ("stage_key");
        CREATE INDEX IF NOT EXISTS "idx_quality_8d_stage_revisions_changed_at"
            ON "apps_kuaizhizao_quality_8d_stage_revisions" ("changed_at");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_quality_8d_stage_revisions";
        ALTER TABLE "apps_kuaizhizao_quality_8d_reports"
            DROP COLUMN IF EXISTS "stage_unlocks";
    """
