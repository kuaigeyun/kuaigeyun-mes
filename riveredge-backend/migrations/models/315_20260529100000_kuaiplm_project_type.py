"""
快研发：项目类型（研发 / 交付）与来源项目关联

Author: RiverEdge Team
Date: 2026-05-29
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaiplm_rd_projects"
            ADD COLUMN IF NOT EXISTS "project_type" VARCHAR(20) NOT NULL DEFAULT 'RD',
            ADD COLUMN IF NOT EXISTS "source_project_id" INT NULL;

        CREATE INDEX IF NOT EXISTS "idx_kuaiplm_rd_project_type"
            ON "apps_kuaiplm_rd_projects" ("tenant_id", "project_type");

        CREATE INDEX IF NOT EXISTS "idx_kuaiplm_rd_project_source"
            ON "apps_kuaiplm_rd_projects" ("source_project_id");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "idx_kuaiplm_rd_project_source";
        DROP INDEX IF EXISTS "idx_kuaiplm_rd_project_type";
        ALTER TABLE "apps_kuaiplm_rd_projects"
            DROP COLUMN IF EXISTS "source_project_id",
            DROP COLUMN IF EXISTS "project_type";
    """
