from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_bom"
            ADD COLUMN IF NOT EXISTS "issue_method" VARCHAR(20) NOT NULL DEFAULT 'pick';

        COMMENT ON COLUMN "apps_master_data_bom"."issue_method"
            IS '发料方式: pick=领料配料, backflush=倒冲, none=不发料';

        UPDATE "apps_master_data_bom" b
        SET "issue_method" = 'none'
        FROM "apps_master_data_materials" m
        WHERE b."component_id" = m."id"
          AND m."source_type" IN ('Phantom', 'Service')
          AND b."deleted_at" IS NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_bom"
            DROP COLUMN IF EXISTS "issue_method";
    """
