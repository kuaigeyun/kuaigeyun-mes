from tortoise import BaseDBAsyncClient


RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "core_roles"
            ADD COLUMN IF NOT EXISTS "functional_domain" VARCHAR(32);

        UPDATE "core_roles"
        SET "functional_domain" = 'sales'
        WHERE UPPER(TRIM("code")) IN ('SALES_MANAGER', 'SALES_PERSON', 'SALES_OPERATOR')
          AND ("functional_domain" IS NULL OR TRIM("functional_domain") = '');

        UPDATE "core_roles"
        SET "functional_domain" = 'purchase'
        WHERE UPPER(TRIM("code")) IN ('PURCHASE_MANAGER', 'PURCHASE_PERSON', 'PURCHASE_OPERATOR')
          AND ("functional_domain" IS NULL OR TRIM("functional_domain") = '');

        UPDATE "core_roles"
        SET "functional_domain" = 'production'
        WHERE UPPER(TRIM("code")) IN (
            'PRODUCTION_MANAGER', 'PRODUCTION_TEAM_LEADER', 'PRODUCTION_CLERK', 'PRODUCTION_STAFF'
        )
          AND ("functional_domain" IS NULL OR TRIM("functional_domain") = '');

        UPDATE "core_roles"
        SET "functional_domain" = 'warehouse'
        WHERE UPPER(TRIM("code")) IN ('WAREHOUSE_MANAGER', 'WAREHOUSE_OPERATOR')
          AND ("functional_domain" IS NULL OR TRIM("functional_domain") = '');

        UPDATE "core_roles"
        SET "functional_domain" = 'finance'
        WHERE UPPER(TRIM("code")) IN ('FINANCE_MANAGER', 'FINANCE_OPERATOR')
          AND ("functional_domain" IS NULL OR TRIM("functional_domain") = '');

        UPDATE "core_roles"
        SET "functional_domain" = 'quality'
        WHERE UPPER(TRIM("code")) IN ('QUALITY_MANAGER', 'QUALITY_OPERATOR')
          AND ("functional_domain" IS NULL OR TRIM("functional_domain") = '');

        UPDATE "core_roles"
        SET "functional_domain" = 'general'
        WHERE UPPER(TRIM("code")) IN ('ADMIN_OFFICE', 'EMPLOYEE')
          AND ("functional_domain" IS NULL OR TRIM("functional_domain") = '');
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "core_roles" DROP COLUMN IF EXISTS "functional_domain";
    """
