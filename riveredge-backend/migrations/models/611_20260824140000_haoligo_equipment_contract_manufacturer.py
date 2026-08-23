"""好力 GO — 设备合同/应付款：供方从财务材料供应商改为设备制造厂商。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_finance_equipment_contract"
            ADD COLUMN IF NOT EXISTS "manufacturer_id" INT,
            ADD COLUMN IF NOT EXISTS "manufacturer_code" VARCHAR(64),
            ADD COLUMN IF NOT EXISTS "manufacturer_name" VARCHAR(200);

        ALTER TABLE "haoligo_finance_equipment_payable"
            ADD COLUMN IF NOT EXISTS "manufacturer_id" INT,
            ADD COLUMN IF NOT EXISTS "manufacturer_code" VARCHAR(64),
            ADD COLUMN IF NOT EXISTS "manufacturer_name" VARCHAR(200);

        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'haoligo_finance_equipment_contract'
                  AND column_name = 'supplier_id'
            ) THEN
                INSERT INTO "haoligo_manufacturer" ("uuid", "tenant_id", "created_at", "updated_at", "code", "name")
                SELECT
                    gen_random_uuid()::text,
                    fs."tenant_id",
                    NOW(),
                    NOW(),
                    'EQM-' || fs."id"::text,
                    COALESCE(NULLIF(TRIM(fs."supplier_name"), ''), '历史材料供方-' || fs."id"::text)
                FROM "haoligo_finance_supplier" fs
                WHERE fs."id" IN (
                    SELECT DISTINCT c."supplier_id"
                    FROM "haoligo_finance_equipment_contract" c
                    WHERE c."supplier_id" IS NOT NULL
                    UNION
                    SELECT DISTINCT p."supplier_id"
                    FROM "haoligo_finance_equipment_payable" p
                    WHERE p."supplier_id" IS NOT NULL
                )
                  AND NOT EXISTS (
                    SELECT 1
                    FROM "haoligo_manufacturer" m
                    WHERE m."tenant_id" = fs."tenant_id"
                      AND m."deleted_at" IS NULL
                      AND m."code" = 'EQM-' || fs."id"::text
                  );

                UPDATE "haoligo_finance_equipment_contract" c
                SET
                    "manufacturer_id" = m."id",
                    "manufacturer_code" = m."code",
                    "manufacturer_name" = m."name"
                FROM "haoligo_finance_supplier" fs
                JOIN "haoligo_manufacturer" m
                  ON m."tenant_id" = fs."tenant_id"
                 AND m."deleted_at" IS NULL
                 AND m."code" = 'EQM-' || fs."id"::text
                WHERE c."supplier_id" = fs."id"
                  AND c."manufacturer_id" IS NULL;

                UPDATE "haoligo_finance_equipment_payable" p
                SET
                    "manufacturer_id" = m."id",
                    "manufacturer_code" = m."code",
                    "manufacturer_name" = m."name"
                FROM "haoligo_finance_supplier" fs
                JOIN "haoligo_manufacturer" m
                  ON m."tenant_id" = fs."tenant_id"
                 AND m."deleted_at" IS NULL
                 AND m."code" = 'EQM-' || fs."id"::text
                WHERE p."supplier_id" = fs."id"
                  AND p."manufacturer_id" IS NULL;
            END IF;
        END $$;

        INSERT INTO "haoligo_manufacturer" ("uuid", "tenant_id", "created_at", "updated_at", "code", "name")
        SELECT
            gen_random_uuid()::text,
            c."tenant_id",
            NOW(),
            NOW(),
            'EQC-' || c."id"::text,
            '历史合同厂商-' || c."id"::text
        FROM "haoligo_finance_equipment_contract" c
        WHERE c."manufacturer_id" IS NULL
          AND NOT EXISTS (
            SELECT 1
            FROM "haoligo_manufacturer" m
            WHERE m."tenant_id" = c."tenant_id"
              AND m."deleted_at" IS NULL
              AND m."code" = 'EQC-' || c."id"::text
          );

        UPDATE "haoligo_finance_equipment_contract" c
        SET
            "manufacturer_id" = m."id",
            "manufacturer_code" = m."code",
            "manufacturer_name" = m."name"
        FROM "haoligo_manufacturer" m
        WHERE c."manufacturer_id" IS NULL
          AND m."tenant_id" = c."tenant_id"
          AND m."deleted_at" IS NULL
          AND m."code" = 'EQC-' || c."id"::text;

        UPDATE "haoligo_finance_equipment_payable" p
        SET
            "manufacturer_id" = c."manufacturer_id",
            "manufacturer_code" = c."manufacturer_code",
            "manufacturer_name" = c."manufacturer_name"
        FROM "haoligo_finance_equipment_contract" c
        WHERE p."contract_id" = c."id"
          AND p."manufacturer_id" IS NULL
          AND c."manufacturer_id" IS NOT NULL;

        INSERT INTO "haoligo_manufacturer" ("uuid", "tenant_id", "created_at", "updated_at", "code", "name")
        SELECT
            gen_random_uuid()::text,
            p."tenant_id",
            NOW(),
            NOW(),
            'EQP-' || p."id"::text,
            '历史应付款厂商-' || p."id"::text
        FROM "haoligo_finance_equipment_payable" p
        WHERE p."manufacturer_id" IS NULL
          AND NOT EXISTS (
            SELECT 1
            FROM "haoligo_manufacturer" m
            WHERE m."tenant_id" = p."tenant_id"
              AND m."deleted_at" IS NULL
              AND m."code" = 'EQP-' || p."id"::text
          );

        UPDATE "haoligo_finance_equipment_payable" p
        SET
            "manufacturer_id" = m."id",
            "manufacturer_code" = m."code",
            "manufacturer_name" = m."name"
        FROM "haoligo_manufacturer" m
        WHERE p."manufacturer_id" IS NULL
          AND m."tenant_id" = p."tenant_id"
          AND m."deleted_at" IS NULL
          AND m."code" = 'EQP-' || p."id"::text;

        DO $$
        DECLARE
            v_contract_nulls BIGINT;
            v_payable_nulls BIGINT;
        BEGIN
            SELECT COUNT(*) INTO v_contract_nulls
            FROM "haoligo_finance_equipment_contract"
            WHERE "manufacturer_id" IS NULL;

            SELECT COUNT(*) INTO v_payable_nulls
            FROM "haoligo_finance_equipment_payable"
            WHERE "manufacturer_id" IS NULL;

            IF v_contract_nulls > 0 OR v_payable_nulls > 0 THEN
                RAISE EXCEPTION 'manufacturer 回填未完成: contract_nulls=%, payable_nulls=%',
                    v_contract_nulls, v_payable_nulls;
            END IF;
        END $$;

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

        ALTER TABLE "haoligo_finance_equipment_contract"
            ALTER COLUMN "manufacturer_id" SET NOT NULL,
            ALTER COLUMN "manufacturer_name" SET NOT NULL;
        ALTER TABLE "haoligo_finance_equipment_payable"
            ALTER COLUMN "manufacturer_id" SET NOT NULL,
            ALTER COLUMN "manufacturer_name" SET NOT NULL;

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
    return """
        ALTER TABLE "haoligo_finance_equipment_contract"
            DROP CONSTRAINT IF EXISTS "haoligo_fin_eq_contract_manufacturer_id_fkey";
        ALTER TABLE "haoligo_finance_equipment_payable"
            DROP CONSTRAINT IF EXISTS "haoligo_fin_eq_payable_manufacturer_id_fkey";
        DROP INDEX IF EXISTS "idx_haoligo_fin_eq_contract_manufacturer";
        DROP INDEX IF EXISTS "idx_haoligo_fin_eq_payable_manufacturer";

        ALTER TABLE "haoligo_finance_equipment_contract"
            ADD COLUMN IF NOT EXISTS "supplier_id" INT,
            ADD COLUMN IF NOT EXISTS "supplier_name" VARCHAR(200);
        ALTER TABLE "haoligo_finance_equipment_payable"
            ADD COLUMN IF NOT EXISTS "supplier_id" INT,
            ADD COLUMN IF NOT EXISTS "supplier_name" VARCHAR(200);

        ALTER TABLE "haoligo_finance_equipment_contract"
            DROP COLUMN IF EXISTS "manufacturer_id",
            DROP COLUMN IF EXISTS "manufacturer_code",
            DROP COLUMN IF EXISTS "manufacturer_name";
        ALTER TABLE "haoligo_finance_equipment_payable"
            DROP COLUMN IF EXISTS "manufacturer_id",
            DROP COLUMN IF EXISTS "manufacturer_code",
            DROP COLUMN IF EXISTS "manufacturer_name";
    """
