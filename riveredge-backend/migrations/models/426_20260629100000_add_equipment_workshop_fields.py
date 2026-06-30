"""
为设备表添加关联车间字段

apps_kuaizhizao_equipment 表增加：
- workshop_id: 关联车间ID
- workshop_name: 关联车间名称
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        DO $migration$
        DECLARE
            tbl_name TEXT;
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'apps_kuaizhizao_equipment'
            ) THEN
                tbl_name := 'apps_kuaizhizao_equipment';
            ELSIF EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'core_equipment'
            ) THEN
                tbl_name := 'core_equipment';
            ELSE
                RETURN;
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = tbl_name AND column_name = 'workshop_id'
            ) THEN
                EXECUTE format('ALTER TABLE %I ADD COLUMN "workshop_id" INT NULL', tbl_name);
                EXECUTE format('COMMENT ON COLUMN %I."workshop_id" IS ''关联车间ID''', tbl_name);
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = tbl_name AND column_name = 'workshop_name'
            ) THEN
                EXECUTE format('ALTER TABLE %I ADD COLUMN "workshop_name" VARCHAR(200) NULL', tbl_name);
                EXECUTE format('COMMENT ON COLUMN %I."workshop_name" IS ''关联车间名称''', tbl_name);
            END IF;

            EXECUTE format(
                'CREATE INDEX IF NOT EXISTS idx_%s_workshop_id ON %I ("workshop_id")',
                replace(tbl_name, '.', '_'),
                tbl_name
            );
        END $migration$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DO $migration$
        DECLARE
            tbl_name TEXT;
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'apps_kuaizhizao_equipment'
            ) THEN
                tbl_name := 'apps_kuaizhizao_equipment';
            ELSIF EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'core_equipment'
            ) THEN
                tbl_name := 'core_equipment';
            ELSE
                RETURN;
            END IF;

            EXECUTE format('DROP INDEX IF EXISTS idx_%s_workshop_id', replace(tbl_name, '.', '_'));
            EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS "workshop_name"', tbl_name);
            EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS "workshop_id"', tbl_name);
        END $migration$;
    """
