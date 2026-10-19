"""研发项目：体系清单字段并入交付物（funide 合并）。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaiplm_rd_project_deliverables"
            ADD COLUMN IF NOT EXISTS "system_archive_type_code" VARCHAR(50),
            ADD COLUMN IF NOT EXISTS "linked_target_type" VARCHAR(50),
            ADD COLUMN IF NOT EXISTS "linked_target_id" INT,
            ADD COLUMN IF NOT EXISTS "linked_target_uuid" VARCHAR(36),
            ADD COLUMN IF NOT EXISTS "linked_target_code" VARCHAR(100),
            ADD COLUMN IF NOT EXISTS "linked_target_name" VARCHAR(200),
            ADD COLUMN IF NOT EXISTS "missing_notes" TEXT,
            ADD COLUMN IF NOT EXISTS "missing_marked_at" TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS "missing_marked_by" INT,
            ADD COLUMN IF NOT EXISTS "missing_marked_by_name" VARCHAR(100),
            ADD COLUMN IF NOT EXISTS "acceptance_notes" TEXT,
            ADD COLUMN IF NOT EXISTS "accepted_at" TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS "accepted_by" INT,
            ADD COLUMN IF NOT EXISTS "accepted_by_name" VARCHAR(100);
        CREATE UNIQUE INDEX IF NOT EXISTS "uidx_rd_deliverable_system_archive_type"
            ON "apps_kuaiplm_rd_project_deliverables" ("tenant_id", "project_id", "system_archive_type_code")
            WHERE "system_archive_type_code" IS NOT NULL AND "deleted_at" IS NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "uidx_rd_deliverable_system_archive_type";
        ALTER TABLE "apps_kuaiplm_rd_project_deliverables"
            DROP COLUMN IF EXISTS "accepted_by_name",
            DROP COLUMN IF EXISTS "accepted_by",
            DROP COLUMN IF EXISTS "accepted_at",
            DROP COLUMN IF EXISTS "acceptance_notes",
            DROP COLUMN IF EXISTS "missing_marked_by_name",
            DROP COLUMN IF EXISTS "missing_marked_by",
            DROP COLUMN IF EXISTS "missing_marked_at",
            DROP COLUMN IF EXISTS "missing_notes",
            DROP COLUMN IF EXISTS "linked_target_name",
            DROP COLUMN IF EXISTS "linked_target_code",
            DROP COLUMN IF EXISTS "linked_target_uuid",
            DROP COLUMN IF EXISTS "linked_target_id",
            DROP COLUMN IF EXISTS "linked_target_type",
            DROP COLUMN IF EXISTS "system_archive_type_code";
    """
