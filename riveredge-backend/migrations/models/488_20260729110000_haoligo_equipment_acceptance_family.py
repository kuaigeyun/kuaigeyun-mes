"""
好力 GO — 设备验收单增加设备族字段（注塑机/其它设备单据拆分）。

schema：equipment_family 列（默认 general）
data：已关联台账且一级分类为「注塑机」的验收单回填为 injection
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_equipment_acceptance_sheet"
            ADD COLUMN IF NOT EXISTS "equipment_family" VARCHAR(16) NOT NULL DEFAULT 'general';

        UPDATE "haoligo_equipment_acceptance_sheet" AS a
        SET "equipment_family" = 'injection'
        FROM "haoligo_equipment" AS e
        INNER JOIN "haoligo_equipment_category" AS cat
          ON cat.id = e.category_id AND cat.tenant_id = e.tenant_id
        WHERE a.equipment_id = e.id
          AND a.tenant_id = e.tenant_id
          AND a.deleted_at IS NULL
          AND e.deleted_at IS NULL
          AND cat.level1_category = '注塑机'
          AND COALESCE(a.equipment_family, 'general') <> 'injection';

        UPDATE "haoligo_equipment_acceptance_sheet" AS a
        SET "equipment_family" = 'general'
        FROM "haoligo_equipment" AS e
        INNER JOIN "haoligo_equipment_category" AS cat
          ON cat.id = e.category_id AND cat.tenant_id = e.tenant_id
        WHERE a.equipment_id = e.id
          AND a.tenant_id = e.tenant_id
          AND a.deleted_at IS NULL
          AND e.deleted_at IS NULL
          AND COALESCE(cat.level1_category, '') <> '注塑机'
          AND a.equipment_family = 'injection';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_equipment_acceptance_sheet"
            DROP COLUMN IF EXISTS "equipment_family";
    """
