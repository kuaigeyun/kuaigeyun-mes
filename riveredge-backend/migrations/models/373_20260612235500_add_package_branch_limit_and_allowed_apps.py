"""
为套餐新增分支组织上限和应用白名单字段
"""

from tortoise import BaseDBAsyncClient


RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "infra_packages"
        ADD COLUMN IF NOT EXISTS "max_branch_organizations" INT;

        COMMENT ON COLUMN "infra_packages"."max_branch_organizations" IS '最大分支组织数量限制（null=不限制）';

        ALTER TABLE "infra_packages"
        ADD COLUMN IF NOT EXISTS "allowed_app_codes" JSONB NOT NULL DEFAULT '[]'::jsonb;

        COMMENT ON COLUMN "infra_packages"."allowed_app_codes" IS '允许加载的应用编码白名单（空=不限制）';

        UPDATE "infra_packages"
        SET "max_branch_organizations" = 0
        WHERE "plan" = 'trial' AND "max_branch_organizations" IS NULL;

        UPDATE "infra_packages"
        SET "max_branch_organizations" = 1
        WHERE "plan" = 'basic' AND "max_branch_organizations" IS NULL;

        UPDATE "infra_packages"
        SET "max_branch_organizations" = 3
        WHERE "plan" = 'professional' AND "max_branch_organizations" IS NULL;

        UPDATE "infra_packages"
        SET "max_branch_organizations" = 5
        WHERE "plan" = 'enterprise' AND "max_branch_organizations" IS NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "infra_packages" DROP COLUMN IF EXISTS "allowed_app_codes";
        ALTER TABLE "infra_packages" DROP COLUMN IF EXISTS "max_branch_organizations";
    """
