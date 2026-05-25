"""好力 GO — 设备类别增加一级/二级分类。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_equipment_category"
            ADD COLUMN IF NOT EXISTS "level1_category" VARCHAR(200),
            ADD COLUMN IF NOT EXISTS "level2_category" VARCHAR(200);
        COMMENT ON COLUMN "haoligo_equipment_category"."level1_category" IS '一级分类';
        COMMENT ON COLUMN "haoligo_equipment_category"."level2_category" IS '二级分类';

        UPDATE "haoligo_equipment_category"
        SET
            "level1_category" = COALESCE("level1_category", "name"),
            "level2_category" = COALESCE("level2_category", "name")
        WHERE "level1_category" IS NULL OR "level2_category" IS NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_equipment_category"
            DROP COLUMN IF EXISTS "level2_category",
            DROP COLUMN IF EXISTS "level1_category";
    """
