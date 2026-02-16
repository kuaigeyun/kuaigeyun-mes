"""
为模具表添加维保及校验扩展字段

apps_kuaizhizao_molds 表增加：
- maintenance_interval: 保养间隔（使用次数）
- needs_calibration: 是否需要校验
- calibration_period: 校验周期（天）
- last_calibration_date: 上次校验日期
- next_calibration_date: 下次校验日期

Author: Auto (AI Assistant)
Date: 2026-02-16
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：为模具表添加维保及校验扩展字段
    """
    return """
        DO $migration$
        DECLARE
            tbl_name TEXT := 'apps_kuaizhizao_molds';
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl_name) THEN
                RETURN;
            END IF;

            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = tbl_name AND column_name = 'maintenance_interval') THEN
                EXECUTE format('ALTER TABLE %I ADD COLUMN "maintenance_interval" INT NULL', tbl_name);
                EXECUTE format('COMMENT ON COLUMN %I."maintenance_interval" IS ''保养间隔（使用次数）''', tbl_name);
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = tbl_name AND column_name = 'needs_calibration') THEN
                EXECUTE format('ALTER TABLE %I ADD COLUMN "needs_calibration" BOOLEAN NOT NULL DEFAULT FALSE', tbl_name);
                EXECUTE format('COMMENT ON COLUMN %I."needs_calibration" IS ''是否需要校验''', tbl_name);
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = tbl_name AND column_name = 'calibration_period') THEN
                EXECUTE format('ALTER TABLE %I ADD COLUMN "calibration_period" INT NULL', tbl_name);
                EXECUTE format('COMMENT ON COLUMN %I."calibration_period" IS ''校验周期（天）''', tbl_name);
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = tbl_name AND column_name = 'last_calibration_date') THEN
                EXECUTE format('ALTER TABLE %I ADD COLUMN "last_calibration_date" DATE NULL', tbl_name);
                EXECUTE format('COMMENT ON COLUMN %I."last_calibration_date" IS ''上次校验日期''', tbl_name);
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = tbl_name AND column_name = 'next_calibration_date') THEN
                EXECUTE format('ALTER TABLE %I ADD COLUMN "next_calibration_date" DATE NULL', tbl_name);
                EXECUTE format('COMMENT ON COLUMN %I."next_calibration_date" IS ''下次校验日期''', tbl_name);
            END IF;
        END $migration$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：移除模具表维保及校验扩展字段
    """
    return """
        DO $migration$
        DECLARE
            tbl_name TEXT := 'apps_kuaizhizao_molds';
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl_name) THEN
                RETURN;
            END IF;
            EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS "next_calibration_date"', tbl_name);
            EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS "last_calibration_date"', tbl_name);
            EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS "calibration_period"', tbl_name);
            EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS "needs_calibration"', tbl_name);
            EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS "maintenance_interval"', tbl_name);
        END $migration$;
    """
