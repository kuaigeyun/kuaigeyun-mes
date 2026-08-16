"""
供应商准入状态、资质清单、评级字段。
既有数据默认已准入，避免打断现网采购。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_suppliers"
            ADD COLUMN IF NOT EXISTS "qualification_status" VARCHAR(20) NOT NULL DEFAULT 'approved';
        ALTER TABLE "apps_master_data_suppliers"
            ADD COLUMN IF NOT EXISTS "qualifications" JSONB;
        ALTER TABLE "apps_master_data_suppliers"
            ADD COLUMN IF NOT EXISTS "rating_grade" VARCHAR(8);
        ALTER TABLE "apps_master_data_suppliers"
            ADD COLUMN IF NOT EXISTS "rating_score" DECIMAL(8,2);
        ALTER TABLE "apps_master_data_suppliers"
            ADD COLUMN IF NOT EXISTS "rated_at" TIMESTAMPTZ;
        CREATE INDEX IF NOT EXISTS "idx_md_suppliers_qualification"
            ON "apps_master_data_suppliers" ("tenant_id", "qualification_status");
        CREATE INDEX IF NOT EXISTS "idx_md_suppliers_rating_grade"
            ON "apps_master_data_suppliers" ("tenant_id", "rating_grade");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "idx_md_suppliers_rating_grade";
        DROP INDEX IF EXISTS "idx_md_suppliers_qualification";
        ALTER TABLE "apps_master_data_suppliers" DROP COLUMN IF EXISTS "rated_at";
        ALTER TABLE "apps_master_data_suppliers" DROP COLUMN IF EXISTS "rating_score";
        ALTER TABLE "apps_master_data_suppliers" DROP COLUMN IF EXISTS "rating_grade";
        ALTER TABLE "apps_master_data_suppliers" DROP COLUMN IF EXISTS "qualifications";
        ALTER TABLE "apps_master_data_suppliers" DROP COLUMN IF EXISTS "qualification_status";
    """
