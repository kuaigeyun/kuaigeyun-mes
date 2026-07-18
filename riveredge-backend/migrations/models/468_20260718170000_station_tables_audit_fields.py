"""
工位终端新表补齐 BaseModel 审计字段（created_by / updated_by 等）。

467 建表时未包含这些列，Tortoise 查询会 SELECT updated_by 导致 500。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_operator_skill_qualifications"
            ADD COLUMN IF NOT EXISTS "created_by" INT,
            ADD COLUMN IF NOT EXISTS "created_by_name" VARCHAR(100),
            ADD COLUMN IF NOT EXISTS "updated_by" INT,
            ADD COLUMN IF NOT EXISTS "updated_by_name" VARCHAR(100);

        ALTER TABLE "apps_kuaizhizao_station_shift_handovers"
            ADD COLUMN IF NOT EXISTS "created_by" INT,
            ADD COLUMN IF NOT EXISTS "created_by_name" VARCHAR(100),
            ADD COLUMN IF NOT EXISTS "updated_by" INT,
            ADD COLUMN IF NOT EXISTS "updated_by_name" VARCHAR(100);

        ALTER TABLE "core_user_face_templates"
            ADD COLUMN IF NOT EXISTS "created_by" INT,
            ADD COLUMN IF NOT EXISTS "created_by_name" VARCHAR(100),
            ADD COLUMN IF NOT EXISTS "updated_by" INT,
            ADD COLUMN IF NOT EXISTS "updated_by_name" VARCHAR(100);
        """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_operator_skill_qualifications"
            DROP COLUMN IF EXISTS "created_by",
            DROP COLUMN IF EXISTS "created_by_name",
            DROP COLUMN IF EXISTS "updated_by",
            DROP COLUMN IF EXISTS "updated_by_name";

        ALTER TABLE "apps_kuaizhizao_station_shift_handovers"
            DROP COLUMN IF EXISTS "created_by",
            DROP COLUMN IF EXISTS "created_by_name",
            DROP COLUMN IF EXISTS "updated_by",
            DROP COLUMN IF EXISTS "updated_by_name";

        ALTER TABLE "core_user_face_templates"
            DROP COLUMN IF EXISTS "created_by",
            DROP COLUMN IF EXISTS "created_by_name",
            DROP COLUMN IF EXISTS "updated_by",
            DROP COLUMN IF EXISTS "updated_by_name";
        """
