"""好力 GO — 设备合同/应付款 manufacturer 回填修复（611 遇 NULL 时补跑）。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'haoligo_finance_equipment_contract'
                  AND column_name = 'manufacturer_id'
            ) THEN
                RETURN;
            END IF;
        END $$;

        INSERT INTO "haoligo_manufacturer" ("uuid", "tenant_id", "created_at", "updated_at", "code", "name")
        SELECT
            gen_random_uuid()::text,
            c."tenant_id",
            NOW(),
            NOW(),
            'EQC-R-' || c."id"::text,
            COALESCE(NULLIF(TRIM(c."supplier_name"), ''), '历史合同厂商-' || c."id"::text)
        FROM "haoligo_finance_equipment_contract" c
        WHERE c."deleted_at" IS NULL
          AND c."manufacturer_id" IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM "haoligo_manufacturer" m
            WHERE m."tenant_id" = c."tenant_id"
              AND m."deleted_at" IS NULL
              AND m."code" = 'EQC-R-' || c."id"::text
          );

        UPDATE "haoligo_finance_equipment_contract" c
        SET
            "manufacturer_id" = m."id",
            "manufacturer_code" = m."code",
            "manufacturer_name" = m."name"
        FROM "haoligo_manufacturer" m
        WHERE c."deleted_at" IS NULL
          AND c."manufacturer_id" IS NULL
          AND m."tenant_id" = c."tenant_id"
          AND m."deleted_at" IS NULL
          AND m."code" = 'EQC-R-' || c."id"::text;

        UPDATE "haoligo_finance_equipment_payable" p
        SET
            "manufacturer_id" = c."manufacturer_id",
            "manufacturer_code" = c."manufacturer_code",
            "manufacturer_name" = c."manufacturer_name"
        FROM "haoligo_finance_equipment_contract" c
        WHERE p."contract_id" = c."id"
          AND p."deleted_at" IS NULL
          AND p."manufacturer_id" IS NULL
          AND c."manufacturer_id" IS NOT NULL;

        INSERT INTO "haoligo_manufacturer" ("uuid", "tenant_id", "created_at", "updated_at", "code", "name")
        SELECT
            gen_random_uuid()::text,
            p."tenant_id",
            NOW(),
            NOW(),
            'EQP-R-' || p."id"::text,
            COALESCE(NULLIF(TRIM(p."supplier_name"), ''), '历史应付款厂商-' || p."id"::text)
        FROM "haoligo_finance_equipment_payable" p
        WHERE p."deleted_at" IS NULL
          AND p."manufacturer_id" IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM "haoligo_manufacturer" m
            WHERE m."tenant_id" = p."tenant_id"
              AND m."deleted_at" IS NULL
              AND m."code" = 'EQP-R-' || p."id"::text
          );

        UPDATE "haoligo_finance_equipment_payable" p
        SET
            "manufacturer_id" = m."id",
            "manufacturer_code" = m."code",
            "manufacturer_name" = m."name"
        FROM "haoligo_manufacturer" m
        WHERE p."deleted_at" IS NULL
          AND p."manufacturer_id" IS NULL
          AND m."tenant_id" = p."tenant_id"
          AND m."deleted_at" IS NULL
          AND m."code" = 'EQP-R-' || p."id"::text;

        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'haoligo_finance_equipment_contract'
                  AND column_name = 'supplier_id'
            ) THEN
                IF EXISTS (
                    SELECT 1 FROM "haoligo_finance_equipment_contract"
                    WHERE "deleted_at" IS NULL AND "manufacturer_id" IS NULL
                ) THEN
                    RAISE EXCEPTION '设备合同仍有 manufacturer_id 为空';
                END IF;
                IF EXISTS (
                    SELECT 1 FROM "haoligo_finance_equipment_payable"
                    WHERE "deleted_at" IS NULL AND "manufacturer_id" IS NULL
                ) THEN
                    RAISE EXCEPTION '设备应付款仍有 manufacturer_id 为空';
                END IF;

                ALTER TABLE "haoligo_finance_equipment_contract"
                    DROP CONSTRAINT IF EXISTS "haoligo_finance_equipment_contract_supplier_id_fkey";
                ALTER TABLE "haoligo_finance_equipment_payable"
                    DROP CONSTRAINT IF EXISTS "haoligo_finance_equipment_payable_supplier_id_fkey";
                DROP INDEX IF EXISTS "idx_haoligo_fin_eq_contract_supplier";
                DROP INDEX IF EXISTS "idx_haoligo_fin_eq_payable_supplier";

                ALTER TABLE "haoligo_finance_equipment_contract"
                    DROP COLUMN IF EXISTS "supplier_id",
                    DROP COLUMN IF EXISTS "supplier_name";
                ALTER TABLE "haoligo_finance_equipment_payable"
                    DROP COLUMN IF EXISTS "supplier_id",
                    DROP COLUMN IF EXISTS "supplier_name";
            END IF;
        END $$;

        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'haoligo_finance_equipment_contract'
                  AND column_name = 'manufacturer_id'
                  AND is_nullable = 'YES'
            ) THEN
                ALTER TABLE "haoligo_finance_equipment_contract"
                    ALTER COLUMN "manufacturer_id" SET NOT NULL,
                    ALTER COLUMN "manufacturer_name" SET NOT NULL;
            END IF;
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'haoligo_finance_equipment_payable'
                  AND column_name = 'manufacturer_id'
                  AND is_nullable = 'YES'
            ) THEN
                ALTER TABLE "haoligo_finance_equipment_payable"
                    ALTER COLUMN "manufacturer_id" SET NOT NULL,
                    ALTER COLUMN "manufacturer_name" SET NOT NULL;
            END IF;
        END $$;

        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'haoligo_fin_eq_contract_manufacturer_id_fkey'
            ) THEN
                ALTER TABLE "haoligo_finance_equipment_contract"
                    ADD CONSTRAINT "haoligo_fin_eq_contract_manufacturer_id_fkey"
                    FOREIGN KEY ("manufacturer_id") REFERENCES "haoligo_manufacturer" ("id") ON DELETE RESTRICT;
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'haoligo_fin_eq_payable_manufacturer_id_fkey'
            ) THEN
                ALTER TABLE "haoligo_finance_equipment_payable"
                    ADD CONSTRAINT "haoligo_fin_eq_payable_manufacturer_id_fkey"
                    FOREIGN KEY ("manufacturer_id") REFERENCES "haoligo_manufacturer" ("id") ON DELETE RESTRICT;
            END IF;
        END $$;

        CREATE INDEX IF NOT EXISTS "idx_haoligo_fin_eq_contract_manufacturer"
            ON "haoligo_finance_equipment_contract" ("manufacturer_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_fin_eq_payable_manufacturer"
            ON "haoligo_finance_equipment_payable" ("manufacturer_id");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return ""
