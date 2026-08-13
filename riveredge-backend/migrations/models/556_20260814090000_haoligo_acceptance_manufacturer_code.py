"""设备验收单快照制造商编码，供厂外厂家 DataScope 按 manufacturer 维度过滤。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_equipment_acceptance_sheet"
            ADD COLUMN IF NOT EXISTS "manufacturer_code" VARCHAR(64);

        UPDATE "haoligo_equipment_acceptance_sheet" AS s
        SET manufacturer_code = m.code
        FROM "haoligo_manufacturer" AS m
        WHERE s.manufacturer_id = m.id
          AND s.tenant_id = m.tenant_id
          AND (s.manufacturer_code IS NULL OR s.manufacturer_code = '');

        CREATE INDEX IF NOT EXISTS "idx_haoligo_acc_mfr_code"
            ON "haoligo_equipment_acceptance_sheet" ("manufacturer_code");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "idx_haoligo_acc_mfr_code";
        ALTER TABLE "haoligo_equipment_acceptance_sheet"
            DROP COLUMN IF EXISTS "manufacturer_code";
    """
