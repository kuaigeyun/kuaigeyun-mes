"""
部门表增加外部系统标识，供企微/飞书/钉钉通讯录同步匹配。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "core_departments"
        ADD COLUMN IF NOT EXISTS "external_source" VARCHAR(32);

        ALTER TABLE "core_departments"
        ADD COLUMN IF NOT EXISTS "external_id" VARCHAR(64);

        COMMENT ON COLUMN "core_departments"."external_source" IS '外部系统来源（如 wecom / feishu / dingtalk）';
        COMMENT ON COLUMN "core_departments"."external_id" IS '外部系统部门 ID';

        CREATE INDEX IF NOT EXISTS "idx_core_departments_external"
        ON "core_departments" ("tenant_id", "external_source", "external_id");

        CREATE UNIQUE INDEX IF NOT EXISTS "uidx_core_departments_tenant_external_active"
        ON "core_departments" ("tenant_id", "external_source", "external_id")
        WHERE "deleted_at" IS NULL
          AND "external_source" IS NOT NULL
          AND "external_id" IS NOT NULL;
        """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "uidx_core_departments_tenant_external_active";
        DROP INDEX IF EXISTS "idx_core_departments_external";
        ALTER TABLE "core_departments" DROP COLUMN IF EXISTS "external_id";
        ALTER TABLE "core_departments" DROP COLUMN IF EXISTS "external_source";
        """
