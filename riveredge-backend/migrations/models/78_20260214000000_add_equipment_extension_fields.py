"""
为设备表添加运行及校验扩展字段

apps_kuaizhizao_equipment 表增加：
- total_running_hours: 累计运行小时数
- total_cycle_count: 累计循环次数/冲压次数
- needs_calibration: 是否需要校验
- calibration_period: 校验周期（天）
- last_calibration_date: 上次校验日期
- next_calibration_date: 下次校验日期

Author: Auto (AI Assistant)
Date: 2026-02-14
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：为设备表添加扩展字段
    兼容 core_equipment 和 apps_kuaizhizao_equipment（迁移73可能已重命名）
    """
    return """
        DO $migration$
        DECLARE
            tbl_name TEXT;
        BEGIN
            -- 确定表名（优先 apps_kuaizhizao_equipment）
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'apps_kuaizhizao_equipment') THEN
                tbl_name := 'apps_kuaizhizao_equipment';
            ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'core_equipment') THEN
                tbl_name := 'core_equipment';
            ELSE
                RETURN;
            END IF;

            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = tbl_name AND column_name = 'total_running_hours') THEN
                EXECUTE format('ALTER TABLE %I ADD COLUMN "total_running_hours" INT NOT NULL DEFAULT 0', tbl_name);
                EXECUTE format('COMMENT ON COLUMN %I."total_running_hours" IS ''累计运行小时数''', tbl_name);
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = tbl_name AND column_name = 'total_cycle_count') THEN
                EXECUTE format('ALTER TABLE %I ADD COLUMN "total_cycle_count" INT NOT NULL DEFAULT 0', tbl_name);
                EXECUTE format('COMMENT ON COLUMN %I."total_cycle_count" IS ''累计循环次数/冲压次数''', tbl_name);
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
    降级：移除设备表扩展字段
    """
    return """
        DO $migration$
        DECLARE
            tbl_name TEXT;
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'apps_kuaizhizao_equipment') THEN
                tbl_name := 'apps_kuaizhizao_equipment';
            ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'core_equipment') THEN
                tbl_name := 'core_equipment';
            ELSE
                RETURN;
            END IF;
            EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS "next_calibration_date"', tbl_name);
            EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS "last_calibration_date"', tbl_name);
            EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS "calibration_period"', tbl_name);
            EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS "needs_calibration"', tbl_name);
            EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS "total_cycle_count"', tbl_name);
            EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS "total_running_hours"', tbl_name);
        END $migration$;
    """
