"""
不合格品台账：降级回用目标物料/仓库及其他入库单关联字段。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_defect_records"
            ADD COLUMN IF NOT EXISTS "downgrade_material_id" INT,
            ADD COLUMN IF NOT EXISTS "downgrade_material_code" VARCHAR(50),
            ADD COLUMN IF NOT EXISTS "downgrade_material_name" VARCHAR(200),
            ADD COLUMN IF NOT EXISTS "downgrade_material_unit" VARCHAR(20),
            ADD COLUMN IF NOT EXISTS "downgrade_warehouse_id" INT,
            ADD COLUMN IF NOT EXISTS "downgrade_warehouse_name" VARCHAR(100),
            ADD COLUMN IF NOT EXISTS "other_inbound_id" INT;

        COMMENT ON COLUMN "apps_kuaizhizao_defect_records"."downgrade_material_id" IS '降级回用目标原料物料ID';
        COMMENT ON COLUMN "apps_kuaizhizao_defect_records"."downgrade_material_code" IS '降级回用目标原料编码';
        COMMENT ON COLUMN "apps_kuaizhizao_defect_records"."downgrade_material_name" IS '降级回用目标原料名称';
        COMMENT ON COLUMN "apps_kuaizhizao_defect_records"."downgrade_material_unit" IS '降级回用目标原料单位';
        COMMENT ON COLUMN "apps_kuaizhizao_defect_records"."downgrade_warehouse_id" IS '降级回用入库仓库ID';
        COMMENT ON COLUMN "apps_kuaizhizao_defect_records"."downgrade_warehouse_name" IS '降级回用入库仓库名称';
        COMMENT ON COLUMN "apps_kuaizhizao_defect_records"."other_inbound_id" IS '降级回用生成的其他入库单ID';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_defect_records"
            DROP COLUMN IF EXISTS "downgrade_material_id",
            DROP COLUMN IF EXISTS "downgrade_material_code",
            DROP COLUMN IF EXISTS "downgrade_material_name",
            DROP COLUMN IF EXISTS "downgrade_material_unit",
            DROP COLUMN IF EXISTS "downgrade_warehouse_id",
            DROP COLUMN IF EXISTS "downgrade_warehouse_name",
            DROP COLUMN IF EXISTS "other_inbound_id";
    """
