"""快制造 — 交付项目 material_lines_json 与 rd_project_id"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_delivery_projects"
            ADD COLUMN IF NOT EXISTS "material_lines_json" TEXT,
            ADD COLUMN IF NOT EXISTS "rd_project_id" INT;

        CREATE INDEX IF NOT EXISTS "idx_dp_tenant_rd_project"
            ON "apps_kuaizhizao_delivery_projects" ("tenant_id", "rd_project_id");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "idx_dp_tenant_rd_project";
        ALTER TABLE "apps_kuaizhizao_delivery_projects"
            DROP COLUMN IF EXISTS "rd_project_id",
            DROP COLUMN IF EXISTS "material_lines_json";
    """
