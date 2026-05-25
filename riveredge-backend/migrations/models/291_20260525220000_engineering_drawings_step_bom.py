"""
工程图纸表增加 STP BOM 关联字段。

Date: 2026-05-25
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_engineering_drawings"
            ADD COLUMN IF NOT EXISTS "linked_bom_material_id" INT,
            ADD COLUMN IF NOT EXISTS "linked_bom_version" VARCHAR(50),
            ADD COLUMN IF NOT EXISTS "last_step_bom_import_at" TIMESTAMPTZ;

        CREATE INDEX IF NOT EXISTS "idx_eng_drawing_linked_bom_material"
            ON "apps_master_data_engineering_drawings" ("linked_bom_material_id");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "idx_eng_drawing_linked_bom_material";
        ALTER TABLE "apps_master_data_engineering_drawings"
            DROP COLUMN IF EXISTS "linked_bom_material_id",
            DROP COLUMN IF EXISTS "linked_bom_version",
            DROP COLUMN IF EXISTS "last_step_bom_import_at";
    """
