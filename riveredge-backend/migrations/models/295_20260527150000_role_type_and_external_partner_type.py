from tortoise import BaseDBAsyncClient


RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "core_roles"
            ADD COLUMN IF NOT EXISTS "role_type" VARCHAR(20) NOT NULL DEFAULT 'internal';
        ALTER TABLE "core_roles"
            ADD COLUMN IF NOT EXISTS "external_partner_type" VARCHAR(20);

        UPDATE "core_roles"
        SET "role_type" = COALESCE(NULLIF(TRIM("role_type"), ''), 'internal')
        WHERE "role_type" IS NULL OR TRIM("role_type") = '';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "core_roles" DROP COLUMN IF EXISTS "external_partner_type";
        ALTER TABLE "core_roles" DROP COLUMN IF EXISTS "role_type";
    """

