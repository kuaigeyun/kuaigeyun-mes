"""物料分组增加分组代号（alias）字段。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_material_groups"
            ADD COLUMN IF NOT EXISTS "alias" VARCHAR(100);
        COMMENT ON COLUMN "apps_master_data_material_groups"."alias" IS '分组代号（英文展示名，可选）';
        COMMENT ON COLUMN "apps_master_data_material_groups"."code" IS '分组编号（组织内唯一，参与物料编号生成）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_material_groups"
            DROP COLUMN IF EXISTS "alias";
    """
