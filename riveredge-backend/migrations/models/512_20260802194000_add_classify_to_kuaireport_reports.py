"""
为 apps_kuaireport_reports 表添加 classify 业务分类字段

用于报表中心卡片视图按分类分组；与 category（system/custom 页签归属）分离。
"""
from tortoise import BaseDBAsyncClient


RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaireport_reports" ADD COLUMN IF NOT EXISTS "classify" VARCHAR(50) NOT NULL DEFAULT '未分类';
        COMMENT ON COLUMN "apps_kuaireport_reports"."classify" IS '业务分类（销售/采购/生产等，用于列表分组）';
        CREATE INDEX IF NOT EXISTS "idx_kuaireport_reports_tenant_classify" ON "apps_kuaireport_reports" ("tenant_id", "classify");
        """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "idx_kuaireport_reports_tenant_classify";
        ALTER TABLE "apps_kuaireport_reports" DROP COLUMN IF EXISTS "classify";
        """
