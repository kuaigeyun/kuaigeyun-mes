"""好力 GO 模具台账：模具寿命改为累计产量上限（小数）；移除维修周期(依天数)。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold"
          ALTER COLUMN "service_life_years" TYPE NUMERIC(18,4)
          USING "service_life_years"::numeric;
        ALTER TABLE "haoligo_mold" DROP COLUMN IF EXISTS "maintenance_cycle_by_days";
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold" ADD COLUMN IF NOT EXISTS "maintenance_cycle_by_days" INT;
        ALTER TABLE "haoligo_mold"
          ALTER COLUMN "service_life_years" TYPE INT
          USING ROUND("service_life_years")::int;
    """
