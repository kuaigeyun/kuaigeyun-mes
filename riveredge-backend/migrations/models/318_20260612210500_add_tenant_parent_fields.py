"""infra_tenants 增加父子组织字段（两级组织模型）"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "infra_tenants"
            ADD COLUMN IF NOT EXISTS "parent_tenant_id" INT4,
            ADD COLUMN IF NOT EXISTS "is_subtenant" BOOL NOT NULL DEFAULT FALSE;

        CREATE INDEX IF NOT EXISTS "idx_infra_tenants_parent_tenant_id"
            ON "infra_tenants" ("parent_tenant_id");

        CREATE INDEX IF NOT EXISTS "idx_infra_tenants_is_subtenant"
            ON "infra_tenants" ("is_subtenant");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "idx_infra_tenants_is_subtenant";
        DROP INDEX IF EXISTS "idx_infra_tenants_parent_tenant_id";

        ALTER TABLE "infra_tenants"
            DROP COLUMN IF EXISTS "is_subtenant",
            DROP COLUMN IF EXISTS "parent_tenant_id";
    """
