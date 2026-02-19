"""
为 apps_kuaireport_reports 表添加 category 字段

报表中心模型新增 category 字段（system/custom），用于区分系统预置报表和用户自定义报表。
"""
from tortoise import BaseDBAsyncClient


RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaireport_reports" ADD COLUMN IF NOT EXISTS "category" VARCHAR(20) NOT NULL DEFAULT 'custom';
        COMMENT ON COLUMN "apps_kuaireport_reports"."category" IS '报表分类：system（系统报表）/ custom（用户自定义）';
        """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaireport_reports" DROP COLUMN IF EXISTS "category";
        """
