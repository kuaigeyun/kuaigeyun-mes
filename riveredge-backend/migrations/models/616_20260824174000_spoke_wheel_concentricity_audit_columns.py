"""
辐条轮毂同心度检测表 — 补齐审计字段

SpokeWheelConcentricityCheck 模型含 created_by / updated_by 等字段，
614 建表时未写入，导致查询 by-assembly 报 column does not exist。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_spoke_wheel_concentricity_checks"
            ADD COLUMN IF NOT EXISTS "created_by" INT,
            ADD COLUMN IF NOT EXISTS "created_by_name" VARCHAR(100),
            ADD COLUMN IF NOT EXISTS "updated_by" INT,
            ADD COLUMN IF NOT EXISTS "updated_by_name" VARCHAR(100);
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_spoke_wheel_concentricity_checks"
            DROP COLUMN IF EXISTS "updated_by_name",
            DROP COLUMN IF EXISTS "updated_by",
            DROP COLUMN IF EXISTS "created_by_name",
            DROP COLUMN IF EXISTS "created_by";
    """
