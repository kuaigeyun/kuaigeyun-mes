"""
为 apps_master_data_sop 表添加「工艺路线+BOM 融合」与绑定字段

标准操作SOP 开发计划阶段一：SOP 绑定物料/物料组、工艺路线载入、BOM 载入方式。
仅改造 SOP 表，不改动工艺路线与 BOM 表。

新增字段：
- material_group_uuids: 绑定的物料组 UUID 列表（JSONB 数组）
- material_uuids: 绑定的具体物料 UUID 列表（JSONB 数组），匹配时优先于物料组
- route_uuids: 载入的工艺路线 UUID 列表（JSONB 数组），作为融合输入
- bom_load_mode: BOM 载入方式（by_material / by_material_group / specific_bom）
- specific_bom_uuid: 指定 BOM 的 UUID（当 bom_load_mode 为 specific_bom 时使用）

Author: 标准操作SOP开发计划
Date: 2026-01-27
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        DO $$
        BEGIN
            -- material_group_uuids
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'apps_master_data_sop'
                AND column_name = 'material_group_uuids'
            ) THEN
                ALTER TABLE apps_master_data_sop ADD COLUMN material_group_uuids JSONB DEFAULT NULL;
                COMMENT ON COLUMN apps_master_data_sop.material_group_uuids IS '绑定的物料组 UUID 列表（JSON 数组），供工单/报工按物料组匹配 SOP';
            END IF;

            -- material_uuids
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'apps_master_data_sop'
                AND column_name = 'material_uuids'
            ) THEN
                ALTER TABLE apps_master_data_sop ADD COLUMN material_uuids JSONB DEFAULT NULL;
                COMMENT ON COLUMN apps_master_data_sop.material_uuids IS '绑定的具体物料 UUID 列表（JSON 数组），匹配时优先于物料组';
            END IF;

            -- route_uuids
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'apps_master_data_sop'
                AND column_name = 'route_uuids'
            ) THEN
                ALTER TABLE apps_master_data_sop ADD COLUMN route_uuids JSONB DEFAULT NULL;
                COMMENT ON COLUMN apps_master_data_sop.route_uuids IS '载入的工艺路线 UUID 列表（JSON 数组），作为融合输入';
            END IF;

            -- bom_load_mode
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'apps_master_data_sop'
                AND column_name = 'bom_load_mode'
            ) THEN
                ALTER TABLE apps_master_data_sop ADD COLUMN bom_load_mode VARCHAR(32) DEFAULT 'by_material';
                COMMENT ON COLUMN apps_master_data_sop.bom_load_mode IS 'BOM 载入方式：by_material=按关联物料, by_material_group=按关联物料组, specific_bom=指定BOM';
            END IF;

            -- specific_bom_uuid
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'apps_master_data_sop'
                AND column_name = 'specific_bom_uuid'
            ) THEN
                ALTER TABLE apps_master_data_sop ADD COLUMN specific_bom_uuid VARCHAR(36) DEFAULT NULL;
                COMMENT ON COLUMN apps_master_data_sop.specific_bom_uuid IS '指定 BOM 的 UUID（当 bom_load_mode 为 specific_bom 时使用）';
            END IF;
        END $$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'apps_master_data_sop' AND column_name = 'material_group_uuids') THEN
                ALTER TABLE apps_master_data_sop DROP COLUMN material_group_uuids;
            END IF;
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'apps_master_data_sop' AND column_name = 'material_uuids') THEN
                ALTER TABLE apps_master_data_sop DROP COLUMN material_uuids;
            END IF;
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'apps_master_data_sop' AND column_name = 'route_uuids') THEN
                ALTER TABLE apps_master_data_sop DROP COLUMN route_uuids;
            END IF;
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'apps_master_data_sop' AND column_name = 'bom_load_mode') THEN
                ALTER TABLE apps_master_data_sop DROP COLUMN bom_load_mode;
            END IF;
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'apps_master_data_sop' AND column_name = 'specific_bom_uuid') THEN
                ALTER TABLE apps_master_data_sop DROP COLUMN specific_bom_uuid;
            END IF;
        END $$;
    """
