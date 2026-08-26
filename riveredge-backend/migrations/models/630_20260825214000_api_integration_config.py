"""
core_apis 增加可选应用连接器外键。
"""

from tortoise import BaseDBAsyncClient


RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "core_apis"
            ADD COLUMN IF NOT EXISTS "integration_config_id" INT;
        CREATE INDEX IF NOT EXISTS "idx_core_apis_integration_config_id"
            ON "core_apis" ("integration_config_id");
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'fk_core_apis_integration_config_id'
            ) THEN
                ALTER TABLE "core_apis"
                    ADD CONSTRAINT "fk_core_apis_integration_config_id"
                    FOREIGN KEY ("integration_config_id")
                    REFERENCES "core_integration_configs" ("id")
                    ON DELETE SET NULL;
            END IF;
        END $$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "core_apis" DROP CONSTRAINT IF EXISTS "fk_core_apis_integration_config_id";
        DROP INDEX IF EXISTS "idx_core_apis_integration_config_id";
        ALTER TABLE "core_apis" DROP COLUMN IF EXISTS "integration_config_id";
    """
