"""好力 GO 模具台账扩展字段（与 Web「新增」表单对齐）"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold" ADD COLUMN IF NOT EXISTS "unit" VARCHAR(32) NOT NULL DEFAULT '';
        ALTER TABLE "haoligo_mold" ADD COLUMN IF NOT EXISTS "mold_capacity" NUMERIC(18,4) NOT NULL DEFAULT 0;
        ALTER TABLE "haoligo_mold" ADD COLUMN IF NOT EXISTS "processing_time_min" INT;
        ALTER TABLE "haoligo_mold" ADD COLUMN IF NOT EXISTS "service_life_years" INT;
        ALTER TABLE "haoligo_mold" ADD COLUMN IF NOT EXISTS "usable_times" INT;
        ALTER TABLE "haoligo_mold" ADD COLUMN IF NOT EXISTS "usable_yield" NUMERIC(18,4);
        ALTER TABLE "haoligo_mold" ADD COLUMN IF NOT EXISTS "maintenance_cycle_by_yield" NUMERIC(18,4);
        ALTER TABLE "haoligo_mold" ADD COLUMN IF NOT EXISTS "maintenance_cycle_by_days" INT;
        ALTER TABLE "haoligo_mold" ADD COLUMN IF NOT EXISTS "allow_repeated_borrow" BOOLEAN NOT NULL DEFAULT TRUE;
        ALTER TABLE "haoligo_mold" ADD COLUMN IF NOT EXISTS "purchase_vendor_name" VARCHAR(200);
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold" DROP COLUMN IF EXISTS "purchase_vendor_name";
        ALTER TABLE "haoligo_mold" DROP COLUMN IF EXISTS "allow_repeated_borrow";
        ALTER TABLE "haoligo_mold" DROP COLUMN IF EXISTS "maintenance_cycle_by_days";
        ALTER TABLE "haoligo_mold" DROP COLUMN IF EXISTS "maintenance_cycle_by_yield";
        ALTER TABLE "haoligo_mold" DROP COLUMN IF EXISTS "usable_yield";
        ALTER TABLE "haoligo_mold" DROP COLUMN IF EXISTS "usable_times";
        ALTER TABLE "haoligo_mold" DROP COLUMN IF EXISTS "service_life_years";
        ALTER TABLE "haoligo_mold" DROP COLUMN IF EXISTS "processing_time_min";
        ALTER TABLE "haoligo_mold" DROP COLUMN IF EXISTS "mold_capacity";
        ALTER TABLE "haoligo_mold" DROP COLUMN IF EXISTS "unit";
    """
