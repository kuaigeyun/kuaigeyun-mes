"""好力 GO — 原设备类别名称仅回填为二级分类。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "haoligo_equipment_category"
        SET
            "level2_category" = COALESCE(NULLIF(TRIM("level2_category"), ''), TRIM("name")),
            "level1_category" = CASE
                WHEN TRIM(COALESCE("level1_category", '')) = TRIM("name")
                 AND (
                    TRIM(COALESCE("level2_category", '')) = TRIM("name")
                    OR TRIM(COALESCE("level2_category", '')) = ''
                 )
                THEN ''
                ELSE TRIM(COALESCE("level1_category", ''))
            END
        WHERE "deleted_at" IS NULL;

        UPDATE "haoligo_equipment_category"
        SET "name" = CASE
            WHEN TRIM(COALESCE("level1_category", '')) <> '' THEN
                TRIM("level1_category") || ' / ' || TRIM("level2_category")
            ELSE TRIM("level2_category")
        END
        WHERE "deleted_at" IS NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "haoligo_equipment_category"
        SET
            "level1_category" = "name",
            "level2_category" = "name"
        WHERE "deleted_at" IS NULL
          AND TRIM(COALESCE("level1_category", '')) = '';
    """
