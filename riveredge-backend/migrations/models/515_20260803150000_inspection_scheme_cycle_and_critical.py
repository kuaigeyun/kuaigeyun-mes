"""
点检方案增加周期；方案行增加关键项标记。
"""
from tortoise import BaseDBAsyncClient


RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_equipment_inspection_schemes"
            ADD COLUMN IF NOT EXISTS "cycle_type" VARCHAR(32);
        COMMENT ON COLUMN "apps_kuaizhizao_equipment_inspection_schemes"."cycle_type"
            IS '点检周期（每班/每天/每周/每月/每季度）';

        ALTER TABLE "apps_kuaizhizao_equipment_inspection_scheme_lines"
            ADD COLUMN IF NOT EXISTS "is_critical" BOOLEAN NOT NULL DEFAULT FALSE;
        COMMENT ON COLUMN "apps_kuaizhizao_equipment_inspection_scheme_lines"."is_critical"
            IS '是否关键项（不合格即停用）';
        """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_equipment_inspection_schemes"
            DROP COLUMN IF EXISTS "cycle_type";
        ALTER TABLE "apps_kuaizhizao_equipment_inspection_scheme_lines"
            DROP COLUMN IF EXISTS "is_critical";
        """
