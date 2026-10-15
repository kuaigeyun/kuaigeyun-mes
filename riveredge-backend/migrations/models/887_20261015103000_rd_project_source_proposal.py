"""研发项目关联来源项目建议书"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaiplm_rd_projects"
            ADD COLUMN IF NOT EXISTS "source_proposal_id" INT;
        COMMENT ON COLUMN "apps_kuaiplm_rd_projects"."source_proposal_id"
            IS '来源项目建议书ID';
        CREATE INDEX IF NOT EXISTS "idx_rd_projects_tenant_source_proposal"
            ON "apps_kuaiplm_rd_projects" ("tenant_id", "source_proposal_id");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "idx_rd_projects_tenant_source_proposal";
        ALTER TABLE "apps_kuaiplm_rd_projects"
            DROP COLUMN IF EXISTS "source_proposal_id";
    """
