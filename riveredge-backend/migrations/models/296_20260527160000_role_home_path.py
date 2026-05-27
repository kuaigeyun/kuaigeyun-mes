"""
角色 UniTabs 首页路径 core_roles.home_path
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "core_roles"
        ADD COLUMN IF NOT EXISTS "home_path" VARCHAR(500) NULL;
        COMMENT ON COLUMN "core_roles"."home_path" IS '角色级 UniTabs 固定首页路由（优先于租户菜单首页）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "core_roles" DROP COLUMN IF EXISTS "home_path";
    """
