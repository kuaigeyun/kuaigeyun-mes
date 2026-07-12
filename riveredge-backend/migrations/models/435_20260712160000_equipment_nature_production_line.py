"""
设备台账 Phase2：设备性质 + 使用产线（线组）

apps_kuaizhizao_equipment 增加：
- equipment_nature
- production_line_id / production_line_code / production_line_name
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
                WHERE table_schema = 'public' AND table_name = tbl_name AND column_name = 'equipment_nature'
            ) THEN
                EXECUTE format(
                    'ALTER TABLE %I ADD COLUMN "equipment_nature" VARCHAR(50) NULL',
                    tbl_name
                );
                EXECUTE format(
                    'COMMENT ON COLUMN %I."equipment_nature" IS ''设备性质（如通用设备、测量设备）''',
                    tbl_name
                );
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = tbl_name AND column_name = 'production_line_id'
            ) THEN
                EXECUTE format(
                    'ALTER TABLE %I ADD COLUMN "production_line_id" INT NULL',
                    tbl_name
                );
                EXECUTE format(
                    'COMMENT ON COLUMN %I."production_line_id" IS ''使用产线ID（线组）''',
                    tbl_name
                );
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = tbl_name AND column_name = 'production_line_code'
            ) THEN
                EXECUTE format(
                    'ALTER TABLE %I ADD COLUMN "production_line_code" VARCHAR(50) NULL',
                    tbl_name
                );
                EXECUTE format(
                    'COMMENT ON COLUMN %I."production_line_code" IS ''使用产线编码''',
                    tbl_name
                );
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = tbl_name AND column_name = 'production_line_name'
            ) THEN
                EXECUTE format(
                    'ALTER TABLE %I ADD COLUMN "production_line_name" VARCHAR(200) NULL',
                    tbl_name
                );
                EXECUTE format(
                    'COMMENT ON COLUMN %I."production_line_name" IS ''使用产线名称''',
                    tbl_name
                );
            END IF;

            EXECUTE format(
                'CREATE INDEX IF NOT EXISTS idx_%s_equipment_nature ON %I ("equipment_nature")',
                replace(tbl_name, '.', '_'),
                tbl_name
            );
            EXECUTE format(
                'CREATE INDEX IF NOT EXISTS idx_%s_production_line_id ON %I ("production_line_id")',
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

            EXECUTE format('DROP INDEX IF EXISTS idx_%s_production_line_id', replace(tbl_name, '.', '_'));
            EXECUTE format('DROP INDEX IF EXISTS idx_%s_equipment_nature', replace(tbl_name, '.', '_'));
            EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS "production_line_name"', tbl_name);
            EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS "production_line_code"', tbl_name);
            EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS "production_line_id"', tbl_name);
            EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS "equipment_nature"', tbl_name);
        END $migration$;
    """
