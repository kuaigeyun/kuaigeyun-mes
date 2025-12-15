"""
BOM管理增强迁移

为BOM表添加版本控制、有效期管理、审核流程等字段。
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 为BOM表添加新字段
        ALTER TABLE "seed_master_data_bom" 
        ADD COLUMN IF NOT EXISTS "version" VARCHAR(50) NOT NULL DEFAULT '1.0',
        ADD COLUMN IF NOT EXISTS "bom_code" VARCHAR(100),
        ADD COLUMN IF NOT EXISTS "effective_date" TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "expiry_date" TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "approval_status" VARCHAR(20) NOT NULL DEFAULT 'draft',
        ADD COLUMN IF NOT EXISTS "approved_by" INT,
        ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "approval_comment" TEXT,
        ADD COLUMN IF NOT EXISTS "remark" TEXT;

        -- 创建新索引
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_bom_bom_code" ON "seed_master_data_bom" ("bom_code");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_bom_version" ON "seed_master_data_bom" ("version");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_bom_approval_status" ON "seed_master_data_bom" ("approval_status");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_bom_effective_date" ON "seed_master_data_bom" ("effective_date");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_bom_expiry_date" ON "seed_master_data_bom" ("expiry_date");
        
        -- 为现有BOM数据设置默认值（如果需要）
        UPDATE "seed_master_data_bom" 
        SET "version" = '1.0' 
        WHERE "version" IS NULL OR "version" = '';
        
        -- 为现有BOM数据生成bom_code（如果为空）
        UPDATE "seed_master_data_bom" 
        SET "bom_code" = 'BOM-' || "material_id"::text || '-' || "id"::text
        WHERE "bom_code" IS NULL OR "bom_code" = '';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 删除索引
        DROP INDEX IF EXISTS "idx_seed_master_data_bom_bom_code";
        DROP INDEX IF EXISTS "idx_seed_master_data_bom_version";
        DROP INDEX IF EXISTS "idx_seed_master_data_bom_approval_status";
        DROP INDEX IF EXISTS "idx_seed_master_data_bom_effective_date";
        DROP INDEX IF EXISTS "idx_seed_master_data_bom_expiry_date";
        
        -- 删除新添加的字段
        ALTER TABLE "seed_master_data_bom" 
        DROP COLUMN IF EXISTS "version",
        DROP COLUMN IF EXISTS "bom_code",
        DROP COLUMN IF EXISTS "effective_date",
        DROP COLUMN IF EXISTS "expiry_date",
        DROP COLUMN IF EXISTS "approval_status",
        DROP COLUMN IF EXISTS "approved_by",
        DROP COLUMN IF EXISTS "approved_at",
        DROP COLUMN IF EXISTS "approval_comment",
        DROP COLUMN IF EXISTS "remark";
    """
